#!/usr/bin/env python3
"""
Backend Testing Script for HOA Meetings Mobile Integration
Tests the HOA meetings endpoints that will be used by the mobile hoa-meetings.tsx screen
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import base64
import os

# Configuration
BASE_URL = "https://hoa-portal-7.preview.emergentagent.com/api"
TEST_USERNAME = f"test_hoa_user_{uuid.uuid4().hex[:8]}"
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "TestPassword123!"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, message: str = ""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "message": message
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed, {self.failed} failed")
        return self.passed, self.failed, total

class HOAAdminTester:
    def __init__(self):
        self.session = requests.Session()
        self.results = TestResults()
        
        # Test users data
        self.regular_user = None
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
    
    def setup_test_users(self):
        """Create test users: regular user, property owner, HOA admin"""
        print("🔧 Setting up test users...")
        
        # Create regular user
        self.regular_user = self.register_user(
            f"regular_user_{uuid.uuid4().hex[:8]}", 
            f"regular_{uuid.uuid4().hex[:8]}@test.com", 
            "password123"
        )
        if not self.regular_user:
            self.results.add_result("Setup Regular User", False, "Failed to create regular user")
            return False
        
        # Create property owner
        self.property_owner = self.register_user(
            f"property_owner_{uuid.uuid4().hex[:8]}", 
            f"owner_{uuid.uuid4().hex[:8]}@test.com", 
            "password123"
        )
        if not self.property_owner:
            self.results.add_result("Setup Property Owner", False, "Failed to create property owner")
            return False
        
        # Create HOA admin
        self.hoa_admin = self.register_user(
            f"hoa_admin_{uuid.uuid4().hex[:8]}", 
            f"admin_{uuid.uuid4().hex[:8]}@test.com", 
            "password123"
        )
        if not self.hoa_admin:
            self.results.add_result("Setup HOA Admin", False, "Failed to create HOA admin")
            return False
        
        self.results.add_result("Setup Test Users", True, "All test users created successfully")
        return True
    
    def setup_test_property(self):
        """Create a test property owned by property_owner"""
        print("🏠 Setting up test property...")
        
        status, data = self.make_request("POST", "/properties", {
            "name": "Test HOA Property",
            "address": "123 Test Street, Test City, TC 12345"
        }, self.property_owner["headers"])
        
        if status == 200:
            self.test_property = {
                "id": data["id"],
                "name": data["name"],
                "address": data["address"]
            }
            self.results.add_result("Setup Test Property", True, f"Property created with ID: {data['id']}")
            return True
        else:
            self.results.add_result("Setup Test Property", False, f"Failed to create property: {data}")
            return False
    
    def setup_hoa_admin_permissions(self):
        """Verify HOA admin profile access"""
        print("🔑 Verifying HOA admin permissions...")
        
        # Verify the HOA admin user exists and can access profile
        status, data = self.make_request("GET", "/auth/profile", headers=self.hoa_admin["headers"])
        
        if status == 200:
            self.results.add_result("Verify HOA Admin Profile", True, "HOA admin profile accessible")
            
            # Note: In a real scenario, we would need a super admin to assign managed_properties
            # For this test, we'll test both scenarios - with and without managed_properties
            print(f"📝 Note: HOA admin {self.hoa_admin['username']} will be tested for managed_properties configuration")
            return True
        else:
            self.results.add_result("Verify HOA Admin Profile", False, f"Cannot access HOA admin profile: {data}")
            return False
    
    def test_create_amenity_authorization(self):
        """Test amenity creation authorization for different user types"""
        print("\n🏊 Testing Amenity Creation Authorization...")
        
        amenity_data = {
            "property_id": self.test_property["id"],
            "name": "Swimming Pool",
            "description": "Community swimming pool with lifeguard",
            "capacity": 50,
            "booking_fee": 25.0,
            "available_hours_start": "06:00",
            "available_hours_end": "22:00"
        }
        
        # Test 1: Regular user should get 403 Forbidden
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/amenities",
            amenity_data,
            self.regular_user["headers"]
        )
        
        if status == 403:
            self.results.add_result("Regular User Amenity Creation", True, "Correctly denied with 403 Forbidden")
        else:
            self.results.add_result("Regular User Amenity Creation", False, f"Expected 403, got {status}: {data}")
        
        # Test 2: Property owner should be able to create amenity
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/amenities",
            amenity_data,
            self.property_owner["headers"]
        )
        
        if status == 200:
            self.results.add_result("Property Owner Amenity Creation", True, f"Successfully created amenity: {data.get('name', 'Unknown')}")
            self.created_amenity_id = data.get("id")
        else:
            self.results.add_result("Property Owner Amenity Creation", False, f"Expected 200, got {status}: {data}")
        
        # Test 3: HOA admin should be able to create amenity (if properly configured)
        amenity_data["name"] = "Gym Facility"
        amenity_data["description"] = "Fully equipped fitness center"
        
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/amenities",
            amenity_data,
            self.hoa_admin["headers"]
        )
        
        if status == 200:
            self.results.add_result("HOA Admin Amenity Creation", True, f"Successfully created amenity: {data.get('name', 'Unknown')}")
        elif status == 403:
            self.results.add_result("HOA Admin Amenity Creation", False, f"HOA admin denied access - managed_properties not configured: {data}")
        else:
            self.results.add_result("HOA Admin Amenity Creation", False, f"Unexpected status {status}: {data}")
    
    def test_create_meeting_authorization(self):
        """Test meeting creation authorization for different user types"""
        print("\n📅 Testing Meeting Creation Authorization...")
        
        future_date = datetime.utcnow() + timedelta(days=7)
        meeting_data = {
            "property_id": self.test_property["id"],
            "title": "Monthly HOA Meeting",
            "description": "Regular monthly meeting to discuss community matters",
            "meeting_type": "general",
            "date": future_date.isoformat(),
            "time": "19:00",
            "duration_minutes": 90,
            "location": "Community Center",
            "agenda": ["Budget Review", "Maintenance Updates", "New Policies"]
        }
        
        # Test 1: Regular user should get 403 Forbidden
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/meetings",
            meeting_data,
            self.regular_user["headers"]
        )
        
        if status == 403:
            self.results.add_result("Regular User Meeting Creation", True, "Correctly denied with 403 Forbidden")
        else:
            self.results.add_result("Regular User Meeting Creation", False, f"Expected 403, got {status}: {data}")
        
        # Test 2: Property owner should be able to create meeting
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/meetings",
            meeting_data,
            self.property_owner["headers"]
        )
        
        if status == 200:
            self.results.add_result("Property Owner Meeting Creation", True, f"Successfully created meeting: {data.get('title', 'Unknown')}")
            self.created_meeting_id = data.get("id")
        else:
            self.results.add_result("Property Owner Meeting Creation", False, f"Expected 200, got {status}: {data}")
        
        # Test 3: HOA admin should be able to create meeting (if properly configured)
        meeting_data["title"] = "Emergency HOA Meeting"
        meeting_data["meeting_type"] = "emergency"
        
        status, data = self.make_request(
            "POST", 
            f"/properties/{self.test_property['id']}/meetings",
            meeting_data,
            self.hoa_admin["headers"]
        )
        
        if status == 200:
            self.results.add_result("HOA Admin Meeting Creation", True, f"Successfully created meeting: {data.get('title', 'Unknown')}")
        elif status == 403:
            self.results.add_result("HOA Admin Meeting Creation", False, f"HOA admin denied access - managed_properties not configured: {data}")
        else:
            self.results.add_result("HOA Admin Meeting Creation", False, f"Unexpected status {status}: {data}")
    
    def test_get_amenities_endpoint(self):
        """Test GET amenities endpoint"""
        print("\n🏊 Testing GET Amenities Endpoint...")
        
        status, data = self.make_request(
            "GET", 
            f"/properties/{self.test_property['id']}/amenities",
            headers=self.property_owner["headers"]
        )
        
        if status == 200:
            if isinstance(data, list):
                self.results.add_result("GET Amenities Endpoint", True, f"Successfully retrieved {len(data)} amenities")
            else:
                self.results.add_result("GET Amenities Endpoint", False, f"Expected list, got: {type(data)}")
        else:
            self.results.add_result("GET Amenities Endpoint", False, f"Expected 200, got {status}: {data}")
    
    def test_get_meetings_endpoint(self):
        """Test GET meetings endpoint"""
        print("\n📅 Testing GET Meetings Endpoint...")
        
        status, data = self.make_request(
            "GET", 
            f"/properties/{self.test_property['id']}/meetings",
            headers=self.property_owner["headers"]
        )
        
        if status == 200:
            if isinstance(data, list):
                self.results.add_result("GET Meetings Endpoint", True, f"Successfully retrieved {len(data)} meetings")
            else:
                self.results.add_result("GET Meetings Endpoint", False, f"Expected list, got: {type(data)}")
        else:
            self.results.add_result("GET Meetings Endpoint", False, f"Expected 200, got {status}: {data}")
    
    def run_all_tests(self):
        """Run all HOA admin authorization tests"""
        print("🚀 Starting HOA Admin Portal Authorization Tests")
        print(f"🌐 Backend URL: {API_BASE}")
        
        # Setup phase
        if not self.setup_test_users():
            return
        
        if not self.setup_test_property():
            return
        
        if not self.setup_hoa_admin_permissions():
            return
        
        # Test phase
        self.test_create_amenity_authorization()
        self.test_create_meeting_authorization()
        self.test_get_amenities_endpoint()
        self.test_get_meetings_endpoint()
        
        # Summary
        passed, failed, total = self.results.summary()
        
        if failed > 0:
            print("\n❌ CRITICAL ISSUES FOUND:")
            for result in self.results.results:
                if not result["passed"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        return passed, failed, total

def main():
    """Main test execution"""
    tester = HOAAdminTester()
    passed, failed, total = tester.run_all_tests()
    
    print(f"\n🎯 Final Results:")
    print(f"   ✅ Passed: {passed}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📊 Total: {total}")
    
    if failed == 0:
        print("\n🎉 All HOA Admin authorization tests passed!")
    else:
        print(f"\n⚠️  {failed} test(s) failed - review authorization implementation")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)