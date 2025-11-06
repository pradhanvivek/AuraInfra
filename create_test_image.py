#!/usr/bin/env python3
"""
Create a proper test image for AI scanning
"""

from PIL import Image, ImageDraw
import base64
import io

def create_test_car_image():
    """Create a simple car-like image"""
    # Create a 200x100 image with a white background
    img = Image.new('RGB', (200, 100), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple car shape
    # Car body (rectangle)
    draw.rectangle([20, 40, 180, 80], fill='blue', outline='black', width=2)
    
    # Car windows
    draw.rectangle([30, 45, 80, 65], fill='lightblue', outline='black')
    draw.rectangle([120, 45, 170, 65], fill='lightblue', outline='black')
    
    # Car wheels
    draw.ellipse([35, 75, 55, 95], fill='black')
    draw.ellipse([145, 75, 165, 95], fill='black')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return img_str

def create_test_appliance_image():
    """Create a simple appliance-like image"""
    # Create a 150x200 image with a white background
    img = Image.new('RGB', (150, 200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple refrigerator shape
    # Main body
    draw.rectangle([20, 20, 130, 180], fill='silver', outline='black', width=2)
    
    # Door handle
    draw.rectangle([110, 90, 115, 110], fill='black')
    
    # Freezer section
    draw.line([20, 70, 130, 70], fill='black', width=2)
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return img_str

if __name__ == "__main__":
    car_image = create_test_car_image()
    appliance_image = create_test_appliance_image()
    
    print("Car image base64 (first 100 chars):")
    print(car_image[:100] + "...")
    print(f"Car image length: {len(car_image)}")
    
    print("\nAppliance image base64 (first 100 chars):")
    print(appliance_image[:100] + "...")
    print(f"Appliance image length: {len(appliance_image)}")
    
    # Save to files for testing
    with open('/app/test_car_image.txt', 'w') as f:
        f.write(car_image)
    
    with open('/app/test_appliance_image.txt', 'w') as f:
        f.write(appliance_image)