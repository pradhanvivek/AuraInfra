"""
Migration script to add geomancy_type to existing vastu analyses
Run this once to update existing records
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def migrate_geomancy_type():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.aurainfra
    
    # Update all existing vastu_analysis documents that don't have geomancy_type
    result = await db.vastu_analysis.update_many(
        {"geomancy_type": {"$exists": False}},
        {"$set": {"geomancy_type": "vastu"}}
    )
    
    print(f"Updated {result.modified_count} documents with default geomancy_type='vastu'")
    
    # Verify the update
    count = await db.vastu_analysis.count_documents({"geomancy_type": {"$exists": True}})
    total = await db.vastu_analysis.count_documents({})
    print(f"Total analyses: {total}, with geomancy_type: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_geomancy_type())
