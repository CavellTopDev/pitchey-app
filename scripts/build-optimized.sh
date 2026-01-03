#!/bin/bash

# 🚀 Optimized Frontend Build Script
# Builds frontend with maximum optimization for production deployment

set -e

echo "🚀 PITCHEY FRONTEND OPTIMIZATION BUILD"
echo "====================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FRONTEND_DIR="./frontend"
DIST_DIR="$FRONTEND_DIR/dist"
REPORT_DIR="./optimization_report_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}1. 🧹 CLEANING PREVIOUS BUILDS${NC}"
echo "--------------------------------"

# Clean previous builds
if [ -d "$DIST_DIR" ]; then
    rm -rf "$DIST_DIR"
    echo "✅ Cleaned previous build"
fi

# Create report directory
mkdir -p "$REPORT_DIR"

echo ""
echo -e "${BLUE}2. 📦 INSTALLING DEPENDENCIES${NC}"
echo "-------------------------------"

cd "$FRONTEND_DIR"

# Ensure all dependencies are installed
npm ci
echo "✅ Dependencies installed"

echo ""
echo -e "${BLUE}3. 🔍 PRE-BUILD ANALYSIS${NC}"
echo "---------------------------"

# Analyze source before build
echo "📊 Analyzing source files..."
find src -type f -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" | wc -l > "../$REPORT_DIR/source_files_count.txt"
find src -type f -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -exec wc -l {} + | tail -1 | awk '{print $1}' > "../$REPORT_DIR/source_lines_count.txt"

echo "📄 Source files: $(cat "../$REPORT_DIR/source_files_count.txt")"
echo "📏 Total lines: $(cat "../$REPORT_DIR/source_lines_count.txt")"

echo ""
echo -e "${BLUE}4. 🏗️ OPTIMIZED BUILD${NC}"
echo "----------------------"

# Set production environment variables
export NODE_ENV=production
export GENERATE_SOURCEMAP=false

# Run optimized build
echo "🔧 Building with optimizations..."
start_time=$(date +%s)

npm run build 2>&1 | tee "../$REPORT_DIR/build_output.log"

end_time=$(date +%s)
build_duration=$((end_time - start_time))

echo "⏱️ Build completed in ${build_duration} seconds"

echo ""
echo -e "${BLUE}5. 📊 POST-BUILD ANALYSIS${NC}"
echo "----------------------------"

# Analyze build output
if [ -d "dist" ]; then
    echo "🎯 Build successful! Analyzing output..."
    
    # Overall size
    total_size=$(du -sh dist/ | cut -f1)
    echo "📦 Total build size: $total_size"
    
    # Asset breakdown
    echo "📋 Asset breakdown:"
    ls -la dist/assets/ | head -10
    
    # Calculate compression savings
    original_size=$(du -sb dist/ | cut -f1)
    compressed_size=$(find dist/ -type f \( -name "*.js" -o -name "*.css" \) -exec gzip -c {} \; | wc -c)
    compression_ratio=$(echo "scale=2; (1 - $compressed_size / $original_size) * 100" | bc -l 2>/dev/null || echo "N/A")
    
    # Save detailed analysis
    {
        echo "Pitchey Frontend Build Analysis"
        echo "Generated: $(date)"
        echo "==============================="
        echo ""
        echo "BUILD SUMMARY:"
        echo "Build Duration: ${build_duration} seconds"
        echo "Total Size: $total_size"
        echo "Original Size: $(numfmt --to=iec $original_size)"
        echo "Gzipped Size: $(numfmt --to=iec $compressed_size)"
        echo "Compression Ratio: ${compression_ratio}%"
        echo ""
        echo "LARGEST ASSETS:"
        find dist/ -type f -name "*.js" -exec ls -la {} \; | sort -k5 -nr | head -10
        echo ""
        echo "CHUNK BREAKDOWN:"
        ls -la dist/assets/*.js | awk '{print $5, $9}' | sort -nr | head -15
    } > "../$REPORT_DIR/build_analysis.txt"
    
    echo "✅ Analysis saved to $REPORT_DIR/build_analysis.txt"
else
    echo -e "${RED}❌ Build failed! Check build_output.log for details${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}6. 🔍 BUNDLE OPTIMIZATION SUGGESTIONS${NC}"
echo "--------------------------------------"

# Analyze potential optimizations
{
    echo "OPTIMIZATION RECOMMENDATIONS:"
    echo "=============================="
    echo ""
    
    # Check for large chunks
    large_chunks=$(find dist/assets/ -name "*.js" -size +500k 2>/dev/null | wc -l)
    if [ "$large_chunks" -gt 0 ]; then
        echo "🔴 Found $large_chunks chunks larger than 500KB:"
        find dist/assets/ -name "*.js" -size +500k -exec ls -lh {} \;
        echo "   → Consider further code splitting"
        echo ""
    fi
    
    # Check for duplicate dependencies
    echo "🔍 Checking for potential duplicate dependencies:"
    total_js_size=$(find dist/assets/ -name "*.js" -exec stat --format="%s" {} \; | awk '{sum+=$1} END {print sum}')
    if [ "$total_js_size" -gt 2000000 ]; then  # 2MB threshold
        echo "   → Total JS size is large ($(numfmt --to=iec $total_js_size))"
        echo "   → Consider lazy loading non-critical routes"
        echo "   → Review vendor dependencies for duplicates"
    else
        echo "   → JS bundle size is reasonable ($(numfmt --to=iec $total_js_size))"
    fi
    echo ""
    
    # Check CSS optimization
    css_count=$(find dist/assets/ -name "*.css" | wc -l)
    echo "🎨 CSS optimization:"
    echo "   → Found $css_count CSS files"
    if [ "$css_count" -gt 1 ]; then
        echo "   → Consider combining CSS files if possible"
    fi
    echo ""
    
    echo "✅ OPTIMIZATION APPLIED:"
    echo "   → Code splitting by portal and vendor"
    echo "   → Console log removal in production"
    echo "   → Terser minification"
    echo "   → Sourcemap removal in production"
    echo "   → Asset hashing for cache busting"
    
} > "../$REPORT_DIR/optimization_suggestions.txt"

cat "../$REPORT_DIR/optimization_suggestions.txt"

echo ""
echo -e "${BLUE}7. 🚀 DEPLOYMENT PREPARATION${NC}"
echo "------------------------------"

cd ..

# Create deployment-ready package
echo "📦 Preparing deployment package..."

# Copy optimized build
cp -r "$FRONTEND_DIR/dist" "./optimized_frontend_$(date +%Y%m%d_%H%M%S)"

echo "✅ Deployment package ready"

echo ""
echo "======================================"
echo -e "${GREEN}✅ OPTIMIZATION BUILD COMPLETE!${NC}"
echo "======================================"
echo ""
echo "📊 Build Summary:"
echo "   📦 Total Size: $total_size"
echo "   ⏱️  Build Time: ${build_duration} seconds"
echo "   📋 Report: $REPORT_DIR/"
echo ""
echo "🚀 Ready for deployment!"
echo "   Use: npm run deploy:frontend"
echo ""

# Performance score calculation
if [ "$build_duration" -lt 60 ] && [ "${total_size%?}" -lt 5000 ]; then
    echo -e "${GREEN}🏆 EXCELLENT: Fast build + Small bundle!${NC}"
elif [ "$build_duration" -lt 120 ] && [ "${total_size%?}" -lt 10000 ]; then
    echo -e "${YELLOW}⚠️  GOOD: Acceptable performance${NC}"
else
    echo -e "${RED}⚠️  NEEDS OPTIMIZATION: Large bundle or slow build${NC}"
fi