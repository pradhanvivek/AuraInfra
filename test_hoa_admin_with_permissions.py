#!/usr/bin/env python3
"""
Test HOA Admin with Managed Properties
This test simulates an HOA admin who has been properly configured with managed_properties.
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os
from pymongo import MongoClient

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://hoamanager-1.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
client = MongoClient(MONGO_URL)
db = client["test_database"]

class HOAAdminWithPermissionsTester:
    def __init__(self):
        self.session = requests.Session()
        self.property_owner = None
        self.hoa_admin = None
        self.test_property = None
        
    def make_request(self, method: str, endpoint: str, data: dict = None, headers: dict = None) -> tuple:
        """Make HTTP request and return (status, response_data)"""
        url = f"{API_BASE}{endpoint}"
        try:
            response = self.session.request(method, url, json=data, headers=headers)
            try:
                response_data = response.json()
            except:
                response_data = response.text
            return response.status_code, response_data
        except Exception as e:
            return 500, {"error": str(e)}
    
    def register_user(self, username: str, email: str, password: str) -> dict:
        """Register a new user and return auth data"""
        status, data = self.make_request("POST", "/auth/register", {
            "username": username,
            "email": email,
            "password": password
        })
        
        if status == 200:
            return {
                "user_id": data["user_id"],
                "username": data["username"],
                "token": data["access_token"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            }
        return None
    
    def setup_users_and_property(self):
        """Create property owner, HOA admin, and test property"""
        print("🔧 Setting up users and property...")
        
        # Create property owner
        self.property_owner = self.register_user(
            f"prop_owner_{uuid.uuid4().hex[:8]}", 
            f"owner_{uuid.uuid4().hex[:8]}@test.com", 
            "password123"
        )
        if not self.property_owner:
            print("❌ Failed to create property owner")
            return False
        
        # Create HOA admin
        self.hoa_admin = self.register_user(
            f"hoa_admin_{uuid.uuid4().hex[:8]}", 
            f"admin_{uuid.uuid4().hex[:8]}@test.com", 
            "password123"
        )
        if not self.hoa_admin:
            print("❌ Failed to create HOA admin")
            return False
        
        # Create test property
        status, data = self.make_request("POST", "/properties", {
            "name": "Test HOA Managed Property",
            "address": "456 Admin Street, Test City, TC 12345"
        }, self.property_owner["headers"])
        
        if status == 200:
            self.test_property = {
                "id": data["id"],
                "name": data["name"],
                "address": data["address"]
            }
            print(f"✅ Property created: {data['id']}")
        else:
            print(f"❌ Failed to create property: {data}")
            return False
        
        return True
    
    def configure_hoa_admin_permissions(self):
        """Manually update the HOA admin to have managed_properties"""
        print("🔑 Configuring HOA admin permissions...")
        
        try:
            # Update the HOA admin user to include the test property in managed_properties
            result = db.users.update_one(
                {"id": self.hoa_admin["user_id"]},
                {
                    "$set": {
                        "is_hoa_admin": True,
                        "managed_properties": [self.test_property["id"]]
                    }
                }
            )
            
            if result.modified_count > 0:
                print(f"✅ HOA admin configured to manage property {self.test_property['id']}")
                return True
            else:
                print("❌ Failed to update HOA admin permissions")
                return False
                
        except Exception as e:
            print(f"❌ Error configuring HOA admin: {str(e)}")
            return False
    
    def test_hoa_admin_amenity_creation(self):
        """Test that HOA admin can create amenities when properly configured"""
        print("\\n🏊 Testing HOA Admin Amenity Creation (with permissions)...")
        
        amenity_data = {
            "property_id": self.test_property["id"],
            "name": "Tennis Court",
            "description": "Professional tennis court with lighting",
            "capacity": 4,
            "booking_fee": 50.0,
            "available_hours_start": "06:00",
            "available_hours_end": "22:00"
        }
        
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/amenities",
            amenity_data,
            self.hoa_admin["headers"]
        )
        
        if status == 200:
            print(f"✅ HOA Admin successfully created amenity: {data.get('name', 'Unknown')}")
            return True
        else:
            print(f"❌ HOA Admin amenity creation failed: {status} - {data}")
            return False
    
    def test_hoa_admin_meeting_creation(self):
        """Test that HOA admin can create meetings when properly configured"""
        print("\\n📅 Testing HOA Admin Meeting Creation (with permissions)...")
        
        future_date = datetime.utcnow() + timedelta(days=14)
        meeting_data = {
            "property_id": self.test_property["id"],
            "title": "Quarterly HOA Board Meeting",
            "description": "Quarterly meeting for board members and residents",
            "meeting_type": "committee",
            "date": future_date.isoformat(),
            "time": "18:00",
            "duration_minutes": 120,
            "location": "Community Hall",
            "agenda": ["Financial Report", "Maintenance Schedule", "New Regulations"]
        }
        
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/meetings",
            meeting_data,
            self.hoa_admin["headers"]
        )
        
        if status == 200:
            print(f"✅ HOA Admin successfully created meeting: {data.get('title', 'Unknown')}")
            return True
        else:
            print(f"❌ HOA Admin meeting creation failed: {status} - {data}")
            return False
    
    def run_test(self):
        """Run the complete test"""
        print("🚀 Testing HOA Admin with Managed Properties")
        print(f"🌐 Backend URL: {API_BASE}")
        
        if not self.setup_users_and_property():
            return False
        
        if not self.configure_hoa_admin_permissions():
            return False
        
        amenity_success = self.test_hoa_admin_amenity_creation()
        meeting_success = self.test_hoa_admin_meeting_creation()
        
        if amenity_success and meeting_success:
            print("\\n🎉 All HOA Admin permission tests passed!")
            print("✅ Authorization logic is working correctly for HOA admins with managed_properties")
            return True
        else:
            print("\\n❌ Some HOA Admin permission tests failed")
            return False

def main():
    """Main test execution"""
    tester = HOAAdminWithPermissionsTester()
    success = tester.run_test()
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)