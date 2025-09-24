import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Video, Camera } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import BackButton from '../components/BackButton';

export default function CreatorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, loginCreator } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await loginCreator(email, password);
      
      // Store userType for routing
      localStorage.setItem('userType', 'creator');
      
      console.log('Login successful, navigating to dashboard...'); // Debug navigation
      // Force a small delay to ensure state updates have propagated
      setTimeout(() => {
        navigate('/creator/dashboard');
      }, 100);
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.response?.data?.error || err.message || 'Invalid creator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <BackButton variant="light" />
      </div>

      <div className="max-w-md w-full">
        {/* Creator Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center p-2 border-2 border-purple-600">
              <img src="/pitcheylogo.png" alt="Pitchey Logo" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Creator Portal</h1>
          <p className="text-gray-600">Share your creative vision with the world</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                placeholder="creator@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign in as Creator'}
            </button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <a href="/register/creator" className="text-purple-600 hover:text-purple-700 text-sm transition">
                New creator? Register here
              </a>
            </div>
            <div className="flex items-center justify-center space-x-4 text-xs">
              <a href="/login/investor" className="text-purple-600 hover:text-purple-700 transition flex items-center gap-1">
                <Camera className="w-3 h-3" /> Investor Portal
              </a>
              <span className="text-gray-400">•</span>
              <a href="/login/production" className="text-purple-600 hover:text-purple-700 transition flex items-center gap-1">
                <Video className="w-3 h-3" /> Production Portal
              </a>
            </div>
          </div>

          {/* Demo Account */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-gray-700 text-xs text-center mb-3">
              Try our demo account
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail('alex.creator@demo.com');
                setPassword('Demo123');
              }}
              className="w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition border border-purple-300"
            >
              Use Demo Creator Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}