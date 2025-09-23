import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import BackButton from '../components/BackButton';
import { API_URL } from '../config/api.config';

export default function InvestorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/investor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user && data.user.userType === 'investor') {
        // Store token and user data for the auth system
        localStorage.setItem('token', data.token);
        localStorage.setItem('authToken', data.token); // For auth store compatibility
        localStorage.setItem('userType', 'investor');
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Update auth store state
        useAuthStore.setState({ 
          user: data.user, 
          isAuthenticated: true, 
          loading: false 
        });
        
        // Navigate to investor dashboard with delay to ensure state updates
        setTimeout(() => {
          navigate('/investor/dashboard');
        }, 100);
      } else {
        setError('Invalid investor credentials or account type');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <BackButton variant="dark" />
      </div>

      <div className="max-w-md w-full">
        {/* Investor Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center p-2">
              <img src="/pitcheylogo.png" alt="Pitchey Logo" className="h-12 w-auto object-contain filter brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Investor Portal</h1>
          <p className="text-blue-200">Discover and invest in tomorrow's blockbusters</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-blue-100 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-blue-300/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:bg-white/20 transition"
                placeholder="investor@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-blue-100 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-blue-300/30 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-blue-400 focus:bg-white/20 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign in as Investor'}
            </button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <a href="/register/investor" className="text-blue-200 hover:text-white text-sm transition">
                New investor? Register here
              </a>
            </div>
            <div className="flex items-center justify-center space-x-4 text-xs">
              <a href="/login/creator" className="text-blue-300 hover:text-white transition flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Creator Portal
              </a>
              <span className="text-blue-400">•</span>
              <a href="/login/production" className="text-blue-300 hover:text-white transition flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Production Portal
              </a>
            </div>
          </div>

          {/* Demo Account */}
          <div className="mt-6 p-4 bg-blue-600/20 rounded-lg border border-blue-500/30">
            <p className="text-blue-200 text-xs text-center mb-3">
              Try our demo account
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail('sarah.investor@demo.com');
                setPassword('Demo123');
              }}
              className="w-full py-2 bg-blue-500/30 hover:bg-blue-500/40 text-blue-100 rounded-lg text-sm font-medium transition border border-blue-400/30"
            >
              Use Demo Investor Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}