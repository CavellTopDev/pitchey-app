import React, { useState } from 'react';
import { 
  TrendingUp, 
  Eye, 
  Heart, 
  Share2, 
  Users, 
  DollarSign 
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';

interface CreatorAnalyticsProps {
  pitchPerformance: {
    totalViews: number;
    viewsChange: number;
    totalLikes: number;
    likesChange: number;
    totalShares: number;
    sharesChange: number;
    potentialInvestment: number;
    investmentChange: number;
  };
}

export const CreatorAnalytics: React.FC<CreatorAnalyticsProps> = ({ 
  pitchPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const performanceData = {
    views: [
      { label: '1', value: 100 },
      { label: '2', value: 150 },
      { label: '3', value: 200 },
      { label: '4', value: 180 },
      { label: '5', value: 220 }
    ],
    likes: [
      { label: '1', value: 50 },
      { label: '2', value: 75 },
      { label: '3', value: 100 },
      { label: '4', value: 90 },
      { label: '5', value: 110 }
    ]
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Pitch Performance Analytics
        </h2>
        <div className="flex items-center gap-4">
          <TimeRangeFilter 
            onChange={(range) => setTimeRange(range)}
            defaultRange="30d"
          />
          <AnalyticsExport 
            data={[]}  // Replace with actual data
            title="Creator Analytics"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <AnalyticCard 
          title="Total Views"
          value={pitchPerformance.totalViews}
          change={pitchPerformance.viewsChange}
          icon={<Eye className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Likes"
          value={pitchPerformance.totalLikes}
          change={pitchPerformance.likesChange}
          icon={<Heart className="w-5 h-5 text-red-500" />}
          variant="danger"
        />
        <AnalyticCard 
          title="Total Shares"
          value={pitchPerformance.totalShares}
          change={pitchPerformance.sharesChange}
          icon={<Share2 className="w-5 h-5 text-green-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="Potential Investment"
          value={pitchPerformance.potentialInvestment}
          change={pitchPerformance.investmentChange}
          icon={<DollarSign className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="currency"
        />
        <AnalyticCard 
          title="Followers"
          value={500}  // Replace with actual data
          change={10}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
        <AnalyticCard 
          title="Engagement Rate"
          value={25.6}
          icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Views Performance</h3>
          <PerformanceChart 
            title="Views Over Time"
            datasets={[{
              label: 'Views',
              data: performanceData.views,
              color: '#3B82F6'
            }]}
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Likes Performance</h3>
          <PerformanceChart 
            title="Likes Over Time"
            datasets={[{
              label: 'Likes',
              data: performanceData.likes,
              color: '#EF4444'
            }]}
          />
        </div>
      </div>
    </div>
  );
};