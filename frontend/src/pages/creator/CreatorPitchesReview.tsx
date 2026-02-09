import { MessageSquare, Clock } from 'lucide-react';

export default function CreatorPitchesReview() {
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pitch Reviews</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track feedback and reviews from industry professionals
          </p>
        </div>

        {/* Coming Soon */}
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
            <MessageSquare className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Coming Soon</h2>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            The pitch review system is currently being built. Soon you'll be able to receive and track feedback from investors, production companies, and industry experts.
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
