import React, { useState } from 'react';
import { Key, AlertCircle, ChevronLeft } from 'lucide-react';
import { api } from '../../services/api.service';

interface BackupCodeVerificationProps {
  onVerify: (token: string) => void;
  onBack?: () => void;
  onCancel?: () => void;
}

export const BackupCodeVerification: React.FC<BackupCodeVerificationProps> = ({
  onVerify,
  onBack,
  onCancel
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode) {
      setError('Please enter a backup code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/mfa/verify', {
        code: trimmedCode,
        method: 'backup'
      });

      if (response.success && response.data.mfaToken) {
        onVerify(response.data.mfaToken);
        
        // Show warning if running low on backup codes
        if (response.data.backupCodesRemaining && response.data.backupCodesRemaining <= 2) {
          // You might want to show a notification here
          console.warn(`Only ${response.data.backupCodesRemaining} backup codes remaining`);
        }
      } else {
        setError(response.error?.message || 'Invalid backup code. Please try again.');
        setCode('');
      }
    } catch (err) {
      setError('Failed to verify backup code. Please try again.');
      console.error('Backup code verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCode = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Add hyphen after 4 characters if entering full code
    if (cleaned.length <= 4) {
      return cleaned;
    } else if (cleaned.length <= 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <Key className="w-12 h-12 text-blue-600 mx-auto mb-3" />
        <h2 className="text-2xl font-bold mb-2">Use Backup Code</h2>
        <p className="text-sm text-gray-600">
          Enter one of your saved backup codes to access your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="backup-code" className="block text-sm font-medium text-gray-700 mb-2">
            Backup Code
          </label>
          <input
            id="backup-code"
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="ABCD-1234"
            className="w-full px-4 py-2 text-lg font-mono border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            maxLength={9}
            autoComplete="off"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Format: XXXX-XXXX (8 characters)
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Each backup code can only be used once</li>
                <li>After using this code, it will be permanently disabled</li>
                <li>Generate new backup codes if you're running low</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify Backup Code'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t">
        <div className="space-y-2">
          {onBack && (
            <button
              onClick={onBack}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to authenticator code
            </button>
          )}
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel authentication
            </button>
          )}
        </div>
      </div>
    </div>
  );
};