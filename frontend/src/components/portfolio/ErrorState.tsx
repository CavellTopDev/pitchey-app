import React from 'react';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, onGoBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto px-4 py-24">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-6">😞</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Oops! Something went wrong
          </h2>
          <p className="text-gray-600 mb-8">
            {error}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {onRetry && (
              <button 
                onClick={onRetry}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Try Again
              </button>
            )}
            {onGoBack && (
              <button 
                onClick={onGoBack}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;