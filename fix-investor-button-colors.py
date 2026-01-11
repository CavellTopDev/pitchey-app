#!/usr/bin/env python3
import os
import re
import sys

def fix_button_colors(file_path):
    """Change purple buttons to green in investor pages."""
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Define color replacements for buttons
    replacements = [
        # Primary button colors
        (r'(button[^>]*className="[^"]*)\bbg-purple-600\b', r'\1bg-green-600'),
        (r'(button[^>]*className="[^"]*)\bhover:bg-purple-700\b', r'\1hover:bg-green-700'),
        (r'(button[^>]*className="[^"]*)\bbg-purple-500\b', r'\1bg-green-500'),
        (r'(button[^>]*className="[^"]*)\bhover:bg-purple-600\b', r'\1hover:bg-green-600'),
        
        # Border and text colors for buttons
        (r'(button[^>]*className="[^"]*)\bborder-purple-600\b', r'\1border-green-600'),
        (r'(button[^>]*className="[^"]*)\btext-purple-600\b', r'\1text-green-600'),
        (r'(button[^>]*className="[^"]*)\bhover:bg-purple-50\b', r'\1hover:bg-green-50'),
        
        # Button component (capital B)
        (r'(Button[^>]*className="[^"]*)\bbg-purple-600\b', r'\1bg-green-600'),
        (r'(Button[^>]*className="[^"]*)\bhover:bg-purple-700\b', r'\1hover:bg-green-700'),
        (r'(Button[^>]*className="[^"]*)\bbg-purple-500\b', r'\1bg-green-500'),
        (r'(Button[^>]*className="[^"]*)\bhover:bg-purple-600\b', r'\1hover:bg-green-600'),
        
        # Focus ring colors for buttons
        (r'(button[^>]*className="[^"]*)\bfocus:ring-purple-500\b', r'\1focus:ring-green-500'),
        (r'(button[^>]*className="[^"]*)\bfocus:ring-purple-600\b', r'\1focus:ring-green-600'),
        
        # Ring colors
        (r'(button[^>]*className="[^"]*)\bring-purple-500\b', r'\1ring-green-500'),
        (r'(button[^>]*className="[^"]*)\bring-purple-600\b', r'\1ring-green-600'),
    ]
    
    # Apply all replacements
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also handle multi-line button definitions
    button_pattern = r'(<button[^>]*>)'
    buttons = re.findall(button_pattern, content, flags=re.MULTILINE | re.DOTALL)
    
    for button in buttons:
        if 'className=' in button:
            new_button = button
            new_button = new_button.replace('bg-purple-600', 'bg-green-600')
            new_button = new_button.replace('hover:bg-purple-700', 'hover:bg-green-700')
            new_button = new_button.replace('bg-purple-500', 'bg-green-500')
            new_button = new_button.replace('hover:bg-purple-600', 'hover:bg-green-600')
            new_button = new_button.replace('border-purple-600', 'border-green-600')
            new_button = new_button.replace('text-purple-600', 'text-green-600')
            new_button = new_button.replace('hover:bg-purple-50', 'hover:bg-green-50')
            new_button = new_button.replace('focus:ring-purple-500', 'focus:ring-green-500')
            new_button = new_button.replace('focus:ring-purple-600', 'focus:ring-green-600')
            new_button = new_button.replace('ring-purple-500', 'ring-green-500')
            new_button = new_button.replace('ring-purple-600', 'ring-green-600')
            
            if new_button != button:
                content = content.replace(button, new_button)
    
    # Handle JSX Button components
    button_component_pattern = r'(<Button[^>]*>)'
    button_components = re.findall(button_component_pattern, content, flags=re.MULTILINE | re.DOTALL)
    
    for button in button_components:
        if 'className=' in button:
            new_button = button
            new_button = new_button.replace('bg-purple-600', 'bg-green-600')
            new_button = new_button.replace('hover:bg-purple-700', 'hover:bg-green-700')
            new_button = new_button.replace('bg-purple-500', 'bg-green-500')
            new_button = new_button.replace('hover:bg-purple-600', 'hover:bg-green-600')
            
            if new_button != button:
                content = content.replace(button, new_button)
    
    # Don't change purple in non-button contexts (like badges, status indicators, charts)
    # These should remain as they are for visual distinction
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    # List of investor pages to fix
    investor_pages = [
        "frontend/src/pages/investor/InvestorPortfolio.tsx",
        "frontend/src/pages/investor/InvestorWatchlist.tsx",
        "frontend/src/pages/investor/InvestorReports.tsx",
        "frontend/src/pages/investor/InvestorCoInvestors.tsx",
        "frontend/src/pages/investor/InvestorProductionCompanies.tsx",
        "frontend/src/pages/investor/InvestorPitchView.tsx",
        "frontend/src/pages/investor/InvestorSaved.tsx",
        "frontend/src/pages/investor/InvestorNetwork.tsx",
        "frontend/src/pages/investor/InvestorCreators.tsx",
        "frontend/src/pages/investor/InvestorDiscover.tsx",
        "frontend/src/pages/investor/InvestorWallet.tsx",
        "frontend/src/pages/investor/PaymentMethods.tsx",
        "frontend/src/pages/investor/TransactionHistory.tsx",
        "frontend/src/pages/investor/AllInvestments.tsx",
        "frontend/src/pages/investor/PendingDeals.tsx",
        "frontend/src/pages/investor/CompletedProjects.tsx",
        "frontend/src/pages/investor/ROIAnalysis.tsx",
        "frontend/src/pages/investor/BudgetAllocation.tsx",
        "frontend/src/pages/investor/FinancialOverview.tsx",
        "frontend/src/pages/investor/TaxDocuments.tsx",
        "frontend/src/pages/investor/MarketTrends.tsx",
        "frontend/src/pages/investor/RiskAssessment.tsx",
        "frontend/src/pages/investor/InvestorActivity.tsx",
        "frontend/src/pages/investor/InvestorPerformance.tsx",
        "frontend/src/pages/investor/InvestorStats.tsx",
        "frontend/src/pages/investor/PerformanceTracking.tsx",
        "frontend/src/pages/investor/InvestorSettings.tsx",
    ]
    
    fixed_count = 0
    for file_path in investor_pages:
        if os.path.exists(file_path):
            print(f"Processing: {file_path}")
            if fix_button_colors(file_path):
                fixed_count += 1
                print(f"  ✓ Fixed button colors")
            else:
                print(f"  - No changes needed")
        else:
            print(f"  ✗ File not found: {file_path}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()