#!/usr/bin/env python3
"""
Debug script to see what the vehicle scan endpoint is actually returning
"""

import requests
import json
import base64
import os

# Configuration
BACKEND_URL = "https://propmanager-app.preview.emergentagent.com"
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

# Test with a simple 1x1 pixel image
def test_vehicle_scan():
    token = get_auth_token()
    if not token:
        print("Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a simple test image (1x1 pixel PNG)
    simple_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=="
    
    scan_data = {"image": simple_image}
    
    print("Testing vehicle scan with simple image...")
    response = requests.post(f"{API_BASE}/vehicles/scan", json=scan_data, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Let's also check the backend logs
    print("\nChecking backend logs...")
    import subprocess
    try:
        logs = subprocess.check_output(["tail", "-n", "20", "/var/log/supervisor/backend.err.log"], text=True)
        print("Backend logs:")
        print(logs)
    except:
        print("Could not fetch backend logs")

if __name__ == "__main__":
    test_vehicle_scan()