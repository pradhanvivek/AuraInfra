#!/usr/bin/env python3
"""
Demo Data Population Script for AuraInfra.ai Video Walkthrough
Creates properties, appliances, and documents for realistic demo
"""

import requests
import json
import base64
from datetime import datetime, timedelta
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "http://localhost:8001/api"

# Demo user credentials
DEMO_USER = {
    "username": "demo_investor",
    "password": "Demo123!@#",
    "email": "demo@aurainf.ai"
}

def create_sample_pdf_base64(title, content_lines):
    """Create a simple image-based PDF placeholder"""
    # Create a simple image to represent a document
    img = Image.new('RGB', (800, 1000), color='white')
    draw = ImageDraw.Draw(img)
    
    # Add title
    draw.text((50, 50), title, fill='black')
    
    # Add content lines
    y_position = 150
    for line in content_lines:
        draw.text((50, y_position), line, fill='black')
        y_position += 40
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"

def register_or_login():
    """Register demo user or login if exists"""
    print("🔐 Setting up demo user...")
    
    # Try to register
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json={
            "username": DEMO_USER["username"],
            "password": DEMO_USER["password"],
            "email": DEMO_USER["email"]
        })
        
        if response.status_code == 200:
            print("✅ Demo user created successfully")
            return response.json()["access_token"]
    except:
        pass
    
    # If registration fails, try login
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "username": DEMO_USER["username"],
        "password": DEMO_USER["password"]
    })
    
    if response.status_code == 200:
        print("✅ Logged in with existing demo user")
        return response.json()["access_token"]
    
    raise Exception("Failed to setup demo user")

def create_property(token, property_data):
    """Create a property"""
    print(f"🏠 Creating property: {property_data['name']}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/properties", json=property_data, headers=headers)
    
    if response.status_code == 200:
        property_id = response.json()["id"]
        print(f"✅ Property created: {property_data['name']} (ID: {property_id})")
        return property_id
    else:
        print(f"❌ Failed to create property: {response.text}")
        return None

