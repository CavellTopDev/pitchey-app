import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, Activity, TrendingUp, DollarSign, Eye, 
  Film, Users, Clock, Calendar, FileText,
  TrendingDown, Award, Target, Briefcase
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { useAuthStore } from '../store/authStore';
import ProductionAnalytics from './production/ProductionAnalytics';
import ProductionActivity from './production/ProductionActivity';
import ProductionStats from './production/ProductionStats';
import ProductionRevenue from './production/ProductionRevenue';

export default function ProductionAnalyticsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'stats' | 'revenue'>('overview');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'stats', label: 'Quick Stats', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue', icon: DollarSign }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Analytics & Performance"
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <ProductionAnalytics />
              
              {/* Additional Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Performance */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-600" />
                    Project Performance
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Award className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Completed Projects</p>
                          <p className="text-sm text-gray-500">This Quarter</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">8</p>
                        <p className="text-xs text-green-600">+2 vs last quarter</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Active Projects</p>
                          <p className="text-sm text-gray-500">Currently Running</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">12</p>
                        <p className="text-xs text-gray-600">In production</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium">Development Pipeline</p>
                          <p className="text-sm text-gray-500">Pre-production</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">5</p>
                        <p className="text-xs text-gray-600">Projects</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Budget Overview */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Budget Overview
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-600">Total Budget Allocated</p>
                          <p className="text-2xl font-bold text-purple-900">$25.5M</p>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          2024
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Spent</span>
                          <span className="text-sm font-semibold">$18.2M (71%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '71%' }}></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Committed</span>
                          <span className="text-sm font-semibold">$4.8M (19%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '19%' }}></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Available</span>
                          <span className="text-sm font-semibold">$2.5M (10%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <ProductionActivity />
          )}

          {activeTab === 'stats' && (
            <ProductionStats />
          )}

          {activeTab === 'revenue' && (
            <ProductionRevenue />
          )}
        </div>
      </div>
    </div>
  );
}