#!/usr/bin/env python3
"""
Test vehicle scan with a proper car image
"""

import requests
import json
import base64
import os

# Configuration
BACKEND_URL = "https://aurainfra-docfix.preview.emergentagent.com"
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

# Test vehicle scan with real image
def test_vehicle_scan_with_real_image():
    token = get_auth_token()
    if not token:
        print("Failed to get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Read the car image
    try:
        with open('/app/test_car_image.txt', 'r') as f:
            car_image = f.read().strip()
    except FileNotFoundError:
        print("Car image file not found. Run create_test_image.py first.")
        return
    
    scan_data = {"image": car_image}
    
    print("Testing vehicle scan with realistic car image...")
    print(f"Image length: {len(car_image)} characters")
    
    response = requests.post(f"{API_BASE}/vehicles/scan", json=scan_data, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        try:
            data = response.json()
            print("\n✅ SUCCESS! Vehicle scan worked!")
            print(f"Make: {data.get('make', 'N/A')}")
            print(f"Model: {data.get('model', 'N/A')}")
            print(f"Year: {data.get('year', 'N/A')}")
            print(f"Confidence: {data.get('confidence', 'N/A')}")
        except json.JSONDecodeError:
            print("Failed to parse JSON response")
    else:
        print(f"\n❌ FAILED with status {response.status_code}")

if __name__ == "__main__":
    test_vehicle_scan_with_real_image()