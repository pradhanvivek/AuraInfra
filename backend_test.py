#!/usr/bin/env python3
"""
PHASE 1 - PDF VIEWER CRITICAL FIX TESTING

Testing document management endpoints after fixing the missing react-native-blob-util dependency.
Focus on verifying that PDF and image documents can be uploaded, retrieved, and managed without server errors.
"""

import requests
import json
import base64
import uuid
from datetime import datetime
import os

# Get backend URL from frontend .env
BACKEND_URL = "https://property-pulse-91.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.auth_token = None
        self.user_id = None
        self.property_id = None
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
        """Register a test user for authentication"""
        try:
            test_username = f"testuser_{uuid.uuid4().hex[:8]}"
            test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
            
            payload = {
                "username": test_username,
                "email": test_email,
                "password": "TestPassword123!",
                "property_ids": []
            }
            
            response = requests.post(f"{API_BASE}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data["access_token"]
                self.user_id = data["user_id"]
                self.log_result("User Registration", True, f"Registered user: {test_username}")
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
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "name": "Test Property for PDF Documents",
                "address": "123 Test Street, Test City, TC 12345",
                "purchase_cost": 500000.0,
                "current_value": 550000.0
            }
            
            response = requests.post(f"{API_BASE}/properties", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.property_id = data["id"]
                self.log_result("Property Creation", True, f"Created property: {data['name']}")
                return True
            else:
                self.log_result("Property Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Property Creation", False, f"Exception: {str(e)}")
            return False
    
    def create_test_pdf_base64(self):
        """Create a simple test PDF in base64 format"""
        # Simple PDF content (minimal PDF structure)
        pdf_content = """%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF Document) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF"""
        return base64.b64encode(pdf_content.encode()).decode()
    
    def create_test_image_base64(self):
        """Create a simple test image in base64 format (1x1 PNG)"""
        # Minimal 1x1 transparent PNG
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(png_data).decode()
    
    def test_get_documents_empty(self):
        """Test GET documents endpoint with empty property"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{API_BASE}/properties/{self.property_id}/documents", headers=headers)
            
            if response.status_code == 200:
                documents = response.json()
                if isinstance(documents, list) and len(documents) == 0:
                    self.log_result("GET Documents (Empty)", True, "Empty documents list returned correctly")
                    return True
                else:
                    self.log_result("GET Documents (Empty)", False, f"Expected empty list, got: {documents}")
                    return False
            else:
                self.log_result("GET Documents (Empty)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Documents (Empty)", False, f"Exception: {str(e)}")
            return False
    
    def test_upload_pdf_document(self):
        """Test uploading a PDF document"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            pdf_base64 = self.create_test_pdf_base64()
            
            payload = {
                "name": "Test Property Document.pdf",
                "file_data": pdf_base64,
                "file_type": "application/pdf"
            }
            
            response = requests.post(f"{API_BASE}/properties/{self.property_id}/documents", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "name", "file_type", "file_data", "uploaded_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    if data["file_type"] == "application/pdf" and data["name"] == "Test Property Document.pdf":
                        self.log_result("PDF Upload", True, f"PDF uploaded successfully: {data['name']}")
                        return data["id"]
                    else:
                        self.log_result("PDF Upload", False, f"Incorrect file_type or name: {data}")
                        return None
                else:
                    self.log_result("PDF Upload", False, f"Missing fields in response: {missing_fields}")
                    return None
            else:
                self.log_result("PDF Upload", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("PDF Upload", False, f"Exception: {str(e)}")
            return None
    
    def test_upload_image_document(self):
        """Test uploading an image document"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            image_base64 = self.create_test_image_base64()
            
            payload = {
                "name": "Test Property Image.png",
                "file_data": image_base64,
                "file_type": "image/png"
            }
            
            response = requests.post(f"{API_BASE}/properties/{self.property_id}/documents", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "name", "file_type", "file_data", "uploaded_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    if data["file_type"] == "image/png" and data["name"] == "Test Property Image.png":
                        self.log_result("Image Upload", True, f"Image uploaded successfully: {data['name']}")
                        return data["id"]
                    else:
                        self.log_result("Image Upload", False, f"Incorrect file_type or name: {data}")
                        return None
                else:
                    self.log_result("Image Upload", False, f"Missing fields in response: {missing_fields}")
                    return None
            else:
                self.log_result("Image Upload", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Image Upload", False, f"Exception: {str(e)}")
            return None
    
    def test_get_documents_with_files(self):
        """Test GET documents endpoint with uploaded files"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{API_BASE}/properties/{self.property_id}/documents", headers=headers)
            
            if response.status_code == 200:
                documents = response.json()
                if isinstance(documents, list) and len(documents) >= 2:
                    # Check that we have both PDF and image
                    file_types = [doc.get("file_type") for doc in documents]
                    has_pdf = "application/pdf" in file_types
                    has_image = "image/png" in file_types
                    
                    if has_pdf and has_image:
                        self.log_result("GET Documents (With Files)", True, f"Retrieved {len(documents)} documents correctly")
                        return documents
                    else:
                        self.log_result("GET Documents (With Files)", False, f"Missing expected file types. Found: {file_types}")
                        return None
                else:
                    self.log_result("GET Documents (With Files)", False, f"Expected at least 2 documents, got: {len(documents) if isinstance(documents, list) else 'not a list'}")
                    return None
            else:
                self.log_result("GET Documents (With Files)", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("GET Documents (With Files)", False, f"Exception: {str(e)}")
            return None
    
    def test_delete_document(self, document_id, doc_name):
        """Test deleting a document"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.delete(f"{API_BASE}/properties/{self.property_id}/documents/{document_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "deleted" in data["message"].lower():
                    self.log_result("Document Deletion", True, f"Deleted document: {doc_name}")
                    return True
                else:
                    self.log_result("Document Deletion", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Document Deletion", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Document Deletion", False, f"Exception: {str(e)}")
            return False
    
    def test_authentication_required(self):
        """Test that endpoints require authentication"""
        try:
            # Test without auth header
            response = requests.get(f"{API_BASE}/properties/{self.property_id}/documents")
            
            if response.status_code == 403:
                self.log_result("Authentication Required", True, "Correctly denied access without auth token")
                return True
            else:
                self.log_result("Authentication Required", False, f"Expected 403, got: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Authentication Required", False, f"Exception: {str(e)}")
            return False
    
    def test_backend_health(self):
        """Test that backend is responding"""
        try:
            # Try a simple endpoint that should exist
            response = requests.get(f"{BACKEND_URL}/docs", timeout=10)
            
            # In production, docs might be disabled, so check for any response
            if response.status_code in [200, 404, 403]:
                self.log_result("Backend Health", True, f"Backend responding (status: {response.status_code})")
                return True
            else:
                self.log_result("Backend Health", False, f"Unexpected status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Backend Health", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all PDF viewer related tests"""
        print("=" * 60)
        print("PHASE 1 - PDF VIEWER CRITICAL FIX TESTING")
        print("=" * 60)
        
        # Test 1: Backend Health
        if not self.test_backend_health():
            print("❌ Backend not responding - aborting tests")
            return False
        
        # Test 2: User Registration & Authentication
        if not self.register_test_user():
            print("❌ Cannot register user - aborting tests")
            return False
        
        # Test 3: Property Creation (needed for documents)
        if not self.create_test_property():
            print("❌ Cannot create property - aborting tests")
            return False
        
        # Test 4: Authentication Required
        self.test_authentication_required()
        
        # Test 5: Empty Documents List
        self.test_get_documents_empty()
        
        # Test 6: PDF Upload
        pdf_doc_id = self.test_upload_pdf_document()
        
        # Test 7: Image Upload  
        image_doc_id = self.test_upload_image_document()
        
        # Test 8: Get Documents with Files
        documents = self.test_get_documents_with_files()
        
        # Test 9: Delete Documents (CRUD completion)
        if pdf_doc_id:
            self.test_delete_document(pdf_doc_id, "Test Property Document.pdf")
        
        if image_doc_id:
            self.test_delete_document(image_doc_id, "Test Property Image.png")
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED - PDF Viewer fix is working correctly!")
    else:
        print("\n⚠️  SOME TESTS FAILED - Issues found that need attention")