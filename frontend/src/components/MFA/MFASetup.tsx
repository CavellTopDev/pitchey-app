import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Copy, Check, AlertCircle, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api.service';

interface MFASetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'intro' | 'qrcode' | 'verify' | 'complete'>('intro');
  const [qrCode, setQrCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/mfa/setup/start');
      
      if (response.success) {
        setQrCode(response.data.qrCode);
        setBackupCodes(response.data.backupCodes);
        setStep('qrcode');
      } else {
        setError(response.error?.message || 'Failed to start MFA setup');
      }
    } catch (err) {
      setError('An error occurred while setting up MFA');
      console.error('MFA setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/mfa/setup/verify', {
        code: verificationCode
      });

      if (response.success) {
        setStep('complete');
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      } else {
        setError(response.error?.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      console.error('MFA verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setVerificationCode(value);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {step === 'intro' && (
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Secure Your Account with 2FA</h2>
          <p className="text-gray-600 mb-6">
            Two-factor authentication adds an extra layer of security to your account.
            You'll need to enter a code from your authenticator app when signing in.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">You'll need:</h3>
            <ul className="list-disc list-inside text-sm text-gray-700">
              <li>A smartphone with an authenticator app (Google Authenticator, Authy, etc.)</li>
              <li>A few minutes to complete setup</li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={startSetup}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Get Started'}
            </button>
          </div>
        </div>
      )}

      {step === 'qrcode' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Scan QR Code</h2>
          <p className="text-gray-600 mb-6">
            Scan this QR code with your authenticator app to add your Pitchey account.
          </p>

          {qrCode && (
            <div className="flex justify-center mb-6 p-4 bg-gray-50 rounded-lg">
              <QRCodeSVG value={qrCode} size={200} />
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <AlertCircle className="inline-block w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-semibold">Important:</span> Save these backup codes in a safe place.
            You can use them to access your account if you lose your authenticator device.
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Backup Codes</h3>
              <button
                onClick={copyBackupCodes}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                {copiedCodes ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <code key={index} className="px-2 py-1 bg-white border border-gray-200 rounded text-sm font-mono">
                  {code}
                </code>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep('verify')}
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            I've Saved My Backup Codes
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="text-center">
          <Key className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Verify Setup</h2>
          <p className="text-gray-600 mb-6">
            Enter the 6-digit code from your authenticator app to complete setup.
          </p>

          <div className="mb-6">
            <input
              type="text"
              value={verificationCode}
              onChange={handleCodeInput}
              placeholder="000000"
              className="w-32 text-center text-2xl font-mono px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              maxLength={6}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setStep('qrcode')}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={verifyCode}
              disabled={loading || verificationCode.length !== 6}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4">2FA Enabled Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your account is now protected with two-factor authentication.
            You'll need to enter a code from your authenticator app each time you sign in.
          </p>
        </div>
      )}
    </div>
  );
};