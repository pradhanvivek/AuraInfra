#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Document Deletion Fix
Testing the critical document deletion functionality after duplicate function rename fix.
"""

import requests
import json
import base64
import os
from datetime import datetime

# Configuration
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://hoa-dash.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class DocumentDeletionTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_property_id = None
        self.test_document_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
    
    def register_test_user(self):
        """Register a test user for authentication"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            test_user = {
                "username": f"doctest_{timestamp}",
                "email": f"doctest_{timestamp}@test.com",
                "password": "TestPass123!"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=test_user)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data['access_token']
                self.user_id = data['user_id']
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                self.log_result("User Registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_result("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Exception: {str(e)}")
            return False
    
    def create_test_property(self):
        """Create a test property for document testing"""
        try:
            property_data = {
                "name": "Document Test Property",
                "address": "123 Test Street, Test City, TC 12345",
                "purchase_cost": 500000.0,
                "current_value": 550000.0
            }
            
            response = self.session.post(f"{API_BASE}/properties", json=property_data)
            
            if response.status_code == 200:
                data = response.json()
                self.test_property_id = data['id']
                self.log_result("Property Creation", True, f"Property ID: {self.test_property_id}")
                return True
            else:
                self.log_result("Property Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Property Creation", False, f"Exception: {str(e)}")
            return False
    
    def create_test_document(self):
        """Create a test document for deletion testing"""
        try:
            # Create a simple base64 encoded test document
            test_content = "This is a test document for deletion testing."
            encoded_content = base64.b64encode(test_content.encode()).decode()
            
            document_data = {
                "name": "Test Document for Deletion.txt",
                "file_data": encoded_content,
                "file_type": "text/plain"
            }
            
            response = self.session.post(
                f"{API_BASE}/properties/{self.test_property_id}/documents", 
                json=document_data
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_document_id = data['id']
                self.log_result("Document Creation", True, f"Document ID: {self.test_document_id}")
                return True
            else:
                self.log_result("Document Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Document Creation", False, f"Exception: {str(e)}")
            return False
    
    def test_document_deletion_endpoint(self):
        """Test the main document deletion endpoint - CRITICAL TEST"""
        try:
            print("\n🔥 CRITICAL TEST: Document Deletion Endpoint")
            
            response = self.session.delete(
                f"{API_BASE}/properties/{self.test_property_id}/documents/{self.test_document_id}"
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Document deleted successfully"
                if data.get('message') == expected_message:
                    self.log_result("Document Deletion Endpoint", True, f"Status: 200, Message: {data['message']}")
                    return True
                else:
                    self.log_result("Document Deletion Endpoint", False, f"Unexpected message: {data}")
                    return False
            else:
                self.log_result("Document Deletion Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Document Deletion Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def verify_document_removed_from_database(self):
        """Verify document is actually removed from database"""
        try:
            # Try to fetch documents list to verify deletion
            response = self.session.get(f"{API_BASE}/properties/{self.test_property_id}/documents")
            
            if response.status_code == 200:
                documents = response.json()
                # Check if our test document is still in the list
                for doc in documents:
                    if doc['id'] == self.test_document_id:
                        self.log_result("Document Database Removal", False, "Document still exists in database")
                        return False
                
                self.log_result("Document Database Removal", True, "Document successfully removed from database")
                return True
            else:
                self.log_result("Document Database Removal", False, f"Failed to fetch documents: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Document Database Removal", False, f"Exception: {str(e)}")
            return False
    
    def test_complete_document_crud_flow(self):
        """Test complete document CRUD flow"""
        try:
            print("\n📋 TESTING: Complete Document CRUD Flow")
            
            # 1. Create a new document
            test_content = "CRUD Flow Test Document Content"
            encoded_content = base64.b64encode(test_content.encode()).decode()
            
            document_data = {
                "name": "CRUD Test Document.txt",
                "file_data": encoded_content,
                "file_type": "text/plain"
            }
            
            create_response = self.session.post(
                f"{API_BASE}/properties/{self.test_property_id}/documents", 
                json=document_data
            )
            
            if create_response.status_code != 200:
                self.log_result("CRUD Flow - Create", False, f"Create failed: {create_response.status_code}")
                return False
            
            crud_doc_id = create_response.json()['id']
            
            # 2. Retrieve documents list to confirm upload
            list_response = self.session.get(f"{API_BASE}/properties/{self.test_property_id}/documents")
            
            if list_response.status_code != 200:
                self.log_result("CRUD Flow - List", False, f"List failed: {list_response.status_code}")
                return False
            
            documents = list_response.json()
            found_document = False
            for doc in documents:
                if doc['id'] == crud_doc_id:
                    found_document = True
                    break
            
            if not found_document:
                self.log_result("CRUD Flow - Verify Upload", False, "Document not found in list after creation")
                return False
            
            # 3. Delete the document
            delete_response = self.session.delete(
                f"{API_BASE}/properties/{self.test_property_id}/documents/{crud_doc_id}"
            )
            
            if delete_response.status_code != 200:
                self.log_result("CRUD Flow - Delete", False, f"Delete failed: {delete_response.status_code}")
                return False
            
            # 4. Verify document is removed by fetching list again
            verify_response = self.session.get(f"{API_BASE}/properties/{self.test_property_id}/documents")
            
            if verify_response.status_code != 200:
                self.log_result("CRUD Flow - Verify Deletion", False, f"Verify failed: {verify_response.status_code}")
                return False
            
            final_documents = verify_response.json()
            for doc in final_documents:
                if doc['id'] == crud_doc_id:
                    self.log_result("CRUD Flow - Complete", False, "Document still exists after deletion")
                    return False
            
            self.log_result("CRUD Flow - Complete", True, "Full CRUD flow successful")
            return True
            
        except Exception as e:
            self.log_result("CRUD Flow - Complete", False, f"Exception: {str(e)}")
            return False
    
    def test_authentication_required(self):
        """Test that JWT authentication is required for document deletion"""
        try:
            print("\n🔐 TESTING: Authentication Requirements")
            
            # Create a document first
            test_content = "Auth Test Document"
            encoded_content = base64.b64encode(test_content.encode()).decode()
            
            document_data = {
                "name": "Auth Test Document.txt",
                "file_data": encoded_content,
                "file_type": "text/plain"
            }
            
            create_response = self.session.post(
                f"{API_BASE}/properties/{self.test_property_id}/documents", 
                json=document_data
            )
            
            if create_response.status_code != 200:
                self.log_result("Auth Test - Document Creation", False, "Failed to create test document")
                return False
            
            auth_doc_id = create_response.json()['id']
            
            # Remove authentication header
            original_headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            # Try to delete without authentication
            response = self.session.delete(
                f"{API_BASE}/properties/{self.test_property_id}/documents/{auth_doc_id}"
            )
            
            # Restore headers
            self.session.headers.update(original_headers)
            
            if response.status_code == 403 or response.status_code == 401:
                self.log_result("Authentication Required", True, f"Correctly returned {response.status_code} without auth")
                
                # Clean up - delete the test document with auth
                cleanup_response = self.session.delete(
                    f"{API_BASE}/properties/{self.test_property_id}/documents/{auth_doc_id}"
                )
                return True
            else:
                self.log_result("Authentication Required", False, f"Expected 401/403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authentication Required", False, f"Exception: {str(e)}")
            return False
    
    def test_ownership_validation(self):
        """Test that users can only delete documents from properties they own"""
        try:
            print("\n👤 TESTING: Ownership Validation")
            
            # Create a second user
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            second_user = {
                "username": f"doctest2_{timestamp}",
                "email": f"doctest2_{timestamp}@test.com",
                "password": "TestPass123!"
            }
            
            register_response = requests.post(f"{API_BASE}/auth/register", json=second_user)
            
            if register_response.status_code != 200:
                self.log_result("Ownership Test - Second User", False, "Failed to create second user")
                return False
            
            second_user_token = register_response.json()['access_token']
            
            # Create a document with the first user
            test_content = "Ownership Test Document"
            encoded_content = base64.b64encode(test_content.encode()).decode()
            
            document_data = {
                "name": "Ownership Test Document.txt",
                "file_data": encoded_content,
                "file_type": "text/plain"
            }
            
            create_response = self.session.post(
                f"{API_BASE}/properties/{self.test_property_id}/documents", 
                json=document_data
            )
            
            if create_response.status_code != 200:
                self.log_result("Ownership Test - Document Creation", False, "Failed to create test document")
                return False
            
            ownership_doc_id = create_response.json()['id']
            
            # Try to delete with second user's token
            second_user_session = requests.Session()
            second_user_session.headers.update({'Authorization': f'Bearer {second_user_token}'})
            
            delete_response = second_user_session.delete(
                f"{API_BASE}/properties/{self.test_property_id}/documents/{ownership_doc_id}"
            )
            
            if delete_response.status_code == 403 or delete_response.status_code == 404:
                self.log_result("Ownership Validation", True, f"Correctly denied access with {delete_response.status_code}")
                
                # Clean up - delete with original user
                cleanup_response = self.session.delete(
                    f"{API_BASE}/properties/{self.test_property_id}/documents/{ownership_doc_id}"
                )
                return True
            else:
                self.log_result("Ownership Validation", False, f"Expected 403/404, got {delete_response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Ownership Validation", False, f"Exception: {str(e)}")
            return False
    
    def test_error_handling(self):
        """Test error handling for various invalid scenarios"""
        try:
            print("\n⚠️ TESTING: Error Handling")
            
            # Test 1: Non-existent document ID
            fake_doc_id = "non-existent-document-id"
            response1 = self.session.delete(
                f"{API_BASE}/properties/{self.test_property_id}/documents/{fake_doc_id}"
            )
            
            if response1.status_code == 404:
                self.log_result("Error Handling - Non-existent Document", True, "Correctly returned 404")
            else:
                self.log_result("Error Handling - Non-existent Document", False, f"Expected 404, got {response1.status_code}")
                return False
            
            # Test 2: Non-existent property ID
            fake_property_id = "non-existent-property-id"
            response2 = self.session.delete(
                f"{API_BASE}/properties/{fake_property_id}/documents/{fake_doc_id}"
            )
            
            if response2.status_code == 404 or response2.status_code == 403:
                self.log_result("Error Handling - Non-existent Property", True, f"Correctly returned {response2.status_code}")
            else:
                self.log_result("Error Handling - Non-existent Property", False, f"Expected 404/403, got {response2.status_code}")
                return False
            
            self.log_result("Error Handling - Complete", True, "All error scenarios handled correctly")
            return True
            
        except Exception as e:
            self.log_result("Error Handling - Complete", False, f"Exception: {str(e)}")
            return False
    
    def run_comprehensive_tests(self):
        """Run all document deletion tests"""
        print("🚀 STARTING COMPREHENSIVE DOCUMENT DELETION TESTING")
        print("=" * 60)
        
        # Setup phase
        if not self.register_test_user():
            return False
        
        if not self.create_test_property():
            return False
        
        if not self.create_test_document():
            return False
        
        # Core deletion test
        deletion_success = self.test_document_deletion_endpoint()
        
        if deletion_success:
            # Verify deletion worked
            self.verify_document_removed_from_database()
        
        # Additional comprehensive tests
        self.test_complete_document_crud_flow()
        self.test_authentication_required()
        self.test_ownership_validation()
        self.test_error_handling()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status} - {result['test']}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Document deletion fix is working correctly!")
            return True
        else:
            print("⚠️ SOME TESTS FAILED - Document deletion needs attention")
            return False

def main():
    """Main test execution"""
    tester = DocumentDeletionTester()
    success = tester.run_comprehensive_tests()
    
    if success:
        print("\n✅ DOCUMENT DELETION FIX VERIFICATION: SUCCESS")
        print("The duplicate function rename fix has resolved the 404 error issue.")
    else:
        print("\n❌ DOCUMENT DELETION FIX VERIFICATION: ISSUES FOUND")
        print("Further investigation required.")

if __name__ == "__main__":
    main()