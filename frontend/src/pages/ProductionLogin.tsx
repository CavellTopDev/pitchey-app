import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import BackButton from '../components/BackButton';
import { authService } from '../services/auth.service';

export default function ProductionLogin() {
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
      const data = await authService.productionLogin({ email, password });
      
      // Update auth store state
      useAuthStore.setState({ 
        user: data.user, 
        isAuthenticated: true, 
        loading: false 
      });
      
      // Navigate to production dashboard
      navigate('/production/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid production company credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-800 flex items-center justify-center p-4">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <BackButton variant="dark" />
      </div>

      <div className="max-w-md w-full">
        {/* Production Portal Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center p-2">
              <img src="/pitcheylogo.png" alt="Pitchey Logo" className="h-12 w-auto object-contain filter brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Production Portal</h1>
          <p className="text-green-200">Transform creative visions into reality</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-green-100 text-sm font-medium mb-2">
                Company Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-green-300/30 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-400 focus:bg-white/20 transition"
                placeholder="production@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-green-100 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-green-300/30 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-400 focus:bg-white/20 transition"
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
              className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign in as Production Company'}
            </button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <a href="/register/production" className="text-green-200 hover:text-white text-sm transition">
                Register your production company
              </a>
            </div>
            <div className="flex items-center justify-center space-x-4 text-xs">
              <a href="/login/creator" className="text-green-300 hover:text-white transition flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Creator Portal
              </a>
              <span className="text-green-400">•</span>
              <a href="/login/investor" className="text-green-300 hover:text-white transition flex items-center gap-1">
                <Users className="w-3 h-3" /> Investor Portal
              </a>
            </div>
          </div>

          {/* Demo Account */}
          <div className="mt-6 p-4 bg-green-600/20 rounded-lg border border-green-500/30">
            <p className="text-green-200 text-xs text-center mb-3">
              Try our demo account
            </p>
            <button
              type="button"
              onClick={() => {
                setEmail('stellar.production@demo.com');
                setPassword('Demo123');
              }}
              className="w-full py-2 bg-green-500/30 hover:bg-green-500/40 text-green-100 rounded-lg text-sm font-medium transition border border-green-400/30"
            >
              Use Demo Production Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}