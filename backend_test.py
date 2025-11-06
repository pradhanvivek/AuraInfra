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
BASE_URL = "https://aurafix.preview.emergentagent.com/api"
TEST_USERNAME = f"test_hoa_user_{uuid.uuid4().hex[:8]}"
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "TestPassword123!"

class HOAMeetingsBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.property_id = None
        self.test_meetings = []
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f": {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def setup_authentication(self):
        """Setup test user and authentication"""
        print("\n=== AUTHENTICATION SETUP ===")
        
        # Register test user
        register_data = {
            "username": TEST_USERNAME,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.user_id = data["user_id"]
                self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                self.log_result("User Registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_result("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("User Registration", False, f"Exception: {str(e)}")
            return False
    
    def create_test_property(self):
        """Create a test property for meetings"""
        print("\n=== PROPERTY SETUP ===")
        
        property_data = {
            "name": "Sunset Heights HOA Community",
            "address": "123 Sunset Boulevard, Beverly Hills, CA 90210",
            "latitude": 34.0736,
            "longitude": -118.4004,
            "purchase_cost": 2500000.00,
            "current_value": 2800000.00
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/properties", json=property_data)
            if response.status_code == 200:
                data = response.json()
                self.property_id = data["id"]
                self.log_result("Property Creation", True, f"Property ID: {self.property_id}")
                return True
            else:
                self.log_result("Property Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Property Creation", False, f"Exception: {str(e)}")
            return False
    
    def create_test_meetings(self):
        """Create test meetings - one upcoming and one past"""
        print("\n=== MEETING SETUP ===")
        
        # Future meeting (upcoming)
        future_date = datetime.utcnow() + timedelta(days=7)
        upcoming_meeting = {
            "property_id": self.property_id,
            "title": "Monthly HOA Board Meeting",
            "description": "Regular monthly meeting to discuss community matters, budget updates, and upcoming maintenance projects.",
            "meeting_type": "general",
            "date": future_date.isoformat(),
            "time": "19:00",
            "duration_minutes": 90,
            "location": "Community Clubhouse - Main Hall",
            "agenda": [
                "Welcome and Roll Call",
                "Review of Previous Meeting Minutes",
                "Treasurer's Report",
                "Maintenance Updates",
                "New Business",
                "Resident Concerns",
                "Next Meeting Date"
            ],
            "max_attendees": 50,
            "rsvp_deadline": (future_date - timedelta(days=2)).isoformat()
        }
        
        # Past meeting
        past_date = datetime.utcnow() - timedelta(days=14)
        past_meeting = {
            "property_id": self.property_id,
            "title": "Annual General Meeting 2024",
            "description": "Annual meeting for budget approval, board elections, and major community decisions.",
            "meeting_type": "agm",
            "date": past_date.isoformat(),
            "time": "18:30",
            "duration_minutes": 120,
            "location": "Community Center - Auditorium",
            "agenda": [
                "Annual Financial Report",
                "Board Member Elections",
                "Budget Approval for 2025",
                "Major Maintenance Projects",
                "Community Rules Updates"
            ],
            "max_attendees": 100,
            "rsvp_deadline": (past_date - timedelta(days=3)).isoformat()
        }
        
        meetings_created = 0
        
        for meeting_data in [upcoming_meeting, past_meeting]:
            try:
                response = self.session.post(f"{BASE_URL}/properties/{self.property_id}/meetings", json=meeting_data)
                if response.status_code == 200:
                    meeting = response.json()
                    self.test_meetings.append(meeting)
                    meetings_created += 1
                    meeting_type = "Upcoming" if "Monthly" in meeting_data["title"] else "Past"
                    self.log_result(f"{meeting_type} Meeting Creation", True, f"Meeting ID: {meeting['id']}")
                else:
                    self.log_result(f"Meeting Creation ({meeting_data['title']})", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_result(f"Meeting Creation ({meeting_data['title']})", False, f"Exception: {str(e)}")
        
        return meetings_created == 2
    
    def test_meeting_retrieval_upcoming(self):
        """Test GET /api/properties/{property_id}/meetings?upcoming=true"""
        print("\n=== TESTING UPCOMING MEETINGS RETRIEVAL ===")
        
        try:
            response = self.session.get(f"{BASE_URL}/properties/{self.property_id}/meetings?upcoming=true")
            
            if response.status_code == 200:
                meetings = response.json()
                
                # Verify we get meetings
                if len(meetings) > 0:
                    # Check if meetings are actually upcoming (future dates)
                    now = datetime.utcnow()
                    upcoming_count = 0
                    
                    for meeting in meetings:
                        meeting_date = datetime.fromisoformat(meeting["date"].replace('Z', '+00:00'))
                        if meeting_date > now:
                            upcoming_count += 1
                        
                        # Verify required fields are present
                        required_fields = ["id", "title", "description", "meeting_type", "date", "time", 
                                         "duration_minutes", "location", "agenda", "organizer_name", 
                                         "max_attendees", "rsvp_deadline"]
                        
                        missing_fields = [field for field in required_fields if field not in meeting]
                        if missing_fields:
                            self.log_result("Upcoming Meetings - Required Fields", False, 
                                          f"Missing fields: {missing_fields}")
                            return False
                    
                    if upcoming_count > 0:
                        self.log_result("Upcoming Meetings Retrieval", True, 
                                      f"Found {upcoming_count} upcoming meetings with all required fields")
                        
                        # Test sorting (should be ascending by date)
                        if len(meetings) > 1:
                            dates = [datetime.fromisoformat(m["date"].replace('Z', '+00:00')) for m in meetings]
                            is_sorted = all(dates[i] <= dates[i+1] for i in range(len(dates)-1))
                            self.log_result("Upcoming Meetings - Date Sorting", is_sorted, 
                                          "Meetings sorted by date (ascending)" if is_sorted else "Meetings not properly sorted")
                        
                        return True
                    else:
                        self.log_result("Upcoming Meetings Retrieval", False, "No upcoming meetings found")
                        return False
                else:
                    self.log_result("Upcoming Meetings Retrieval", False, "No meetings returned")
                    return False
            else:
                self.log_result("Upcoming Meetings Retrieval", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Upcoming Meetings Retrieval", False, f"Exception: {str(e)}")
            return False
    
    def test_meeting_retrieval_past(self):
        """Test GET /api/properties/{property_id}/meetings?upcoming=false"""
        print("\n=== TESTING PAST MEETINGS RETRIEVAL ===")
        
        try:
            response = self.session.get(f"{BASE_URL}/properties/{self.property_id}/meetings?upcoming=false")
            
            if response.status_code == 200:
                meetings = response.json()
                
                if len(meetings) > 0:
                    # Check if meetings are actually past (past dates)
                    now = datetime.utcnow()
                    past_count = 0
                    
                    for meeting in meetings:
                        meeting_date = datetime.fromisoformat(meeting["date"].replace('Z', '+00:00'))
                        if meeting_date <= now:
                            past_count += 1
                    
                    if past_count > 0:
                        self.log_result("Past Meetings Retrieval", True, 
                                      f"Found {past_count} past meetings")
                        return True
                    else:
                        self.log_result("Past Meetings Retrieval", False, "No past meetings found")
                        return False
                else:
                    self.log_result("Past Meetings Retrieval", False, "No meetings returned")
                    return False
            else:
                self.log_result("Past Meetings Retrieval", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Past Meetings Retrieval", False, f"Exception: {str(e)}")
            return False
    
    def test_rsvp_submission(self):
        """Test POST /api/meetings/rsvp with different statuses"""
        print("\n=== TESTING RSVP SUBMISSION ===")
        
        if not self.test_meetings:
            self.log_result("RSVP Submission", False, "No test meetings available")
            return False
        
        # Get the upcoming meeting for RSVP testing
        upcoming_meeting = None
        for meeting in self.test_meetings:
            meeting_date = datetime.fromisoformat(meeting["date"].replace('Z', '+00:00'))
            if meeting_date > datetime.utcnow():
                upcoming_meeting = meeting
                break
        
        if not upcoming_meeting:
            self.log_result("RSVP Submission", False, "No upcoming meeting found for RSVP testing")
            return False
        
        meeting_id = upcoming_meeting["id"]
        rsvp_statuses = ["attending", "maybe", "not_attending"]
        success_count = 0
        
        for status in rsvp_statuses:
            rsvp_data = {
                "meeting_id": meeting_id,
                "status": status,
                "guests_count": 1 if status == "attending" else 0
            }
            
            try:
                response = self.session.post(f"{BASE_URL}/meetings/rsvp", json=rsvp_data)
                
                if response.status_code == 200:
                    self.log_result(f"RSVP Submission - {status}", True, "RSVP created/updated successfully")
                    success_count += 1
                else:
                    self.log_result(f"RSVP Submission - {status}", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_result(f"RSVP Submission - {status}", False, f"Exception: {str(e)}")
        
        # Test updating existing RSVP (submit twice for same meeting)
        final_rsvp_data = {
            "meeting_id": meeting_id,
            "status": "attending",
            "guests_count": 2
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/meetings/rsvp", json=final_rsvp_data)
            if response.status_code == 200:
                self.log_result("RSVP Update (Existing)", True, "Existing RSVP updated successfully")
                success_count += 1
            else:
                self.log_result("RSVP Update (Existing)", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("RSVP Update (Existing)", False, f"Exception: {str(e)}")
        
        return success_count >= 3  # At least 3 out of 4 tests should pass
    
    def test_rsvp_retrieval(self):
        """Test GET /api/meetings/{meeting_id}/rsvps"""
        print("\n=== TESTING RSVP RETRIEVAL ===")
        
        if not self.test_meetings:
            self.log_result("RSVP Retrieval", False, "No test meetings available")
            return False
        
        # Get the upcoming meeting that should have RSVPs
        upcoming_meeting = None
        for meeting in self.test_meetings:
            meeting_date = datetime.fromisoformat(meeting["date"].replace('Z', '+00:00'))
            if meeting_date > datetime.utcnow():
                upcoming_meeting = meeting
                break
        
        if not upcoming_meeting:
            self.log_result("RSVP Retrieval", False, "No upcoming meeting found for RSVP retrieval testing")
            return False
        
        meeting_id = upcoming_meeting["id"]
        
        try:
            response = self.session.get(f"{BASE_URL}/meetings/{meeting_id}/rsvps")
            
            if response.status_code == 200:
                rsvps = response.json()
                
                if len(rsvps) > 0:
                    # Verify required fields in RSVP response
                    required_fields = ["id", "meeting_id", "user_id", "user_name", "status", "guests_count"]
                    
                    for rsvp in rsvps:
                        missing_fields = [field for field in required_fields if field not in rsvp]
                        if missing_fields:
                            self.log_result("RSVP Retrieval - Required Fields", False, 
                                          f"Missing fields: {missing_fields}")
                            return False
                    
                    # Check if user can identify their own RSVP
                    user_rsvp_found = any(rsvp["user_id"] == self.user_id for rsvp in rsvps)
                    
                    if user_rsvp_found:
                        self.log_result("RSVP Retrieval", True, 
                                      f"Found {len(rsvps)} RSVPs with all required fields, user RSVP identified")
                        return True
                    else:
                        self.log_result("RSVP Retrieval", False, "User's own RSVP not found in response")
                        return False
                else:
                    self.log_result("RSVP Retrieval", False, "No RSVPs returned (expected at least user's RSVP)")
                    return False
            else:
                self.log_result("RSVP Retrieval", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("RSVP Retrieval", False, f"Exception: {str(e)}")
            return False
    
    def test_authentication_required(self):
        """Test that all endpoints require proper JWT authentication"""
        print("\n=== TESTING AUTHENTICATION REQUIREMENTS ===")
        
        # Create a session without authentication
        unauth_session = requests.Session()
        
        endpoints_to_test = [
            ("GET", f"/properties/{self.property_id}/meetings?upcoming=true"),
            ("POST", "/meetings/rsvp"),
            ("GET", f"/meetings/{self.test_meetings[0]['id'] if self.test_meetings else 'test'}/rsvps")
        ]
        
        auth_tests_passed = 0
        
        for method, endpoint in endpoints_to_test:
            try:
                if method == "GET":
                    response = unauth_session.get(f"{BASE_URL}{endpoint}")
                else:
                    response = unauth_session.post(f"{BASE_URL}{endpoint}", json={})
                
                if response.status_code in [401, 403]:
                    self.log_result(f"Authentication Required - {method} {endpoint}", True, 
                                  f"Properly denied with status {response.status_code}")
                    auth_tests_passed += 1
                else:
                    self.log_result(f"Authentication Required - {method} {endpoint}", False, 
                                  f"Expected 401/403, got {response.status_code}")
            except Exception as e:
                self.log_result(f"Authentication Required - {method} {endpoint}", False, f"Exception: {str(e)}")
        
        return auth_tests_passed == len(endpoints_to_test)
    
    def run_all_tests(self):
        """Run all HOA meetings backend tests"""
        print("🏢 HOA MEETINGS BACKEND INTEGRATION TESTING")
        print("=" * 60)
        
        # Setup phase
        if not self.setup_authentication():
            print("\n❌ CRITICAL: Authentication setup failed. Cannot proceed with tests.")
            return False
        
        if not self.create_test_property():
            print("\n❌ CRITICAL: Property creation failed. Cannot proceed with tests.")
            return False
        
        if not self.create_test_meetings():
            print("\n❌ CRITICAL: Meeting creation failed. Cannot proceed with tests.")
            return False
        
        # Core functionality tests
        test_results = []
        test_results.append(self.test_meeting_retrieval_upcoming())
        test_results.append(self.test_meeting_retrieval_past())
        test_results.append(self.test_rsvp_submission())
        test_results.append(self.test_rsvp_retrieval())
        test_results.append(self.test_authentication_required())
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        # Overall result
        critical_tests_passed = all(test_results)
        if critical_tests_passed:
            print("\n✅ ALL CRITICAL TESTS PASSED - HOA Meetings endpoints are ready for mobile integration!")
        else:
            print("\n❌ SOME CRITICAL TESTS FAILED - Issues need to be resolved before mobile integration")
        
        return critical_tests_passed

def main():
    """Main test execution"""
    tester = HOAMeetingsBackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 HOA Meetings Backend Integration: READY FOR PRODUCTION")
    else:
        print("\n⚠️  HOA Meetings Backend Integration: NEEDS ATTENTION")
    
    return success

if __name__ == "__main__":
    main()