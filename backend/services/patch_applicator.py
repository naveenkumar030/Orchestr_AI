"""
Patch Applicator Service for SentinelOps.
Rigorously parses standard unified diffs, validates context lines against actual
repository file contents, applies hunk modifications in memory, and produces
the resulting complete source file contents.

Guarantees:
1. NEVER writes a unified diff string directly into a source file.
2. Validates every context line and deletion line against the target file.
3. Rejects the patch if context does not match, lines were modified elsewhere,
   or target file is missing.
4. Strips any Markdown backtick fences or conversational wrapper text around diffs.
5. Returns structured result with resulting_files dict mapping path -> complete updated content.
"""

import logging
import re
from typing import Any, Callable

logger = logging.getLogger("sentinelops.patch_applicator")


class Hunk:
    """Represents a single unified diff hunk: @@ -old_start,old_count +new_start,new_count @@"""

    def __init__(self, old_start: int, old_count: int, new_start: int, new_count: int):
        self.old_start = old_start
        self.old_count = old_count
        self.new_start = new_start
        self.new_count = new_count
        self.lines: list[tuple[str, str]] = []  # (' ' | '-' | '+', content)

    def add_line(self, line_type: str, content: str):
        self.lines.append((line_type, content))


class FilePatch:
    """Represents changes for a single file in a unified diff."""

    def __init__(self, old_file: str, new_file: str):
        self.old_file = old_file
        self.new_file = new_file
        self.hunks: list[Hunk] = []
        self.is_new_file = old_file == "/dev/null" or old_file == ""
        self.is_deleted_file = new_file == "/dev/null" or new_file == ""


