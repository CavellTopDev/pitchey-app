#!/usr/bin/env python3
import os
import re
import sys

def remove_navigation_component(file_path):
    """Remove DashboardHeader or navigation components from files."""
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Remove DashboardHeader import
    content = re.sub(r"import\s+DashboardHeader\s+from\s+['\"].*?['\"];?\n", "", content)
    
    # Remove InvestorNavigation import
    content = re.sub(r"import\s+{\s*InvestorNavigation\s*}\s+from\s+['\"].*?['\"];?\n", "", content)
    
    # Remove unused imports from useBetterAuthStore if only used for navigation
    # Check if useBetterAuthStore is used elsewhere
    if 'useBetterAuthStore' in content:
        store_usage_count = len(re.findall(r'useBetterAuthStore', content))
        # If it's only in import and one usage for destructuring, check what's destructured
        if store_usage_count == 2:  # One import, one usage
            # Check if only user and logout are destructured and not used elsewhere
            user_logout_pattern = r'const\s+{\s*user\s*,\s*logout\s*}\s*=\s*useBetterAuthStore\(\);'
            if re.search(user_logout_pattern, content):
                # Check if user and logout are only used in navigation components
                user_usage = len(re.findall(r'\buser\b(?!:)', content))
                logout_usage = len(re.findall(r'\blogout\b(?!:)', content))
                # If they're not used much, they were likely only for navigation
                if user_usage <= 3 and logout_usage <= 3:
                    content = re.sub(user_logout_pattern, '', content)
                    content = re.sub(r"import\s+{\s*useBetterAuthStore\s*}\s+from\s+['\"].*?betterAuthStore['\"];?\n", "", content)
    
    # Remove useNavigate if only used for logout
    if 'useNavigate' in content:
        navigate_usage = len(re.findall(r'navigate', content))
        if navigate_usage <= 3:  # Likely only for logout
            content = re.sub(r"import\s+{\s*useNavigate\s*}\s+from\s+['\"]react-router-dom['\"];?\n", "", content)
            content = re.sub(r"const\s+navigate\s*=\s*useNavigate\(\);?\n", "", content)
    
    # Remove handleLogout function
    content = re.sub(r"const\s+handleLogout\s*=\s*\(\)\s*=>\s*{\s*logout\(\);\s*navigate\(['\"][^'\"]*['\"]\);\s*};\n", "", content)
    
    # Remove DashboardHeader component usage
    content = re.sub(r'<DashboardHeader[^>]*?/>\n?', '', content)
    content = re.sub(r'<DashboardHeader[^>]*?>.*?</DashboardHeader>\n?', '', content, flags=re.DOTALL)
    
    # Remove InvestorNavigation component usage  
    content = re.sub(r'<InvestorNavigation[^>]*?/>\n?', '', content)
    content = re.sub(r'<InvestorNavigation[^>]*?>.*?</InvestorNavigation>\n?', '', content, flags=re.DOTALL)
    
    # Clean up the main container div that wraps everything
    # Replace min-h-screen bg-gray-50 wrapper divs with just a plain div
    content = re.sub(r'<div\s+className="min-h-screen bg-gray-50">', '<div>', content)
    
    # Clean up any double empty lines
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    # List of files to fix based on our search
    files_to_fix = []
    
    # Add DashboardHeader files (excluding main dashboard pages)
    dashboard_header_files = [
        "frontend/src/pages/creator/CreatorCollaborations.tsx",
        "frontend/src/pages/creator/CreatorPitchesAnalytics.tsx", 
        "frontend/src/pages/creator/CreatorPitchesDrafts.tsx",
        "frontend/src/pages/creator/CreatorPitchesReview.tsx",
        "frontend/src/pages/creator/CreatorTeamInvite.tsx",
        "frontend/src/pages/creator/CreatorTeamMembers.tsx",
        "frontend/src/pages/creator/CreatorTeamRoles.tsx",
        "frontend/src/pages/production/ProductionActivity.tsx",
        "frontend/src/pages/production/ProductionAnalytics.tsx",
        "frontend/src/pages/production/ProductionCollaborations.tsx",
        "frontend/src/pages/production/ProductionPipeline.tsx",
        "frontend/src/pages/production/ProductionProjectsActive.tsx",
        "frontend/src/pages/production/ProductionProjectsCompleted.tsx",
        "frontend/src/pages/production/ProductionProjectsDevelopment.tsx",
        "frontend/src/pages/production/ProductionProjectsPost.tsx",
        "frontend/src/pages/production/ProductionProjects.tsx",
        "frontend/src/pages/production/ProductionRevenue.tsx",
        "frontend/src/pages/production/ProductionSaved.tsx",
        "frontend/src/pages/production/ProductionStats.tsx",
        "frontend/src/pages/production/ProductionSubmissions.tsx",
        "frontend/src/pages/production/ProductionSubmissionsAccepted.tsx",
        "frontend/src/pages/production/ProductionSubmissionsArchive.tsx",
        "frontend/src/pages/production/ProductionSubmissionsNew.tsx",
        "frontend/src/pages/production/ProductionSubmissionsRejected.tsx",
        "frontend/src/pages/production/ProductionSubmissionsReview.tsx",
        "frontend/src/pages/production/ProductionSubmissionsShortlisted.tsx",
    ]
    
    # Add InvestorNavigation files
    investor_nav_files = [
        "frontend/src/pages/investor/AllInvestments.tsx",
        "frontend/src/pages/investor/BudgetAllocation.tsx",
        "frontend/src/pages/investor/CompletedProjects.tsx",
        "frontend/src/pages/investor/FinancialOverview.tsx",
        "frontend/src/pages/investor/InvestorActivity.tsx",
        # InvestorAnalytics already fixed
        "frontend/src/pages/investor/InvestorCoInvestors.tsx",
        "frontend/src/pages/investor/InvestorCreators.tsx",
        "frontend/src/pages/investor/InvestorDeals.tsx",
        "frontend/src/pages/investor/InvestorDiscover.tsx",
        "frontend/src/pages/investor/InvestorNetwork.tsx",
        "frontend/src/pages/investor/InvestorPerformance.tsx",
        "frontend/src/pages/investor/InvestorPortfolio.tsx",
        "frontend/src/pages/investor/InvestorProductionCompanies.tsx",
        "frontend/src/pages/investor/InvestorReports.tsx",
        "frontend/src/pages/investor/InvestorSaved.tsx",
        "frontend/src/pages/investor/InvestorSettings.tsx",
        "frontend/src/pages/investor/InvestorStats.tsx",
        "frontend/src/pages/investor/InvestorWallet.tsx",
        "frontend/src/pages/investor/InvestorWatchlist.tsx",
        "frontend/src/pages/investor/MarketTrends.tsx",
        "frontend/src/pages/investor/NDARequests.tsx",
        "frontend/src/pages/investor/PaymentMethods.tsx",
        "frontend/src/pages/investor/PendingDeals.tsx",
        "frontend/src/pages/investor/PerformanceTracking.tsx",
        "frontend/src/pages/investor/RiskAssessment.tsx",
        "frontend/src/pages/investor/ROIAnalysis.tsx",
        "frontend/src/pages/investor/TaxDocuments.tsx",
        "frontend/src/pages/investor/TransactionHistory.tsx",
    ]
    
    files_to_fix.extend(dashboard_header_files)
    files_to_fix.extend(investor_nav_files)
    
    fixed_count = 0
    for file_path in files_to_fix:
        if os.path.exists(file_path):
            print(f"Processing: {file_path}")
            if remove_navigation_component(file_path):
                fixed_count += 1
                print(f"  ✓ Fixed")
            else:
                print(f"  - No changes needed")
        else:
            print(f"  ✗ File not found: {file_path}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()