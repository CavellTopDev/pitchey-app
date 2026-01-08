import React, { useState, useRef, useEffect } from 'react';
import { Shield, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '../../services/api.service';

interface MFAVerificationProps {
  onVerify: (token: string) => void;
  onCancel?: () => void;
  onUseBackupCode?: () => void;
  email?: string;
}

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  onVerify,
  onCancel,
  onUseBackupCode,
  email
}) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(0, 1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (index === 5 && digit) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Handle Enter
    if (e.key === 'Enter') {
      const fullCode = code.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (digits) {
      const newCode = digits.split('').concat(['', '', '', '', '', '']).slice(0, 6);
      setCode(newCode);
      
      // Focus last filled input or next empty one
      const lastFilledIndex = Math.min(digits.length, 5);
      inputRefs.current[lastFilledIndex]?.focus();

      // Auto-submit if 6 digits pasted
      if (digits.length === 6) {
        verifyCode(digits);
      }
    }
  };

  const verifyCode = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/mfa/verify', {
        code: codeToVerify,
        method: 'totp'
      });

      if (response.success && response.data.mfaToken) {
        onVerify(response.data.mfaToken);
      } else {
        setAttempts(prev => prev + 1);
        setError(response.error?.message || 'Invalid code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        // Show warning after 3 failed attempts
        if (attempts >= 2) {
          setError(prev => prev + ' You can use a backup code if needed.');
        }
      }
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      console.error('MFA verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    // In a real app, this might generate a new code or resend via SMS/email
    setError('');
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <Shield className="w-12 h-12 text-blue-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold mb-2">Two-Factor Authentication</h2>
        {email && (
          <p className="text-sm text-gray-600">
            Verifying identity for {email}
          </p>
        )}
      </div>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Enter the 6-digit code from your authenticator app
        </p>

        <div className="flex justify-center gap-2 mb-4">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className={`
                w-12 h-14 text-center text-xl font-mono
                border-2 rounded-lg transition-all
                ${digit ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              maxLength={1}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <button
          onClick={() => verifyCode()}
          disabled={loading || code.join('').length !== 6}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      <div className="border-t pt-4">
        <div className="space-y-2">
          <button
            onClick={onUseBackupCode}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
          >
            <span>Use backup code instead</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleResend}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
          >
            <span>Try a different method</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel and go back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};