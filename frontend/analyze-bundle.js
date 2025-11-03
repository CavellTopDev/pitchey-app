#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * 
 * Analyzes the production build and generates a performance report
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Performance thresholds
const THRESHOLDS = {
  totalSize: 500 * 1024,      // 500 KB total
  jsSize: 300 * 1024,         // 300 KB JavaScript
  cssSize: 50 * 1024,         // 50 KB CSS
  largestChunk: 200 * 1024,   // 200 KB largest chunk
  firstLoad: 250 * 1024,      // 250 KB first load
};

async function getDirectorySize(dir) {
  let totalSize = 0;
  const files = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += await getDirectorySize(filePath);
    } else {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

async function analyzeBundle() {
  console.log(`${colors.bright}${colors.blue}🔍 Analyzing Production Bundle...${colors.reset}\n`);
  
  const distPath = path.join(__dirname, 'dist');
  const assetsPath = path.join(distPath, 'assets');
  
  try {
    // Check if dist folder exists
    await fs.access(distPath);
  } catch {
    console.log(`${colors.red}❌ No production build found. Run 'npm run build' first.${colors.reset}`);
    process.exit(1);
  }
  
  // Analyze files
  const files = await fs.readdir(distPath, { withFileTypes: true, recursive: true });
  const fileStats = [];
  
  for (const file of files) {
    if (file.isFile()) {
      const filePath = file.path ? path.join(file.path, file.name) : path.join(distPath, file.name);
      const stats = await fs.stat(filePath);
      const ext = path.extname(file.name);
      
      fileStats.push({
        name: file.name,
        path: filePath.replace(distPath, ''),
        size: stats.size,
        ext: ext,
        type: getFileType(ext),
      });
    }
  }
  
  // Sort by size
  fileStats.sort((a, b) => b.size - a.size);
  
  // Calculate totals
  const totals = {
    all: fileStats.reduce((sum, f) => sum + f.size, 0),
    js: fileStats.filter(f => f.type === 'js').reduce((sum, f) => sum + f.size, 0),
    css: fileStats.filter(f => f.type === 'css').reduce((sum, f) => sum + f.size, 0),
    images: fileStats.filter(f => f.type === 'image').reduce((sum, f) => sum + f.size, 0),
    fonts: fileStats.filter(f => f.type === 'font').reduce((sum, f) => sum + f.size, 0),
    other: fileStats.filter(f => f.type === 'other').reduce((sum, f) => sum + f.size, 0),
  };
  
  // Find chunks
  const chunks = fileStats.filter(f => f.type === 'js' && f.name.includes('.js'));
  const entryChunk = chunks.find(c => c.name.includes('index')) || chunks[0];
  const vendorChunks = chunks.filter(c => c.name.includes('vendor') || c.name.includes('react'));
  
  // Calculate first load JS
  const firstLoadJS = entryChunk ? entryChunk.size + vendorChunks.reduce((sum, c) => sum + c.size, 0) : 0;
  
  // Print summary
  console.log(`${colors.bright}📊 Bundle Size Summary${colors.reset}\n`);
  console.log(`Total Size:      ${formatSize(totals.all)} ${getSizeIndicator(totals.all, THRESHOLDS.totalSize)}`);
  console.log(`JavaScript:      ${formatSize(totals.js)} ${getSizeIndicator(totals.js, THRESHOLDS.jsSize)}`);
  console.log(`CSS:             ${formatSize(totals.css)} ${getSizeIndicator(totals.css, THRESHOLDS.cssSize)}`);
  console.log(`Images:          ${formatSize(totals.images)}`);
  console.log(`Fonts:           ${formatSize(totals.fonts)}`);
  console.log(`Other:           ${formatSize(totals.other)}`);
  console.log(`First Load JS:   ${formatSize(firstLoadJS)} ${getSizeIndicator(firstLoadJS, THRESHOLDS.firstLoad)}`);
  
  // Print largest files
  console.log(`\n${colors.bright}📦 Largest Files${colors.reset}\n`);
  const largestFiles = fileStats.slice(0, 10);
  for (const file of largestFiles) {
    const indicator = file.type === 'js' ? getSizeIndicator(file.size, THRESHOLDS.largestChunk) : '';
    console.log(`  ${formatSize(file.size).padEnd(10)} ${file.name} ${indicator}`);
  }
  
  // Print chunks
  console.log(`\n${colors.bright}🧩 JavaScript Chunks${colors.reset}\n`);
  for (const chunk of chunks) {
    const gzipSize = await estimateGzipSize(chunk.size);
    console.log(`  ${chunk.name.padEnd(30)} ${formatSize(chunk.size).padEnd(10)} (gzip: ~${formatSize(gzipSize)})`);
  }
  
  // Performance metrics
  console.log(`\n${colors.bright}⚡ Performance Metrics${colors.reset}\n`);
  
  const metrics = {
    'Chunk Count': chunks.length,
    'Lazy Routes': chunks.filter(c => c.name.includes('pages')).length,
    'Code Splitting': chunks.length > 5 ? '✅ Good' : '⚠️ Could be better',
    'Tree Shaking': totals.js < 500 * 1024 ? '✅ Good' : '⚠️ Review imports',
  };
  
  for (const [key, value] of Object.entries(metrics)) {
    console.log(`${key.padEnd(20)} ${value}`);
  }
  
  // Recommendations
  console.log(`\n${colors.bright}💡 Recommendations${colors.reset}\n`);
  
  const recommendations = [];
  
  if (totals.all > THRESHOLDS.totalSize) {
    recommendations.push('• Total bundle size exceeds recommended limit. Consider more code splitting.');
  }
  
  if (totals.js > THRESHOLDS.jsSize) {
    recommendations.push('• JavaScript size is large. Review dependencies and implement dynamic imports.');
  }
  
  if (firstLoadJS > THRESHOLDS.firstLoad) {
    recommendations.push('• First load JS is heavy. Move non-critical code to lazy-loaded chunks.');
  }
  
  const largestChunk = chunks[0];
  if (largestChunk && largestChunk.size > THRESHOLDS.largestChunk) {
    recommendations.push(`• Largest chunk (${largestChunk.name}) is too big. Consider splitting it.`);
  }
  
  if (chunks.length < 5) {
    recommendations.push('• Low number of chunks detected. Implement more route-based code splitting.');
  }
  
  const hasSourceMaps = fileStats.some(f => f.name.endsWith('.map'));
  if (!hasSourceMaps) {
    recommendations.push('• No source maps found. Enable hidden source maps for debugging.');
  }
  
  if (recommendations.length === 0) {
    console.log(`${colors.green}✅ Bundle is well optimized!${colors.reset}`);
  } else {
    recommendations.forEach(r => console.log(`${colors.yellow}${r}${colors.reset}`));
  }
  
  // Generate HTML report if stats file exists
  const statsPath = path.join(distPath, 'stats.html');
  try {
    await fs.access(statsPath);
    console.log(`\n${colors.cyan}📈 Visual bundle analyzer available at: ${statsPath}${colors.reset}`);
  } catch {
    // Stats file doesn't exist
  }
}

function getFileType(ext) {
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'js';
  if (['.css'].includes(ext)) return 'css';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'].includes(ext)) return 'image';
  if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) return 'font';
  return 'other';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getSizeIndicator(size, threshold) {
  if (size <= threshold * 0.7) return `${colors.green}✅${colors.reset}`;
  if (size <= threshold) return `${colors.yellow}⚠️${colors.reset}`;
  return `${colors.red}❌${colors.reset}`;
}

async function estimateGzipSize(size) {
  // Rough estimation: gzip typically achieves 60-70% compression for JS
  return Math.round(size * 0.35);
}

// Run the analysis
analyzeBundle().catch(console.error);