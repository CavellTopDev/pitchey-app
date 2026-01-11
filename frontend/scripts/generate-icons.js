#!/usr/bin/env node

/**
 * PWA Icon Generator for Pitchey Platform
 * Generates all required icons for mobile app support
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes needed for PWA
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 192, name: 'maskable-icon-192x192.png', maskable: true },
  { size: 512, name: 'maskable-icon-512x512.png', maskable: true },
];

// Shortcut icons
const shortcutIcons = [
  { name: 'browse-96x96.png', size: 96 },
  { name: 'create-96x96.png', size: 96 },
  { name: 'dashboard-96x96.png', size: 96 },
];

// Badge icon
const badgeIcon = { name: 'badge-72x72.png', size: 72 };

function generateSVGIcon(size, type = 'default') {
  const padding = type === 'maskable' ? size * 0.1 : 0;
  const iconSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Simple film reel icon for Pitchey
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${type === 'maskable' ? `<rect width="${size}" height="${size}" fill="#1f2937"/>` : ''}
      <g transform="translate(${padding}, ${padding})">
        <!-- Main circle -->
        <circle cx="${centerX - padding}" cy="${centerY - padding}" r="${iconSize * 0.35}" 
                fill="${type === 'maskable' ? '#ffffff' : '#1f2937'}" stroke="#e5e7eb" stroke-width="2"/>
        <!-- Center hole -->
        <circle cx="${centerX - padding}" cy="${centerY - padding}" r="${iconSize * 0.1}" 
                fill="${type === 'maskable' ? '#1f2937' : '#ffffff'}"/>
        <!-- Film holes -->
        <circle cx="${centerX - padding - iconSize * 0.2}" cy="${centerY - padding - iconSize * 0.2}" r="${iconSize * 0.04}" 
                fill="${type === 'maskable' ? '#1f2937' : '#ffffff'}"/>
        <circle cx="${centerX - padding + iconSize * 0.2}" cy="${centerY - padding + iconSize * 0.2}" r="${iconSize * 0.04}" 
                fill="${type === 'maskable' ? '#1f2937' : '#ffffff'}"/>
        <circle cx="${centerX - padding + iconSize * 0.2}" cy="${centerY - padding - iconSize * 0.2}" r="${iconSize * 0.04}" 
                fill="${type === 'maskable' ? '#1f2937' : '#ffffff'}"/>
        <circle cx="${centerX - padding - iconSize * 0.2}" cy="${centerY - padding + iconSize * 0.2}" r="${iconSize * 0.04}" 
                fill="${type === 'maskable' ? '#1f2937' : '#ffffff'}"/>
        <!-- P letter in center -->
        <text x="${centerX - padding}" y="${centerY - padding + iconSize * 0.06}" 
              text-anchor="middle" 
              font-family="Arial, sans-serif" 
              font-weight="bold" 
              font-size="${iconSize * 0.2}" 
              fill="${type === 'maskable' ? '#ffffff' : '#1f2937'}">P</text>
      </g>
    </svg>
  `;
}

function generateShortcutIcon(size, iconType) {
  const icons = {
    browse: '🎬',
    create: '➕',
    dashboard: '📊'
  };
  
  const emoji = icons[iconType] || '🎬';
  
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="12" fill="#1f2937"/>
      <text x="${size/2}" y="${size/2 + size*0.1}" 
            text-anchor="middle" 
            font-size="${size * 0.5}">${emoji}</text>
    </svg>
  `;
}

function createIconsDirectory() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  return iconsDir;
}

function generateIconPlaceholders() {
  console.log('🎨 Generating PWA icons for Pitchey...');
  
  const iconsDir = createIconsDirectory();
  
  // Generate main app icons
  iconSizes.forEach(({ size, name, maskable }) => {
    const svg = generateSVGIcon(size, maskable ? 'maskable' : 'default');
    const svgPath = path.join(iconsDir, name.replace('.png', '.svg'));
    
    fs.writeFileSync(svgPath, svg.trim());
    console.log(`✅ Generated ${name} (${size}x${size})`);
  });
  
  // Generate shortcut icons
  shortcutIcons.forEach(({ name, size }) => {
    const iconType = name.split('-')[0];
    const svg = generateShortcutIcon(size, iconType);
    const svgPath = path.join(iconsDir, name.replace('.png', '.svg'));
    
    fs.writeFileSync(svgPath, svg.trim());
    console.log(`✅ Generated shortcut icon ${name}`);
  });
  
  // Generate badge icon
  const badgeSvg = generateSVGIcon(badgeIcon.size);
  const badgePath = path.join(iconsDir, badgeIcon.name.replace('.png', '.svg'));
  fs.writeFileSync(badgePath, badgeSvg.trim());
  console.log(`✅ Generated badge icon ${badgeIcon.name}`);
  
  // Create conversion instructions
  const readmePath = path.join(iconsDir, 'README.md');
  const readme = `# PWA Icons for Pitchey

## Generated Icons

This directory contains SVG placeholders for all required PWA icons.

### Main App Icons
${iconSizes.map(icon => `- ${icon.name} (${icon.size}x${icon.size})${icon.maskable ? ' - Maskable' : ''}`).join('\n')}

### Shortcut Icons
${shortcutIcons.map(icon => `- ${icon.name} (${icon.size}x${icon.size})`).join('\n')}

### Badge Icon
- ${badgeIcon.name} (${badgeIcon.size}x${badgeIcon.size})

## Converting to PNG

To convert these SVG files to PNG format for production:

1. Use ImageMagick:
   \`\`\`bash
   for file in *.svg; do
     convert "$file" "\${file%.*}.png"
   done
   \`\`\`

2. Or use an online converter like SVGPNG.com

3. Or use a design tool like Figma/Sketch to export as PNG

## Custom Icons

Replace the SVG files with your custom brand icons while maintaining the same sizes and naming convention.
`;
  
  fs.writeFileSync(readmePath, readme);
  
  console.log('\n🎉 Icon generation complete!');
  console.log('📁 Icons saved to:', iconsDir);
  console.log('📖 See README.md in icons directory for conversion instructions');
  
  return iconsDir;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateIconPlaceholders();
}

export { generateIconPlaceholders };