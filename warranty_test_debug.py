#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://aurainfra.preview.emergentagent.com/api"

def test_warranty_reminder_debug():
    """Debug warranty reminder functionality"""
    
    # Register a test user
    test_username = f"warranty_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    test_password = "SecurePass123!"
    
    print(f"🔧 Registering test user: {test_username}")
    
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "username": test_username,
            "password": test_password
        },
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.status_code} - {response.text}")
        return
    
    data = response.json()
    access_token = data["access_token"]
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    print(f"✅ User registered successfully")
    
    # Test 1: Get default profile
    print(f"\n🔍 Testing GET /auth/profile")
    response = requests.get(f"{BASE_URL}/auth/profile", headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        profile = response.json()
        warranty_days = profile.get("warranty_reminder_days")
        print(f"✅ Default warranty_reminder_days: {warranty_days}")
    
    # Test 2: Update to valid value (7)
    print(f"\n🔍 Testing PUT /auth/profile with valid value (7)")
    response = requests.put(
        f"{BASE_URL}/auth/profile",
        json={"warranty_reminder_days": 7},
        headers=headers
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test 3: Update to invalid value (15)
    print(f"\n🔍 Testing PUT /auth/profile with invalid value (15)")
    response = requests.put(
        f"{BASE_URL}/auth/profile",
        json={"warranty_reminder_days": 15},
        headers=headers
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test 4: Update to invalid value (0)
    print(f"\n🔍 Testing PUT /auth/profile with invalid value (0)")
    response = requests.put(
        f"{BASE_URL}/auth/profile",
        json={"warranty_reminder_days": 0},
        headers=headers
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Test 5: Update to invalid value (-1)
    print(f"\n🔍 Testing PUT /auth/profile with invalid value (-1)")
    response = requests.put(
        f"{BASE_URL}/auth/profile",
        json={"warranty_reminder_days": -1},
        headers=headers
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_warranty_reminder_debug()