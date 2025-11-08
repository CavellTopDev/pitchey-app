#!/usr/bin/env python3

"""
Comprehensive test script to verify all mock data has been replaced with real backend data.
This script performs detailed analysis of API responses to ensure no hardcoded values remain.
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple
import sys

# Configuration
API_BASE = "http://localhost:8001"

# Use demo login credentials
DEMO_USERS = {
    "creator": {
        "email": "alice@example.com",
        "password": "password123",
        "username": "alice",
        "userType": "creator"
    },
    "investor": {
        "email": "bob@example.com",
        "password": "password123",
        "username": "bob",
        "userType": "investor"
    },
    "production": {
        "email": "charlie@example.com",
        "password": "password123",
        "username": "charlie",
        "userType": "production"
    }
}

# Default to creator account for testing
TEST_USER = DEMO_USERS["creator"]

# Known mock data patterns to check for
MOCK_DATA_PATTERNS = {
    "suspicious_numbers": [15000, 892, 1234, 5678, 1000, 2000, 3000],
    "mock_strings": ["mockPitchesData", "TODO", "FIXME", "dummy", "test", "sample"],
    "unrealistic_stats": {
        "totalViews": (0, 1000),  # Realistic range for new account
        "followers": (0, 100),
        "avgRating": (0, 5),
        "pitches": (0, 50)
    }
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_colored(message: str, color: str = Colors.ENDC):
    print(f"{color}{message}{Colors.ENDC}")

def print_section(title: str):
    print_colored(f"\n{'=' * 60}", Colors.BLUE)
    print_colored(f"{title}", Colors.BOLD)
    print_colored(f"{'=' * 60}", Colors.BLUE)

def authenticate(user_type: str = "creator") -> str:
    """Login with demo account and get auth token"""
    print_section("Authentication")
    
    user = DEMO_USERS.get(user_type, DEMO_USERS["creator"])
    print(f"Logging in as demo {user_type} user: {user['email']}")
    
    # Login with demo account
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": user["email"], "password": user["password"]}
    )
    
    if response.status_code == 200 or response.status_code == 201:
        data = response.json()
        token = data.get("session", {}).get("token") or data.get("token")
        if token:
            print_colored(f"✓ Authentication successful as {user['username']}", Colors.GREEN)
            return token
    
    print_colored(f"✗ Authentication failed: {response.text}", Colors.RED)
    sys.exit(1)

def check_for_mock_data(data: any, path: str = "") -> List[str]:
    """Recursively check for mock data patterns"""
    issues = []
    
    if isinstance(data, dict):
        for key, value in data.items():
            new_path = f"{path}.{key}" if path else key
            issues.extend(check_for_mock_data(value, new_path))
    
    elif isinstance(data, list):
        for i, item in enumerate(data):
            issues.extend(check_for_mock_data(item, f"{path}[{i}]"))
    
    elif isinstance(data, (int, float)):
        # Check for suspicious numbers
        if data in MOCK_DATA_PATTERNS["suspicious_numbers"]:
            issues.append(f"Suspicious value at {path}: {data}")
        
        # Check against realistic ranges
        for field, (min_val, max_val) in MOCK_DATA_PATTERNS["unrealistic_stats"].items():
            if field in path and not (min_val <= data <= max_val):
                issues.append(f"Unrealistic {field} at {path}: {data}")
    
    elif isinstance(data, str):
        # Check for mock strings
        for pattern in MOCK_DATA_PATTERNS["mock_strings"]:
            if pattern.lower() in data.lower():
                issues.append(f"Mock string pattern '{pattern}' found at {path}")
    
    return issues

def test_endpoint(
    method: str, 
    endpoint: str, 
    token: str = None, 
    data: dict = None,
    description: str = ""
) -> Tuple[bool, dict, List[str]]:
    """Test an endpoint and check for mock data"""
    
    print(f"\nTesting: {description or endpoint}")
    print(f"Method: {method} {endpoint}")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data:
        headers["Content-Type"] = "application/json"
    
    try:
        if method == "GET":
            response = requests.get(f"{API_BASE}{endpoint}", headers=headers)
        elif method == "POST":
            response = requests.post(
                f"{API_BASE}{endpoint}", 
                headers=headers,
                json=data
            )
        else:
            response = requests.request(
                method, 
                f"{API_BASE}{endpoint}",
                headers=headers,
                json=data
            )
        
        if response.status_code >= 200 and response.status_code < 300:
            response_data = response.json() if response.text else {}
            issues = check_for_mock_data(response_data)
            
            if issues:
                print_colored(f"✗ Found {len(issues)} mock data issues:", Colors.RED)
                for issue in issues[:5]:  # Show first 5 issues
                    print(f"  - {issue}")
                return False, response_data, issues
            else:
                print_colored("✓ No mock data detected", Colors.GREEN)
                return True, response_data, []
        else:
            print_colored(f"✗ Request failed: {response.status_code}", Colors.RED)
            return False, {}, [f"HTTP {response.status_code}"]
            
    except Exception as e:
        print_colored(f"✗ Error: {str(e)}", Colors.RED)
        return False, {}, [str(e)]

def test_data_flow(token: str):
    """Test complete data flow to ensure real data propagation"""
    print_section("Data Flow Test")
    
    # 1. Create a pitch
    print("\n1. Creating test pitch...")
    pitch_data = {
        "title": f"Real Data Test {int(time.time())}",
        "logline": "Testing real backend data flow",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "Verifying mock data replacement"
    }
    
    success, response, _ = test_endpoint(
        "POST", "/api/pitches", token, pitch_data,
        "Create Pitch"
    )
    
    if not success or "id" not in response:
        print_colored("Failed to create pitch", Colors.RED)
        return False
    
    pitch_id = response["id"]
    print_colored(f"✓ Created pitch ID: {pitch_id}", Colors.GREEN)
    
    # 2. Record a view
    print("\n2. Recording pitch view...")
    test_endpoint("POST", f"/api/pitches/{pitch_id}/view", token, 
                 description="Record View")
    
    # 3. Add a like
    print("\n3. Adding like to pitch...")
    test_endpoint("POST", f"/api/pitches/{pitch_id}/like", token,
                 description="Like Pitch")
    
    # 4. Check dashboard reflects changes
    print("\n4. Verifying dashboard updates...")
    time.sleep(1)  # Allow time for data to propagate
    
    success, dashboard, issues = test_endpoint(
        "GET", "/api/creator/dashboard", token,
        description="Updated Dashboard"
    )
    
    if success:
        views = dashboard.get("stats", {}).get("totalViews", 0)
        pitches = dashboard.get("stats", {}).get("totalPitches", 0)
        
        print(f"  Total Views: {views}")
        print(f"  Total Pitches: {pitches}")
        
        if views > 0 and pitches > 0:
            print_colored("✓ Dashboard shows real data", Colors.GREEN)
            return True
        else:
            print_colored("✗ Dashboard not updating properly", Colors.RED)
            return False
    
    return False

def test_all_endpoints(token: str):
    """Test all major endpoints for mock data"""
    print_section("Endpoint Testing")
    
    endpoints = [
        ("GET", "/api/creator/dashboard", "Creator Dashboard"),
        ("GET", "/api/profile", "User Profile"),
        ("GET", "/api/pitches", "List Pitches"),
        ("GET", "/api/notifications", "Notifications"),
        ("GET", "/api/trending", "Trending Pitches"),
        ("GET", "/api/investor/portfolio", "Investor Portfolio"),
        ("GET", "/api/production/dashboard", "Production Dashboard"),
        ("GET", "/api/analytics/summary", "Analytics Summary"),
    ]
    
    results = []
    total_issues = []
    
    for method, endpoint, description in endpoints:
        success, data, issues = test_endpoint(
            method, endpoint, token, description=description
        )
        results.append((endpoint, success, len(issues)))
        total_issues.extend(issues)
    
    return results, total_issues

def generate_report(results: List, issues: List):
    """Generate final test report"""
    print_section("Test Report")
    
    passed = sum(1 for _, success, _ in results if success)
    failed = len(results) - passed
    
    print(f"\nEndpoint Results:")
    for endpoint, success, issue_count in results:
        status = "✓ PASS" if success else f"✗ FAIL ({issue_count} issues)"
        color = Colors.GREEN if success else Colors.RED
        print_colored(f"  {endpoint}: {status}", color)
    
    print(f"\n" + "=" * 40)
    print(f"Total Endpoints Tested: {len(results)}")
    print_colored(f"Passed: {passed}", Colors.GREEN)
    if failed > 0:
        print_colored(f"Failed: {failed}", Colors.RED)
    
    if issues:
        print(f"\nTop Issues Found:")
        # Count issue types
        issue_types = {}
        for issue in issues:
            issue_type = issue.split(":")[0]
            issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
        
        for issue_type, count in sorted(issue_types.items(), 
                                       key=lambda x: x[1], reverse=True)[:5]:
            print(f"  - {issue_type}: {count} occurrences")
    
    print("\n" + "=" * 40)
    if failed == 0 and not issues:
        print_colored("✅ All tests passed! Mock data successfully replaced.", Colors.GREEN)
        return 0
    else:
        print_colored("⚠️  Some issues detected. Review required.", Colors.YELLOW)
        return 1

def main():
    print_colored("Real Data Verification Script", Colors.BOLD)
    print(f"Testing against: {API_BASE}")
    print(f"Started at: {datetime.now()}")
    
    try:
        # Authenticate
        token = authenticate()
        
        # Test endpoints
        results, issues = test_all_endpoints(token)
        
        # Test data flow
        flow_success = test_data_flow(token)
        results.append(("Data Flow", flow_success, 0 if flow_success else 1))
        
        # Generate report
        exit_code = generate_report(results, issues)
        
        print(f"\nCompleted at: {datetime.now()}")
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print_colored("\n\nTest interrupted by user", Colors.YELLOW)
        sys.exit(1)
    except Exception as e:
        print_colored(f"\nUnexpected error: {e}", Colors.RED)
        sys.exit(1)

if __name__ == "__main__":
    main()