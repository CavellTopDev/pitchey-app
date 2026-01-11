# PWA Icons for Pitchey

## Generated Icons

This directory contains SVG placeholders for all required PWA icons.

### Main App Icons
- icon-72x72.png (72x72)
- icon-96x96.png (96x96)
- icon-128x128.png (128x128)
- icon-144x144.png (144x144)
- icon-152x152.png (152x152)
- icon-192x192.png (192x192)
- icon-384x384.png (384x384)
- icon-512x512.png (512x512)
- maskable-icon-192x192.png (192x192) - Maskable
- maskable-icon-512x512.png (512x512) - Maskable

### Shortcut Icons
- browse-96x96.png (96x96)
- create-96x96.png (96x96)
- dashboard-96x96.png (96x96)

### Badge Icon
- badge-72x72.png (72x72)

## Converting to PNG

To convert these SVG files to PNG format for production:

1. Use ImageMagick:
   ```bash
   for file in *.svg; do
     convert "$file" "${file%.*}.png"
   done
   ```

2. Or use an online converter like SVGPNG.com

3. Or use a design tool like Figma/Sketch to export as PNG

## Custom Icons

Replace the SVG files with your custom brand icons while maintaining the same sizes and naming convention.
