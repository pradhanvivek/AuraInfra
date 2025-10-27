#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Property Manager
Tests all authentication, property, document, fixture, measurement, and AI analysis endpoints
"""

import requests
import json
import base64
import uuid
from datetime import datetime
import os

# Get backend URL from environment
BACKEND_URL = "https://estatehub-38.preview.emergentagent.com/api"

class PropertyManagerAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.username = None
        self.test_property_id = None
        self.test_document_id = None
        self.test_fixture_id = None
        self.test_measurement_id = None
        
        # Test results tracking
        self.results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log_result(self, test_name, success, message=""):
        """Log test result"""
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: PASSED {message}")
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{test_name}: {message}")
            print(f"❌ {test_name}: FAILED - {message}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if token exists
        if self.auth_token and headers is None:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
        elif self.auth_token and headers:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None
    
    def create_sample_base64_file(self, content="Sample document content"):
        """Create a sample base64 encoded file"""
        return base64.b64encode(content.encode()).decode()
    
    def create_sample_image_base64(self):
        """Create a sample base64 encoded image (minimal PNG)"""
        # Minimal 1x1 PNG image in base64
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    # ============= AUTHENTICATION TESTS =============
    
    def test_user_registration(self):
        """Test user registration"""
        test_username = f"john_doe_{uuid.uuid4().hex[:8]}"
        test_password = "SecurePass123!"
        
        data = {
            "username": test_username,
            "password": test_password
        }
        
        response = self.make_request("POST", "/auth/register", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "access_token" in result and "user_id" in result:
                self.auth_token = result["access_token"]
                self.user_id = result["user_id"]
                self.username = result["username"]
                self.log_result("User Registration", True, f"User {test_username} registered successfully")
                return True
            else:
                self.log_result("User Registration", False, "Missing token or user_id in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("User Registration", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_user_login(self):
        """Test user login with existing credentials"""
        if not self.username:
            self.log_result("User Login", False, "No username available from registration")
            return False
        
        # For this test, we'll use the same credentials from registration
        # In a real scenario, we'd use known test credentials
        data = {
            "username": self.username,
            "password": "SecurePass123!"
        }
        
        response = self.make_request("POST", "/auth/login", data, headers={})
        
        if response and response.status_code == 200:
            result = response.json()
            if "access_token" in result:
                # Update token with login token
                self.auth_token = result["access_token"]
                self.log_result("User Login", True, f"User {self.username} logged in successfully")
                return True
            else:
                self.log_result("User Login", False, "Missing access_token in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("User Login", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= PROPERTY TESTS =============
    
    def test_create_property(self):
        """Test creating a new property"""
        data = {
            "name": "Sunset Villa Estate",
            "address": "123 Ocean Drive, Miami Beach, FL 33139"
        }
        
        response = self.make_request("POST", "/properties", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and result["name"] == data["name"]:
                self.test_property_id = result["id"]
                self.log_result("Create Property", True, f"Property '{data['name']}' created with ID: {self.test_property_id}")
                return True
            else:
                self.log_result("Create Property", False, "Missing ID or incorrect name in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Create Property", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_properties(self):
        """Test getting all properties for user"""
        response = self.make_request("GET", "/properties")
        
        if response and response.status_code == 200:
            properties = response.json()
            if isinstance(properties, list) and len(properties) > 0:
                # Check if our test property is in the list
                found_property = any(prop.get("id") == self.test_property_id for prop in properties)
                if found_property:
                    self.log_result("Get Properties", True, f"Retrieved {len(properties)} properties including test property")
                    return True
                else:
                    self.log_result("Get Properties", False, "Test property not found in properties list")
            else:
                self.log_result("Get Properties", False, "No properties returned or invalid format")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Properties", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_property_by_id(self):
        """Test getting a specific property by ID"""
        if not self.test_property_id:
            self.log_result("Get Property by ID", False, "No test property ID available")
            return False
        
        response = self.make_request("GET", f"/properties/{self.test_property_id}")
        
        if response and response.status_code == 200:
            property_data = response.json()
            if property_data.get("id") == self.test_property_id:
                self.log_result("Get Property by ID", True, f"Retrieved property: {property_data.get('name')}")
                return True
            else:
                self.log_result("Get Property by ID", False, "Property ID mismatch")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Property by ID", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= DOCUMENT TESTS =============
    
    def test_create_document(self):
        """Test uploading a document to a property"""
        if not self.test_property_id:
            self.log_result("Create Document", False, "No test property ID available")
            return False
        
        data = {
            "name": "Property Deed.pdf",
            "file_data": self.create_sample_base64_file("This is a sample property deed document content."),
            "file_type": "application/pdf"
        }
        
        response = self.make_request("POST", f"/properties/{self.test_property_id}/documents", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and result["name"] == data["name"]:
                self.test_document_id = result["id"]
                self.log_result("Create Document", True, f"Document '{data['name']}' uploaded with ID: {self.test_document_id}")
                return True
            else:
                self.log_result("Create Document", False, "Missing ID or incorrect name in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Create Document", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_documents(self):
        """Test getting all documents for a property"""
        if not self.test_property_id:
            self.log_result("Get Documents", False, "No test property ID available")
            return False
        
        response = self.make_request("GET", f"/properties/{self.test_property_id}/documents")
        
        if response and response.status_code == 200:
            documents = response.json()
            if isinstance(documents, list) and len(documents) > 0:
                found_document = any(doc.get("id") == self.test_document_id for doc in documents)
                if found_document:
                    self.log_result("Get Documents", True, f"Retrieved {len(documents)} documents including test document")
                    return True
                else:
                    self.log_result("Get Documents", False, "Test document not found in documents list")
            else:
                self.log_result("Get Documents", False, "No documents returned or invalid format")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Documents", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= FIXTURE TESTS =============
    
    def test_create_fixture(self):
        """Test creating a fixture for a property"""
        if not self.test_property_id:
            self.log_result("Create Fixture", False, "No test property ID available")
            return False
        
        data = {
            "name": "Living Room Ceiling Fan",
            "category": "fans",
            "make": "Hunter",
            "model": "Builder Plus",
            "serial_number": "HF52001-WH",
            "warranty_info": "5 year limited warranty",
            "photo": self.create_sample_image_base64()
        }
        
        response = self.make_request("POST", f"/properties/{self.test_property_id}/fixtures", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and result["name"] == data["name"]:
                self.test_fixture_id = result["id"]
                self.log_result("Create Fixture", True, f"Fixture '{data['name']}' created with ID: {self.test_fixture_id}")
                return True
            else:
                self.log_result("Create Fixture", False, "Missing ID or incorrect name in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Create Fixture", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_fixtures(self):
        """Test getting all fixtures for a property"""
        if not self.test_property_id:
            self.log_result("Get Fixtures", False, "No test property ID available")
            return False
        
        response = self.make_request("GET", f"/properties/{self.test_property_id}/fixtures")
        
        if response and response.status_code == 200:
            fixtures = response.json()
            if isinstance(fixtures, list) and len(fixtures) > 0:
                found_fixture = any(fix.get("id") == self.test_fixture_id for fix in fixtures)
                if found_fixture:
                    self.log_result("Get Fixtures", True, f"Retrieved {len(fixtures)} fixtures including test fixture")
                    return True
                else:
                    self.log_result("Get Fixtures", False, "Test fixture not found in fixtures list")
            else:
                self.log_result("Get Fixtures", False, "No fixtures returned or invalid format")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Fixtures", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_fixture_by_id(self):
        """Test getting a specific fixture by ID"""
        if not self.test_property_id or not self.test_fixture_id:
            self.log_result("Get Fixture by ID", False, "No test property or fixture ID available")
            return False
        
        response = self.make_request("GET", f"/properties/{self.test_property_id}/fixtures/{self.test_fixture_id}")
        
        if response and response.status_code == 200:
            fixture_data = response.json()
            if fixture_data.get("id") == self.test_fixture_id:
                self.log_result("Get Fixture by ID", True, f"Retrieved fixture: {fixture_data.get('name')}")
                return True
            else:
                self.log_result("Get Fixture by ID", False, "Fixture ID mismatch")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Fixture by ID", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_update_fixture(self):
        """Test updating a fixture"""
        if not self.test_property_id or not self.test_fixture_id:
            self.log_result("Update Fixture", False, "No test property or fixture ID available")
            return False
        
        data = {
            "name": "Living Room Ceiling Fan - Updated",
            "category": "fans",
            "make": "Hunter",
            "model": "Builder Plus Pro",
            "serial_number": "HF52001-WH-PRO",
            "warranty_info": "7 year extended warranty"
        }
        
        response = self.make_request("PUT", f"/properties/{self.test_property_id}/fixtures/{self.test_fixture_id}", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get("name") == data["name"] and result.get("model") == data["model"]:
                self.log_result("Update Fixture", True, f"Fixture updated successfully: {data['name']}")
                return True
            else:
                self.log_result("Update Fixture", False, "Fixture data not updated correctly")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Update Fixture", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= MEASUREMENT TESTS =============
    
    def test_create_measurement(self):
        """Test creating a measurement for a property"""
        if not self.test_property_id:
            self.log_result("Create Measurement", False, "No test property ID available")
            return False
        
        data = {
            "room_type": "master_bedroom",
            "length": 14.5,
            "width": 12.0,
            "height": 9.0,
            "unit": "feet",
            "floor_plan_image": self.create_sample_image_base64(),
            "notes": "Master bedroom with walk-in closet and ensuite bathroom"
        }
        
        response = self.make_request("POST", f"/properties/{self.test_property_id}/measurements", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "id" in result and result["room_type"] == data["room_type"]:
                self.test_measurement_id = result["id"]
                self.log_result("Create Measurement", True, f"Measurement for '{data['room_type']}' created with ID: {self.test_measurement_id}")
                return True
            else:
                self.log_result("Create Measurement", False, "Missing ID or incorrect room_type in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Create Measurement", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_get_measurements(self):
        """Test getting all measurements for a property"""
        if not self.test_property_id:
            self.log_result("Get Measurements", False, "No test property ID available")
            return False
        
        response = self.make_request("GET", f"/properties/{self.test_property_id}/measurements")
        
        if response and response.status_code == 200:
            measurements = response.json()
            if isinstance(measurements, list) and len(measurements) > 0:
                found_measurement = any(m.get("id") == self.test_measurement_id for m in measurements)
                if found_measurement:
                    self.log_result("Get Measurements", True, f"Retrieved {len(measurements)} measurements including test measurement")
                    return True
                else:
                    self.log_result("Get Measurements", False, "Test measurement not found in measurements list")
            else:
                self.log_result("Get Measurements", False, "No measurements returned or invalid format")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Get Measurements", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= AI ANALYSIS TESTS =============
    
    def test_ai_floorplan_analysis(self):
        """Test AI floor plan analysis"""
        data = {
            "floor_plan_image": self.create_sample_image_base64()
        }
        
        response = self.make_request("POST", "/measurements/analyze-floorplan", data)
        
        if response and response.status_code == 200:
            result = response.json()
            if "analysis" in result and "message" in result:
                self.log_result("AI Floor Plan Analysis", True, "Floor plan analyzed successfully")
                return True
            else:
                self.log_result("AI Floor Plan Analysis", False, "Missing analysis or message in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("AI Floor Plan Analysis", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= DELETION TESTS =============
    
    def test_delete_measurement(self):
        """Test deleting a measurement"""
        if not self.test_property_id or not self.test_measurement_id:
            self.log_result("Delete Measurement", False, "No test property or measurement ID available")
            return False
        
        response = self.make_request("DELETE", f"/properties/{self.test_property_id}/measurements/{self.test_measurement_id}")
        
        if response and response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Delete Measurement", True, "Measurement deleted successfully")
                return True
            else:
                self.log_result("Delete Measurement", False, "No success message in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Delete Measurement", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_delete_fixture(self):
        """Test deleting a fixture"""
        if not self.test_property_id or not self.test_fixture_id:
            self.log_result("Delete Fixture", False, "No test property or fixture ID available")
            return False
        
        response = self.make_request("DELETE", f"/properties/{self.test_property_id}/fixtures/{self.test_fixture_id}")
        
        if response and response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Delete Fixture", True, "Fixture deleted successfully")
                return True
            else:
                self.log_result("Delete Fixture", False, "No success message in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Delete Fixture", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_delete_document(self):
        """Test deleting a document"""
        if not self.test_property_id or not self.test_document_id:
            self.log_result("Delete Document", False, "No test property or document ID available")
            return False
        
        response = self.make_request("DELETE", f"/properties/{self.test_property_id}/documents/{self.test_document_id}")
        
        if response and response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Delete Document", True, "Document deleted successfully")
                return True
            else:
                self.log_result("Delete Document", False, "No success message in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Delete Document", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    def test_delete_property(self):
        """Test deleting a property"""
        if not self.test_property_id:
            self.log_result("Delete Property", False, "No test property ID available")
            return False
        
        response = self.make_request("DELETE", f"/properties/{self.test_property_id}")
        
        if response and response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Delete Property", True, "Property deleted successfully")
                return True
            else:
                self.log_result("Delete Property", False, "No success message in response")
        else:
            error_msg = response.json().get("detail", "Unknown error") if response else "No response"
            self.log_result("Delete Property", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False
    
    # ============= MAIN TEST RUNNER =============
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"\n🚀 Starting Property Manager API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        print("-" * 30)
        self.test_user_registration()
        self.test_user_login()
        
        # Property Tests
        print("\n🏠 PROPERTY TESTS")
        print("-" * 30)
        self.test_create_property()
        self.test_get_properties()
        self.test_get_property_by_id()
        
        # Document Tests
        print("\n📄 DOCUMENT TESTS")
        print("-" * 30)
        self.test_create_document()
        self.test_get_documents()
        
        # Fixture Tests
        print("\n🔧 FIXTURE TESTS")
        print("-" * 30)
        self.test_create_fixture()
        self.test_get_fixtures()
        self.test_get_fixture_by_id()
        self.test_update_fixture()
        
        # Measurement Tests
        print("\n📏 MEASUREMENT TESTS")
        print("-" * 30)
        self.test_create_measurement()
        self.test_get_measurements()
        
        # AI Analysis Tests
        print("\n🤖 AI ANALYSIS TESTS")
        print("-" * 30)
        self.test_ai_floorplan_analysis()
        
        # Deletion Tests
        print("\n🗑️ DELETION TESTS")
        print("-" * 30)
        self.test_delete_measurement()
        self.test_delete_fixture()
        self.test_delete_document()
        self.test_delete_property()
        
        # Final Results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📈 Success Rate: {(self.results['passed'] / (self.results['passed'] + self.results['failed']) * 100):.1f}%")
        
        if self.results['errors']:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        return self.results

if __name__ == "__main__":
    tester = PropertyManagerAPITester()
    results = tester.run_all_tests()