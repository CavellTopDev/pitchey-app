import React from 'react';
import EnhancedNavigation from '../components/EnhancedNavigation';

// Test page to debug navigation dropdowns without authentication
export default function TestNavigation() {
  const mockUser = {
    id: 'test-user',
    username: 'Test User',
    email: 'test@example.com'
  };

  const handleLogout = () => {
    console.log('Logout clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <EnhancedNavigation
        user={mockUser}
        userType="production"
        onLogout={handleLogout}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Navigation Test Page</h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Test Instructions</h2>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              <li>Resize your browser to mobile width (or use developer tools)</li>
              <li>Click the hamburger menu button (☰) in the top navigation</li>
              <li>Try clicking on dropdown items like "Dashboard", "Browse", "Projects", etc.</li>
              <li>Check the browser console for debug messages</li>
              <li>Verify that dropdown menus expand/collapse properly</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900">Desktop Navigation</h3>
              <p className="text-green-800 text-sm mt-1">
                Hover-based dropdowns in desktop view
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900">Mobile Navigation</h3>
              <p className="text-yellow-800 text-sm mt-1">
                Click-based dropdowns with visual debug indicators
              </p>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900">Debug Mode</h3>
              <p className="text-purple-800 text-sm mt-1">
                Enhanced logging and visual feedback enabled
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}