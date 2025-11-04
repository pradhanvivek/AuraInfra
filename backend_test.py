#!/usr/bin/env python3
"""
Backend Testing for HOA Admin Portal Bug Fixes
Tests the 3 bug fixes for HOA admin authorization on amenities and meetings endpoints.
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os

# Get backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://hoa-portal-fixes.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_assets = {}  # Store created test assets
        self.test_maintenance = {}  # Store created maintenance records
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def register_and_login(self):
        """Register a test user and login to get access token"""
        try:
            # Register user
            register_data = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user_id"]
                self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                self.log(f"✅ User registered and logged in: {TEST_USERNAME}")
                return True
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}")
            return False
    
    def create_test_assets(self):
        """Create test assets for maintenance testing"""
        try:
            # Create test property
            property_data = {
                "name": "Test Property for Maintenance",
                "address": "123 Test Street, Mumbai, Maharashtra",
                "purchase_cost": 5000000.0,
                "current_value": 6000000.0
            }
            
            response = self.session.post(f"{BACKEND_URL}/properties", json=property_data)
            if response.status_code == 200:
                property_id = response.json()["id"]
                self.test_assets["property"] = {
                    "id": property_id,
                    "name": "Test Property for Maintenance"
                }
                self.log(f"✅ Test property created: {property_id}")
            
            # Create test vehicle
            vehicle_data = {
                "name": "Test BMW X5",
                "make": "BMW",
                "model": "X5",
                "year": 2022,
                "purchase_cost": 8000000.0,
                "current_value": 7500000.0,
                "maintenance_frequency_months": 6
            }
            
            response = self.session.post(f"{BACKEND_URL}/vehicles", json=vehicle_data)
            if response.status_code == 200:
                vehicle_id = response.json()["id"]
                self.test_assets["vehicle"] = {
                    "id": vehicle_id,
                    "name": "Test BMW X5"
                }
                self.log(f"✅ Test vehicle created: {vehicle_id}")
            
            # Create test appliance
            appliance_data = {
                "name": "Test Samsung Refrigerator",
                "category": "Refrigerator",
                "brand": "Samsung",
                "model": "RT28T3922S8",
                "purchase_cost": 45000.0,
                "current_value": 40000.0,
                "maintenance_frequency_months": 12
            }
            
            response = self.session.post(f"{BACKEND_URL}/appliances", json=appliance_data)
            if response.status_code == 200:
                appliance_id = response.json()["id"]
                self.test_assets["appliance"] = {
                    "id": appliance_id,
                    "name": "Test Samsung Refrigerator"
                }
                self.log(f"✅ Test appliance created: {appliance_id}")
                
            return True
            
        except Exception as e:
            self.log(f"❌ Error creating test assets: {str(e)}")
            return False
    
    def test_portfolio_details_endpoint(self):
        """Test GET /api/portfolio/details endpoint"""
        self.log("\n=== Testing Portfolio Details Endpoint ===")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/portfolio/details")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                expected_keys = ["properties", "vehicles", "appliances", "jewelry", "furniture", "art"]
                missing_keys = [key for key in expected_keys if key not in data]
                
                if missing_keys:
                    self.log(f"❌ Portfolio details missing keys: {missing_keys}")
                    return False
                
                # Verify we have our test assets
                properties_found = any(p.get("name") == "Test Property for Maintenance" for p in data["properties"])
                vehicles_found = any(v.get("name") == "Test BMW X5" for v in data["vehicles"])
                appliances_found = any(a.get("name") == "Test Samsung Refrigerator" for a in data["appliances"])
                
                if properties_found and vehicles_found and appliances_found:
                    self.log("✅ Portfolio details endpoint - All test assets found")
                else:
                    self.log(f"⚠️ Portfolio details endpoint - Some test assets missing (P:{properties_found}, V:{vehicles_found}, A:{appliances_found})")
                
                # Verify ObjectId conversion to string
                for category in expected_keys:
                    for item in data[category]:
                        if "_id" in item and not isinstance(item["_id"], str):
                            self.log(f"❌ Portfolio details - ObjectId not converted to string in {category}")
                            return False
                
                self.log("✅ Portfolio details endpoint - ObjectId conversion working")
                self.log(f"✅ Portfolio details endpoint - Response structure correct with {len(data['properties'])} properties, {len(data['vehicles'])} vehicles, {len(data['appliances'])} appliances")
                return True
                
            else:
                self.log(f"❌ Portfolio details endpoint failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Portfolio details endpoint error: {str(e)}")
            return False
    
    def test_maintenance_create_endpoint(self):
        """Test POST /api/maintenance endpoint"""
        self.log("\n=== Testing Maintenance Create Endpoint ===")
        
        try:
            # Test creating maintenance for different asset types
            test_cases = []
            
            # Property maintenance
            if "property" in self.test_assets:
                test_cases.append({
                    "asset_type": "property",
                    "asset_id": self.test_assets["property"]["id"],
                    "asset_name": self.test_assets["property"]["name"],
                    "maintenance_type": "inspection",
                    "description": "Annual property inspection and maintenance check",
                    "due_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                    "cost": 15000.0,
                    "notes": "Check plumbing, electrical, and structural integrity",
                    "recurring": True,
                    "recurring_interval_days": 365
                })
            
            # Vehicle maintenance
            if "vehicle" in self.test_assets:
                test_cases.append({
                    "asset_type": "vehicle",
                    "asset_id": self.test_assets["vehicle"]["id"],
                    "asset_name": self.test_assets["vehicle"]["name"],
                    "maintenance_type": "service",
                    "description": "Regular vehicle servicing and oil change",
                    "due_date": (datetime.utcnow() + timedelta(days=15)).isoformat(),
                    "cost": 8000.0,
                    "notes": "Engine oil change, brake check, tire rotation",
                    "recurring": True,
                    "recurring_interval_days": 180
                })
            
            # Appliance maintenance
            if "appliance" in self.test_assets:
                test_cases.append({
                    "asset_type": "appliance",
                    "asset_id": self.test_assets["appliance"]["id"],
                    "asset_name": self.test_assets["appliance"]["name"],
                    "maintenance_type": "cleaning",
                    "description": "Deep cleaning and filter replacement",
                    "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                    "cost": 2500.0,
                    "notes": "Clean coils, replace water filter, check seals",
                    "recurring": False
                })
            
            success_count = 0
            for i, maintenance_data in enumerate(test_cases):
                response = self.session.post(f"{BACKEND_URL}/maintenance", json=maintenance_data)
                
                if response.status_code == 200:
                    created_maintenance = response.json()
                    maintenance_id = created_maintenance["id"]
                    self.test_maintenance[f"maintenance_{i}"] = {
                        "id": maintenance_id,
                        "asset_type": maintenance_data["asset_type"],
                        "recurring": maintenance_data["recurring"]
                    }
                    
                    # Verify response structure
                    required_fields = ["id", "asset_type", "asset_id", "asset_name", "maintenance_type", 
                                     "description", "due_date", "completed", "user_id", "created_at"]
                    missing_fields = [field for field in required_fields if field not in created_maintenance]
                    
                    if missing_fields:
                        self.log(f"❌ Maintenance create - Missing fields: {missing_fields}")
                    else:
                        success_count += 1
                        self.log(f"✅ Maintenance created for {maintenance_data['asset_type']}: {maintenance_id}")
                else:
                    self.log(f"❌ Maintenance create failed for {maintenance_data['asset_type']}: {response.status_code} - {response.text}")
            
            if success_count == len(test_cases):
                self.log(f"✅ Maintenance create endpoint - All {success_count} test cases passed")
                return True
            else:
                self.log(f"⚠️ Maintenance create endpoint - {success_count}/{len(test_cases)} test cases passed")
                return False
                
        except Exception as e:
            self.log(f"❌ Maintenance create endpoint error: {str(e)}")
            return False
    
    def test_maintenance_get_endpoint(self):
        """Test GET /api/maintenance endpoint with filters"""
        self.log("\n=== Testing Maintenance Get Endpoint ===")
        
        try:
            test_results = []
            
            # Test 1: Get all maintenance (no filters)
            response = self.session.get(f"{BACKEND_URL}/maintenance")
            if response.status_code == 200:
                all_maintenance = response.json()
                test_results.append(f"✅ Get all maintenance: {len(all_maintenance)} records")
            else:
                test_results.append(f"❌ Get all maintenance failed: {response.status_code}")
            
            # Test 2: Filter by asset_type
            response = self.session.get(f"{BACKEND_URL}/maintenance?asset_type=vehicle")
            if response.status_code == 200:
                vehicle_maintenance = response.json()
                vehicle_count = len([m for m in vehicle_maintenance if m.get("asset_type") == "vehicle"])
                test_results.append(f"✅ Filter by asset_type=vehicle: {vehicle_count} records")
            else:
                test_results.append(f"❌ Filter by asset_type failed: {response.status_code}")
            
            # Test 3: Filter by completed status
            response = self.session.get(f"{BACKEND_URL}/maintenance?completed=false")
            if response.status_code == 200:
                incomplete_maintenance = response.json()
                incomplete_count = len([m for m in incomplete_maintenance if not m.get("completed")])
                test_results.append(f"✅ Filter by completed=false: {incomplete_count} records")
            else:
                test_results.append(f"❌ Filter by completed failed: {response.status_code}")
            
            # Test 4: Filter by upcoming_days
            response = self.session.get(f"{BACKEND_URL}/maintenance?upcoming_days=30")
            if response.status_code == 200:
                upcoming_maintenance = response.json()
                test_results.append(f"✅ Filter by upcoming_days=30: {len(upcoming_maintenance)} records")
            else:
                test_results.append(f"❌ Filter by upcoming_days failed: {response.status_code}")
            
            # Test 5: Filter by specific asset
            if "property" in self.test_assets:
                asset_id = self.test_assets["property"]["id"]
                response = self.session.get(f"{BACKEND_URL}/maintenance?asset_type=property&asset_id={asset_id}")
                if response.status_code == 200:
                    asset_maintenance = response.json()
                    test_results.append(f"✅ Filter by specific asset: {len(asset_maintenance)} records")
                else:
                    test_results.append(f"❌ Filter by specific asset failed: {response.status_code}")
            
            # Test 6: Verify sorting by due_date
            if response.status_code == 200 and len(all_maintenance) > 1:
                dates = [datetime.fromisoformat(m["due_date"].replace("Z", "+00:00")) for m in all_maintenance if "due_date" in m]
                is_sorted = all(dates[i] <= dates[i+1] for i in range(len(dates)-1))
                if is_sorted:
                    test_results.append("✅ Maintenance records sorted by due_date")
                else:
                    test_results.append("❌ Maintenance records not properly sorted")
            
            for result in test_results:
                self.log(result)
            
            success_count = len([r for r in test_results if r.startswith("✅")])
            total_tests = len(test_results)
            
            if success_count == total_tests:
                self.log(f"✅ Maintenance get endpoint - All {success_count} tests passed")
                return True
            else:
                self.log(f"⚠️ Maintenance get endpoint - {success_count}/{total_tests} tests passed")
                return False
                
        except Exception as e:
            self.log(f"❌ Maintenance get endpoint error: {str(e)}")
            return False
    
    def test_maintenance_update_and_recurring(self):
        """Test PUT /api/maintenance/{id} endpoint and recurring functionality"""
        self.log("\n=== Testing Maintenance Update & Recurring ===")
        
        try:
            test_results = []
            
            # Find a recurring maintenance record to test
            recurring_maintenance = None
            for key, maintenance in self.test_maintenance.items():
                if maintenance.get("recurring"):
                    recurring_maintenance = maintenance
                    break
            
            if not recurring_maintenance:
                self.log("❌ No recurring maintenance found for testing")
                return False
            
            maintenance_id = recurring_maintenance["id"]
            
            # Test 1: Update maintenance fields
            update_data = {
                "cost": 12000.0,
                "notes": "Updated maintenance notes with additional details"
            }
            
            response = self.session.put(f"{BACKEND_URL}/maintenance/{maintenance_id}", json=update_data)
            if response.status_code == 200:
                test_results.append("✅ Maintenance update - Basic field update successful")
            else:
                test_results.append(f"❌ Maintenance update failed: {response.status_code} - {response.text}")
            
            # Test 2: Mark as complete and test recurring functionality
            complete_data = {
                "completed": True,
                "completed_date": datetime.utcnow().isoformat()
            }
            
            # Get count of maintenance records before completion
            response = self.session.get(f"{BACKEND_URL}/maintenance")
            if response.status_code == 200:
                before_count = len(response.json())
            else:
                before_count = 0
            
            # Mark as complete
            response = self.session.put(f"{BACKEND_URL}/maintenance/{maintenance_id}", json=complete_data)
            if response.status_code == 200:
                test_results.append("✅ Maintenance update - Mark as complete successful")
                
                # Wait a moment for recurring maintenance to be created
                import time
                time.sleep(1)
                
                # Check if new recurring maintenance was created
                response = self.session.get(f"{BACKEND_URL}/maintenance")
                if response.status_code == 200:
                    after_count = len(response.json())
                    if after_count > before_count:
                        test_results.append("✅ Recurring maintenance - Next occurrence created automatically")
                        
                        # Verify the new maintenance has correct due date
                        all_maintenance = response.json()
                        asset_type = recurring_maintenance["asset_type"]
                        new_maintenance = [m for m in all_maintenance if 
                                         m.get("asset_type") == asset_type and 
                                         not m.get("completed") and 
                                         m.get("id") != maintenance_id]
                        
                        if new_maintenance:
                            test_results.append("✅ Recurring maintenance - New record has correct asset type")
                        else:
                            test_results.append("❌ Recurring maintenance - New record not found or incorrect")
                    else:
                        test_results.append("❌ Recurring maintenance - Next occurrence not created")
                else:
                    test_results.append("❌ Recurring maintenance - Could not verify creation")
            else:
                test_results.append(f"❌ Mark as complete failed: {response.status_code} - {response.text}")
            
            # Test 3: Update non-existent maintenance
            fake_id = str(uuid.uuid4())
            response = self.session.put(f"{BACKEND_URL}/maintenance/{fake_id}", json={"cost": 1000.0})
            if response.status_code == 404:
                test_results.append("✅ Maintenance update - Proper 404 for non-existent record")
            else:
                test_results.append(f"❌ Maintenance update - Expected 404, got {response.status_code}")
            
            for result in test_results:
                self.log(result)
            
            success_count = len([r for r in test_results if r.startswith("✅")])
            total_tests = len(test_results)
            
            if success_count == total_tests:
                self.log(f"✅ Maintenance update & recurring - All {success_count} tests passed")
                return True
            else:
                self.log(f"⚠️ Maintenance update & recurring - {success_count}/{total_tests} tests passed")
                return False
                
        except Exception as e:
            self.log(f"❌ Maintenance update & recurring error: {str(e)}")
            return False
    
    def test_maintenance_additional_endpoints(self):
        """Test additional maintenance endpoints"""
        self.log("\n=== Testing Additional Maintenance Endpoints ===")
        
        try:
            test_results = []
            
            # Test 1: GET /api/maintenance/{id}
            if self.test_maintenance:
                maintenance_id = list(self.test_maintenance.values())[0]["id"]
                response = self.session.get(f"{BACKEND_URL}/maintenance/{maintenance_id}")
                if response.status_code == 200:
                    maintenance_data = response.json()
                    if maintenance_data.get("id") == maintenance_id:
                        test_results.append("✅ Get maintenance by ID - Correct record returned")
                    else:
                        test_results.append("❌ Get maintenance by ID - Incorrect record returned")
                else:
                    test_results.append(f"❌ Get maintenance by ID failed: {response.status_code}")
            
            # Test 2: GET /api/maintenance/asset/{asset_type}/{asset_id}
            if "property" in self.test_assets:
                asset_type = "property"
                asset_id = self.test_assets["property"]["id"]
                response = self.session.get(f"{BACKEND_URL}/maintenance/asset/{asset_type}/{asset_id}")
                if response.status_code == 200:
                    asset_maintenance = response.json()
                    property_records = [m for m in asset_maintenance if m.get("asset_type") == "property"]
                    test_results.append(f"✅ Get maintenance for specific asset: {len(property_records)} records")
                else:
                    test_results.append(f"❌ Get maintenance for specific asset failed: {response.status_code}")
            
            # Test 3: GET /api/maintenance/upcoming?days=30
            response = self.session.get(f"{BACKEND_URL}/maintenance/upcoming?days=30")
            if response.status_code == 200:
                upcoming_maintenance = response.json()
                # Verify all records are incomplete and within 30 days
                now = datetime.utcnow()
                cutoff = now + timedelta(days=30)
                valid_records = all(
                    not m.get("completed") and 
                    datetime.fromisoformat(m["due_date"].replace("Z", "+00:00")) <= cutoff
                    for m in upcoming_maintenance if "due_date" in m
                )
                if valid_records:
                    test_results.append(f"✅ Get upcoming maintenance: {len(upcoming_maintenance)} valid records")
                else:
                    test_results.append("❌ Get upcoming maintenance: Invalid records found")
            else:
                test_results.append(f"❌ Get upcoming maintenance failed: {response.status_code}")
            
            # Test 4: GET /api/maintenance/overdue
            response = self.session.get(f"{BACKEND_URL}/maintenance/overdue")
            if response.status_code == 200:
                overdue_maintenance = response.json()
                # Verify all records are incomplete and past due
                now = datetime.utcnow()
                valid_records = all(
                    not m.get("completed") and 
                    datetime.fromisoformat(m["due_date"].replace("Z", "+00:00")) < now
                    for m in overdue_maintenance if "due_date" in m
                )
                if valid_records or len(overdue_maintenance) == 0:
                    test_results.append(f"✅ Get overdue maintenance: {len(overdue_maintenance)} valid records")
                else:
                    test_results.append("❌ Get overdue maintenance: Invalid records found")
            else:
                test_results.append(f"❌ Get overdue maintenance failed: {response.status_code}")
            
            # Test 5: DELETE /api/maintenance/{id}
            if self.test_maintenance:
                # Use a non-recurring maintenance for deletion test
                delete_maintenance = None
                for maintenance in self.test_maintenance.values():
                    if not maintenance.get("recurring"):
                        delete_maintenance = maintenance
                        break
                
                if delete_maintenance:
                    maintenance_id = delete_maintenance["id"]
                    response = self.session.delete(f"{BACKEND_URL}/maintenance/{maintenance_id}")
                    if response.status_code == 200:
                        # Verify deletion
                        response = self.session.get(f"{BACKEND_URL}/maintenance/{maintenance_id}")
                        if response.status_code == 404:
                            test_results.append("✅ Delete maintenance - Record successfully deleted")
                        else:
                            test_results.append("❌ Delete maintenance - Record still exists after deletion")
                    else:
                        test_results.append(f"❌ Delete maintenance failed: {response.status_code}")
                else:
                    test_results.append("⚠️ Delete maintenance - No non-recurring maintenance found for deletion test")
            
            for result in test_results:
                self.log(result)
            
            success_count = len([r for r in test_results if r.startswith("✅")])
            total_tests = len(test_results)
            
            if success_count == total_tests:
                self.log(f"✅ Additional maintenance endpoints - All {success_count} tests passed")
                return True
            else:
                self.log(f"⚠️ Additional maintenance endpoints - {success_count}/{total_tests} tests passed")
                return False
                
        except Exception as e:
            self.log(f"❌ Additional maintenance endpoints error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting AuraInfra.ai Backend API Testing")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        # Setup
        if not self.register_and_login():
            return False
        
        if not self.create_test_assets():
            return False
        
        # Run tests
        test_results = []
        
        test_results.append(("Portfolio Details Endpoint", self.test_portfolio_details_endpoint()))
        test_results.append(("Maintenance Create", self.test_maintenance_create_endpoint()))
        test_results.append(("Maintenance Get", self.test_maintenance_get_endpoint()))
        test_results.append(("Maintenance Update & Recurring", self.test_maintenance_update_and_recurring()))
        test_results.append(("Additional Maintenance Endpoints", self.test_maintenance_additional_endpoints()))
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📊 TEST SUMMARY")
        self.log("="*60)
        
        passed_tests = []
        failed_tests = []
        
        for test_name, result in test_results:
            if result:
                passed_tests.append(test_name)
                self.log(f"✅ {test_name}")
            else:
                failed_tests.append(test_name)
                self.log(f"❌ {test_name}")
        
        self.log(f"\n📈 Results: {len(passed_tests)}/{len(test_results)} tests passed")
        
        if failed_tests:
            self.log(f"❌ Failed tests: {', '.join(failed_tests)}")
        else:
            self.log("🎉 All tests passed successfully!")
        
        return len(failed_tests) == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)