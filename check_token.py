"""Check GitHub token scopes."""
import urllib.request, json, os

with open('.env') as f:
    TOKEN = [line.split('=')[1].strip() for line in f if line.startswith('GITHUB_TOKEN=')][0]

headers = {
    "User-Agent": "SentinelOps",
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}",
}

req = urllib.request.Request("https://api.github.com/user", headers=headers)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        scopes = r.headers.get("X-OAuth-Scopes", "none")
        body = json.loads(r.read())
        print(f"User: {body.get('login')}")
        print(f"Token scopes: {scopes}")
except Exception as e:
    print(f"Error: {e}")

# Try creating a branch directly
import urllib.error
REPO = "naveenkumar030/testingrepo"
print(f"\nTesting write access to {REPO}...")

# First get main SHA
req2 = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/git/ref/heads/main",
    headers=headers
)
try:
    with urllib.request.urlopen(req2, timeout=10) as r:
        data = json.loads(r.read())
        sha = data["object"]["sha"]
        print(f"main SHA: {sha[:8]}")
        
    # Try to create a test branch
    payload = json.dumps({"ref": "refs/heads/sentinelops/test-write", "sha": sha}).encode()
    req3 = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/git/refs",
        data=payload,
        headers={**headers, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req3, timeout=10) as r:
            print(f"Write test: SUCCESS (HTTP {r.status})")
    except urllib.error.HTTPError as e:
        print(f"Write test FAILED: HTTP {e.code} - {e.read().decode()[:200]}")

except Exception as ex:
    print(f"Error: {ex}")