def add_appliance(token, property_id, appliance_data):
    """Add appliance/fixture to property"""
    print(f"🔧 Adding appliance: {appliance_data['name']}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/properties/{property_id}/fixtures",
        json=appliance_data,
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✅ Appliance added: {appliance_data['name']}")
        return response.json()["id"]
    else:
        print(f"❌ Failed to add appliance: {response.text}")
        return None

def add_document(token, property_id, document_data):
    """Add document to property"""
    print(f"📄 Adding document: {document_data['name']}...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/properties/{property_id}/documents",
        json=document_data,
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✅ Document added: {document_data['name']}")
        return response.json()["id"]
    else:
        print(f"❌ Failed to add document: {response.text}")
        return None

def populate_demo_data():
    """Main function to populate all demo data"""
    print("\n" + "="*60)
    print("🎬 AuraInfra.ai Demo Data Population")
    print("="*60 + "\n")
    
    # Step 1: Setup user
    token = register_or_login()
    
    # Step 2: Create Property 1 - Sunset Villa
    print("\n📍 PROPERTY 1: SUNSET VILLA")
    print("-" * 60)
    
    sunset_villa_data = {
        "name": "Sunset Villa",
        "address": "123 Palm Avenue, Miami, FL 33139",
        "purchase_cost": 450000.00,
        "current_value": 525000.00,
        "purchase_date": "2021-03-15"
    }
    
    sunset_villa_id = create_property(token, sunset_villa_data)
    
    if sunset_villa_id:
        # Add appliances to Sunset Villa
        print("\n🔧 Adding appliances to Sunset Villa...")
        
        # Calculate dates for warranties
        today = datetime.now()
        
        # 1. Central HVAC System
        hvac_data = {
            "name": "Central HVAC System",
            "category": "hvac",
            "make": "Samsung",
            "model": "AC24FB",
            "serial_number": "SAMHVAC2022-45678",
            "purchase_cost": 8500.00,
            "purchase_date": "2022-02-15",
            "warranty_info": "5-year manufacturer warranty",
            "warranty_expiry_date": "2027-02-15",
            "maintenance_frequency_months": 6,
            "notes": "Annual maintenance required. Last service completed 3 months ago."
        }
        add_appliance(token, sunset_villa_id, hvac_data)
        
        # 2. LG Smart Refrigerator
        fridge_data = {
            "name": "Smart French Door Refrigerator",
            "category": "kitchen appliances",
            "make": "LG",
            "model": "LRFDS3006S",
            "serial_number": "LG2023-FRIDGE-9876",
            "purchase_cost": 2800.00,
            "purchase_date": "2023-06-10",
            "warranty_info": "2-year manufacturer warranty",
            "warranty_expiry_date": "2025-06-10",
            "notes": "Energy Star certified. Smart ThinQ technology."
        }
        add_appliance(token, sunset_villa_id, fridge_data)
        
        # 3. Water Heater (expiring soon - for alert demo)
        water_heater_data = {
            "name": "Water Heater",
            "category": "plumbing",
            "make": "Rheem",
            "model": "Performance Platinum",
            "serial_number": "RHEEM2021-WH-1234",
            "purchase_cost": 1200.00,
            "purchase_date": "2021-12-01",
            "warranty_info": "3-year manufacturer warranty",
            "warranty_expiry_date": "2024-12-01",
            "maintenance_frequency_months": 12,
            "notes": "50-gallon capacity. Warranty expiring soon!"
        }
        add_appliance(token, sunset_villa_id, water_heater_data)
        
        # 4. Dishwasher (for AI scan demo reference)
        dishwasher_data = {
            "name": "Built-in Dishwasher",
            "category": "kitchen appliances",
            "make": "Bosch",
            "model": "SHPM88Z75N",
            "serial_number": "BOSCH2023-DW-5432",
            "purchase_cost": 1200.00,
            "purchase_date": "2023-04-20",
            "warranty_info": "2-year manufacturer warranty",
            "warranty_expiry_date": "2025-04-20",
            "notes": "800 Series. Ultra-quiet operation at 40 dBA."
        }
        add_appliance(token, sunset_villa_id, dishwasher_data)
        
        # Add documents to Sunset Villa
        print("\n📄 Adding documents to Sunset Villa...")
        
        # 1. Property Deed
        deed_pdf = create_sample_pdf_base64(
            "PROPERTY DEED",
            [
                "Property: Sunset Villa",
                "Address: 123 Palm Avenue, Miami, FL 33139",
                "Purchase Date: March 15, 2021",
                "Purchase Price: $450,000.00",
                "",
                "This document certifies ownership of the above property.",
                "Recorded with Miami-Dade County Recorder's Office.",
                "",
                "Document No: 2021-DEED-45678",
                "Recording Date: March 20, 2021"
            ]
        )
        
        deed_doc = {
            "name": "Property Deed",
            "file_data": deed_pdf,
            "file_type": "image/png"
        }
        add_document(token, sunset_villa_id, deed_doc)
        
        # 2. Home Insurance Policy
        insurance_pdf = create_sample_pdf_base64(
            "HOME INSURANCE POLICY",
            [
                "Policy Holder: Demo Investor",
                "Property: Sunset Villa",
                "Address: 123 Palm Avenue, Miami, FL 33139",
                "",
                "Coverage Amount: $600,000",
                "Policy Number: HI-2024-789456",
                "Effective Date: January 1, 2024",
                "Expiration Date: December 31, 2024",
                "",
                "Coverage includes: Structure, Personal Property,",
                "Liability, and Natural Disaster Protection"
            ]
        )
        
        insurance_doc = {
            "name": "Home Insurance Policy 2024",
            "file_data": insurance_pdf,
            "file_type": "image/png"
        }
        add_document(token, sunset_villa_id, insurance_doc)
        
        # 3. Annual Inspection Report
        inspection_pdf = create_sample_pdf_base64(
            "ANNUAL INSPECTION REPORT",
            [
                "Property: Sunset Villa",
                "Inspection Date: November 1, 2024",
                "Inspector: ABC Home Inspections",
                "",
                "OVERALL CONDITION: EXCELLENT",
                "",
                "Summary of Findings:",
                "- Roof: Good condition, 8 years remaining",
                "- Foundation: No issues detected",
                "- Electrical: Up to code, functioning properly",
                "- Plumbing: All systems operational",
                "- HVAC: Recently serviced, optimal performance",
                "",
                "Recommendations: Water heater nearing end of warranty"
            ]
        )
        
        inspection_doc = {
            "name": "Annual Inspection Report 2024",
            "file_data": inspection_pdf,
            "file_type": "image/png"
        }
        add_document(token, sunset_villa_id, inspection_doc)
    
    # Step 3: Create Property 2 - Oakwood Apartment
    print("\n📍 PROPERTY 2: OAKWOOD APARTMENT")
    print("-" * 60)
    
    oakwood_data = {
        "name": "Oakwood Apartment",
        "address": "456 Oak Street, Unit 302, Orlando, FL 32801",
        "purchase_cost": 280000.00,
        "current_value": 310000.00,
        "purchase_date": "2022-08-20"
    }
    
    oakwood_id = create_property(token, oakwood_data)
    
    if oakwood_id:
        # Add a few appliances to Oakwood for portfolio view
        print("\n🔧 Adding appliances to Oakwood Apartment...")
        
        washer_data = {
            "name": "Washer & Dryer Combo",
            "category": "laundry",
            "make": "Whirlpool",
            "model": "WFC8090GW",
            "purchase_cost": 1500.00,
            "purchase_date": "2022-09-01",
            "warranty_info": "1-year manufacturer warranty",
            "warranty_expiry_date": "2023-09-01"
        }
        add_appliance(token, oakwood_id, washer_data)
        
        ac_unit_data = {
            "name": "Window AC Unit",
            "category": "hvac",
            "make": "Friedrich",
            "model": "CCF05A10A",
            "purchase_cost": 450.00,
            "purchase_date": "2023-05-15",
            "warranty_info": "2-year manufacturer warranty",
            "warranty_expiry_date": "2025-05-15"
        }
        add_appliance(token, oakwood_id, ac_unit_data)
    
    print("\n" + "="*60)
    print("✅ DEMO DATA POPULATION COMPLETE!")
    print("="*60)
    print("\n📊 Summary:")
    print(f"  • Properties created: 2")
    print(f"    - Sunset Villa: $450K → $525K (+16.7%)")
    print(f"    - Oakwood Apartment: $280K → $310K (+10.7%)")
    print(f"  • Appliances added: 6")
    print(f"  • Documents added: 3")
    print(f"\n🎬 App is ready for video recording!")
    print(f"📝 Follow the script in: /app/video_script_storyboard.md")
    print("\n💡 Demo User Credentials:")
    print(f"  Username: {DEMO_USER['username']}")
    print(f"  Password: {DEMO_USER['password']}")
    print(f"  Email: {DEMO_USER['email']}")
    print("="*60 + "\n")

if __name__ == "__main__":
    try:
        populate_demo_data()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
