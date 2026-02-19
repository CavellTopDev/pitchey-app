import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CreatorHeader from '../components/portfolio/CreatorHeader';
import AchievementsSection from '../components/portfolio/AchievementsSection';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import LoadingState from '../components/portfolio/LoadingState';
import ErrorState from '../components/portfolio/ErrorState';
import { apiClient } from '../lib/api-client';
import { useBetterAuthStore } from '../store/betterAuthStore';
import '../utils/debug-auth.js';

interface Creator {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  joinedDate: string;
  verified?: boolean;
  stats: {
    totalPitches: number;
    totalViews: number;
    totalFollowers: number;
    avgRating: number;
  };
}

interface Pitch {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  thumbnail: string;
  views: number;
  rating: number;
  status: string;
  budget: string;
  createdAt: string;
  description?: string;
}

interface Achievement {
  icon: string;
  title: string;
  event: string;
  year: string;
}

interface PortfolioData {
  success: boolean;
  creator: Creator;
  pitches: Pitch[];
  achievements: Achievement[];
}

const CreatorPortfolio: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const { user } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const navigate = useNavigate();


  // Get effective creator ID
  const getCreatorId = () => {
    if (creatorId) return creatorId;
    
    // Try to get user ID from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.id || '1001';
      } catch (e) {
      }
    }
    return '1001'; // Default fallback
  };

  const effectiveCreatorId = getCreatorId();

  // Check if this is the user's own profile
  const isOwnProfile = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id?.toString() === effectiveCreatorId?.toString();
      }
    } catch (e) {
    }
    return false;
  };

  useEffect(() => {
    fetchPortfolio();
  }, [effectiveCreatorId]);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);

    try {
      // If viewing own portfolio (no creatorId param), use session-based endpoint
      const url = creatorId ? `/api/creator/portfolio/${creatorId}` : '/api/creator/portfolio';
      const response = await apiClient.get(url);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch portfolio');
      }

      const data = response.data as any;

      if (!data) {
        throw new Error('No portfolio data received');
      }

      // Transform backend response { pitches, totalInvestment } into PortfolioData shape
      const rawPitches = Array.isArray(data.pitches) ? data.pitches : [];
      const totalViews = rawPitches.reduce((sum: number, p: any) => sum + (p.view_count ?? p.views ?? 0), 0);

      const portfolio: PortfolioData = {
        success: true,
        creator: data.creator ?? {
          id: user?.id?.toString() ?? '',
          name: user?.name ?? user?.username ?? 'Creator',
          username: user?.username ?? '',
          avatar: user?.profileImageUrl ?? '',
          bio: (user as any)?.bio ?? '',
          location: '',
          joinedDate: user?.createdAt ?? '',
          stats: {
            totalPitches: rawPitches.length,
            totalViews,
            totalFollowers: 0,
            avgRating: 0
          }
        },
        pitches: rawPitches.map((p: any) => ({
          id: p.id?.toString() ?? '',
          title: p.title ?? 'Untitled',
          tagline: p.logline ?? '',
          genre: p.genre ?? '',
          thumbnail: p.cover_image ?? '',
          views: p.view_count ?? 0,
          rating: 0,
          status: p.status ?? 'draft',
          budget: p.investment_total ? `$${Number(p.investment_total).toLocaleString()}` : '$0',
          createdAt: p.created_at ?? '',
          description: p.logline ?? ''
        })),
        achievements: data.achievements ?? []
      };

      setPortfolio(portfolio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchPortfolio();
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleBackToDashboard = () => {
    navigate('/creator/dashboard');
  };


  if (loading) {
    return <LoadingState />;
  }

  if (error || !portfolio) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f3e7ff, #ffffff, #ffe0f7)', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={handleBackToDashboard}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
          
          <ErrorState 
            error={error || 'Portfolio not found'} 
            onRetry={handleRetry}
            onGoBack={handleGoBack}
          />
        </div>
      </div>
    );
  }

  const { creator, pitches, achievements } = portfolio;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f3e7ff, #ffffff, #ffe0f7)', padding: '20px' }}>
      {/* Fixed Position Back Button */}
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        left: '20px', 
        zIndex: 50 
      }}>
        <button
          onClick={handleBackToDashboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7c3aed';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8b5cf6';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }}
        >
          <ArrowLeft style={{ width: '20px', height: '20px', marginRight: '8px' }} />
          Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '60px' }}>
        <CreatorHeader 
          creator={creator} 
          isOwnProfile={isOwnProfile()} 
        />
        
        <AchievementsSection achievements={achievements} />
        
        <PortfolioGrid 
          pitches={pitches} 
          isOwnProfile={isOwnProfile()} 
        />
      </div>
    </div>
  );
};

export default CreatorPortfolio;