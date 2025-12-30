#!/bin/bash

# Keep only essential docs in root
KEEP_IN_ROOT="README.md CLAUDE.md CHANGELOG.md"

# Archive all Better Auth related docs
mv BETTER_AUTH_*.md archive/redundant/ 2>/dev/null

# Archive all implementation and guide docs (we have consolidated versions)
mv *_IMPLEMENTATION*.md *_GUIDE*.md *_DOCUMENTATION*.md archive/redundant/ 2>/dev/null

# Archive all fix and summary docs
mv *_FIX*.md *_FIXED*.md *_SUMMARY*.md archive/redundant/ 2>/dev/null

# Archive all analysis and review docs
mv *_ANALYSIS*.md *_REVIEW*.md *_CHECKLIST*.md archive/redundant/ 2>/dev/null

# Archive all complete/completion docs
mv *_COMPLETE*.md *_COMPLETION*.md archive/redundant/ 2>/dev/null

# Archive architecture docs (we have consolidated version)
mv ARCHITECTURE_*.md ARCHITECTURAL_*.md archive/redundant/ 2>/dev/null

# Archive API docs (we have consolidated version)
mv API_*.md archive/redundant/ 2>/dev/null

# Archive cache docs
mv CACHE_*.md *_CACHE_*.md archive/redundant/ 2>/dev/null

# Archive all context and workflow docs
mv *_CONTEXT*.md *_WORKFLOW*.md *_PATTERNS*.md archive/redundant/ 2>/dev/null

# Archive backend docs
mv BACKEND_*.md archive/redundant/ 2>/dev/null

# Count results
echo "Documentation Organization Complete!"
echo "=================================="
echo "Files archived: $(ls archive/*/*.md 2>/dev/null | wc -l)"
echo "Files in docs: $(ls docs/*.md 2>/dev/null | wc -l)"
echo "Files remaining in root: $(ls *.md 2>/dev/null | wc -l)"
