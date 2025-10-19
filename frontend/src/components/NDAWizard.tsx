import { useState, useEffect } from 'react';
import { 
  X, 
  Shield, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  PenTool,
  Mail,
  Users
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ndaService, type NDA } from '../services/nda.service';

interface NDAWizardProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: number;
  pitchTitle: string;
  creatorName: string;
  onStatusChange?: () => void;
}

type WizardStep = 'info' | 'request' | 'status' | 'review' | 'sign' | 'complete';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

const steps: StepConfig[] = [
  {
    id: 'info',
    title: 'Understanding NDAs',
    description: 'Learn about the NDA process',
    icon: Shield
  },
  {
    id: 'request',
    title: 'Request Access',
    description: 'Submit your NDA request',
    icon: Mail
  },
  {
    id: 'status',
    title: 'Awaiting Review',
    description: 'Creator reviews your request',
    icon: Clock
  },
  {
    id: 'review',
    title: 'Review Agreement',
    description: 'Read the NDA terms',
    icon: FileText
  },
  {
    id: 'sign',
    title: 'Digital Signature',
    description: 'Sign the agreement',
    icon: PenTool
  },
  {
    id: 'complete',
    title: 'Access Granted',
    description: 'View protected content',
    icon: CheckCircle
  }
];

export default function NDAWizard({ 
  isOpen, 
  onClose, 
  pitchId, 
  pitchTitle, 
  creatorName,
  onStatusChange
}: NDAWizardProps) {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<WizardStep>('info');
  const [ndaData, setNDAData] = useState<NDA | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [signature, setSignature] = useState({
    fullName: '',
    title: '',
    company: '',
    acceptTerms: false
  });

  // Check existing NDA status when wizard opens
  useEffect(() => {
    if (isOpen && pitchId) {
      checkNDAStatus();
    }
  }, [isOpen, pitchId]);

  const checkNDAStatus = async () => {
    try {
      setLoading(true);
      const status = await ndaService.getNDAStatus(pitchId);
      
      if (status.hasNDA && status.nda) {
        setNDAData(status.nda);
        
        // Determine step based on NDA status
        switch (status.nda.status) {
          case 'pending':
            setCurrentStep('status');
            break;
          case 'approved':
            setCurrentStep('review');
            break;
          case 'signed':
            setCurrentStep('complete');
            break;
          case 'rejected':
            setCurrentStep('request');
            setError('Your previous NDA request was rejected. You can submit a new request.');
            break;
          default:
            setCurrentStep('info');
        }
      } else {
        // Check if user can request NDA
        const canRequest = await ndaService.canRequestNDA(pitchId);
        if (!canRequest.canRequest) {
          setError(canRequest.reason || 'Cannot request NDA at this time');
          setCurrentStep('info');
        } else {
          setCurrentStep('info');
        }
      }
    } catch (err) {
      console.error('Failed to check NDA status:', err);
      setCurrentStep('info');
    } finally {
      setLoading(false);
    }
  };

  const submitNDARequest = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const nda = await ndaService.requestNDA({
        pitchId,
        message: requestMessage || `I would like to request access to enhanced information for "${pitchTitle}". I understand this requires signing an NDA and I'm prepared to do so.`,
        expiryDays: 90
      });
      
      setNDAData(nda);
      setCurrentStep('status');
      onStatusChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to submit NDA request');
    } finally {
      setLoading(false);
    }
  };

  const signNDA = async () => {
    if (!ndaData || !signature.fullName || !signature.acceptTerms) {
      setError('Please fill in all required fields and accept the terms');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      await ndaService.signNDA({
        ndaId: ndaData.id,
        signature: `${signature.fullName} - ${new Date().toISOString()}`,
        fullName: signature.fullName,
        title: signature.title,
        company: signature.company,
        acceptTerms: signature.acceptTerms
      });
      
      setCurrentStep('complete');
      onStatusChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to sign NDA');
    } finally {
      setLoading(false);
    }
  };

  const downloadNDA = async () => {
    if (!ndaData) return;
    
    try {
      const blob = await ndaService.downloadNDA(ndaData.id, false);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA-${pitchTitle.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download NDA:', err);
    }
  };

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  const canGoNext = () => {
    const stepIndex = getCurrentStepIndex();
    return stepIndex < steps.length - 1;
  };
  const canGoPrev = () => getCurrentStepIndex() > 0;

  const nextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  if (!isOpen) return null;

  const currentStepConfig = steps.find(step => step.id === currentStep);
  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">NDA Access Wizard</h2>
            <p className="text-sm text-gray-600 mt-1">For: {pitchTitle} by {creatorName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = index < currentStepIndex;
              const isAccessible = index <= currentStepIndex;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div 
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                      isActive 
                        ? 'bg-purple-600 text-white' 
                        : isCompleted 
                        ? 'bg-green-600 text-white'
                        : isAccessible
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="ml-3 hidden md:block">
                    <div className={`text-sm font-medium ${isActive ? 'text-purple-600' : isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-400 mx-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {/* Step: Understanding NDAs */}
              {currentStep === 'info' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Understanding Non-Disclosure Agreements
                    </h3>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                      This pitch contains protected information that requires a signed NDA to access. 
                      Here's what you need to know about the process.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 rounded-lg p-6">
                      <h4 className="font-semibold text-blue-900 mb-3">What You'll Get Access To:</h4>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Detailed synopsis and treatment
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Complete budget breakdown
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Financial projections
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Attached talent information
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Distribution strategy
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Direct contact information
                        </li>
                      </ul>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-6">
                      <h4 className="font-semibold text-purple-900 mb-3">The Process:</h4>
                      <ol className="space-y-2 text-sm text-purple-800">
                        <li className="flex items-start gap-2">
                          <span className="bg-purple-200 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">1</span>
                          <span>Submit your NDA request</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-purple-200 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">2</span>
                          <span>Creator reviews and approves request</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-purple-200 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">3</span>
                          <span>Review and sign the NDA</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-purple-200 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">4</span>
                          <span>Gain access to protected content</span>
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Important Note:</p>
                        <p className="text-amber-700 mt-1">
                          By signing an NDA, you agree to keep all shared information confidential. 
                          Violation of NDA terms can result in legal consequences.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Request Access */}
              {currentStep === 'request' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Mail className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Request NDA Access
                    </h3>
                    <p className="text-gray-600">
                      Send a request to {creatorName} to access protected information.
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Your Request Message
                        </label>
                        <textarea
                          value={requestMessage}
                          onChange={(e) => setRequestMessage(e.target.value)}
                          placeholder={`I would like to request access to enhanced information for "${pitchTitle}". I understand this requires signing an NDA and I'm prepared to do so.`}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={4}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Optional: Explain why you're interested in this project
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Your Profile</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><span className="font-medium">Name:</span> {user?.username}</p>
                          <p><span className="font-medium">Type:</span> {user?.userType || 'User'}</p>
                          {user?.companyName && (
                            <p><span className="font-medium">Company:</span> {user.companyName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Awaiting Review */}
              {currentStep === 'status' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Request Submitted
                    </h3>
                    <p className="text-gray-600">
                      Your NDA request has been sent to {creatorName}. They will review and respond shortly.
                    </p>
                  </div>

                  {ndaData && (
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-blue-50 rounded-lg p-6">
                        <h4 className="font-semibold text-blue-900 mb-3">Request Details</h4>
                        <div className="space-y-2 text-sm text-blue-800">
                          <p><span className="font-medium">Submitted:</span> {new Date(ndaData.requestedAt).toLocaleDateString()}</p>
                          <p><span className="font-medium">Status:</span> Pending Review</p>
                          <p><span className="font-medium">Pitch:</span> {pitchTitle}</p>
                        </div>
                      </div>

                      <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600 mb-4">
                          You'll be notified when the creator responds to your request.
                        </p>
                        <button
                          onClick={checkNDAStatus}
                          className="px-4 py-2 text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Check Status
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Review Agreement */}
              {currentStep === 'review' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      NDA Approved - Review Agreement
                    </h3>
                    <p className="text-gray-600">
                      {creatorName} has approved your request. Please review and sign the NDA.
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="bg-green-50 rounded-lg p-6 mb-6">
                      <h4 className="font-semibold text-green-900 mb-3">Agreement Approved</h4>
                      <p className="text-sm text-green-800">
                        The creator has reviewed your request and is ready to share protected information 
                        once you sign the NDA.
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 mb-3">NDA Document</h4>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-8 h-8 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">Non-Disclosure Agreement</p>
                              <p className="text-sm text-gray-600">Standard NDA for {pitchTitle}</p>
                            </div>
                          </div>
                          <button
                            onClick={downloadNDA}
                            className="flex items-center space-x-2 px-3 py-2 text-purple-600 hover:text-purple-700"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-2">
                        <h5 className="font-medium text-gray-900">Key Terms:</h5>
                        <ul className="space-y-1 ml-4">
                          <li>• Confidentiality period: 2 years from signing</li>
                          <li>• Non-disclosure of project details, financials, and strategies</li>
                          <li>• No unauthorized sharing or reproduction of materials</li>
                          <li>• Mutual protection of both parties' information</li>
                          <li>• Governed by applicable jurisdiction laws</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Digital Signature */}
              {currentStep === 'sign' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <PenTool className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Digital Signature
                    </h3>
                    <p className="text-gray-600">
                      Sign the NDA digitally to complete the process.
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={signature.fullName}
                          onChange={(e) => setSignature({...signature, fullName: e.target.value})}
                          placeholder="Enter your full legal name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Title/Position
                        </label>
                        <input
                          type="text"
                          value={signature.title}
                          onChange={(e) => setSignature({...signature, title: e.target.value})}
                          placeholder="e.g., Producer, Investor, Executive"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Company/Organization
                        </label>
                        <input
                          type="text"
                          value={signature.company}
                          onChange={(e) => setSignature({...signature, company: e.target.value})}
                          placeholder="Your company or organization"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4">
                        <label className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={signature.acceptTerms}
                            onChange={(e) => setSignature({...signature, acceptTerms: e.target.checked})}
                            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            I have read, understood, and agree to be bound by the terms of this 
                            Non-Disclosure Agreement. I acknowledge that any breach of this agreement 
                            may result in legal action and damages.
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Complete */}
              {currentStep === 'complete' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      NDA Signed Successfully!
                    </h3>
                    <p className="text-gray-600">
                      You now have access to all protected information for this pitch.
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="bg-green-50 rounded-lg p-6 mb-6">
                      <h4 className="font-semibold text-green-900 mb-3">Access Granted</h4>
                      <p className="text-sm text-green-800 mb-3">
                        You can now view detailed synopsis, budget information, financial projections, 
                        and contact details for this pitch.
                      </p>
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center text-xs text-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Detailed Information
                        </span>
                        <span className="flex items-center text-xs text-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Financial Data
                        </span>
                        <span className="flex items-center text-xs text-green-700">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Contact Info
                        </span>
                      </div>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={onClose}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                      >
                        View Protected Content
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!loading && (
          <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-between">
            <button
              onClick={canGoPrev() ? prevStep : onClose}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium flex items-center space-x-2"
            >
              {canGoPrev() ? (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </>
              ) : (
                <span>Close</span>
              )}
            </button>

            <div className="flex space-x-3">
              {currentStep === 'request' && (
                <button
                  onClick={submitNDARequest}
                  disabled={loading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              )}

              {currentStep === 'review' && (
                <button
                  onClick={() => setCurrentStep('sign')}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Proceed to Sign
                </button>
              )}

              {currentStep === 'sign' && (
                <button
                  onClick={signNDA}
                  disabled={loading || !signature.fullName || !signature.acceptTerms}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing...' : 'Sign NDA'}
                </button>
              )}

              {canGoNext() && !['request', 'review', 'sign'].includes(currentStep) && (
                <button
                  onClick={nextStep}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}