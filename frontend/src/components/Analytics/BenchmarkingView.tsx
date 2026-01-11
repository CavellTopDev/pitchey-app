import React from 'react';
import { BarChart3 } from 'lucide-react';

interface BenchmarkingViewProps {
  data: any;
  role: string;
  onClose: () => void;
}

export default function BenchmarkingView({ data, role, onClose }: BenchmarkingViewProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full">
          <div className="p-6 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Industry Benchmarking</h2>
            <p className="text-gray-600 mb-6">Industry benchmarking and competitive analysis coming soon</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}