#!/bin/bash

echo "Building for production with forced production mode..."

# Clean previous build
rm -rf dist

# Set all production environment variables
export NODE_ENV=production
export VITE_MODE=production
export BABEL_ENV=production

# Build with Vite in production mode
npx vite build --mode production

# Check for jsxDEV in output
echo "Checking for development JSX in build..."
if grep -q "jsxDEV" dist/assets/*.js 2>/dev/null; then
    echo "WARNING: Development JSX found in production build!"
    echo "Files containing jsxDEV:"
    grep -l "jsxDEV" dist/assets/*.js 2>/dev/null | head -5
else
    echo "SUCCESS: No development JSX found in production build"
fi

echo "Build complete!"