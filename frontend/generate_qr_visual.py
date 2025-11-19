from PIL import Image, ImageDraw, ImageFont
import qrcode

# Expo URL for the preview environment
expo_url = "exp://fixandfluid.preview.emergentagent.com:443"

# Generate QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=10,
    border=2,
)
qr.add_data(expo_url)
qr.make(fit=True)

# Create QR code image
qr_img = qr.make_image(fill_color="black", back_color="white")

# Create a larger canvas for the final image with padding
canvas_width = 800
canvas_height = 1000
canvas = Image.new('RGB', (canvas_width, canvas_height), 'white')
draw = ImageDraw.Draw(canvas)

# Resize QR code to fit nicely
qr_size = 600
qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)

# Calculate position to center QR code
qr_x = (canvas_width - qr_size) // 2
qr_y = 180

# Paste QR code onto canvas
canvas.paste(qr_img, (qr_x, qr_y))

# Add text instructions
try:
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    text_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
except:
    title_font = ImageFont.load_default()
    text_font = ImageFont.load_default()
    small_font = ImageFont.load_default()

# Draw title
title = "AuraInfra.ai Preview"
title_bbox = draw.textbbox((0, 0), title, font=title_font)
title_width = title_bbox[2] - title_bbox[0]
draw.text(((canvas_width - title_width) // 2, 40), title, fill='black', font=title_font)

# Draw instruction
instruction = "Scan with Expo Go App"
inst_bbox = draw.textbbox((0, 0), instruction, font=text_font)
inst_width = inst_bbox[2] - inst_bbox[0]
draw.text(((canvas_width - inst_width) // 2, 120), instruction, fill='#666666', font=text_font)

# Draw URL below QR code
url_display = "fixandfluid.preview.emergentagent.com"
url_bbox = draw.textbbox((0, 0), url_display, font=small_font)
url_width = url_bbox[2] - url_bbox[0]
draw.text(((canvas_width - url_width) // 2, qr_y + qr_size + 30), url_display, fill='#888888', font=small_font)

# Draw instructions at bottom
steps = [
    "1. Open Expo Go app on your iPhone",
    "2. Tap 'Scan QR Code'",
    "3. Point camera at this QR code"
]

y_pos = qr_y + qr_size + 80
for step in steps:
    step_bbox = draw.textbbox((0, 0), step, font=small_font)
    step_width = step_bbox[2] - step_bbox[0]
    draw.text(((canvas_width - step_width) // 2, y_pos), step, fill='#555555', font=small_font)
    y_pos += 40

# Save the image
canvas.save("/tmp/expo_qr_instructions.png")
print("Visual QR code with instructions generated!")
print(f"Saved to: /tmp/expo_qr_instructions.png")
