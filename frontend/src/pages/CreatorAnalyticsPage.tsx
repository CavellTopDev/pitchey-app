import React, { useState } from 'react';
import { 
  BarChart3, Activity, TrendingUp, Film, Target
} from 'lucide-react';
import { CreatorAnalytics } from '../components/Analytics/CreatorAnalytics';
import CreatorActivity from './creator/CreatorActivity';
import CreatorStats from './creator/CreatorStats';

export default function CreatorAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'stats'>('overview');

  // Mock data for analytics
  const pitchPerformance = {
    totalViews: 12543,
    viewsChange: 12.5,
    totalLikes: 892,
    likesChange: 8.3,
    totalShares: 234,
    sharesChange: -2.1,
    potentialInvestment: 850000,
    investmentChange: 15.7
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'stats', label: 'Quick Stats', icon: TrendingUp }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-600 mt-1">Track your pitch performance and audience engagement</p>
      </div>

      <div>
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-200 ease-in-out">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Main Analytics Component */}
              <CreatorAnalytics pitchPerformance={pitchPerformance} />
              
              {/* Additional Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performing Pitches */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-600" />
                    Top Performing Pitches
                  </h3>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold text-purple-600">#{i}</span>
                          </div>
                          <div>
                            <p className="font-medium">Pitch Title {i}</p>
                            <p className="text-sm text-gray-500">{1000 * i} views</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">+{15 * i}%</p>
                          <p className="text-xs text-gray-500">vs last week</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audience Insights */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Audience Insights
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Investors</span>
                        <span className="text-sm font-semibold">45%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Production Companies</span>
                        <span className="text-sm font-semibold">35%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '35%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Other Creators</span>
                        <span className="text-sm font-semibold">20%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '20%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <CreatorActivity />
          )}

          {activeTab === 'stats' && (
            <CreatorStats />
          )}
        </div>
      </div>
    </div>
  );
}