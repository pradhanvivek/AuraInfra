#!/usr/bin/env python3
"""
Test jewelry scan to see if it works
"""

import requests
import json
import base64
import os

# Configuration
BACKEND_URL = "https://hoa-dash.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test user credentials
TEST_USERNAME = "vehicle_test_user"
TEST_PASSWORD = "VehicleTest123!"

# Get auth token
def get_auth_token():
    login_data = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(f"{API_BASE}/auth/login", json=login_data)
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

# Test jewelry scan
def test_jewelry_scan():
    token = get_auth_token()
    if not token:
        print("Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a simple test image (1x1 pixel PNG)
    simple_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=="
    
    scan_data = {"image": simple_image}
    
    print("Testing jewelry scan with simple image...")
    response = requests.post(f"{API_BASE}/jewelry/scan", json=scan_data, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_jewelry_scan()