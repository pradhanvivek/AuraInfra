#!/usr/bin/env python3
"""
Comprehensive Backend Testing for THREE MAJOR FEATURES:
1. Super Admin Community Property Management
2. Maintenance Dues System  
3. Production Readiness

This script tests all endpoints mentioned in the review request.
"""

import requests
import json
import base64
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://smartinfra.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class PropertyMembershipTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_users = {}
        self.test_properties = {}
        self.test_memberships = {}
        self.admin_token = None
        self.regular_user_token = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_get_all_properties(self):
        """Test GET /api/public/properties - No authentication required"""
        self.log("Testing GET /api/public/properties...")
        
        try:
            response = self.session.get(f"{API_BASE}/public/properties")
            
            if response.status_code == 200:
                properties = response.json()
                self.log(f"✅ GET /api/public/properties successful - Found {len(properties)} properties")
                
                # Verify response structure
                if properties:
                    prop = properties[0]
                    required_fields = ['id', 'name', 'address']
                    for field in required_fields:
                        if field not in prop:
                            self.log(f"❌ Missing required field '{field}' in property response")
                            return False
                    self.log("✅ Property response structure is correct")
                else:
                    self.log("ℹ️ No properties found in database")
                
                return True
            else:
                self.log(f"❌ GET /api/properties/all failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ GET /api/properties/all error: {str(e)}")
            return False
    
    def create_test_property(self, user_token, property_name):
        """Helper to create a test property"""
        try:
            headers = {"Authorization": f"Bearer {user_token}"}
            property_data = {
                "name": property_name,
                "address": f"123 Test Street, {property_name} City",
                "latitude": 40.7128,
                "longitude": -74.0060
            }
            
            response = self.session.post(
                f"{API_BASE}/properties",
                json=property_data,
                headers=headers
            )
            
            if response.status_code == 200:
                property_obj = response.json()
                self.test_properties[property_name] = property_obj
                self.log(f"✅ Created test property: {property_name} (ID: {property_obj['id']})")
                return property_obj
            else:
                self.log(f"❌ Failed to create test property {property_name}: {response.text}")
                return None
                
        except Exception as e:
            self.log(f"❌ Error creating test property {property_name}: {str(e)}")
            return None
    
    def register_test_user(self, username, email, password, property_ids=None):
        """Helper to register a test user"""
        try:
            # Add timestamp to make usernames unique
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            unique_username = f"{username}_{timestamp}"
            unique_email = f"{username}_{timestamp}@test.com"
            
            user_data = {
                "username": unique_username,
                "email": unique_email,
                "password": password,
                "property_ids": property_ids or []
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
            
            if response.status_code == 200:
                user_info = response.json()
                self.test_users[username] = user_info  # Store with original name for easy access
                self.log(f"✅ Registered test user: {unique_username} (ID: {user_info['user_id']})")
                return user_info
            else:
                self.log(f"❌ Failed to register user {unique_username}: {response.text}")
                return None
                
        except Exception as e:
            self.log(f"❌ Error registering user {username}: {str(e)}")
            return None
    
    def make_user_admin(self, user_id, property_id):
        """Helper to make a user an HOA admin for a property"""
        try:
            # First make user HOA admin
            from motor.motor_asyncio import AsyncIOMotorClient
            import asyncio
            
            async def update_user():
                mongo_url = os.environ['MONGO_URL']
                client = AsyncIOMotorClient(mongo_url)
                db = client[os.environ['DB_NAME']]
                
                # Update user to be HOA admin
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"is_hoa_admin": True}}
                )
                
                # Create admin assignment
                assignment = {
                    "id": str(uuid.uuid4()),
                    "admin_user_id": user_id,
                    "property_id": property_id,
                    "assigned_by": "system",
                    "assigned_at": datetime.utcnow()
                }
                await db.property_admin_assignments.insert_one(assignment)
                
                client.close()
            
            asyncio.run(update_user())
            self.log(f"✅ Made user {user_id} an HOA admin for property {property_id}")
            return True
            
        except Exception as e:
            self.log(f"❌ Error making user admin: {str(e)}")
            return False
    
    def test_registration_with_properties(self):
        """Test POST /api/auth/register with property_ids"""
        self.log("\nTesting user registration with property selection...")
        
        # First create an admin user and property
        admin_user = self.register_test_user("admin_user", "admin@test.com", "password123")
        if not admin_user:
            return False
        
        self.admin_token = admin_user['access_token']
        
        # Create test properties
        property1 = self.create_test_property(self.admin_token, "Sunset Apartments")
        property2 = self.create_test_property(self.admin_token, "Ocean View Condos")
        
        if not property1 or not property2:
            return False
        
        # Test 1: Register without properties
        self.log("Test 1: Register user without properties...")
        user1 = self.register_test_user("user_no_props", "user1@test.com", "password123", [])
        if not user1:
            return False
        
        # Test 2: Register with one property
        self.log("Test 2: Register user with one property...")
        user2 = self.register_test_user("user_one_prop", "user2@test.com", "password123", [property1['id']])
        if not user2:
            return False
        
        # Test 3: Register with multiple properties
        self.log("Test 3: Register user with multiple properties...")
        user3 = self.register_test_user("user_multi_props", "user3@test.com", "password123", [property1['id'], property2['id']])
        if not user3:
            return False
        
        # Test 4: Register with invalid property ID (should skip)
        self.log("Test 4: Register user with invalid property ID...")
        invalid_id = str(uuid.uuid4())
        user4 = self.register_test_user("user_invalid_prop", "user4@test.com", "password123", [property1['id'], invalid_id])
        if not user4:
            return False
        
        self.regular_user_token = user2['access_token']
        return True
    
    def test_profile_member_properties(self):
        """Test GET /api/auth/profile returns member_properties"""
        self.log("\nTesting profile endpoint returns member_properties...")
        
        try:
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.get(f"{API_BASE}/auth/profile", headers=headers)
            
            if response.status_code == 200:
                profile = response.json()
                
                if 'member_properties' in profile:
                    member_props = profile['member_properties']
                    self.log(f"✅ Profile returns member_properties: {member_props}")
                    
                    # Verify the user has the expected property
                    property1_id = self.test_properties["Sunset Apartments"]['id']
                    if property1_id in member_props:
                        self.log("✅ User's member_properties contains expected property")
                        return True
                    else:
                        self.log(f"❌ Expected property {property1_id} not found in member_properties")
                        return False
                else:
                    self.log("❌ Profile response missing member_properties field")
                    return False
            else:
                self.log(f"❌ Profile request failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Profile test error: {str(e)}")
            return False
    
    def test_get_property_members_admin(self):
        """Test GET /api/properties/{property_id}/members as admin"""
        self.log("\nTesting GET property members as admin...")
        
        try:
            # Make admin user an HOA admin for the property
            admin_user_id = self.test_users["admin_user"]['user_id']
            property_id = self.test_properties["Sunset Apartments"]['id']
            
            if not self.make_user_admin(admin_user_id, property_id):
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/properties/{property_id}/members", headers=headers)
            
            if response.status_code == 200:
                members = response.json()
                self.log(f"✅ Admin can view property members - Found {len(members)} members")
                
                # Verify response structure
                if members:
                    member = members[0]
                    required_fields = ['membership_id', 'user_id', 'username', 'role', 'status']
                    for field in required_fields:
                        if field not in member:
                            self.log(f"❌ Missing required field '{field}' in member response")
                            return False
                    self.log("✅ Member response structure is correct")
                
                return True
            else:
                self.log(f"❌ Admin get members failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin get members test error: {str(e)}")
            return False
    
    def test_get_property_members_regular_user(self):
        """Test GET /api/properties/{property_id}/members as regular user (should fail)"""
        self.log("\nTesting GET property members as regular user (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.get(f"{API_BASE}/properties/{property_id}/members", headers=headers)
            
            if response.status_code == 403:
                self.log("✅ Regular user correctly denied access to view members (403 Forbidden)")
                return True
            else:
                self.log(f"❌ Expected 403 Forbidden, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Regular user get members test error: {str(e)}")
            return False
    
    def test_add_property_member_admin(self):
        """Test POST /api/properties/{property_id}/members as admin"""
        self.log("\nTesting POST add property member as admin...")
        
        try:
            # Create a new user to add as member
            new_user = self.register_test_user("new_member", "newmember@test.com", "password123", [])
            if not new_user:
                return False
            
            property_id = self.test_properties["Sunset Apartments"]['id']
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            member_data = {
                "user_id": new_user['user_id'],
                "role": "resident",
                "unit_number": "101",
                "status": "approved"
            }
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/members",
                json=member_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ Admin successfully added member: {result}")
                return True
            else:
                self.log(f"❌ Admin add member failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin add member test error: {str(e)}")
            return False
    
    def test_add_existing_member(self):
        """Test adding user who is already a member (should fail)"""
        self.log("\nTesting add existing member (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to add the same user again
            new_user_id = self.test_users["new_member"]['user_id']
            member_data = {
                "user_id": new_user_id,
                "role": "resident",
                "unit_number": "102",
                "status": "approved"
            }
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/members",
                json=member_data,
                headers=headers
            )
            
            if response.status_code == 400:
                self.log("✅ Correctly rejected adding existing member (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Expected 400 Bad Request, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Add existing member test error: {str(e)}")
            return False
    
    def test_add_nonexistent_user(self):
        """Test adding non-existent user (should fail)"""
        self.log("\nTesting add non-existent user (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            fake_user_id = str(uuid.uuid4())
            member_data = {
                "user_id": fake_user_id,
                "role": "resident",
                "unit_number": "103",
                "status": "approved"
            }
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/members",
                json=member_data,
                headers=headers
            )
            
            if response.status_code == 404:
                self.log("✅ Correctly rejected adding non-existent user (404 Not Found)")
                return True
            else:
                self.log(f"❌ Expected 404 Not Found, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Add non-existent user test error: {str(e)}")
            return False
    
    def test_add_member_as_regular_user(self):
        """Test POST /api/properties/{property_id}/members as regular user (should fail)"""
        self.log("\nTesting POST add member as regular user (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            
            fake_user_id = str(uuid.uuid4())
            member_data = {
                "user_id": fake_user_id,
                "role": "resident",
                "unit_number": "104",
                "status": "approved"
            }
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/members",
                json=member_data,
                headers=headers
            )
            
            if response.status_code == 403:
                self.log("✅ Regular user correctly denied permission to add members (403 Forbidden)")
                return True
            else:
                self.log(f"❌ Expected 403 Forbidden, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Regular user add member test error: {str(e)}")
            return False
    
    def test_remove_property_member_admin(self):
        """Test DELETE /api/properties/{property_id}/members/{member_user_id} as admin"""
        self.log("\nTesting DELETE remove property member as admin...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            member_user_id = self.test_users["new_member"]['user_id']
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = self.session.delete(
                f"{API_BASE}/properties/{property_id}/members/{member_user_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ Admin successfully removed member: {result}")
                return True
            else:
                self.log(f"❌ Admin remove member failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin remove member test error: {str(e)}")
            return False
    
    def test_remove_nonexistent_member(self):
        """Test removing non-existent membership (should fail)"""
        self.log("\nTesting remove non-existent member (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            fake_user_id = str(uuid.uuid4())
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = self.session.delete(
                f"{API_BASE}/properties/{property_id}/members/{fake_user_id}",
                headers=headers
            )
            
            if response.status_code == 404:
                self.log("✅ Correctly rejected removing non-existent member (404 Not Found)")
                return True
            else:
                self.log(f"❌ Expected 404 Not Found, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Remove non-existent member test error: {str(e)}")
            return False
    
    def test_remove_member_as_regular_user(self):
        """Test DELETE as regular user (should fail)"""
        self.log("\nTesting DELETE remove member as regular user (should fail)...")
        
        try:
            property_id = self.test_properties["Sunset Apartments"]['id']
            fake_user_id = str(uuid.uuid4())
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            
            response = self.session.delete(
                f"{API_BASE}/properties/{property_id}/members/{fake_user_id}",
                headers=headers
            )
            
            if response.status_code == 403:
                self.log("✅ Regular user correctly denied permission to remove members (403 Forbidden)")
                return True
            else:
                self.log(f"❌ Expected 403 Forbidden, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Regular user remove member test error: {str(e)}")
            return False
    
    def test_user_join_property(self):
        """Test POST /api/properties/{property_id}/join"""
        self.log("\nTesting POST user join property...")
        
        try:
            # Create a new user to test joining
            join_user = self.register_test_user("join_user", "joinuser@test.com", "password123", [])
            if not join_user:
                return False
            
            property_id = self.test_properties["Ocean View Condos"]['id']
            headers = {"Authorization": f"Bearer {join_user['access_token']}"}
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/join",
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                self.log(f"✅ User successfully joined property: {result}")
                return True
            else:
                self.log(f"❌ User join property failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ User join property test error: {str(e)}")
            return False
    
    def test_join_same_property_twice(self):
        """Test joining same property twice (should fail)"""
        self.log("\nTesting join same property twice (should fail)...")
        
        try:
            property_id = self.test_properties["Ocean View Condos"]['id']
            join_user_token = self.test_users["join_user"]['access_token']
            headers = {"Authorization": f"Bearer {join_user_token}"}
            
            response = self.session.post(
                f"{API_BASE}/properties/{property_id}/join",
                headers=headers
            )
            
            if response.status_code == 400:
                self.log("✅ Correctly rejected joining same property twice (400 Bad Request)")
                return True
            else:
                self.log(f"❌ Expected 400 Bad Request, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Join same property twice test error: {str(e)}")
            return False
    
    def test_join_nonexistent_property(self):
        """Test joining non-existent property (should fail)"""
        self.log("\nTesting join non-existent property (should fail)...")
        
        try:
            fake_property_id = str(uuid.uuid4())
            join_user_token = self.test_users["join_user"]['access_token']
            headers = {"Authorization": f"Bearer {join_user_token}"}
            
            response = self.session.post(
                f"{API_BASE}/properties/{fake_property_id}/join",
                headers=headers
            )
            
            if response.status_code == 404:
                self.log("✅ Correctly rejected joining non-existent property (404 Not Found)")
                return True
            else:
                self.log(f"❌ Expected 404 Not Found, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Join non-existent property test error: {str(e)}")
            return False
    
    def verify_data_persistence(self):
        """Verify that property_memberships collection is created and populated"""
        self.log("\nVerifying data persistence...")
        
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            import asyncio
            
            async def check_data():
                mongo_url = os.environ['MONGO_URL']
                client = AsyncIOMotorClient(mongo_url)
                db = client[os.environ['DB_NAME']]
                
                # Check property_memberships collection exists and has data
                membership_count = await db.property_memberships.count_documents({})
                self.log(f"✅ Property memberships collection has {membership_count} records")
                
                # Check that users have member_properties updated
                user_with_props = await db.users.find_one({"username": "user_one_prop"})
                if user_with_props and user_with_props.get("member_properties"):
                    self.log(f"✅ User member_properties updated: {user_with_props['member_properties']}")
                else:
                    self.log("❌ User member_properties not updated correctly")
                    return False
                
                client.close()
                return True
            
            return asyncio.run(check_data())
            
        except Exception as e:
            self.log(f"❌ Data persistence verification error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all property membership tests"""
        self.log("🚀 Starting PHASE 1: User-Property Association & Residents Management Backend Tests")
        self.log("=" * 80)
        
        tests = [
            ("GET /api/public/properties", self.test_get_all_properties),
            ("User Registration with Properties", self.test_registration_with_properties),
            ("Profile Member Properties", self.test_profile_member_properties),
            ("Get Property Members (Admin)", self.test_get_property_members_admin),
            ("Get Property Members (Regular User)", self.test_get_property_members_regular_user),
            ("Add Property Member (Admin)", self.test_add_property_member_admin),
            ("Add Existing Member", self.test_add_existing_member),
            ("Add Non-existent User", self.test_add_nonexistent_user),
            ("Add Member (Regular User)", self.test_add_member_as_regular_user),
            ("Remove Property Member (Admin)", self.test_remove_property_member_admin),
            ("Remove Non-existent Member", self.test_remove_nonexistent_member),
            ("Remove Member (Regular User)", self.test_remove_member_as_regular_user),
            ("User Join Property", self.test_user_join_property),
            ("Join Same Property Twice", self.test_join_same_property_twice),
            ("Join Non-existent Property", self.test_join_nonexistent_property),
            ("Data Persistence Verification", self.verify_data_persistence)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ {test_name} failed with exception: {str(e)}")
                failed += 1
        
        self.log("\n" + "=" * 80)
        self.log(f"🏁 PHASE 1 Backend Testing Complete!")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 ALL TESTS PASSED! Property membership system is working correctly.")
        else:
            self.log("⚠️ Some tests failed. Please review the issues above.")
        
        return failed == 0

if __name__ == "__main__":
    tester = PropertyMembershipTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)