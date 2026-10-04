import os, json, urllib.request, time

with open('.env') as f:
    token = [line.split('=')[1].strip() for line in f if line.startswith('GITHUB_TOKEN=')][0]

headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github.v3+json'}

# Trigger workflow
url = 'https://api.github.com/repos/naveenkumar030/testingrepo/actions/workflows/365297498/dispatches'
req = urllib.request.Request(url, headers=headers, method='POST', data=json.dumps({'ref': 'sentinelops/fix-36114116056'}).encode())
try:
    urllib.request.urlopen(req)
    print('Workflow dispatched')
except Exception as e:
    print(e)
    
time.sleep(3)

# Get runs
url = 'https://api.github.com/repos/naveenkumar030/testingrepo/actions/runs?branch=sentinelops/fix-36114116056'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    runs = data.get('workflow_runs', [])
    if runs:
        print(f"Latest run: {runs[0]['id']} - status: {runs[0]['status']}")
    else:
        print('No runs found')
