#!/usr/bin/env python3
"""
Backend API Testing for Property Management App
Testing Focus: Property Cost Fields, Appliance Edit, Jewelry Edit
"""

import requests
import json
import base64
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Configuration
BASE_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://asset-manager-ai.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def setup_auth(self):
        """Register a test user and get authentication token"""
        print("\n=== AUTHENTICATION SETUP ===")
        
        # Generate unique username
        username = f"testuser_{uuid.uuid4().hex[:8]}"
        password = "testpass123"
        
        # Register user
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json={
                "username": username,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data['access_token']
                self.user_id = data['user_id']
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                self.log_result("User Registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_result("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Exception: {str(e)}")
            return False
    
    def test_property_cost_fields(self):
        """Test Property Cost Fields Backend functionality"""
        print("\n=== TESTING PROPERTY COST FIELDS ===")
        
        # Test 1: Create property with purchase_cost and current_value
        try:
            property_data = {
                "name": "Luxury Villa with Cost Fields",
                "address": "123 Test Street, Mumbai, India",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "purchase_cost": 5000000.50,
                "current_value": 6500000.75
            }
            
            response = self.session.post(f"{API_BASE}/properties", json=property_data)
            
            if response.status_code == 200:
                created_property = response.json()
                property_id = created_property['id']
                
                # Verify cost fields are returned
                if (created_property.get('purchase_cost') == 5000000.50 and 
                    created_property.get('current_value') == 6500000.75):
                    self.log_result("Property Create with Cost Fields", True, 
                                  f"Property ID: {property_id}, Purchase: ₹{created_property['purchase_cost']}, Current: ₹{created_property['current_value']}")
                else:
                    self.log_result("Property Create with Cost Fields", False, 
                                  f"Cost fields not returned correctly. Got: purchase_cost={created_property.get('purchase_cost')}, current_value={created_property.get('current_value')}")
                    return
            else:
                self.log_result("Property Create with Cost Fields", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_result("Property Create with Cost Fields", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Get property by ID and verify cost fields
        try:
            response = self.session.get(f"{API_BASE}/properties/{property_id}")
            
            if response.status_code == 200:
                property_data = response.json()
                if (property_data.get('purchase_cost') == 5000000.50 and 
                    property_data.get('current_value') == 6500000.75):
                    self.log_result("Property Get by ID with Cost Fields", True, 
                                  f"Cost fields retrieved correctly")
                else:
                    self.log_result("Property Get by ID with Cost Fields", False, 
                                  f"Cost fields not retrieved correctly")
            else:
                self.log_result("Property Get by ID with Cost Fields", False, 
                              f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Property Get by ID with Cost Fields", False, f"Exception: {str(e)}")
        
        # Test 3: Update property cost fields
        try:
            update_data = {
                "purchase_cost": 5500000.00,
                "current_value": 7000000.00
            }
            
            response = self.session.put(f"{API_BASE}/properties/{property_id}", json=update_data)
            
            if response.status_code == 200:
                updated_property = response.json()
                if (updated_property.get('purchase_cost') == 5500000.00 and 
                    updated_property.get('current_value') == 7000000.00):
                    self.log_result("Property Update Cost Fields", True, 
                                  f"Updated to Purchase: ₹{updated_property['purchase_cost']}, Current: ₹{updated_property['current_value']}")
                else:
                    self.log_result("Property Update Cost Fields", False, 
                                  f"Cost fields not updated correctly")
            else:
                self.log_result("Property Update Cost Fields", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Property Update Cost Fields", False, f"Exception: {str(e)}")
        
        # Test 4: Create property with null/missing cost fields (optional fields)
        try:
            property_data_minimal = {
                "name": "Basic Property No Cost",
                "address": "456 Simple Street, Delhi, India"
            }
            
            response = self.session.post(f"{API_BASE}/properties", json=property_data_minimal)
            
            if response.status_code == 200:
                created_property = response.json()
                # Cost fields should be null or not present
                purchase_cost = created_property.get('purchase_cost')
                current_value = created_property.get('current_value')
                
                if purchase_cost is None and current_value is None:
                    self.log_result("Property Create without Cost Fields", True, 
                                  "Optional cost fields handled correctly (null values)")
                else:
                    self.log_result("Property Create without Cost Fields", False, 
                                  f"Expected null values, got purchase_cost={purchase_cost}, current_value={current_value}")
            else:
                self.log_result("Property Create without Cost Fields", False, 
                              f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Property Create without Cost Fields", False, f"Exception: {str(e)}")
    
    def test_appliance_edit_functionality(self):
        """Test Appliance Edit (PUT) functionality"""
        print("\n=== TESTING APPLIANCE EDIT FUNCTIONALITY ===")
        
        # Test 1: Create an appliance first
        try:
            appliance_data = {
                "name": "Samsung Smart TV",
                "category": "TV",
                "brand": "Samsung",
                "model": "QN65Q80A",
                "serial_number": "SN123456789",
                "purchase_date": "2024-01-15",
                "purchase_cost": 85000.00,
                "current_value": 75000.00,
                "warranty_info": "2 years manufacturer warranty",
                "warranty_expiry_date": "2026-01-15",
                "photos": ["base64encodedphoto1", "base64encodedphoto2"],
                "invoice": "base64encodedinvoice",
                "notes": "Living room TV with smart features",
                "maintenance_frequency_months": 12
            }
            
            response = self.session.post(f"{API_BASE}/appliances", json=appliance_data)
            
            if response.status_code == 200:
                created_appliance = response.json()
                appliance_id = created_appliance['id']
                self.log_result("Appliance Create for Edit Test", True, 
                              f"Appliance ID: {appliance_id}")
            else:
                self.log_result("Appliance Create for Edit Test", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_result("Appliance Create for Edit Test", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Update the appliance using PUT
        try:
            updated_data = {
                "name": "Samsung Smart TV - Updated",
                "category": "TV",
                "brand": "Samsung",
                "model": "QN65Q80A-UPDATED",
                "serial_number": "SN123456789-NEW",
                "purchase_date": "2024-01-15",
                "purchase_cost": 90000.00,
                "current_value": 80000.00,
                "warranty_info": "3 years extended warranty",
                "warranty_expiry_date": "2027-01-15",
                "photos": ["base64encodedphoto1-updated", "base64encodedphoto2-updated", "base64encodedphoto3-new"],
                "invoice": "base64encodedinvoice-updated",
                "notes": "Living room TV with smart features - Updated with extended warranty",
                "last_maintenance_date": "2024-12-01",
                "next_maintenance_date": "2025-12-01",
                "maintenance_frequency_months": 6
            }
            
            response = self.session.put(f"{API_BASE}/appliances/{appliance_id}", json=updated_data)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('message') == 'Appliance updated successfully':
                    self.log_result("Appliance PUT Update", True, 
                                  "Appliance updated successfully")
                else:
                    self.log_result("Appliance PUT Update", False, 
                                  f"Unexpected response: {result}")
            else:
                self.log_result("Appliance PUT Update", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_result("Appliance PUT Update", False, f"Exception: {str(e)}")
            return
        
        # Test 3: Verify the update by getting the appliance
        try:
            response = self.session.get(f"{API_BASE}/appliances/{appliance_id}")
            
            if response.status_code == 200:
                appliance = response.json()
                
                # Verify key fields were updated
                checks = [
                    (appliance.get('name') == "Samsung Smart TV - Updated", "name"),
                    (appliance.get('model') == "QN65Q80A-UPDATED", "model"),
                    (appliance.get('serial_number') == "SN123456789-NEW", "serial_number"),
                    (appliance.get('purchase_cost') == 90000.00, "purchase_cost"),
                    (appliance.get('current_value') == 80000.00, "current_value"),
                    (appliance.get('warranty_info') == "3 years extended warranty", "warranty_info"),
                    (appliance.get('warranty_expiry_date') == "2027-01-15", "warranty_expiry_date"),
                    (len(appliance.get('photos', [])) == 3, "photos count"),
                    (appliance.get('invoice') == "base64encodedinvoice-updated", "invoice"),
                    (appliance.get('maintenance_frequency_months') == 6, "maintenance_frequency_months")
                ]
                
                failed_checks = [field for passed, field in checks if not passed]
                
                if not failed_checks:
                    self.log_result("Appliance Update Verification", True, 
                                  "All fields updated correctly")
                else:
                    self.log_result("Appliance Update Verification", False, 
                                  f"Failed fields: {', '.join(failed_checks)}")
            else:
                self.log_result("Appliance Update Verification", False, 
                              f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Appliance Update Verification", False, f"Exception: {str(e)}")
    
    def test_jewelry_edit_functionality(self):
        """Test Jewelry Edit (PUT) functionality"""
        print("\n=== TESTING JEWELRY EDIT FUNCTIONALITY ===")
        
        # Test 1: Create a jewelry item first
        try:
            jewelry_data = {
                "name": "Diamond Engagement Ring",
                "type": "Ring",
                "metal": "White Gold",
                "stones": "1 carat diamond, 2 small rubies",
                "number_of_stones": 3,
                "weight": 5.2,
                "purchase_date": "2024-02-14",
                "purchase_cost": 150000.00,
                "appraisal_value": 180000.00,
                "appraisal_date": "2024-02-20",
                "certificate_number": "GIA-123456789",
                "certificate_photo": "base64encodedcertificate",
                "photos": ["base64encodedphoto1", "base64encodedphoto2"],
                "notes": "Engagement ring with certified diamond",
                "warranty_info": "Lifetime warranty on setting",
                "warranty_expiry_date": "2099-12-31"
            }
            
            response = self.session.post(f"{API_BASE}/jewelry", json=jewelry_data)
            
            if response.status_code == 200:
                created_jewelry = response.json()
                jewelry_id = created_jewelry['id']
                self.log_result("Jewelry Create for Edit Test", True, 
                              f"Jewelry ID: {jewelry_id}")
            else:
                self.log_result("Jewelry Create for Edit Test", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_result("Jewelry Create for Edit Test", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Update the jewelry using PUT
        try:
            updated_data = {
                "name": "Diamond Engagement Ring - Resized",
                "type": "Ring",
                "metal": "Platinum",
                "stones": "1.2 carat diamond, 4 small rubies",
                "number_of_stones": 5,
                "weight": 6.1,
                "purchase_date": "2024-02-14",
                "purchase_cost": 150000.00,
                "appraisal_value": 220000.00,
                "appraisal_date": "2024-12-01",
                "certificate_number": "GIA-123456789-UPDATED",
                "certificate_photo": "base64encodedcertificate-updated",
                "photos": ["base64encodedphoto1-updated", "base64encodedphoto2-updated", "base64encodedphoto3-new"],
                "notes": "Engagement ring with certified diamond - Upgraded and resized",
                "warranty_info": "Lifetime warranty on setting and stones",
                "warranty_expiry_date": "2099-12-31"
            }
            
            response = self.session.put(f"{API_BASE}/jewelry/{jewelry_id}", json=updated_data)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('message') == 'Jewelry updated successfully':
                    self.log_result("Jewelry PUT Update", True, 
                                  "Jewelry updated successfully")
                else:
                    self.log_result("Jewelry PUT Update", False, 
                                  f"Unexpected response: {result}")
            else:
                self.log_result("Jewelry PUT Update", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_result("Jewelry PUT Update", False, f"Exception: {str(e)}")
            return
        
        # Test 3: Verify the update by getting the jewelry
        try:
            response = self.session.get(f"{API_BASE}/jewelry/{jewelry_id}")
            
            if response.status_code == 200:
                jewelry = response.json()
                
                # Verify key fields were updated
                checks = [
                    (jewelry.get('name') == "Diamond Engagement Ring - Resized", "name"),
                    (jewelry.get('metal') == "Platinum", "metal"),
                    (jewelry.get('stones') == "1.2 carat diamond, 4 small rubies", "stones"),
                    (jewelry.get('number_of_stones') == 5, "number_of_stones"),
                    (jewelry.get('weight') == 6.1, "weight"),
                    (jewelry.get('appraisal_value') == 220000.00, "appraisal_value"),
                    (jewelry.get('appraisal_date') == "2024-12-01", "appraisal_date"),
                    (jewelry.get('certificate_number') == "GIA-123456789-UPDATED", "certificate_number"),
                    (jewelry.get('certificate_photo') == "base64encodedcertificate-updated", "certificate_photo"),
                    (len(jewelry.get('photos', [])) == 3, "photos count"),
                    (jewelry.get('warranty_info') == "Lifetime warranty on setting and stones", "warranty_info")
                ]
                
                failed_checks = [field for passed, field in checks if not passed]
                
                if not failed_checks:
                    self.log_result("Jewelry Update Verification", True, 
                                  "All fields updated correctly")
                else:
                    self.log_result("Jewelry Update Verification", False, 
                                  f"Failed fields: {', '.join(failed_checks)}")
            else:
                self.log_result("Jewelry Update Verification", False, 
                              f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Jewelry Update Verification", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests")
        print(f"📍 API Base URL: {API_BASE}")
        print(f"⏰ Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Setup authentication
        if not self.setup_auth():
            print("❌ Authentication setup failed. Cannot proceed with tests.")
            return False
        
        # Run all test suites
        self.test_property_cost_fields()
        self.test_appliance_edit_functionality()
        self.test_jewelry_edit_functionality()
        
        # Print summary
        self.print_summary()
        
        return all(result['success'] for result in self.test_results)
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 BACKEND TESTING SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result['success']:
                print(f"   • {result['test']}")
        
        print("="*60)

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed successfully!")
        exit(0)
    else:
        print("\n💥 Some tests failed!")
        exit(1)