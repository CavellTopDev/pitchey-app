import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { authAPI } from '../lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setVerifying(false);
      setError('Invalid verification link');
    }
  }, [token]);

  const verifyEmail = async () => {
    if (!token) return;
    
    setVerifying(true);
    setError(null);
    
    try {
      await authAPI.verifyEmail(token);
      setVerified(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to verify email. The link may be expired.');
    } finally {
      setVerifying(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    setError(null);
    
    try {
      // Get email from localStorage or prompt user
      const email = localStorage.getItem('pendingVerificationEmail');
      if (!email) {
        setError('Please log in to resend verification email');
        navigate('/login');
        return;
      }
      
      await authAPI.resendVerificationEmail(email);
      setResent(true);
    } catch (error: any) {
      setError('Failed to resend verification email. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Pitchey
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Email Verification
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-700">
          {verifying ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
              <p className="mt-4 text-gray-400">Verifying your email address...</p>
            </div>
          ) : verified ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-900/50 mb-4">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Email verified successfully!
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Your email has been verified. You can now access all features of your account.
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Redirecting to login page...
              </p>
              <Link
                to="/login"
                className="inline-block w-full py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                Go to login
              </Link>
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 mb-4">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Verification failed
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                {error}
              </p>
              
              {resent ? (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-400">
                    A new verification email has been sent. Please check your inbox.
                  </p>
                </div>
              ) : (
                <button
                  onClick={resendVerification}
                  disabled={resending}
                  className="w-full flex justify-center items-center py-2 px-4 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {resending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend verification email
                    </>
                  )}
                </button>
              )}
              
              <Link
                to="/login"
                className="block w-full py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-900/50 mb-4">
                <Mail className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Verify your email
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                We sent a verification email to your registered email address.
                Please check your inbox and click the verification link.
              </p>
              <p className="text-xs text-gray-500 mb-6">
                The link will expire in 24 hours. If you don't see the email, check your spam folder.
              </p>
              
              {resent ? (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-400">
                    A new verification email has been sent. Please check your inbox.
                  </p>
                </div>
              ) : (
                <button
                  onClick={resendVerification}
                  disabled={resending}
                  className="w-full flex justify-center items-center py-2 px-4 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {resending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend verification email
                    </>
                  )}
                </button>
              )}
              
              <Link
                to="/login"
                className="block w-full py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                Continue to login
              </Link>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Having trouble?{' '}
            <a
              href="mailto:support@pitchey.com"
              className="font-medium text-purple-400 hover:text-purple-300"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}