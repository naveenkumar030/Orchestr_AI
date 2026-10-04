import json

with open('real_runs.json') as f:
    d = json.load(f)

runs = d.get('workflow_runs', [])
print(f"Total runs fetched: {len(runs)}")
for r in runs:
    run_id = r["id"]
    name = r["name"]
    conclusion = r["conclusion"]
    branch = r["head_branch"]
    sha = r["head_sha"][:7]
    created = r["created_at"]
    print(f"  ID={run_id} | {name} | conclusion={conclusion} | branch={branch} | sha={sha} | created={created}")
