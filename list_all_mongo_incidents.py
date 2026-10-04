from services.mongo_service import mongo_service

if mongo_service.is_connected():
    db = mongo_service._db
    incs = list(db.incidents.find())
    print(f"Total incidents in MongoDB: {len(incs)}")
    for inc in incs:
        inc_id = inc.get("id")
        repo = inc.get("repo")
        run_id = inc.get("runId")
        pr_url = inc.get("prUrl")
        status = inc.get("status")
        source = inc.get("source")
        print(f"ID={inc_id} | repo={repo} | runId={run_id} | prUrl={pr_url} | source={source} | status={status}")
