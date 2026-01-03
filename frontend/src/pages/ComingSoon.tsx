import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Rocket, Clock, Construction, 
  Sparkles, Bell, Mail 
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function ComingSoon() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [email, setEmail] = useState(user?.email || '');
  const [subscribed, setSubscribed] = useState(false);

  // Extract page title from pathname
  const getPageTitle = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    
    // Convert URL segment to readable title
    return lastSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In a real app, this would send to an API
      setSubscribed(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSubscribed(false);
        setEmail('');
      }, 3000);
    }
  };

  const features = [
    {
      icon: Rocket,
      title: 'Advanced Analytics',
      description: 'Deep insights into your performance metrics'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Tools',
      description: 'Smart recommendations and automated workflows'
    },
    {
      icon: Clock,
      title: 'Real-time Updates',
      description: 'Instant notifications and live data synchronization'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 mb-8 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>

        {/* Main Content */}
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-6 shadow-xl">
            <Construction className="w-12 h-12 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {getPageTitle()}
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl text-gray-600 mb-2">
            Coming Soon
          </p>
          
          {/* Description */}
          <p className="text-gray-500 max-w-2xl mx-auto mb-12">
            We're working hard to bring you this feature. Our team is putting the finishing touches 
            on an amazing experience that will revolutionize how you manage your {user?.userType === 'creator' ? 'pitches' : user?.userType === 'investor' ? 'investments' : 'productions'}.
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
                  <feature.icon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Newsletter Signup */}
          <div className="bg-white rounded-xl p-8 shadow-xl max-w-md mx-auto">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mx-auto mb-4">
              {subscribed ? (
                <Bell className="w-6 h-6 text-indigo-600" />
              ) : (
                <Mail className="w-6 h-6 text-indigo-600" />
              )}
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {subscribed ? 'Thank You!' : 'Get Notified'}
            </h3>
            
            {subscribed ? (
              <p className="text-gray-600">
                We'll let you know as soon as this feature is ready!
              </p>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Be the first to know when this feature launches.
                </p>
                
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition font-medium"
                  >
                    Notify Me
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Expected Launch
            </p>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
              Q1 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}