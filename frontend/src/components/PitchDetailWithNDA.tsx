import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/api-client';
import NDAStatus from './NDAStatus';
import ProtectedContent, { 
  ProtectedBudget, 
  ProtectedScript, 
  ProtectedFinancials 
} from './ProtectedContent';
import NDAModal from './NDAModal';
import { Lock, Shield, Play, DollarSign, FileText, Users, Calendar } from 'lucide-react';

interface Pitch {
  id: number;
  title: string;
  logline: string;
  synopsis: string;
  genre: string;
  format: string;
  budget: number;
  userId: number;
  creator: {
    id: number;
    username: string;
    companyName?: string;
  };
  // Protected fields
  detailedSynopsis?: string;
  script?: string;
  financialProjections?: {
    expectedRevenue: number;
    productionCost: number;
    marketingBudget: number;
    distributionCost: number;
  };
  attachedTalent?: string[];
  distributionStrategy?: string;
  targetAudience?: string;
  marketingPlan?: string;
  contactInfo?: {
    email: string;
    phone: string;
    website: string;
  };
}

export default function PitchDetailWithNDA() {
  const { pitchId } = useParams<{ pitchId: string }>();
  const { user } = useAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaStatus, setNDAStatus] = useState<any>(null);

  useEffect(() => {
    if (pitchId) {
      fetchPitch();
      fetchNDAStatus();
    }
  }, [pitchId, user]);

  const fetchPitch = async () => {
    try {
      const response = await apiClient.get(`/api/pitches/${pitchId}`);
      if (response.success) {
        setPitch(response.pitch);
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNDAStatus = async () => {
    if (!user || !pitchId) return;
    
    try {
      const response = await apiClient.get(`/api/pitches/${pitchId}/nda-status`);
      if (response.success) {
        setNDAStatus(response);
      }
    } catch (error) {
      console.error('Failed to fetch NDA status:', error);
    }
  };

  const handleNDARequest = () => {
    setShowNDAModal(true);
  };

  const handleNDASigned = () => {
    fetchNDAStatus(); // Refresh NDA status
    fetchPitch(); // Refresh pitch data with potentially new access
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pitch Not Found</h2>
          <p className="text-gray-600">The pitch you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === pitch.creator.id;
  const hasNDAAccess = ndaStatus?.hasAccess || isOwner;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{pitch.title}</h1>
              <p className="text-gray-600 mb-4">{pitch.logline}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">{pitch.genre}</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{pitch.format}</span>
                <span>By {pitch.creator.companyName || pitch.creator.username}</span>
              </div>
            </div>
            
            {/* NDA Status */}
            {!isOwner && (
              <div className="ml-4">
                <NDAStatus 
                  pitchId={pitch.id} 
                  creatorId={pitch.creator.id}
                  onNDARequest={handleNDARequest}
                />
              </div>
            )}
          </div>
        </div>

        {/* Basic Information (Always Visible) */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Synopsis</h2>
          <p className="text-gray-700 leading-relaxed">{pitch.synopsis}</p>
        </div>

        {/* Budget - Protected Content */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Budget Information
          </h2>
          <ProtectedBudget
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            budget={pitch.budget}
            className="text-2xl font-bold text-green-600"
          />
        </div>

        {/* Detailed Synopsis - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Synopsis</h2>
          <ProtectedContent
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            field="detailedSynopsis"
            fallback={
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Detailed synopsis requires NDA access</p>
              </div>
            }
          >
            <div className="prose max-w-none text-gray-700">
              {pitch.detailedSynopsis || "Detailed synopsis would be displayed here with full plot details, character arcs, and story structure."}
            </div>
          </ProtectedContent>
        </div>

        {/* Financial Projections - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Projections
          </h2>
          <ProtectedFinancials
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            financials={pitch.financialProjections || {
              expectedRevenue: 15000000,
              productionCost: 8000000,
              marketingBudget: 3000000,
              distributionCost: 2000000
            }}
          />
        </div>

        {/* Script Access - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Script & Treatment
          </h2>
          <ProtectedScript
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            scriptUrl={pitch.script}
          />
        </div>

        {/* Attached Talent - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Attached Talent
          </h2>
          <ProtectedContent
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            field="attachedTalent"
            fallback={
              <div className="text-gray-500 italic">
                Talent information available with NDA access
              </div>
            }
          >
            <div className="space-y-2">
              {(pitch.attachedTalent || [
                "Academy Award winner for Best Director",
                "Emmy-nominated lead actor",
                "Acclaimed cinematographer with 15+ feature credits"
              ]).map((talent, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  <span className="text-gray-700">{talent}</span>
                </div>
              ))}
            </div>
          </ProtectedContent>
        </div>

        {/* Distribution Strategy - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Distribution Strategy</h2>
          <ProtectedContent
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            field="distributionStrategy"
          >
            <div className="text-gray-700">
              {pitch.distributionStrategy || "Theatrical release in Q2 2025, followed by premium VOD and streaming partnerships. International sales through established distribution network with focus on European and Asian markets."}
            </div>
          </ProtectedContent>
        </div>

        {/* Contact Information - Protected */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
          <ProtectedContent
            pitchId={pitch.id}
            creatorId={pitch.creator.id}
            field="contactInfo"
            fallback={
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <Shield className="w-4 h-4" />
                  <span className="font-medium">Contact details protected</span>
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  Sign an NDA to access direct contact information
                </p>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Email:</span>
                <span className="text-gray-900">{pitch.contactInfo?.email || "contact@example.com"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Phone:</span>
                <span className="text-gray-900">{pitch.contactInfo?.phone || "+1 (555) 123-4567"}</span>
              </div>
              {pitch.contactInfo?.website && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Website:</span>
                  <a 
                    href={pitch.contactInfo.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-700"
                  >
                    {pitch.contactInfo.website}
                  </a>
                </div>
              )}
            </div>
          </ProtectedContent>
        </div>

        {/* NDA Request Modal */}
        {showNDAModal && (
          <NDAModal
            isOpen={showNDAModal}
            onClose={() => setShowNDAModal(false)}
            pitchId={pitch.id}
            pitchTitle={pitch.title}
            creatorType="creator"
            onNDASigned={handleNDASigned}
          />
        )}
      </div>
    </div>
  );
}