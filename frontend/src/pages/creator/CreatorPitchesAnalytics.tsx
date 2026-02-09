import { BarChart3, Clock } from 'lucide-react';

export default function CreatorPitchesAnalytics() {
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pitch Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track performance and engagement metrics for your pitches
          </p>
        </div>

        {/* Coming Soon */}
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Coming Soon</h2>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Analytics dashboards are currently being built. Soon you'll be able to track views, engagement, audience demographics, and performance trends for all your pitches.
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-purple-600">
            <Clock className="w-4 h-4" />
            <span>Under development</span>
          </div>
        </div>
      </div>
    </div>
  );
}