class PatchApplicator:
    """
    Deterministic patch parser and applicator for unified diffs.
    """

    def clean_diff_text(self, diff_text: str) -> str:
        """
        Cleans conversational prefixes, markdown code fences, and whitespace
        to isolate the raw unified diff.
        """
        if not diff_text or not isinstance(diff_text, str):
            return ""

        text = diff_text.strip()

        # Remove markdown code blocks if present
        if "```" in text:
            # Extract content inside ```diff ... ``` or first code fence
            fence_match = re.search(r"```(?:diff)?\s*\n([\s\S]+?)\n```", text)
            if fence_match:
                text = fence_match.group(1).strip()
            else:
                # Strip leading and trailing fences
                text = re.sub(r"^```(?:diff)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)

        # Remove any conversational text before the first '--- ' line
        diff_start = text.find("--- ")
        if diff_start > 0:
            text = text[diff_start:]

        return text.strip()

    def parse_unified_diff(self, raw_diff: str) -> list[FilePatch]:
        """
        Parses a unified diff string into a list of FilePatch objects.
        """
        clean_text = self.clean_diff_text(raw_diff)
        if not clean_text:
            return []

        lines = clean_text.splitlines()
        file_patches: list[FilePatch] = []
        current_file_patch: FilePatch | None = None
        current_hunk: Hunk | None = None

        i = 0
        while i < len(lines):
            line = lines[i]

            # File header: --- a/path
            if line.startswith("--- "):
                old_path = line[4:].strip()
                if old_path.startswith("a/"):
                    old_path = old_path[2:]

                # Next line must be +++ b/path
                new_path = old_path
                if i + 1 < len(lines) and lines[i + 1].startswith("+++ "):
                    i += 1
                    new_line = lines[i]
                    new_path = new_line[4:].strip()
                    if new_path.startswith("b/"):
                        new_path = new_path[2:]

                current_file_patch = FilePatch(old_file=old_path, new_file=new_path)
                file_patches.append(current_file_patch)
                current_hunk = None
                i += 1
                continue

            # Hunk header: @@ -old_start,old_count +new_start,new_count @@
            hunk_match = re.match(r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@", line)
            if hunk_match:
                old_start = int(hunk_match.group(1))
                old_count = int(hunk_match.group(2)) if hunk_match.group(2) is not None else 1
                new_start = int(hunk_match.group(3))
                new_count = int(hunk_match.group(4)) if hunk_match.group(4) is not None else 1

                current_hunk = Hunk(old_start, old_count, new_start, new_count)
                if current_file_patch:
                    current_file_patch.hunks.append(current_hunk)
                i += 1
                continue

            # Hunk body line
            if current_hunk is not None:
                if line.startswith("+"):
                    current_hunk.add_line("+", line[1:])
                elif line.startswith("-"):
                    current_hunk.add_line("-", line[1:])
                elif line.startswith(" "):
                    current_hunk.add_line(" ", line[1:])
                elif line == "":
                    # Empty line in diff can be an empty context line
                    current_hunk.add_line(" ", "")
                else:
                    # Line doesn't start with space, +, or -
                    # Could be end of diff or malformed line
                    pass

            i += 1

        return file_patches

    def apply_file_patch(
        self,
        original_content: str,
        file_patch: FilePatch,
    ) -> tuple[bool, str, str, int, int]:
        """
        Applies a FilePatch to the original content string.
        Returns (success, resulting_content, error_reason, lines_added, lines_removed).
        """
        # Case 1: New file creation
        if file_patch.is_new_file:
            new_lines = []
            lines_added = 0
            for hunk in file_patch.hunks:
                for prefix, content in hunk.lines:
                    if prefix == "+":
                        new_lines.append(content)
                        lines_added += 1
            return True, "\n".join(new_lines) + ("\n" if new_lines else ""), "", lines_added, 0

        # Normal file modification
        orig_lines = original_content.splitlines()
        total_orig_lines = len(orig_lines)
        result_lines: list[str] = []
        orig_idx = 0
        total_lines_added = 0
        total_lines_removed = 0

        for hunk_num, hunk in enumerate(file_patch.hunks, start=1):
            target_start = max(0, hunk.old_start - 1)

            # Context verification helper
            def matches_at(offset: int) -> bool:
                curr = offset
                for prefix, line in hunk.lines:
                    if prefix in (" ", "-"):
                        if curr >= total_orig_lines or orig_lines[curr] != line:
                            return False
                        curr += 1
                return True

            # Check if context matches exactly at target_start
            actual_start = target_start
            if not matches_at(target_start):
                # Try small sliding window search (+/- 5 lines) to handle offset drift
                found = False
                for delta in range(1, 6):
                    if target_start - delta >= 0 and matches_at(target_start - delta):
                        actual_start = target_start - delta
                        found = True
                        break
                    if target_start + delta < total_orig_lines and matches_at(target_start + delta):
                        actual_start = target_start + delta
                        found = True
                        break
                if not found:
                    expected_first = next(
                        (l for p, l in hunk.lines if p in (" ", "-")), ""
                    )
                    found_line = orig_lines[target_start] if target_start < total_orig_lines else "<EOF>"
                    return (
                        False,
                        "",
                        (
                            f"Hunk #{hunk_num} context does not match {file_patch.new_file} at line {hunk.old_start}. "
                            f"Expected: '{expected_first[:60]}' | Found: '{found_line[:60]}'"
                        ),
                        0,
                        0,
                    )

            # Copy unchanged lines up to actual_start
            while orig_idx < actual_start:
                result_lines.append(orig_lines[orig_idx])
                orig_idx += 1

            # Apply hunk operations
            for prefix, line in hunk.lines:
                if prefix == " ":
                    # Context line: keep original
                    if orig_idx < total_orig_lines and orig_lines[orig_idx] == line:
                        result_lines.append(orig_lines[orig_idx])
                        orig_idx += 1
                    else:
                        result_lines.append(line)
                        orig_idx += 1
                elif prefix == "-":
                    # Removed line: skip from original
                    if orig_idx < total_orig_lines:
                        orig_idx += 1
                    total_lines_removed += 1
                elif prefix == "+":
                    # Added line: insert into output
                    result_lines.append(line)
                    total_lines_added += 1

        # Copy any remaining original lines after the last hunk
        while orig_idx < total_orig_lines:
            result_lines.append(orig_lines[orig_idx])
            orig_idx += 1

        # Preserve trailing newline if original had one
        has_trailing_newline = original_content.endswith("\n") or total_orig_lines == 0
        resulting_text = "\n".join(result_lines)
        if has_trailing_newline:
            resulting_text += "\n"

        return True, resulting_text, "", total_lines_added, total_lines_removed

    def apply_patch(
        self,
        patch_str: str,
        file_provider: Callable[[str], str | None],
        fallback_target_file: str | None = None,
    ) -> dict[str, Any]:
        """
        Parses and applies a unified diff patch across all modified files.

        Parameters:
        - patch_str: Unified diff string (starts with --- a/... +++ b/...)
        - file_provider: Callable that takes a relative file path and returns current content (or None)
        - fallback_target_file: Optional path if patch does not include --- headers

        Returns:
        {
          "applied": True/False,
          "files_changed": ["services/auth.py"],
          "resulting_files": {"services/auth.py": "<complete new source>"},
          "lines_added": 5,
          "lines_removed": 2,
          "reason": "<error description if applied is False>"
        }
        """
        if not patch_str or not isinstance(patch_str, str) or not patch_str.strip():
            return {
                "applied": False,
                "reason": "Patch content is empty or invalid",
                "files_changed": [],
                "resulting_files": {},
                "lines_added": 0,
                "lines_removed": 0,
            }

        file_patches = self.parse_unified_diff(patch_str)

        # Handle diff without headers if fallback_target_file is provided
        if not file_patches and fallback_target_file:
            clean_patch = f"--- a/{fallback_target_file}\n+++ b/{fallback_target_file}\n@@ -1,1 +1,1 @@\n" + patch_str
            file_patches = self.parse_unified_diff(clean_patch)

        if not file_patches:
            return {
                "applied": False,
                "reason": "Could not parse any valid unified diff hunks from patch",
                "files_changed": [],
                "resulting_files": {},
                "lines_added": 0,
                "lines_removed": 0,
            }

        resulting_files: dict[str, str] = {}
        files_changed: list[str] = []
        total_added = 0
        total_removed = 0

        for fp in file_patches:
            target_path = fp.new_file or fp.old_file
            if not target_path or target_path == "/dev/null":
                target_path = fp.old_file

            target_clean = target_path.strip().replace("\\", "/")

            # Fetch current file content
            orig_content = file_provider(target_clean)

            if orig_content is None:
                if fp.is_new_file:
                    orig_content = ""
                else:
                    return {
                        "applied": False,
                        "reason": f"Target file '{target_clean}' does not exist in repository",
                        "files_changed": [],
                        "resulting_files": {},
                        "lines_added": 0,
                        "lines_removed": 0,
                    }

            success, modified_content, err_msg, added, removed = self.apply_file_patch(
                original_content=orig_content,
                file_patch=fp,
            )

            if not success:
                logger.warning("Patch application failed on %s: %s", target_clean, err_msg)
                return {
                    "applied": False,
                    "status": "PATCH_FAILED",
                    "reason": err_msg,
                    "error": err_msg,
                    "files_changed": [],
                    "resulting_files": {},
                    "lines_added": 0,
                    "lines_removed": 0,
                    "git_diff": "",
                }

            resulting_files[target_clean] = modified_content
            files_changed.append(target_clean)
            total_added += added
            total_removed += removed

        # Generate verified git diff for all resulting files
        all_diffs = []
        for path in files_changed:
            orig = file_provider(path) or ""
            mod = resulting_files.get(path, "")
            all_diffs.append(self.generate_git_diff(orig, mod, path))

        return {
            "applied": True,
            "status": "PATCH_APPLIED",
            "files_changed": files_changed,
            "resulting_files": resulting_files,
            "lines_added": total_added,
            "lines_removed": total_removed,
            "git_diff": "\n".join(d for d in all_diffs if d),
            "reason": "",
            "error": "",
        }

    def generate_git_diff(self, original_content: str, modified_content: str, file_path: str) -> str:
        """Generates real git-format unified diff between original and resulting files."""
        import difflib
        clean_path = file_path.strip().replace("\\", "/").lstrip("/")
        orig_lines = original_content.splitlines(keepends=True)
        mod_lines = modified_content.splitlines(keepends=True)
        diff = difflib.unified_diff(
            orig_lines,
            mod_lines,
            fromfile=f"a/{clean_path}",
            tofile=f"b/{clean_path}",
        )
        return "".join(diff)


# Singleton patch applicator instance
patch_applicator = PatchApplicator()

