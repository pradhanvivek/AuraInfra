#!/usr/bin/env python3
"""
Script to set up admin assignments for testing
"""

import asyncio
import os
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

async def setup_admin():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Find the superadmin_test user
    super_admin = await db.users.find_one({"username": "superadmin_test"})
    if not super_admin:
        print("Super admin user not found")
        client.close()
        return
    
    # Find a test property created by the super admin
    test_property = await db.properties.find_one({"user_id": super_admin["id"]})
    if test_property:
        print(f"Found test property: {test_property['name']} (ID: {test_property['id']})")
        
        # Create admin assignment for the super admin to manage this property
        assignment = {
            "id": str(uuid.uuid4()),
            "admin_user_id": super_admin["id"],
            "property_id": test_property["id"],
            "assigned_by": "system",
            "assigned_at": datetime.utcnow()
        }
        
        # Check if assignment already exists
        existing = await db.property_admin_assignments.find_one({
            "admin_user_id": super_admin["id"],
            "property_id": test_property["id"]
        })
        
        if not existing:
            await db.property_admin_assignments.insert_one(assignment)
            print(f"Created admin assignment for property {test_property['id']}")
        else:
            print("Admin assignment already exists")
    else:
        print("No test property found")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_admin())