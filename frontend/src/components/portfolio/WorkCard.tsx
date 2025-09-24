import React from 'react';
import { Link } from 'react-router-dom';

interface Work {
  id: string;
  title: string;
  tagline: string;
  category: string;
  thumbnail: string;
  views: number;
  rating?: number;
  status: string;
  budget: string;
  createdAt: string;
  description?: string;
  releaseDate?: string;
  boxOffice?: string;
  productionStage?: string;
}

interface WorkCardProps {
  work: Work;
  userType: 'creator' | 'production' | 'investor';
}

const WorkCard: React.FC<WorkCardProps> = ({ work, userType }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Get appropriate link based on user type
  const getDetailLink = () => {
    switch (userType) {
      case 'production':
        return `/project/${work.id}`;
      case 'investor':
        return `/investment/${work.id}`;
      default:
        return `/pitch/${work.id}`;
    }
  };

  // Get appropriate status color
  const getStatusColor = () => {
    const status = work.status.toLowerCase();
    if (status.includes('production') || status.includes('filming')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    if (status.includes('released') || status.includes('completed')) {
      return 'bg-green-100 text-green-700';
    }
    if (status.includes('development') || status.includes('pre-production')) {
      return 'bg-blue-100 text-blue-700';
    }
    if (status.includes('seeking') || status.includes('funding')) {
      return 'bg-purple-100 text-purple-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  // Format budget or box office
  const formatMoney = (amount: string) => {
    // Handle both budget and box office formats
    if (amount.includes('-')) {
      // Range format (e.g., "$1M-5M")
      return amount;
    }
    // Single value format
    return amount;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all group">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={work.thumbnail} 
          alt={work.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
          {work.category}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center justify-between text-white text-sm">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              {formatNumber(work.views)}
            </span>
            {work.rating && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                {work.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {work.title}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-2">
          {work.tagline}
        </p>
        {work.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-3">
            {work.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-sm mb-4">
          <span className={`px-3 py-1 rounded-full ${getStatusColor()}`}>
            {work.productionStage || work.status}
          </span>
          <span className="text-gray-500 font-semibold">
            {work.boxOffice ? `Box Office: ${formatMoney(work.boxOffice)}` : formatMoney(work.budget)}
          </span>
        </div>
        
        {work.releaseDate && (
          <div className="text-sm text-gray-500 mb-4">
            Released: {new Date(work.releaseDate).toLocaleDateString()}
          </div>
        )}
        
        <div className="pt-4 border-t">
          <Link 
            to={getDetailLink()}
            className="block w-full text-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkCard;