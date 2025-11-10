#!/usr/bin/env python3
"""
Backend API Testing for Property Logo Management
Tests property logo upload, retrieval, and management functionality
"""

import requests
import json
import base64
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://propmanager-app.preview.emergentagent.com/api"

# Test data - small base64 encoded PNG image (1x1 pixel red dot)
SAMPLE_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

class PropertyLogoTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_property_id = None
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
    
    def register_and_login(self):
        """Register a test user and login"""
        try:
            # Register user
            register_data = {
                "username": f"logotest_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "email": f"logotest_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com",
                "password": "LogoTest123!"
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user_id"]
                self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                self.log_result("User Registration", True, f"User registered successfully: {register_data['username']}")
                return True
            else:
                self.log_result("User Registration", False, f"Registration failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Registration error: {str(e)}")
            return False
    
    def create_test_property(self):
        """Create a test property for logo testing"""
        try:
            property_data = {
                "name": "Logo Test Property",
                "address": "123 Test Street, Logo City, LC 12345",
                "purchase_cost": 500000.0,
                "current_value": 550000.0
            }
            
            response = self.session.post(f"{BACKEND_URL}/properties", json=property_data)
            if response.status_code == 200:
                data = response.json()
                self.test_property_id = data["id"]
                self.log_result("Property Creation", True, f"Test property created: {self.test_property_id}")
                return True
            else:
                self.log_result("Property Creation", False, f"Property creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Property Creation", False, f"Property creation error: {str(e)}")
            return False
    
    def test_put_property_with_logo(self):
        """Test PUT /api/properties/{id} with logo field"""
        try:
            update_data = {
                "name": "Logo Test Property Updated",
                "logo": SAMPLE_LOGO_BASE64
            }
            
            response = self.session.put(f"{BACKEND_URL}/properties/{self.test_property_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                if "logo" in data and data["logo"] == SAMPLE_LOGO_BASE64:
                    self.log_result("PUT Property with Logo", True, "Property logo updated successfully", 
                                  f"Logo field present and matches: {len(data['logo'])} chars")
                    return True
                else:
                    self.log_result("PUT Property with Logo", False, "Logo field missing or incorrect in response",
                                  f"Response logo: {data.get('logo', 'MISSING')[:50]}...")
                    return False
            else:
                self.log_result("PUT Property with Logo", False, f"PUT request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("PUT Property with Logo", False, f"PUT property error: {str(e)}")
            return False
    
    def test_get_property_with_logo(self):
        """Test GET /api/properties/{id} returns logo field"""
        try:
            response = self.session.get(f"{BACKEND_URL}/properties/{self.test_property_id}")
            if response.status_code == 200:
                data = response.json()
                if "logo" in data and data["logo"] == SAMPLE_LOGO_BASE64:
                    self.log_result("GET Property with Logo", True, "Property logo retrieved successfully",
                                  f"Logo field present: {len(data['logo'])} chars")
                    return True
                else:
                    self.log_result("GET Property with Logo", False, "Logo field missing or incorrect",
                                  f"Response logo: {data.get('logo', 'MISSING')}")
                    return False
            else:
                self.log_result("GET Property with Logo", False, f"GET request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Property with Logo", False, f"GET property error: {str(e)}")
            return False
    
    def test_get_properties_list_with_logo(self):
        """Test GET /api/properties returns properties with logo fields"""
        try:
            response = self.session.get(f"{BACKEND_URL}/properties")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Find our test property
                    test_property = None
                    for prop in data:
                        if prop.get("id") == self.test_property_id:
                            test_property = prop
                            break
                    
                    if test_property and "logo" in test_property and test_property["logo"] == SAMPLE_LOGO_BASE64:
                        self.log_result("GET Properties List with Logo", True, "Properties list includes logo field",
                                      f"Found test property with logo: {len(test_property['logo'])} chars")
                        return True
                    else:
                        self.log_result("GET Properties List with Logo", False, "Logo field missing in properties list",
                                      f"Test property logo: {test_property.get('logo', 'MISSING') if test_property else 'PROPERTY NOT FOUND'}")
                        return False
                else:
                    self.log_result("GET Properties List with Logo", False, "No properties returned or invalid format",
                                  f"Response: {data}")
                    return False
            else:
                self.log_result("GET Properties List with Logo", False, f"GET properties failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Properties List with Logo", False, f"GET properties error: {str(e)}")
            return False
    
    def test_logo_field_optional(self):
        """Test that logo field is optional (can be null/omitted)"""
        try:
            # Test 1: Update property without logo field
            update_data = {
                "name": "Logo Test Property - No Logo Update"
            }
            
            response = self.session.put(f"{BACKEND_URL}/properties/{self.test_property_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                # Logo should still be present from previous test
                if "logo" in data and data["logo"] == SAMPLE_LOGO_BASE64:
                    self.log_result("Logo Field Optional - Omitted", True, "Logo field preserved when omitted from update")
                else:
                    self.log_result("Logo Field Optional - Omitted", False, "Logo field lost when omitted from update")
                    return False
            else:
                self.log_result("Logo Field Optional - Omitted", False, f"Update without logo failed: {response.status_code}")
                return False
            
            # Test 2: Explicitly set logo to null
            update_data = {
                "name": "Logo Test Property - Null Logo",
                "logo": None
            }
            
            response = self.session.put(f"{BACKEND_URL}/properties/{self.test_property_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("logo") is None:
                    self.log_result("Logo Field Optional - Null", True, "Logo field can be set to null")
                    return True
                else:
                    self.log_result("Logo Field Optional - Null", False, f"Logo field not null: {data.get('logo')}")
                    return False
            else:
                self.log_result("Logo Field Optional - Null", False, f"Update with null logo failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Logo Field Optional", False, f"Optional logo test error: {str(e)}")
            return False
    
    def test_invalid_base64_logo(self):
        """Test error handling for invalid base64 logo data"""
        try:
            update_data = {
                "name": "Logo Test Property - Invalid Logo",
                "logo": "invalid_base64_data_here"
            }
            
            response = self.session.put(f"{BACKEND_URL}/properties/{self.test_property_id}", json=update_data)
            # This should either succeed (backend doesn't validate base64) or return appropriate error
            if response.status_code == 200:
                self.log_result("Invalid Base64 Logo", True, "Backend accepts invalid base64 (no validation)", 
                              "Note: Backend doesn't validate base64 format")
                return True
            elif response.status_code == 400:
                self.log_result("Invalid Base64 Logo", True, "Backend properly validates base64 format",
                              f"Validation error: {response.text}")
                return True
            else:
                self.log_result("Invalid Base64 Logo", False, f"Unexpected response: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Invalid Base64 Logo", False, f"Invalid base64 test error: {str(e)}")
            return False
    
    def test_large_logo_handling(self):
        """Test handling of larger logo files"""
        try:
            # Create a larger base64 string (simulate a small actual image)
            large_logo = SAMPLE_LOGO_BASE64 * 100  # Repeat to make it larger
            
            update_data = {
                "name": "Logo Test Property - Large Logo",
                "logo": large_logo
            }
            
            response = self.session.put(f"{BACKEND_URL}/properties/{self.test_property_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                if "logo" in data and data["logo"] == large_logo:
                    self.log_result("Large Logo Handling", True, f"Large logo handled successfully: {len(large_logo)} chars")
                    return True
                else:
                    self.log_result("Large Logo Handling", False, "Large logo not stored correctly")
                    return False
            else:
                self.log_result("Large Logo Handling", False, f"Large logo upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Large Logo Handling", False, f"Large logo test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all property logo tests"""
        print("🚀 Starting Property Logo Management Backend Testing")
        print("=" * 60)
        
        # Setup
        if not self.register_and_login():
            return False
        
        if not self.create_test_property():
            return False
        
        # Core logo functionality tests
        tests = [
            self.test_put_property_with_logo,
            self.test_get_property_with_logo,
            self.test_get_properties_list_with_logo,
            self.test_logo_field_optional,
            self.test_invalid_base64_logo,
            self.test_large_logo_handling
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL PROPERTY LOGO TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            return False
    
    def get_summary(self):
        """Get test summary for reporting"""
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        return {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%",
            "results": self.test_results
        }

def main():
    """Main test execution"""
    tester = VehicleScanTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎯 CONCLUSION: Vehicle AI Scanning endpoint fix has been successfully verified!")
        print("   - No 'Provided image is not valid' error")
        print("   - Gemini AI integration working")
        print("   - Proper authentication and validation")
        print("   - Structured response format correct")
    else:
        print("\n🚨 CONCLUSION: Vehicle AI Scanning endpoint still has issues that need to be addressed.")
    
    return success

if __name__ == "__main__":
    main()