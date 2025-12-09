import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Layers, 
  PieChart, 
  Users, 
  Shield, 
  Building2 
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';

interface ProductionAnalyticsProps {
  productionPerformance: {
    totalPitches: number;
    totalRevenue: number;
    activeProjects: number;
    ndaSignedCount: number;
    averageProjectBudget: number;
    creatorInteractions: number;
  };
}

export const ProductionAnalytics: React.FC<ProductionAnalyticsProps> = ({ 
  productionPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const performanceData = {
    pitches: [
      { label: '1', value: 10 },
      { label: '2', value: 15 },
      { label: '3', value: 20 },
      { label: '4', value: 18 },
      { label: '5', value: 22 }
    ],
    revenue: [
      { label: '1', value: 50000 },
      { label: '2', value: 75000 },
      { label: '3', value: 100000 },
      { label: '4', value: 90000 },
      { label: '5', value: 110000 }
    ]
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Production Company Analytics
        </h2>
        <div className="flex items-center gap-4">
          <TimeRangeFilter 
            onChange={(range) => setTimeRange(range)}
            defaultRange="30d"
          />
          <AnalyticsExport 
            data={[]}  // Replace with actual data
            title="Production Analytics"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <AnalyticCard 
          title="Total Pitches"
          value={productionPerformance.totalPitches}
          icon={<Layers className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Revenue"
          value={productionPerformance.totalRevenue}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Active Projects"
          value={productionPerformance.activeProjects}
          icon={<Building2 className="w-5 h-5 text-purple-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="NDA Signed"
          value={productionPerformance.ndaSignedCount}
          icon={<Shield className="w-5 h-5 text-yellow-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Avg Project Budget"
          value={productionPerformance.averageProjectBudget}
          icon={<PieChart className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
          format="currency"
        />
        <AnalyticCard 
          title="Creator Interactions"
          value={productionPerformance.creatorInteractions}
          icon={<Users className="w-5 h-5 text-red-500" />}
          variant="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Pitch Performance</h3>
          <PerformanceChart 
            title="Pitches Over Time"
            datasets={[{
              label: 'Pitch Count',
              data: performanceData.pitches,
              color: '#3B82F6'
            }]}
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Performance</h3>
          <PerformanceChart 
            title="Revenue Trends"
            datasets={[{
              label: 'Revenue',
              data: performanceData.revenue,
              color: '#10B981'
            }]}
            currency={true}
          />
        </div>
      </div>
    </div>
  );
};