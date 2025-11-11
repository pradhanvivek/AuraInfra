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
    
    def setup_test_user(self):
        """Create a test user for authentication"""
        print("\n=== Setting up test user ===")
        
        # Generate unique test user credentials
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        test_username = f"country_test_user_{timestamp}"
        test_email = f"country_test_{timestamp}@example.com"
        test_password = "TestPassword123!"
        
        # Register test user
        register_data = {
            "username": test_username,
            "email": test_email,
            "password": test_password
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user_id"]
                self.log_result("User Registration", True, f"Created test user: {test_username}")
                return True
            else:
                self.log_result("User Registration", False, f"Failed to register user: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_result("User Registration", False, f"Registration error: {str(e)}")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.access_token}"}
    
    def test_get_profile_country_field(self):
        """Test 1: GET /api/auth/profile - Country Field Return"""
        print("\n=== Test 1: GET Profile Country Field ===")
        
        try:
            response = requests.get(f"{self.base_url}/auth/profile", headers=self.get_auth_headers())
            
            if response.status_code == 200:
                profile_data = response.json()
                
                # Check if country field exists in response
                if "country" in profile_data:
                    # For new user, country should be null
                    if profile_data["country"] is None:
                        self.log_result("GET Profile - Country Field", True, "Country field returned as null for new user", profile_data.get("country"))
                    else:
                        self.log_result("GET Profile - Country Field", True, f"Country field returned: {profile_data['country']}", profile_data.get("country"))
                else:
                    self.log_result("GET Profile - Country Field", False, "Country field missing from profile response")
                
                return profile_data
            else:
                self.log_result("GET Profile - Country Field", False, f"Failed to get profile: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log_result("GET Profile - Country Field", False, f"Error getting profile: {str(e)}")
            return None
    
    def test_save_valid_countries(self):
        """Test 2: PUT /api/auth/profile - Save Valid Countries"""
        print("\n=== Test 2: Save Valid Countries ===")
        
        for country in VALID_COUNTRIES:
            try:
                update_data = {"country": country}
                response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
                
                if response.status_code == 200:
                    profile_data = response.json()
                    if profile_data.get("country") == country:
                        self.log_result(f"Save Country - {country}", True, f"Successfully saved country: {country}")
                    else:
                        self.log_result(f"Save Country - {country}", False, f"Country not saved correctly. Expected: {country}, Got: {profile_data.get('country')}")
                else:
                    self.log_result(f"Save Country - {country}", False, f"Failed to save country {country}: {response.status_code} - {response.text}")
                    
            except Exception as e:
                self.log_result(f"Save Country - {country}", False, f"Error saving country {country}: {str(e)}")
    
    def test_country_validation(self):
        """Test 3: PUT /api/auth/profile - Country Validation"""
        print("\n=== Test 3: Country Validation ===")
        
        # Test invalid country
        try:
            invalid_country = "Germany"
            update_data = {"country": invalid_country}
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 400:
                self.log_result("Invalid Country Validation", True, f"Correctly rejected invalid country: {invalid_country}")
            else:
                self.log_result("Invalid Country Validation", False, f"Should have rejected invalid country {invalid_country}. Got: {response.status_code}")
                
        except Exception as e:
            self.log_result("Invalid Country Validation", False, f"Error testing invalid country: {str(e)}")
        
        # Test empty string (should be accepted)
        try:
            update_data = {"country": ""}
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 200:
                self.log_result("Empty String Country", True, "Empty string country accepted")
            else:
                self.log_result("Empty String Country", False, f"Empty string should be accepted. Got: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Empty String Country", False, f"Error testing empty string: {str(e)}")
        
        # Test null value (should be accepted)
        try:
            update_data = {"country": None}
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 200:
                self.log_result("Null Country", True, "Null country value accepted")
            else:
                self.log_result("Null Country", False, f"Null country should be accepted. Got: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Null Country", False, f"Error testing null country: {str(e)}")
    
    def test_data_persistence(self):
        """Test 4: Data Persistence"""
        print("\n=== Test 4: Data Persistence ===")
        
        # Save a country
        test_country = "India"
        try:
            update_data = {"country": test_country}
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 200:
                # Get profile to verify persistence
                get_response = requests.get(f"{self.base_url}/auth/profile", headers=self.get_auth_headers())
                
                if get_response.status_code == 200:
                    profile_data = get_response.json()
                    if profile_data.get("country") == test_country:
                        self.log_result("Data Persistence - Save & Retrieve", True, f"Country {test_country} persisted correctly")
                    else:
                        self.log_result("Data Persistence - Save & Retrieve", False, f"Country not persisted. Expected: {test_country}, Got: {profile_data.get('country')}")
                else:
                    self.log_result("Data Persistence - Save & Retrieve", False, f"Failed to retrieve profile after save: {get_response.status_code}")
            else:
                self.log_result("Data Persistence - Save & Retrieve", False, f"Failed to save country for persistence test: {response.status_code}")
                
        except Exception as e:
            self.log_result("Data Persistence - Save & Retrieve", False, f"Error in persistence test: {str(e)}")
        
        # Update to different country and verify
        new_country = "Canada"
        try:
            update_data = {"country": new_country}
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 200:
                # Get profile to verify update
                get_response = requests.get(f"{self.base_url}/auth/profile", headers=self.get_auth_headers())
                
                if get_response.status_code == 200:
                    profile_data = get_response.json()
                    if profile_data.get("country") == new_country:
                        self.log_result("Data Persistence - Update", True, f"Country updated to {new_country} and persisted correctly")
                    else:
                        self.log_result("Data Persistence - Update", False, f"Country update not persisted. Expected: {new_country}, Got: {profile_data.get('country')}")
                else:
                    self.log_result("Data Persistence - Update", False, f"Failed to retrieve profile after update: {get_response.status_code}")
            else:
                self.log_result("Data Persistence - Update", False, f"Failed to update country: {response.status_code}")
                
        except Exception as e:
            self.log_result("Data Persistence - Update", False, f"Error in update persistence test: {str(e)}")
    
    def test_integration_with_other_fields(self):
        """Test 5: Integration with Other Profile Fields"""
        print("\n=== Test 5: Integration with Other Profile Fields ===")
        
        try:
            # Update multiple fields including country
            update_data = {
                "email": "updated_country_test@example.com",
                "phone": "+1234567890",
                "country": "Australia",
                "currency_preference": "AUD",
                "measurement_system": "metric",
                "warranty_reminder_days": 14
            }
            
            response = requests.put(f"{self.base_url}/auth/profile", json=update_data, headers=self.get_auth_headers())
            
            if response.status_code == 200:
                profile_data = response.json()
                
                # Verify all fields were updated correctly
                all_correct = True
                field_results = {}
                
                for field, expected_value in update_data.items():
                    actual_value = profile_data.get(field)
                    field_results[field] = {"expected": expected_value, "actual": actual_value}
                    if actual_value != expected_value:
                        all_correct = False
                
                if all_correct:
                    self.log_result("Integration - Multiple Fields", True, "All profile fields updated correctly together", field_results)
                else:
                    self.log_result("Integration - Multiple Fields", False, "Some profile fields not updated correctly", field_results)
            else:
                self.log_result("Integration - Multiple Fields", False, f"Failed to update multiple fields: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log_result("Integration - Multiple Fields", False, f"Error in integration test: {str(e)}")
    
    def run_all_tests(self):
        """Run all country selection tests"""
        print("🚀 Starting Country Selection Feature Backend Testing")
        print(f"Base URL: {self.base_url}")
        print(f"Valid Countries: {', '.join(VALID_COUNTRIES)}")
        
        # Setup
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return False
        
        # Run tests
        self.test_get_profile_country_field()
        self.test_save_valid_countries()
        self.test_country_validation()
        self.test_data_persistence()
        self.test_integration_with_other_fields()
        
        # Summary
        self.print_summary()
        return self.get_overall_success()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 COUNTRY SELECTION TESTING SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}: {result['message']}")
    
    def get_overall_success(self):
        """Check if all tests passed"""
        return all(result["success"] for result in self.test_results)

def main():
    """Main function"""
    tester = CountrySelectionTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Country selection feature is working correctly.")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED! Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()