import qrcode
import sys

# Expo URL for the preview environment
expo_url = "exp://fixandfluid.preview.emergentagent.com:443"

# Generate QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(expo_url)
qr.make(fit=True)

# Create an image
img = qr.make_image(fill_color="black", back_color="white")
img.save("/tmp/expo_qr_code.png")

print(f"QR code generated successfully!")
print(f"Expo URL: {expo_url}")
print(f"Saved to: /tmp/expo_qr_code.png")
