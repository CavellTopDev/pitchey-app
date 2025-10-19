import { useState } from 'react';
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Info,
  X,
  FileText,
  Eye,
  Users
} from 'lucide-react';
import NDAWizard from './NDAWizard';

interface PitchNDAHeaderProps {
  pitchId: number;
  pitchTitle: string;
  creatorName: string;
  creatorId: number;
  ndaStatus?: {
    hasAccess: boolean;
    status?: string;
    nda?: any;
  };
  isOwner: boolean;
  onStatusChange?: () => void;
}

export default function PitchNDAHeader({
  pitchId,
  pitchTitle,
  creatorName,
  creatorId,
  ndaStatus,
  isOwner,
  onStatusChange
}: PitchNDAHeaderProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  if (isOwner) {
    return null; // Don't show NDA header for pitch owner
  }

  const getStatusConfig = () => {
    if (ndaStatus?.hasAccess) {
      return {
        color: 'green',
        icon: CheckCircle,
        title: 'Full Access Granted',
        description: 'You have signed the NDA and can view all protected content',
        action: null,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800'
      };
    }

    switch (ndaStatus?.status) {
      case 'pending':
        return {
          color: 'amber',
          icon: Clock,
          title: 'NDA Request Pending',
          description: `Your NDA request is awaiting approval from ${creatorName}`,
          action: null,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-800'
        };
      
      case 'approved':
        return {
          color: 'blue',
          icon: FileText,
          title: 'NDA Ready to Sign',
          description: `${creatorName} has approved your request. Sign the NDA to access protected content`,
          action: {
            text: 'Sign NDA',
            onClick: () => setShowWizard(true)
          },
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800'
        };
      
      case 'rejected':
        return {
          color: 'red',
          icon: AlertTriangle,
          title: 'NDA Request Declined',
          description: `${creatorName} has declined your NDA request`,
          action: {
            text: 'Request Again',
            onClick: () => setShowWizard(true)
          },
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        };
      
      default:
        return {
          color: 'purple',
          icon: Lock,
          title: 'Protected Content Available',
          description: 'This pitch contains enhanced information that requires an NDA to access',
          action: {
            text: 'Request Access',
            onClick: () => setShowWizard(true)
          },
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-800'
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <>
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
        <div className="flex items-start space-x-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center`}>
            <StatusIcon className={`w-5 h-5 text-${config.color}-600`} />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className={`font-semibold ${config.textColor} mb-1`}>
                  {config.title}
                </h3>
                <p className={`text-sm ${config.textColor} opacity-90`}>
                  {config.description}
                </p>

                {/* Additional Info */}
                {!ndaStatus?.hasAccess && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className={`text-xs ${config.textColor} opacity-75 hover:opacity-100 flex items-center gap-1`}
                    >
                      <Info className="w-3 h-3" />
                      What will I get access to?
                    </button>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {config.action && (
                <button
                  onClick={config.action.onClick}
                  className={`ml-4 px-4 py-2 bg-${config.color}-600 text-white text-sm font-medium rounded-lg hover:bg-${config.color}-700 transition-colors`}
                >
                  {config.action.text}
                </button>
              )}
            </div>

            {/* Expanded Info */}
            {showInfo && !ndaStatus?.hasAccess && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900 text-sm">
                    Enhanced Content Includes:
                  </h4>
                  <button
                    onClick={() => setShowInfo(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span>Complete detailed synopsis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-3 h-3 text-gray-400" />
                    <span>Full budget breakdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span>Attached talent information</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-gray-400" />
                    <span>Financial projections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span>Distribution strategy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span>Direct contact information</span>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Request NDA access</li>
                    <li>Creator reviews your request</li>
                    <li>Sign the digital NDA agreement</li>
                    <li>Get immediate access to protected content</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NDA Wizard */}
      {showWizard && (
        <NDAWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          pitchId={pitchId}
          pitchTitle={pitchTitle}
          creatorName={creatorName}
          onStatusChange={() => {
            onStatusChange?.();
            setShowWizard(false);
          }}
        />
      )}
    </>
  );
}

// Compact version for cards/lists
export function PitchNDABadge({
  ndaStatus,
  isOwner
}: {
  ndaStatus?: { hasAccess: boolean; status?: string };
  isOwner: boolean;
}) {
  if (isOwner) return null;

  if (ndaStatus?.hasAccess) {
    return (
      <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Access Granted
      </div>
    );
  }

  switch (ndaStatus?.status) {
    case 'pending':
      return (
        <div className="absolute top-2 right-2 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </div>
      );
    
    case 'approved':
      return (
        <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <FileText className="w-3 h-3" />
          Ready to Sign
        </div>
      );
    
    case 'rejected':
      return (
        <div className="absolute top-2 right-2 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Declined
        </div>
      );
    
    default:
      return (
        <div className="absolute top-2 right-2 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <Lock className="w-3 h-3" />
          NDA Required
        </div>
      );
  }
}