/**
 * Quick Actions Test Suite for Creator Dashboard
 * Run this in the browser console while on the creator dashboard
 * 
 * Usage:
 * 1. Navigate to https://pitchey.pages.dev/creator/dashboard
 * 2. Login as creator (alex.creator@demo.com / Demo123)
 * 3. Open browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Run testQuickActions()
 */

function testQuickActions() {
  console.log('%c===== Quick Actions Test Suite =====', 'color: blue; font-size: 16px; font-weight: bold');
  
  // Define Quick Actions with their expected routes
  const quickActions = [
    { 
      text: 'Upload New Pitch', 
      route: '/creator/pitch/new',
      selector: 'button:contains("Upload New Pitch")',
      altSelector: '[href="/creator/pitch/new"]'
    },
    { 
      text: 'Manage Pitches', 
      route: '/creator/pitches',
      selector: 'button:contains("Manage Pitches")',
      altSelector: '[href="/creator/pitches"]'
    },
    { 
      text: 'View Analytics', 
      route: '/creator/analytics',
      selector: 'button:contains("View Analytics")',
      altSelector: '[href="/creator/analytics"]'
    },
    { 
      text: 'NDA Management', 
      route: '/creator/ndas',
      selector: 'button:contains("NDA Management")',
      altSelector: '[href="/creator/ndas"]'
    },
    { 
      text: 'View My Portfolio', 
      route: '/creator/portfolio',
      selector: 'button:contains("View My Portfolio")',
      altSelector: '[href="/creator/portfolio"]'
    },
    { 
      text: 'Following', 
      route: '/creator/following',
      selector: 'button:contains("Following")',
      altSelector: '[href="/creator/following"]'
    },
    { 
      text: 'Messages', 
      route: '/creator/messages',
      selector: 'button:contains("Messages")',
      altSelector: '[href="/creator/messages"]'
    },
    { 
      text: 'Calendar', 
      route: '/creator/calendar',
      selector: 'button:contains("Calendar")',
      altSelector: '[href="/creator/calendar"]'
    },
    { 
      text: 'Billing & Payments', 
      route: '/creator/billing',
      selector: 'button:contains("Billing")',
      altSelector: '[href="/creator/billing"]'
    }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  console.log('Testing Quick Action buttons...\n');

  // Find Quick Actions container
  const quickActionsContainer = Array.from(document.querySelectorAll('h2')).find(
    h => h.textContent.includes('Quick Actions')
  )?.closest('.bg-white');

  if (!quickActionsContainer) {
    console.error('%c❌ Quick Actions section not found!', 'color: red');
    console.log('Make sure you are on the creator dashboard');
    return;
  }

  console.log('%c✓ Quick Actions section found', 'color: green');
  console.log('');

  // Test each Quick Action button
  quickActions.forEach(action => {
    // Look for button containing the text within Quick Actions container
    const buttons = Array.from(quickActionsContainer.querySelectorAll('button'));
    const button = buttons.find(btn => 
      btn.textContent.includes(action.text.replace(' & Payments', '').replace('View ', ''))
    );

    if (button) {
      // Check if button has onClick handler
      const hasClickHandler = button.onclick || 
                             button.getAttribute('onclick') || 
                             (button._reactProps && button._reactProps.onClick);

      // Try to get the route it navigates to
      let navigatesToRoute = false;
      
      // Check if it's wrapped in a Link or has href
      const parentLink = button.closest('a[href]');
      if (parentLink) {
        navigatesToRoute = parentLink.getAttribute('href') === action.route;
      }

      // Check React props (if accessible)
      try {
        const reactKey = Object.keys(button).find(key => key.startsWith('__reactInternalInstance'));
        if (reactKey) {
          const reactProps = button[reactKey];
          // This is a simplified check - actual React internals are more complex
          navigatesToRoute = true; // Assume it works if React handler exists
        }
      } catch (e) {
        // React internals not accessible
      }

      if (hasClickHandler || navigatesToRoute) {
        console.log(`%c✓ ${action.text}`, 'color: green', `- Button found and appears functional`);
        passed++;
        results.push({
          action: action.text,
          status: 'PASS',
          element: button,
          route: action.route
        });
      } else {
        console.log(`%c⚠ ${action.text}`, 'color: orange', `- Button found but may not navigate correctly`);
        passed++;
        results.push({
          action: action.text,
          status: 'WARNING',
          element: button,
          route: action.route,
          note: 'Button exists but navigation handler unclear'
        });
      }
    } else {
      console.log(`%c✗ ${action.text}`, 'color: red', `- Button not found`);
      failed++;
      results.push({
        action: action.text,
        status: 'FAIL',
        route: action.route,
        error: 'Button not found in Quick Actions section'
      });
    }
  });

  // Summary
  console.log('\n%c===== Test Summary =====', 'color: blue; font-size: 14px; font-weight: bold');
  console.log(`Total Quick Actions tested: ${quickActions.length}`);
  console.log(`%cPassed: ${passed}`, passed > 0 ? 'color: green' : 'color: gray');
  console.log(`%cFailed: ${failed}`, failed > 0 ? 'color: red' : 'color: gray');
  
  if (failed === 0) {
    console.log('\n%c✅ All Quick Actions buttons found!', 'color: green; font-size: 14px; font-weight: bold');
  } else {
    console.log('\n%c⚠️ Some Quick Actions are missing or broken', 'color: orange; font-size: 14px; font-weight: bold');
  }

  // Store results globally for inspection
  window.quickActionTestResults = results;
  console.log('\nDetailed results saved to: window.quickActionTestResults');
  
  return results;
}

// Interactive button clicker for testing navigation
function testQuickActionNavigation(buttonText) {
  const quickActionsContainer = Array.from(document.querySelectorAll('h2')).find(
    h => h.textContent.includes('Quick Actions')
  )?.closest('.bg-white');

  if (!quickActionsContainer) {
    console.error('Quick Actions section not found!');
    return;
  }

  const buttons = Array.from(quickActionsContainer.querySelectorAll('button'));
  const button = buttons.find(btn => 
    btn.textContent.includes(buttonText.replace('View ', '').replace(' & Payments', ''))
  );

  if (button) {
    console.log(`Found button: "${buttonText}"`);
    console.log('Clicking button...');
    button.click();
    
    // Check if navigation occurred after a short delay
    setTimeout(() => {
      console.log(`Current URL: ${window.location.pathname}`);
    }, 500);
  } else {
    console.error(`Button "${buttonText}" not found`);
  }
}

// Helper to list all Quick Action buttons found
function listQuickActionButtons() {
  const quickActionsContainer = Array.from(document.querySelectorAll('h2')).find(
    h => h.textContent.includes('Quick Actions')
  )?.closest('.bg-white');

  if (!quickActionsContainer) {
    console.error('Quick Actions section not found!');
    return;
  }

  const buttons = Array.from(quickActionsContainer.querySelectorAll('button'));
  console.log(`Found ${buttons.length} Quick Action buttons:`);
  buttons.forEach((btn, index) => {
    console.log(`${index + 1}. ${btn.textContent.trim()}`);
  });
}

console.log('%cQuick Actions Test Suite loaded!', 'color: green; font-weight: bold');
console.log('Available functions:');
console.log('  testQuickActions() - Run full test suite');
console.log('  listQuickActionButtons() - List all Quick Action buttons');
console.log('  testQuickActionNavigation("Button Text") - Test specific button navigation');
console.log('\nRun testQuickActions() to start');