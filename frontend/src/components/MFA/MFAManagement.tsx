import React, { useState, useEffect } from 'react';
import { Shield, Key, Download, RefreshCw, Trash2, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.service';
import { MFASetup } from './MFASetup';
import { MFAVerification } from './MFAVerification';

interface MFAStatus {
  enabled: boolean;
  method?: 'totp' | 'sms' | 'email';
  backupCodesRemaining?: number;
  lastUsed?: string;
  enrolledAt?: string;
}

export const MFAManagement: React.FC = () => {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerateBackup, setShowRegenerateBackup] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      const response = await api.get('/api/mfa/status');
      if (response.success) {
        setStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
      setError('Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    setSuccess('Two-factor authentication has been enabled successfully');
    fetchMFAStatus();
  };

  const handleDisableMFA = async (code: string) => {
    try {
      const response = await api.post('/api/mfa/disable', { code });
      
      if (response.success) {
        setShowDisable(false);
        setSuccess('Two-factor authentication has been disabled');
        fetchMFAStatus();
      } else {
        setError(response.error?.message || 'Failed to disable MFA');
      }
    } catch (err) {
      setError('An error occurred while disabling MFA');
    }
  };

  const handleRegenerateBackupCodes = async (code: string) => {
    try {
      const response = await api.post('/api/mfa/backup-codes/regenerate', { code });
      
      if (response.success) {
        setNewBackupCodes(response.data.backupCodes);
        setShowRegenerateBackup(false);
        setSuccess('New backup codes generated successfully');
        fetchMFAStatus();
      } else {
        setError(response.error?.message || 'Failed to regenerate backup codes');
      }
    } catch (err) {
      setError('An error occurred while regenerating backup codes');
    }
  };

  const downloadBackupCodes = () => {
    const content = `Pitchey Backup Codes
Generated: ${new Date().toISOString()}

IMPORTANT: Keep these codes in a safe place.
Each code can only be used once.

${newBackupCodes.join('\n')}

To use a backup code:
1. Go to the login page
2. Click "Use backup code" when prompted for 2FA
3. Enter one of these codes
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pitchey-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <MFASetup
        onComplete={handleSetupComplete}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
          </div>
          {status?.enabled && (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              Enabled
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-start">
            <Check className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>{success}</div>
          </div>
        )}

        {newBackupCodes.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-semibold mb-2 text-amber-900">New Backup Codes</h3>
            <p className="text-sm text-amber-700 mb-3">
              Save these codes immediately. You won't be able to see them again.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {newBackupCodes.map((code, index) => (
                <code key={index} className="px-2 py-1 bg-white border border-amber-300 rounded text-sm font-mono">
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={downloadBackupCodes}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Download className="w-4 h-4" />
              Download Codes
            </button>
          </div>
        )}

        {!status?.enabled ? (
          <div>
            <p className="text-gray-600 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication.
              You'll need to enter a code from your authenticator app in addition to your password when signing in.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2 text-blue-900">Benefits of 2FA:</h3>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>Protects against password theft</li>
                <li>Prevents unauthorized access even if password is compromised</li>
                <li>Required for high-value transactions and sensitive operations</li>
                <li>Industry-standard security practice</li>
              </ul>
            </div>

            <button
              onClick={() => setShowSetup(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Enable Two-Factor Authentication
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Method:</span>
                  <span className="font-medium">
                    {status.method === 'totp' ? 'Authenticator App' : status.method?.toUpperCase()}
                  </span>
                </div>
                {status.enrolledAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Enabled since:</span>
                    <span className="font-medium">
                      {new Date(status.enrolledAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {status.lastUsed && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last used:</span>
                    <span className="font-medium">
                      {new Date(status.lastUsed).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {status.backupCodesRemaining !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Backup codes remaining:</span>
                    <span className={`font-medium ${status.backupCodesRemaining <= 2 ? 'text-red-600' : ''}`}>
                      {status.backupCodesRemaining}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowRegenerateBackup(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 w-full text-left"
                >
                  <RefreshCw className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Regenerate Backup Codes</div>
                    <div className="text-xs text-gray-600">
                      Generate new backup codes if you've lost them or used most of them
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowDisable(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 w-full text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Disable Two-Factor Authentication</div>
                    <div className="text-xs">
                      Remove the extra security layer from your account
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {showDisable && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Disable Two-Factor Authentication</h3>
              <p className="text-gray-600 mb-4">
                Enter your current 2FA code to disable two-factor authentication.
              </p>
              <MFAVerification
                onVerify={(token) => {
                  // Use the token as the code for disabling
                  handleDisableMFA(token);
                }}
                onCancel={() => setShowDisable(false)}
              />
            </div>
          </div>
        )}

        {showRegenerateBackup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Regenerate Backup Codes</h3>
              <p className="text-gray-600 mb-4">
                Enter your current 2FA code to generate new backup codes.
                Your old backup codes will be invalidated.
              </p>
              <MFAVerification
                onVerify={(token) => {
                  // Use the token as the code for regenerating
                  handleRegenerateBackupCodes(token);
                }}
                onCancel={() => setShowRegenerateBackup(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};