#!/bin/bash

echo "=== Finding pages with potential duplicate header issues ==="
echo ""
echo "Pages that import DashboardHeader or navigation components:"
echo ""

# Find all pages that import DashboardHeader
echo "1. Pages with DashboardHeader:"
grep -r "import.*DashboardHeader" frontend/src/pages --include="*.tsx" --include="*.jsx" | cut -d: -f1 | sort | uniq

echo ""
echo "2. Pages with InvestorNavigation:"
grep -r "import.*InvestorNavigation" frontend/src/pages --include="*.tsx" --include="*.jsx" | cut -d: -f1 | sort | uniq

echo ""
echo "3. Pages with CreatorNavigation:"
grep -r "import.*CreatorNavigation" frontend/src/pages --include="*.tsx" --include="*.jsx" | cut -d: -f1 | sort | uniq

echo ""
echo "4. Pages with ProductionNavigation:"
grep -r "import.*ProductionNavigation" frontend/src/pages --include="*.tsx" --include="*.jsx" | cut -d: -f1 | sort | uniq

echo ""
echo "=== These pages likely need fixing if they're rendered within PortalLayout ==="