#!/usr/bin/env python3
"""
Generate a professional Apple HIG-compliant app icon for the Wishlist app.
Design concept: Overlapping gift cards that form a heart shape — dual meaning.
"""
from PIL import Image, ImageDraw
import math

SIZE = 1024
PADDING = int(SIZE * 0.18)  # Safe zone per Apple HIG

def create_gradient(size, top_color, bottom_color):
    """Create a vertical gradient image."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        ratio = y / size
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * ratio)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * ratio)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * ratio)
        for x in range(size):
            img.putpixel((x, y), (r, g, b, 255))
    return img

def create_gradient_fast(size, top_color, bottom_color):
    """Create a vertical gradient image (fast version)."""
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        ratio = y / size
        # Use cubic easing for a more Apple-like gradient
        ratio = ratio * ratio * (3 - 2 * ratio)  # smoothstep
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * ratio)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * ratio)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    return img

def draw_rounded_rect(draw, bbox, radius, **kwargs):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = bbox
    draw.rounded_rectangle(bbox, radius=radius, **kwargs)

# === Design Parameters ===
# Apple HIG gradient: subtle top-to-bottom, light-to-dark
TOP_COLOR = (255, 189, 168)    # Warm peach-coral
BOTTOM_COLOR = (196, 61, 90)   # Deep rose

# Card dimensions
CARD_W = int(SIZE * 0.42)
CARD_H = int(SIZE * 0.52)
CARD_RADIUS = int(SIZE * 0.07)

# Create base image with gradient
img = create_gradient_fast(SIZE, TOP_COLOR, BOTTOM_COLOR)
draw = ImageDraw.Draw(img, 'RGBA')

# Two overlapping cards arranged to suggest a heart
# Back card (slightly left and up, rose-pink tint)
back_offset_x = -int(SIZE * 0.06)
back_offset_y = -int(SIZE * 0.03)
back_x1 = (SIZE - CARD_W) // 2 + back_offset_x - int(SIZE * 0.04)
back_y1 = (SIZE - CARD_H) // 2 + back_offset_y - int(SIZE * 0.02)
back_x2 = back_x1 + CARD_W
back_y2 = back_y1 + CARD_H

# Draw back card with slight transparency and pink tint
overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
overlay_draw = ImageDraw.Draw(overlay)
draw_rounded_rect(overlay_draw, (back_x1, back_y1, back_x2, back_y2),
                  CARD_RADIUS, fill=(255, 195, 205, 200))
img.paste(Image.alpha_composite(Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)), overlay).convert('RGB'))

# Front card (centered, white)
front_x1 = (SIZE - CARD_W) // 2 + int(SIZE * 0.04)
front_y1 = (SIZE - CARD_H) // 2 + int(SIZE * 0.02)
front_x2 = front_x1 + CARD_W
front_y2 = front_y1 + CARD_H

# Draw front card
draw2 = ImageDraw.Draw(img, 'RGBA')
draw_rounded_rect(draw2, (front_x1, front_y1, front_x2, front_y2),
                  CARD_RADIUS, fill=(255, 255, 255, 245))

# Add a subtle heart icon on the front card
heart_cx = (front_x1 + front_x2) // 2
heart_cy = (front_y1 + front_y2) // 2 - int(SIZE * 0.02)
heart_size = int(SIZE * 0.08)

# Draw a simple heart using circles and triangle
draw2.ellipse([
    heart_cx - heart_size, heart_cy - heart_size,
    heart_cx, heart_cy + heart_size // 2
], fill=(232, 86, 127, 230))
draw2.ellipse([
    heart_cx, heart_cy - heart_size,
    heart_cx + heart_size, heart_cy + heart_size // 2
], fill=(232, 86, 127, 230))
draw2.polygon([
    heart_cx - heart_size, heart_cy,
    heart_cx + heart_size, heart_cy,
    heart_cx, heart_cy + int(heart_size * 1.3)
], fill=(232, 86, 127, 230))

# Save
img.save('/home/z/my-project/download/icon-apple-style.png', 'PNG', quality=100)
print("Icon saved!")

# Also create favicon sizes
for size_name, px in [('favicon-32', 32), ('favicon-16', 16), ('apple-touch-icon', 180)]:
    resized = img.resize((px, px), Image.LANCZOS)
    resized.save(f'/home/z/my-project/download/{size_name}.png', 'PNG', quality=100)
    print(f"{size_name}.png ({px}x{px}) saved!")
