"""
Centralized LLM Resilience Manager for SentinelOps (Phase 6).
Orchestrates:
1. Provider Fallback Chain: Groq -> Gemini -> Ollama -> Heuristics / Fail-Closed
2. Exponential Backoff with Jitter & Status-Code Discrimination
3. Circuit Breaker integration (CLOSED / OPEN / HALF_OPEN)
4. Telemetry Recording (requests, retries, fallbacks, latencies, tokens)
5. Strict Timeouts (SENTINEL_LLM_TIMEOUT)
"""

import os
import json
import time
import random
import logging
import requests
from typing import Optional, Dict, Any, List, Tuple
from config import Config
from services.resilience.circuit_breaker import circuit_breaker_registry, CircuitState
from services.resilience.reliability_telemetry import reliability_telemetry

logger = logging.getLogger("sentinel.resilience.llm_manager")


class LLMResilienceManager:
    """
    Robust LLM client with retries, exponential backoff, circuit breaking,
    multi-provider fallback, and detailed telemetry.
    """

    def __init__(self):
        self.groq_api_key = getattr(Config, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")
        self.gemini_api_key = getattr(Config, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
        self.openai_api_key = getattr(Config, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY")
        self.ollama_enabled = getattr(Config, "SENTINEL_OLLAMA_ENABLED", False)
        self.ollama_endpoint = getattr(Config, "SENTINEL_OLLAMA_ENDPOINT", "http://localhost:11434")
        self.ollama_model = getattr(Config, "SENTINEL_OLLAMA_MODEL", "llama3")

        self.primary_provider = getattr(Config, "SENTINEL_PRIMARY_LLM", "groq").lower()
        self.fallback_provider = getattr(Config, "SENTINEL_FALLBACK_LLM", "gemini").lower()
        self.max_retries = int(getattr(Config, "SENTINEL_LLM_MAX_RETRIES", 3))
        self.default_timeout = float(getattr(Config, "SENTINEL_LLM_TIMEOUT", 30))

    def _get_provider_chain(self) -> List[str]:
        """Builds the ordered list of LLM providers to attempt."""
        chain = []
        if self.primary_provider:
            chain.append(self.primary_provider)
        if self.fallback_provider and self.fallback_provider not in chain:
            chain.append(self.fallback_provider)
        # Add OpenAI if configured and not already in chain
        if self.openai_api_key and "openai" not in chain:
            chain.append("openai")
        # Add Ollama if enabled
        if self.ollama_enabled and "ollama" not in chain:
            chain.append("ollama")
        return chain

    def _calculate_backoff(self, attempt: int, base: float = 0.5, max_delay: float = 4.0) -> float:
        """Calculates exponential backoff delay with jitter."""
        delay = min(base * (2 ** (attempt - 1)), max_delay)
        jitter = random.uniform(0.05, 0.25) * delay
        return delay + jitter

    def _is_permanent_error(self, status_code: Optional[int], error_str: str) -> bool:
        """Identifies permanent client errors that should NOT be retried."""
        if status_code in (400, 401, 403, 404):
            return True
        err_lower = error_str.lower()
        if "invalid_api_key" in err_lower or "unauthorized" in err_lower or "authentication" in err_lower:
            return True
        return False

    def _call_groq(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        json_mode: bool,
    ) -> Tuple[Optional[str], Optional[int], int]:
        """
        Executes raw Groq LLM call.
        Returns (content, status_code, approx_tokens).
        """
        if not self.groq_api_key or self.groq_api_key == "mock-groq-key":
            return None, 401, 0

        from groq import Groq
        client = Groq(api_key=self.groq_api_key, timeout=timeout)
        kwargs: Dict[str, Any] = {
            "model": "openai/gpt-oss-120b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "timeout": timeout,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        completion = client.chat.completions.create(**kwargs)
        content = completion.choices[0].message.content
        tokens = 0
        if hasattr(completion, "usage") and completion.usage:
            tokens = getattr(completion.usage, "total_tokens", 0)
        return content, 200, tokens

    def _call_gemini(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        json_mode: bool,
    ) -> Tuple[Optional[str], Optional[int], int]:
        """
        Executes raw Gemini REST call.
        """
        if not self.gemini_api_key or self.gemini_api_key == "mock-gemini-key":
            return None, 401, 0

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
        full_prompt = f"{system_prompt}\n\nUser:\n{user_prompt}"
        if json_mode:
            full_prompt += "\n\nRespond ONLY with valid, raw JSON."

        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"temperature": temperature},
        }

        resp = requests.post(url, json=payload, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)
                return content, 200, tokens
            return None, 200, 0
        return None, resp.status_code, 0

    def _call_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        json_mode: bool,
    ) -> Tuple[Optional[str], Optional[int], int]:
        """
        Executes raw OpenAI REST call.
        """
        if not self.openai_api_key:
            return None, 401, 0

        headers = {"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return content, 200, tokens
        return None, resp.status_code, 0

    def _call_ollama(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        json_mode: bool,
    ) -> Tuple[Optional[str], Optional[int], int]:
        """
        Executes local Ollama call.
        """
        url = f"{self.ollama_endpoint.rstrip('/')}/api/generate"
        payload = {
            "model": self.ollama_model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if json_mode:
            payload["format"] = "json"

        resp = requests.post(url, json=payload, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("response", ""), 200, data.get("eval_count", 0)
        return None, resp.status_code, 0

    def _dispatch_provider(
        self,
        provider: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        timeout: float,
        json_mode: bool,
    ) -> Tuple[Optional[str], Optional[int], int]:
        """Dispatches request to specific provider implementation."""
        p = provider.lower().strip()
        if p == "groq":
            return self._call_groq(system_prompt, user_prompt, temperature, timeout, json_mode)
        elif p == "gemini":
            return self._call_gemini(system_prompt, user_prompt, temperature, timeout, json_mode)
        elif p == "openai":
            return self._call_openai(system_prompt, user_prompt, temperature, timeout, json_mode)
        elif p == "ollama":
            return self._call_ollama(system_prompt, user_prompt, temperature, timeout, json_mode)
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    def execute_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        timeout: Optional[float] = None,
        json_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes LLM completion with retries, exponential backoff, circuit breaking,
        and multi-provider fallback.
        """
        call_timeout = timeout if timeout is not None else self.default_timeout
        providers = self._get_provider_chain()
        last_error = None
        total_retries = 0
        provider_attempts: List[str] = []

        start_time = time.time()

        for idx, provider in enumerate(providers):
            provider_attempts.append(provider)

            # Check Circuit Breaker
            if not circuit_breaker_registry.allow_request(provider):
                logger.warning(
                    f"Provider '{provider}' circuit is OPEN / cooling down. Skipping to fallback."
                )
                reliability_telemetry.record_circuit_trip(provider)
                if idx + 1 < len(providers):
                    reliability_telemetry.record_fallback(provider, providers[idx + 1], "circuit_open")
                continue

            for attempt in range(1, self.max_retries + 1):
                t0 = time.time()
                try:
                    content, status_code, tokens = self._dispatch_provider(
                        provider=provider,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        temperature=temperature,
                        timeout=call_timeout,
                        json_mode=json_mode,
                    )

                    # Success check
                    if content is not None and (status_code == 200 or status_code is None):
                        latency_ms = (time.time() - t0) * 1000.0
                        circuit_breaker_registry.record_success(provider)
                        reliability_telemetry.record_llm_request(
                            provider=provider,
                            success=True,
                            latency_ms=latency_ms,
                            tokens_used=tokens,
                        )
                        return {
                            "success": True,
                            "content": content,
                            "provider_used": provider,
                            "attempts": attempt,
                            "retries_taken": total_retries,
                            "fallback_occurred": idx > 0,
                            "provider_chain": provider_attempts,
                            "tokens_used": tokens,
                            "latency_ms": latency_ms,
                            "error": None,
                        }

                    # Non-successful HTTP status code
                    err_msg = f"HTTP {status_code}"
                    last_error = err_msg

                    if self._is_permanent_error(status_code, err_msg):
                        logger.warning(
                            f"Provider '{provider}' permanent client error ({status_code}). Not retrying."
                        )
                        circuit_breaker_registry.record_failure(provider, Exception(err_msg))
                        reliability_telemetry.record_llm_request(provider=provider, success=False)
                        break  # Break inner retry loop, trigger next provider

                    # Transient error -> retry if attempts remaining
                    if attempt < self.max_retries:
                        total_retries += 1
                        backoff = self._calculate_backoff(attempt)
                        logger.info(
                            f"Provider '{provider}' transient error ({status_code}). Retrying attempt {attempt+1}/{self.max_retries} in {backoff:.2f}s..."
                        )
                        reliability_telemetry.record_retry(provider, err_msg, attempt, backoff)
                        time.sleep(backoff)
                    else:
                        circuit_breaker_registry.record_failure(provider, Exception(err_msg))
                        reliability_telemetry.record_llm_request(provider=provider, success=False)

                except Exception as e:
                    err_msg = str(e)
                    last_error = err_msg
                    logger.warning(f"Provider '{provider}' exception on attempt {attempt}: {err_msg}")

                    if self._is_permanent_error(None, err_msg):
                        circuit_breaker_registry.record_failure(provider, e)
                        reliability_telemetry.record_llm_request(provider=provider, success=False)
                        break

                    if attempt < self.max_retries:
                        total_retries += 1
                        backoff = self._calculate_backoff(attempt)
                        reliability_telemetry.record_retry(provider, err_msg, attempt, backoff)
                        time.sleep(backoff)
                    else:
                        circuit_breaker_registry.record_failure(provider, e)
                        reliability_telemetry.record_llm_request(provider=provider, success=False)

            # Record fallback route if we failed this provider and have another
            if idx + 1 < len(providers):
                reliability_telemetry.record_fallback(provider, providers[idx + 1], str(last_error))

        # All providers exhausted
        logger.error(f"All LLM providers exhausted in fallback chain: {providers}. Final error: {last_error}")
        return {
            "success": False,
            "content": None,
            "provider_used": "none",
            "retries_taken": total_retries,
            "fallback_occurred": True,
            "provider_chain": provider_attempts,
            "tokens_used": 0,
            "latency_ms": (time.time() - start_time) * 1000.0,
            "error": f"All LLM providers failed: {last_error}",
        }

    def call_llm_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        timeout: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Executes LLM completion and parses JSON output safely.
        Returns parsed dict or None on failure.
        """
        result = self.execute_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            timeout=timeout,
            json_mode=True,
        )
        if not result["success"] or not result["content"]:
            return None

        raw = result["content"].strip()
        # Clean markdown codeblocks if returned
        if raw.startswith("```json"):
            raw = raw[7:]
        elif raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM JSON output: {e}. Raw content: {raw[:200]}")
            return None


# Singleton instance
llm_resilience_manager = LLMResilienceManager()
