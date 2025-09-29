import { useState } from 'react';
import { X, Upload, FileText, Shield, AlertCircle } from 'lucide-react';
import { ndaService } from '../services/nda.service';
import { useAuthStore } from '../store/authStore';

interface NDAModalProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: number;
  pitchTitle: string;
  creatorType: 'creator' | 'production' | 'investor';
  onNDASigned: () => void;
}

export default function NDAModal({ 
  isOpen, 
  onClose, 
  pitchId, 
  pitchTitle,
  creatorType,
  onNDASigned 
}: NDAModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [ndaType, setNdaType] = useState<'standard' | 'upload'>('standard');
  const [customTerms, setCustomTerms] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!user) {
      setError('Please sign in to request access to enhanced information');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if we can request NDA first
      const canRequestResult = await ndaService.canRequestNDA(pitchId);
      
      if (!canRequestResult.canRequest) {
        if (canRequestResult.existingNDA) {
          alert('You have already requested NDA access for this pitch. The creator will review your request soon.');
        } else {
          alert(canRequestResult.reason || 'Cannot request NDA at this time.');
        }
        onClose();
        return;
      }

      // Submit NDA request
      const nda = await ndaService.requestNDA({
        pitchId,
        message: customTerms || `Requesting access to enhanced information for ${pitchTitle}`,
        templateId: ndaType === 'standard' ? undefined : 1, // Use custom template if not standard
        expiryDays: 90 // Default to 90 days expiry
      });
      
      // Show success message
      alert('NDA request submitted successfully! The creator will review your request and respond shortly.');
      onClose();
      // Don't call onNDASigned here since the NDA isn't signed yet
    } catch (err) {
      console.error('NDA request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit NDA request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Request Access to Enhanced Information
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              For: {pitchTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                Why is an NDA required?
              </h3>
              <p className="text-sm text-blue-800">
                {creatorType === 'production' ? 
                  "Production companies require NDAs to protect confidential information about their slate, financing details, and distribution strategies." :
                  creatorType === 'investor' ?
                  "Investors require NDAs to protect sensitive financial information and investment terms." :
                  "Creators use NDAs to protect their creative concepts, scripts, and detailed project information."
                }
              </p>
              <div className="mt-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">After signing, you'll get access to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Full synopsis and treatment</li>
                  <li>Budget breakdown and financing details</li>
                  <li>Target audience and marketing strategy</li>
                  <li>Attached talent and crew</li>
                  <li>Production timeline and milestones</li>
                  <li>Distribution plans and comparable titles</li>
                </ul>
              </div>
            </div>
          </div>

          {/* NDA Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              NDA Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setNdaType('standard')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  ndaType === 'standard'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6 mb-2 mx-auto text-purple-600" />
                <div className="font-medium">Standard NDA</div>
                <p className="text-xs text-gray-600 mt-1">
                  Use our standard confidentiality agreement
                </p>
              </button>
              
              <button
                onClick={() => setNdaType('upload')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  ndaType === 'upload'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Upload className="w-6 h-6 mb-2 mx-auto text-purple-600" />
                <div className="font-medium">Upload Your NDA</div>
                <p className="text-xs text-gray-600 mt-1">
                  Use your company's NDA template
                </p>
              </button>
            </div>
          </div>

          {/* Standard NDA Terms */}
          {ndaType === 'standard' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Additional Terms (Optional)
              </label>
              <textarea
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value)}
                placeholder="Add any specific terms or conditions..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={4}
              />
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                  Standard NDA Terms Include:
                </h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Confidentiality period: 2 years</li>
                  <li>• Non-disclosure of project details, financials, and strategies</li>
                  <li>• No unauthorized sharing or reproduction of materials</li>
                  <li>• Mutual protection of both parties' information</li>
                  <li>• Governed by applicable state/country laws</li>
                </ul>
              </div>
            </div>
          )}

          {/* Upload NDA */}
          {ndaType === 'upload' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Upload NDA Document
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="nda-upload"
                />
                <label
                  htmlFor="nda-upload"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <span className="text-sm font-medium text-purple-600 hover:text-purple-700">
                    Click to upload NDA
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    PDF, DOC, or DOCX (max 10MB)
                  </span>
                </label>
                {uploadedFile && (
                  <div className="mt-4 flex items-center justify-center space-x-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">{uploadedFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* User Type Warning for Creators */}
          {user?.userType === 'creator' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Note for Creators:</p>
                  <p>As a creator, you can request NDAs but enhanced information access is primarily for production companies and investors. Consider upgrading your account type if you're representing a production company.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (ndaType === 'upload' && !uploadedFile)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              loading || (ndaType === 'upload' && !uploadedFile)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {loading ? 'Submitting...' : 'Submit NDA Request'}
          </button>
        </div>
      </div>
    </div>
  );
}