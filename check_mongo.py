from services.mongo_service import mongo_service

if mongo_service.is_connected():
    print("MongoDB is connected!")
    db = mongo_service._db
    print("Collections:", db.list_collection_names())
    inc_count = db.incidents.count_documents({})
    print("Incidents count in MongoDB:", inc_count)
    
    # Check sample incidents
    samples = list(db.incidents.find().limit(10))
    for s in samples:
        print(f"ID: {s.get('id')} | repo: {s.get('repo')} | runId: {s.get('runId')} | prUrl: {s.get('prUrl')} | prNumber: {s.get('prNumber')}")
else:
    print("MongoDB not connected!")
