import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  PenTool,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle,
  FileText,
  Shield,
  Calendar,
  User,
  Building2,
  Save
} from 'lucide-react';
import { useToast } from '../Toast/ToastProvider';
import { ndaService } from '../../services/nda.service';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface NDASignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  nda: {
    id: number;
    pitchId: number;
    pitchTitle: string;
    creatorName: string;
    status: string;
    documentUrl?: string;
    terms?: string;
    approvedAt?: string;
    expiresAt?: string;
  };
  onSigned: () => void;
}

interface SignatureData {
  fullName: string;
  title: string;
  company: string;
  date: string;
  signature: string;
  ipAddress: string;
  acceptTerms: boolean;
}

export default function NDASignatureModal({
  isOpen,
  onClose,
  nda,
  onSigned
}: NDASignatureModalProps) {
  const { user } = useBetterAuthStore();
  const { success, error } = useToast();
  
  const [step, setStep] = useState<'terms' | 'signature' | 'confirmation'>('terms');
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData>({
    fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    title: '',
    company: user?.companyName || '',
    date: new Date().toLocaleDateString(),
    signature: '',
    ipAddress: '',
    acceptTerms: false
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    // Get user's IP address (in a real implementation, this would be handled server-side)
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        setSignatureData(prev => ({ ...prev, ipAddress: data.ip }));
      })
      .catch(() => {
        setSignatureData(prev => ({ ...prev, ipAddress: 'Unknown' }));
      });
  }, []);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof SignatureData, value: string | boolean) => {
    setSignatureData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const captureSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const signatureDataUrl = canvas.toDataURL();
      setSignatureData(prev => ({ ...prev, signature: signatureDataUrl }));
      return signatureDataUrl;
    }
    return '';
  };

  const handleSign = async () => {
    if (!hasSignature) {
      error('Signature Required', 'Please provide your signature before proceeding.');
      return;
    }

    if (!signatureData.fullName.trim()) {
      error('Full Name Required', 'Please enter your full legal name.');
      return;
    }

    if (!signatureData.acceptTerms) {
      error('Terms Acceptance Required', 'You must accept the terms and conditions to proceed.');
      return;
    }

    try {
      setLoading(true);
      
      const signature = captureSignature();
      
      await ndaService.signNDA({
        ndaId: nda.id,
        signature,
        fullName: signatureData.fullName,
        title: signatureData.title,
        company: signatureData.company,
        acceptTerms: signatureData.acceptTerms
      });

      setStep('confirmation');
      success('NDA Signed Successfully', 'You have successfully signed the NDA. You now have access to the protected content.');
      onSigned();

    } catch (err) {
      error('Signature Failed', err instanceof Error ? err.message : 'Unable to sign NDA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateNDADocument = () => {
    return `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on ${signatureData.date} between:

DISCLOSING PARTY: ${nda.creatorName}
RECEIVING PARTY: ${signatureData.fullName}
${signatureData.title ? `Title: ${signatureData.title}` : ''}
${signatureData.company ? `Company: ${signatureData.company}` : ''}

PROJECT: "${nda.pitchTitle}"

1. CONFIDENTIAL INFORMATION
All information disclosed in relation to the above project, including but not limited to creative concepts, treatments, scripts, financial projections, production timelines, business plans, distribution strategies, talent attachments, and deal structures.

2. OBLIGATIONS
The Receiving Party agrees to:
• Keep all information strictly confidential
• Use information solely for evaluation purposes  
• Not disclose to any third parties without prior written consent
• Return or destroy all confidential materials upon request

3. TERM
This agreement shall remain in effect for 2 years from the date of signature.

4. EXCEPTIONS
This agreement does not apply to information that:
• Is already publicly available
• Was known prior to disclosure
• Is independently developed
• Is required to be disclosed by law

5. REMEDIES
Breach of this agreement may result in irreparable harm, and the Disclosing Party shall be entitled to seek injunctive relief and monetary damages.

6. ELECTRONIC SIGNATURE
Both parties agree that electronic signatures have the same legal effect as handwritten signatures.

DISCLOSING PARTY: ${nda.creatorName}
Date: ${signatureData.date}

RECEIVING PARTY: ${signatureData.fullName}
${signatureData.title ? `Title: ${signatureData.title}` : ''}
${signatureData.company ? `Company: ${signatureData.company}` : ''}
Date: ${signatureData.date}
IP Address: ${signatureData.ipAddress}

SIGNATURE: [Digital Signature Applied]

By proceeding with electronic signature, the Receiving Party acknowledges they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.
    `.trim();
  };

  const downloadDocument = () => {
    const document = generateNDADocument();
    const blob = new Blob([document], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NDA_${nda.pitchTitle.replace(/[^a-z0-9]/gi, '_')}_${signatureData.date.replace(/\//g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Digital NDA Signature</h3>
                <p className="text-sm text-gray-600">
                  {step === 'terms' && 'Review and accept terms'}
                  {step === 'signature' && 'Provide digital signature'}  
                  {step === 'confirmation' && 'Signature complete'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'terms' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-3 ${
              step !== 'terms' ? 'bg-blue-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'signature' ? 'bg-blue-600 text-white' : 
              step === 'confirmation' ? 'bg-gray-200 text-gray-600' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className={`flex-1 h-1 mx-3 ${
              step === 'confirmation' ? 'bg-blue-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'confirmation' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Review Terms</span>
            <span>Digital Signature</span>
            <span>Confirmation</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'terms' && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">NDA Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-800">Project:</span>
                    <span className="ml-2 text-blue-700">{nda.pitchTitle}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-800">Creator:</span>
                    <span className="ml-2 text-blue-700">{nda.creatorName}</span>
                  </div>
                  {nda.approvedAt && (
                    <div>
                      <span className="font-medium text-blue-800">Approved:</span>
                      <span className="ml-2 text-blue-700">{new Date(nda.approvedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {nda.expiresAt && (
                    <div>
                      <span className="font-medium text-blue-800">Expires:</span>
                      <span className="ml-2 text-blue-700">{new Date(nda.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms Document */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Non-Disclosure Agreement Terms</h4>
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                    {generateNDADocument()}
                  </pre>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900 mb-1">Legal Agreement</p>
                    <p className="text-amber-800">
                      By proceeding to sign this NDA, you are entering into a legally binding agreement. 
                      Please ensure you understand all terms and conditions before providing your signature.
                      Electronic signatures have the same legal effect as handwritten signatures.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'signature' && (
            <div className="space-y-6">
              {/* Signer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    value={signatureData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full legal name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title/Position
                  </label>
                  <input
                    type="text"
                    value={signatureData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your title or position"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company/Organization
                  </label>
                  <input
                    type="text"
                    value={signatureData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Company or organization name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="text"
                    value={signatureData.date}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              {/* Digital Signature Canvas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digital Signature *
                </label>
                <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Sign here using your mouse or touchscreen:</span>
                    <button
                      onClick={clearSignature}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="border border-gray-200 rounded cursor-crosshair w-full"
                    style={{ touchAction: 'none' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Draw your signature in the box above. This will serve as your electronic signature.
                  </p>
                </div>
              </div>

              {/* Signature Verification */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Signature Verification</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">IP Address:</span>
                    <span className="ml-2 text-gray-600">{signatureData.ipAddress}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Timestamp:</span>
                    <span className="ml-2 text-gray-600">{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Terms Acceptance */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={signatureData.acceptTerms}
                    onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">
                      I accept the terms and conditions
                    </p>
                    <p className="text-blue-800">
                      I have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement. 
                      I acknowledge that this electronic signature has the same legal effect as a handwritten signature.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">NDA Successfully Signed!</h4>
                <p className="text-gray-600">
                  You have successfully signed the Non-Disclosure Agreement for "{nda.pitchTitle}". 
                  You now have access to the protected content.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-2">What happens next?</p>
                  <ul className="text-left space-y-1 list-disc list-inside">
                    <li>Your signature has been recorded with timestamp and IP verification</li>
                    <li>You can now access the protected pitch materials</li>
                    <li>The creator has been notified of your signature</li>
                    <li>You can download a copy of the signed agreement</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={downloadDocument}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Download Agreement
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4" />
                  Access Content
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'confirmation' && (
          <div className="p-6 border-t bg-gray-50 flex justify-between">
            <button
              onClick={step === 'terms' ? onClose : () => setStep('terms')}
              className="px-6 py-2 text-gray-700 hover:text-gray-900"
            >
              {step === 'terms' ? 'Cancel' : 'Previous'}
            </button>
            
            <div className="flex gap-3">
              {step === 'terms' && (
                <button
                  onClick={() => setStep('signature')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Accept & Continue
                </button>
              )}
              
              {step === 'signature' && (
                <button
                  onClick={handleSign}
                  disabled={loading || !hasSignature || !signatureData.fullName.trim() || !signatureData.acceptTerms}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg ${
                    loading || !hasSignature || !signatureData.fullName.trim() || !signatureData.acceptTerms
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <PenTool className="w-4 h-4" />
                  {loading ? 'Signing...' : 'Sign Agreement'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}