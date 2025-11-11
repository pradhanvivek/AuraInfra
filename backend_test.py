#!/usr/bin/env python3
"""
Backend API Testing Script for Country Selection Feature
Tests the country selection functionality in user profile management.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://smartinfra.preview.emergentagent.com/api"
VALID_COUNTRIES = ["India", "US", "UK", "Canada", "Australia", "UAE"]

class CountrySelectionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_user_registration(self):
        """Test user registration to create test user"""
        print("\n=== Testing User Registration (Setup) ===")
        
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register", json=self.test_user_data)
            
            if response.status_code == 201 or response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user_id" in data:
                    self.auth_token = data["access_token"]
                    self.log_test("User Registration", True, f"User created with ID: {data['user_id']}")
                    return True
                else:
                    self.log_test("User Registration", False, "Missing access_token or user_id in response")
                    return False
            elif response.status_code == 400 and "already exists" in response.text:
                # User already exists, try to login to get token
                self.log_test("User Registration", True, "User already exists, will use existing user")
                return True
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_1_username_login(self):
        """Test Scenario 1: Login with Username (Existing Functionality)"""
        print("\n=== Test Scenario 1: Login with Username ===")
        
        try:
            login_data = {
                "username": self.test_user_data["username"],
                "password": self.test_user_data["password"]
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if all(key in data for key in ["access_token", "token_type", "user_id", "username"]):
                    if data["token_type"] == "bearer" and data["username"] == self.test_user_data["username"]:
                        self.log_test("Login with Username", True, f"JWT token received, user_id: {data['user_id']}")
                        return True
                    else:
                        self.log_test("Login with Username", False, "Invalid token type or username mismatch")
                        return False
                else:
                    self.log_test("Login with Username", False, "Missing required fields in response")
                    return False
            else:
                self.log_test("Login with Username", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Login with Username", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_2_email_login(self):
        """Test Scenario 2: Login with Email (NEW Functionality)"""
        print("\n=== Test Scenario 2: Login with Email (NEW) ===")
        
        try:
            login_data = {
                "username": self.test_user_data["email"],  # Using email in username field
                "password": self.test_user_data["password"]
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if all(key in data for key in ["access_token", "token_type", "user_id", "username"]):
                    if data["token_type"] == "bearer" and data["username"] == self.test_user_data["username"]:
                        self.log_test("Login with Email", True, f"JWT token received, user_id: {data['user_id']}")
                        return True
                    else:
                        self.log_test("Login with Email", False, "Invalid token type or username mismatch")
                        return False
                else:
                    self.log_test("Login with Email", False, "Missing required fields in response")
                    return False
            else:
                self.log_test("Login with Email", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Login with Email", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_3_invalid_email_password(self):
        """Test Scenario 3: Invalid Credentials with Email"""
        print("\n=== Test Scenario 3: Invalid Credentials with Email ===")
        
        try:
            login_data = {
                "username": self.test_user_data["email"],
                "password": "WrongPassword123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data and "Invalid credentials" in data["detail"]:
                    self.log_test("Invalid Email Credentials", True, "Correctly returned 401 with 'Invalid credentials'")
                    return True
                else:
                    self.log_test("Invalid Email Credentials", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Invalid Email Credentials", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Email Credentials", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_4_invalid_username_password(self):
        """Test Scenario 4: Invalid Credentials with Username"""
        print("\n=== Test Scenario 4: Invalid Credentials with Username ===")
        
        try:
            login_data = {
                "username": self.test_user_data["username"],
                "password": "WrongPassword123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data and "Invalid credentials" in data["detail"]:
                    self.log_test("Invalid Username Credentials", True, "Correctly returned 401 with 'Invalid credentials'")
                    return True
                else:
                    self.log_test("Invalid Username Credentials", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Invalid Username Credentials", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Username Credentials", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_5_nonexistent_email(self):
        """Test Scenario 5: Non-existent Email"""
        print("\n=== Test Scenario 5: Non-existent Email ===")
        
        try:
            login_data = {
                "username": "nonexistent.user@example.com",
                "password": "AnyPassword123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data and "Invalid credentials" in data["detail"]:
                    self.log_test("Non-existent Email", True, "Correctly returned 401 with 'Invalid credentials'")
                    return True
                else:
                    self.log_test("Non-existent Email", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Non-existent Email", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Non-existent Email", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_6_nonexistent_username(self):
        """Test Scenario 6: Non-existent Username"""
        print("\n=== Test Scenario 6: Non-existent Username ===")
        
        try:
            login_data = {
                "username": "nonexistentuser2025",
                "password": "AnyPassword123!"
            }
            
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data and "Invalid credentials" in data["detail"]:
                    self.log_test("Non-existent Username", True, "Correctly returned 401 with 'Invalid credentials'")
                    return True
                else:
                    self.log_test("Non-existent Username", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Non-existent Username", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Non-existent Username", False, f"Exception: {str(e)}")
            return False
    
    def test_token_consistency(self):
        """Verify that both email and username login return identical JWT token structure"""
        print("\n=== Testing Token Consistency ===")
        
        try:
            # Login with username
            username_login = {
                "username": self.test_user_data["username"],
                "password": self.test_user_data["password"]
            }
            username_response = requests.post(f"{BACKEND_URL}/auth/login", json=username_login)
            
            # Login with email
            email_login = {
                "username": self.test_user_data["email"],
                "password": self.test_user_data["password"]
            }
            email_response = requests.post(f"{BACKEND_URL}/auth/login", json=email_login)
            
            if username_response.status_code == 200 and email_response.status_code == 200:
                username_data = username_response.json()
                email_data = email_response.json()
                
                # Check if both have same structure and user_id
                if (username_data["user_id"] == email_data["user_id"] and
                    username_data["username"] == email_data["username"] and
                    username_data["token_type"] == email_data["token_type"]):
                    self.log_test("Token Consistency", True, "Both login methods return identical user data")
                    return True
                else:
                    self.log_test("Token Consistency", False, "Token data mismatch between email and username login")
                    return False
            else:
                self.log_test("Token Consistency", False, "One or both login methods failed")
                return False
                
        except Exception as e:
            self.log_test("Token Consistency", False, f"Exception: {str(e)}")
            return False
    
    def test_authenticated_request(self):
        """Test that JWT token works for subsequent authenticated requests"""
        print("\n=== Testing Authenticated Request ===")
        
        try:
            # First get a token
            login_data = {
                "username": self.test_user_data["username"],
                "password": self.test_user_data["password"]
            }
            
            login_response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if login_response.status_code == 200:
                token = login_response.json()["access_token"]
                
                # Use token to access protected endpoint
                headers = {"Authorization": f"Bearer {token}"}
                profile_response = requests.get(f"{BACKEND_URL}/auth/profile", headers=headers)
                
                if profile_response.status_code == 200:
                    profile_data = profile_response.json()
                    if profile_data["username"] == self.test_user_data["username"]:
                        self.log_test("Authenticated Request", True, "JWT token valid for protected endpoints")
                        return True
                    else:
                        self.log_test("Authenticated Request", False, "Profile data mismatch")
                        return False
                else:
                    self.log_test("Authenticated Request", False, f"Profile request failed: {profile_response.status_code}")
                    return False
            else:
                self.log_test("Authenticated Request", False, "Failed to get login token")
                return False
                
        except Exception as e:
            self.log_test("Authenticated Request", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 Starting Email OR Username Login Feature Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {self.test_user_data['username']} / {self.test_user_data['email']}")
        
        # Setup
        if not self.test_user_registration():
            print("❌ Failed to setup test user, aborting tests")
            return False
        
        # Run all test scenarios
        tests = [
            self.test_scenario_1_username_login,
            self.test_scenario_2_email_login,
            self.test_scenario_3_invalid_email_password,
            self.test_scenario_4_invalid_username_password,
            self.test_scenario_5_nonexistent_email,
            self.test_scenario_6_nonexistent_username,
            self.test_token_consistency,
            self.test_authenticated_request
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        # Summary
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Email OR Username Login Feature is working correctly!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Review the failures above")
            return False

def main():
    """Main function to run tests"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()