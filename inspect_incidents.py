import json, sys

with open('incidents_dump.json') as f:
    data = json.load(f)

print(f"Total incidents: {len(data)}")
print()
for i in data[:30]:
    inc_id = i.get("id", "?")
    src = i.get("source", "?")
    repo = i.get("repo", "?")
    run_id = i.get("runId", "?")
    status = i.get("status", "?")
    failure = i.get("failure", "?")
    print(f"  {inc_id:<30} src={src:<8} repo={repo:<20} runId={run_id:<15} status={status}")
