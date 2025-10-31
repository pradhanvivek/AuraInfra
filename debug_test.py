#!/usr/bin/env python3
import requests
import uuid

# Configuration
BACKEND_URL = "https://property-pulse-80.preview.emergentagent.com/api"
TEST_USERNAME = f"debuguser_{uuid.uuid4().hex[:8]}"
TEST_PASSWORD = "SecurePass123!"

def test_auth_and_endpoints():
    session = requests.Session()
    
    # Register and login
    register_data = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    }
    
    response = session.post(f"{BACKEND_URL}/auth/register", json=register_data)
    if response.status_code == 200:
        data = response.json()
        access_token = data["access_token"]
        session.headers.update({"Authorization": f"Bearer {access_token}"})
        print(f"✅ Authenticated as {TEST_USERNAME}")
        
        # Test upcoming endpoint
        print("\nTesting /maintenance/upcoming...")
        response = session.get(f"{BACKEND_URL}/maintenance/upcoming")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        # Test overdue endpoint
        print("\nTesting /maintenance/overdue...")
        response = session.get(f"{BACKEND_URL}/maintenance/overdue")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        # Test with query parameter
        print("\nTesting /maintenance/upcoming?days=30...")
        response = session.get(f"{BACKEND_URL}/maintenance/upcoming?days=30")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_auth_and_endpoints()