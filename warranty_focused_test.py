#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://aurainfra.preview.emergentagent.com/api"

class WarrantyReminderTester:
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
    
    def register_test_user(self):
        """Register a new test user for warranty reminder testing"""
        try:
            test_username = f"warranty_test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            test_password = "SecurePass123!"
            
            response = requests.post(
                f"{self.base_url}/auth/register",
                json={
                    "username": test_username,
                    "password": test_password
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user_id"]
                self.log_result(
                    "User Registration",
                    True,
                    f"Successfully registered test user: {test_username}",
                    f"User ID: {self.user_id}"
                )
                return True
            else:
                self.log_result(
                    "User Registration",
                    False,
                    f"Failed to register user. Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Exception during registration: {str(e)}")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_profile_default_warranty_days(self):
        """Test GET /api/auth/profile returns default warranty_reminder_days of 30"""
        try:
            response = requests.get(
                f"{self.base_url}/auth/profile",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                profile = response.json()
                warranty_days = profile.get("warranty_reminder_days")
                
                if warranty_days == 30:
                    self.log_result(
                        "GET Profile - Default Warranty Days",
                        True,
                        "Profile returns default warranty_reminder_days of 30",
                        f"Received: {warranty_days}"
                    )
                    return True
                else:
                    self.log_result(
                        "GET Profile - Default Warranty Days",
                        False,
                        f"Expected warranty_reminder_days=30, got {warranty_days}",
                        f"Full profile: {profile}"
                    )
                    return False
            else:
                self.log_result(
                    "GET Profile - Default Warranty Days",
                    False,
                    f"Failed to get profile. Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                "GET Profile - Default Warranty Days",
                False,
                f"Exception during profile fetch: {str(e)}"
            )
            return False
    
    def test_update_warranty_days_valid(self, days):
        """Test PUT /api/auth/profile with valid warranty_reminder_days"""
        try:
            response = requests.put(
                f"{self.base_url}/auth/profile",
                json={"warranty_reminder_days": days},
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                profile = response.json()
                updated_days = profile.get("warranty_reminder_days")
                
                if updated_days == days:
                    self.log_result(
                        f"PUT Profile - Update to {days} days",
                        True,
                        f"Successfully updated warranty_reminder_days to {days}",
                        f"Response: {updated_days}"
                    )
                    return True
                else:
                    self.log_result(
                        f"PUT Profile - Update to {days} days",
                        False,
                        f"Expected {days}, got {updated_days}",
                        f"Full response: {profile}"
                    )
                    return False
            else:
                self.log_result(
                    f"PUT Profile - Update to {days} days",
                    False,
                    f"Failed to update profile. Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                f"PUT Profile - Update to {days} days",
                False,
                f"Exception during profile update: {str(e)}"
            )
            return False
    
    def test_update_warranty_days_invalid(self, invalid_days):
        """Test PUT /api/auth/profile with invalid warranty_reminder_days (should return 400)"""
        try:
            response = requests.put(
                f"{self.base_url}/auth/profile",
                json={"warranty_reminder_days": invalid_days},
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 400:
                self.log_result(
                    f"PUT Profile - Invalid value {invalid_days}",
                    True,
                    f"Correctly rejected invalid warranty_reminder_days: {invalid_days}",
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                return True
            else:
                self.log_result(
                    f"PUT Profile - Invalid value {invalid_days}",
                    False,
                    f"Expected 400 error for invalid value {invalid_days}, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                f"PUT Profile - Invalid value {invalid_days}",
                False,
                f"Exception during invalid update test: {str(e)}"
            )
            return False
    
    def test_warranty_days_persistence(self, test_days):
        """Test that warranty_reminder_days value persists after update"""
        try:
            # First update to test_days
            update_success = self.test_update_warranty_days_valid(test_days)
            if not update_success:
                return False
            
            # Then fetch profile again to verify persistence
            response = requests.get(
                f"{self.base_url}/auth/profile",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                profile = response.json()
                persisted_days = profile.get("warranty_reminder_days")
                
                if persisted_days == test_days:
                    self.log_result(
                        f"Warranty Days Persistence - {test_days} days",
                        True,
                        f"Value {test_days} persisted correctly after update",
                        f"Fetched value: {persisted_days}"
                    )
                    return True
                else:
                    self.log_result(
                        f"Warranty Days Persistence - {test_days} days",
                        False,
                        f"Expected persisted value {test_days}, got {persisted_days}",
                        f"Full profile: {profile}"
                    )
                    return False
            else:
                self.log_result(
                    f"Warranty Days Persistence - {test_days} days",
                    False,
                    f"Failed to fetch profile for persistence test. Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result(
                f"Warranty Days Persistence - {test_days} days",
                False,
                f"Exception during persistence test: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all warranty reminder tests"""
        print("=" * 60)
        print("STARTING WARRANTY REMINDER SETTINGS BACKEND TESTS")
        print("=" * 60)
        
        # Step 1: Register test user
        if not self.register_test_user():
            print("❌ Cannot proceed without user registration")
            return False
        
        print("\n" + "-" * 40)
        print("TESTING WARRANTY REMINDER FUNCTIONALITY")
        print("-" * 40)
        
        # Step 2: Test default warranty days
        self.test_get_profile_default_warranty_days()
        
        # Step 3: Test valid warranty days updates
        valid_days = [7, 14, 30]
        for days in valid_days:
            self.test_update_warranty_days_valid(days)
        
        # Step 4: Test invalid warranty days (should be rejected)
        invalid_days = [1, 5, 15, 60, 0, -1, 100]
        for days in invalid_days:
            self.test_update_warranty_days_invalid(days)
        
        # Step 5: Test persistence for each valid value
        for days in valid_days:
            self.test_warranty_days_persistence(days)
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return failed_tests == 0

def main():
    """Main function to run warranty reminder tests"""
    tester = WarrantyReminderTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL WARRANTY REMINDER TESTS PASSED!")
        return True
    else:
        print("\n💥 SOME WARRANTY REMINDER TESTS FAILED!")
        return False

if __name__ == "__main__":
    main()