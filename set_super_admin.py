#!/usr/bin/env python3
"""
Script to set a user as super admin in the database
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

async def set_super_admin():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Find the superadmin_test user
    user = await db.users.find_one({"username": "superadmin_test"})
    if user:
        # Update user to be super admin
        result = await db.users.update_one(
            {"username": "superadmin_test"},
            {"$set": {"is_super_admin": True}}
        )
        print(f"Updated user {user['username']} (ID: {user['id']}) to super admin: {result.modified_count} documents modified")
    else:
        print("User 'superadmin_test' not found")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(set_super_admin())