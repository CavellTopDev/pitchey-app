import { useState, useEffect, ReactNode } from 'react';
import { Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { apiClient } from '../lib/api-client';
import NDAModal from './NDAModal';

interface ProtectedContentProps {
  pitchId: number;
  creatorId: number;
  field: string; // budget, financialProjections, script, etc.
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

interface AccessData {
  hasAccess: boolean;
  accessLevel?: string;
  protectedFields: string[];
}

export default function ProtectedContent({
  pitchId,
  creatorId,
  field,
  children,
  fallback,
  className = ''
}: ProtectedContentProps) {
  const { user } = useBetterAuthStore();
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);

  useEffect(() => {
    if (user && user.id !== creatorId) {
      fetchAccessData();
    } else if (user?.id === creatorId) {
      // Pitch owner has full access
      setAccessData({ hasAccess: true, protectedFields: [] });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [pitchId, user, creatorId]);

  const fetchAccessData = async () => {
    try {
      const response = await apiClient.get(`/api/pitches/${pitchId}/nda-status`);
      if (response.success && (response.data as any)?.protectedContent) {
        const protectedContent = (response.data as any).protectedContent;
        setAccessData({
          hasAccess: protectedContent.hasAccess,
          accessLevel: protectedContent.accessLevel,
          protectedFields: protectedContent.protectedFields || []
        });
      }
    } catch (error) {
      console.error('Failed to fetch access data:', error);
      setAccessData({ hasAccess: false, protectedFields: [field] });
    } finally {
      setLoading(false);
    }
  };

  const handleNDARequest = () => {
    setShowNDAModal(true);
  };

  const handleNDASigned = () => {
    fetchAccessData(); // Refresh access data
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`}>
        <div className="h-20 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Show content if user has access or field is not protected
  if (accessData?.hasAccess || !accessData?.protectedFields.includes(field)) {
    return <div className={className}>{children}</div>;
  }

  // Show fallback if provided
  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  // Default protected content UI
  return (
    <>
      <div className={`relative ${className}`}>
        {/* Blurred content */}
        <div className="filter blur-sm pointer-events-none opacity-50">
          {children}
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-6">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-purple-100 rounded-full">
                <Lock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Protected Content
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This information requires an NDA to view. 
              {getFieldDescription(field)}
            </p>
            <button
              onClick={handleNDARequest}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Shield className="w-4 h-4 mr-2" />
              Request Access
            </button>
          </div>
        </div>
      </div>

      {showNDAModal && (
        <NDAModal
          isOpen={showNDAModal}
          onClose={() => setShowNDAModal(false)}
          pitchId={pitchId}
          pitchTitle={`Protected content access`}
          creatorType="creator"
          onNDASigned={handleNDASigned}
        />
      )}
    </>
  );
}

// Specialized components for different content types
export function ProtectedBudget({ pitchId, creatorId, budget, className = '' }: {
  pitchId: number;
  creatorId: number;
  budget: string | number;
  className?: string;
}) {
  return (
    <ProtectedContent
      pitchId={pitchId}
      creatorId={creatorId}
      field="budget"
      className={className}
      fallback={
        <div className="flex items-center space-x-2 text-gray-500">
          <Lock className="w-4 h-4" />
          <span>Budget information requires NDA</span>
        </div>
      }
    >
      <div className="font-semibold text-lg text-green-600">
        ${typeof budget === 'number' ? budget.toLocaleString() : budget}
      </div>
    </ProtectedContent>
  );
}

export function ProtectedScript({ pitchId, creatorId, scriptUrl, className = '' }: {
  pitchId: number;
  creatorId: number;
  scriptUrl?: string;
  className?: string;
}) {
  return (
    <ProtectedContent
      pitchId={pitchId}
      creatorId={creatorId}
      field="script"
      className={className}
      fallback={
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Lock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">Script access requires NDA</p>
        </div>
      }
    >
      {scriptUrl ? (
        <a
          href={scriptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Script
        </a>
      ) : (
        <div className="text-gray-500">No script available</div>
      )}
    </ProtectedContent>
  );
}

export function ProtectedFinancials({ pitchId, creatorId, financials, className = '' }: {
  pitchId: number;
  creatorId: number;
  financials: any;
  className?: string;
}) {
  return (
    <ProtectedContent
      pitchId={pitchId}
      creatorId={creatorId}
      field="financialProjections"
      className={className}
      fallback={
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Lock className="w-4 h-4" />
            <span className="font-medium">Financial Projections</span>
          </div>
          <p className="text-sm text-gray-400">
            Detailed financial information requires NDA access
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        {financials && Object.entries(financials).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
            <span className="font-semibold">${(value as number).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </ProtectedContent>
  );
}

function getFieldDescription(field: string): string {
  const descriptions: Record<string, string> = {
    budget: 'View detailed budget breakdown and financing structure.',
    financialProjections: 'Access revenue projections and ROI analysis.',
    script: 'Read the full screenplay or treatment.',
    contactInfo: 'Get direct contact information for the creator.',
    distributionStrategy: 'See distribution plans and target markets.',
    attachedTalent: 'View confirmed cast and crew attachments.',
    marketingPlan: 'Access marketing strategy and promotional materials.'
  };
  
  return descriptions[field] || 'Access additional project details.';
}