import { useState, useEffect } from 'react';
import { Shield, Lock, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/api-client';

interface NDAStatusProps {
  pitchId: number;
  creatorId: number;
  onNDARequest?: () => void;
  compact?: boolean;
}

interface NDAStatusData {
  hasAccess: boolean;
  reason: string;
  protectedContent: {
    hasAccess: boolean;
    accessLevel?: string;
    protectedFields: string[];
    nda?: any;
  };
}

export default function NDAStatus({ 
  pitchId, 
  creatorId, 
  onNDARequest, 
  compact = false 
}: NDAStatusProps) {
  const { user } = useAuthStore();
  const [ndaStatus, setNDAStatus] = useState<NDAStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    if (user && user.id !== creatorId) {
      fetchNDAStatus();
    } else {
      setLoading(false);
    }
  }, [pitchId, user]);

  const fetchNDAStatus = async () => {
    try {
      const response = await apiClient.get(`/api/pitches/${pitchId}/nda-status`);
      if (response.success) {
        setNDAStatus({
          hasAccess: response.hasAccess,
          reason: response.reason,
          protectedContent: response.protectedContent
        });
      }
    } catch (error) {
      console.error('Failed to fetch NDA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNDA = async () => {
    if (onNDARequest) {
      onNDARequest();
      return;
    }

    setRequestLoading(true);
    try {
      const response = await apiClient.post(`/api/pitches/${pitchId}/request-nda`, {
        ndaType: 'basic',
        requestMessage: 'Requesting access to view enhanced pitch information.'
      });
      
      if (response.success) {
        await fetchNDAStatus(); // Refresh status
      }
    } catch (error) {
      console.error('Failed to request NDA:', error);
    } finally {
      setRequestLoading(false);
    }
  };

  const downloadNDA = async () => {
    if (!ndaStatus?.protectedContent.nda) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://pitchey-backend.deno.dev';
      const response = await fetch(`${apiUrl}/api/nda/${ndaStatus.protectedContent.nda.id}/document`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NDA-${ndaStatus.protectedContent.nda.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download NDA:', error);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
        {!compact && <span className="text-xs text-gray-500">Checking access...</span>}
      </div>
    );
  }

  // Don't show for the pitch owner
  if (!user || user.id === creatorId) {
    return null;
  }

  // User has access
  if (ndaStatus?.hasAccess) {
    const accessLevel = ndaStatus.protectedContent.accessLevel || 'basic';
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <CheckCircle className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-green-600`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-green-600">
              {accessLevel === 'enhanced' ? 'Full Access' : 'Basic Access'}
            </span>
            {ndaStatus.protectedContent.nda && (
              <button
                onClick={downloadNDA}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                title="Download NDA Document"
              >
                <Download className="w-3 h-3" />
                <span>NDA</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // NDA required
  return (
    <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
      <Lock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-amber-600`} />
      {!compact && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-amber-600">NDA Required</span>
          <button
            onClick={handleRequestNDA}
            disabled={requestLoading}
            className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requestLoading ? 'Requesting...' : 'Request Access'}
          </button>
        </div>
      )}
    </div>
  );
}

// NDA Status Badge for compact display
export function NDAStatusBadge({ 
  pitchId, 
  creatorId 
}: { 
  pitchId: number; 
  creatorId: number; 
}) {
  return (
    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1">
      <NDAStatus pitchId={pitchId} creatorId={creatorId} compact={true} />
    </div>
  );
}

// Protected content indicator
export function ProtectedContentIndicator({ 
  fields, 
  hasAccess 
}: { 
  fields: string[]; 
  hasAccess: boolean; 
}) {
  if (fields.length === 0 || hasAccess) return null;

  return (
    <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs">
      <Shield className="w-3 h-3" />
      <span>Protected Content - NDA Required</span>
    </div>
  );
}