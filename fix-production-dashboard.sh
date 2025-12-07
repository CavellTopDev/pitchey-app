#!/bin/bash

# Find the line where DashboardHeader starts and the problematic content
LINE_NUM=$(grep -n "DashboardHeader" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/ProductionDashboard.tsx | head -1 | cut -d: -f1)

# Create a temporary file with the correct structure
cat > /tmp/production-dashboard-fix.txt << 'EOF'
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Responsive Header */}
      <DashboardHeader
        user={user}
        userType="production"
        title="Production Dashboard"
        credits={credits}
        subscription={subscription}
        onLogout={handleLogout}
      >
        {/* Tabs as part of header */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto">
            <nav className="-mb-px flex flex-wrap gap-x-4 sm:gap-x-8 px-4 sm:px-6 lg:px-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('my-pitches')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'my-pitches'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Saved Pitches
              </button>
              <button
                onClick={() => setActiveTab('following')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'following'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Following
              </button>
              <button
                onClick={() => setActiveTab('ndas')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'ndas'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                NDAs
              </button>
            </nav>
          </div>
        </div>
      </DashboardHeader>

      {/* Verification Warning */}
      {verificationStatus === 'pending' && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Your company verification is pending. Some features may be limited until verification is complete (24-48 hours).
              </p>
            </div>
          </div>
        </div>
      )}
EOF

echo "Fixed production dashboard header section"