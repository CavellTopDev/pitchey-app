import { useNavigate } from 'react-router-dom';
import { Film, DollarSign, Building2, ArrowRight, ArrowLeft } from 'lucide-react';

export default function PortalSelect() {
  const navigate = useNavigate();

  const portals = [
    {
      id: 'creator',
      title: 'Creator Portal',
      description: 'Share your creative vision and connect with production companies and investors',
      icon: Film,
      color: 'purple',
      gradient: 'from-purple-600 to-indigo-600',
      bgGradient: 'from-purple-900 via-purple-800 to-indigo-900',
      path: '/login/creator',
      features: ['Upload pitch decks', 'Track viewer analytics', 'Secure NDA protection', 'Direct messaging']
    },
    {
      id: 'production',
      title: 'Production Portal',
      description: 'Find and develop the next blockbuster from talented creators',
      icon: Building2,
      color: 'green',
      gradient: 'from-green-600 to-emerald-600',
      bgGradient: 'from-green-900 via-emerald-900 to-teal-800',
      path: '/login/production',
      features: ['Scout new projects', 'Manage productions', 'Team collaboration', 'Budget planning']
    },
    {
      id: 'investor',
      title: 'Investor Portal',
      description: 'Discover promising film projects and investment opportunities',
      icon: DollarSign,
      color: 'blue',
      gradient: 'from-blue-600 to-indigo-600',
      bgGradient: 'from-blue-900 via-indigo-900 to-blue-800',
      path: '/login/investor',
      features: ['Browse curated pitches', 'Investment tracking', 'Due diligence tools', 'Portfolio management']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Back Button */}
      <div className="pt-6 px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>

      {/* Header */}
      <div className="text-center pt-8 pb-8">
        <h1 className="text-5xl font-bold text-white mb-4">Join Pitchey</h1>
        <p className="text-xl text-gray-300">Select your role to get started</p>
      </div>

      {/* Portal Cards */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {portals.map((portal) => (
            <div
              key={portal.id}
              className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105"
              onClick={() => navigate(portal.path)}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${portal.gradient} rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur-xl`}></div>
              
              <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-gray-700 hover:border-gray-600 transition-colors p-8">
                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-r ${portal.gradient} rounded-xl flex items-center justify-center mb-6`}>
                  <portal.icon className="w-8 h-8 text-white" />
                </div>

                {/* Title and Description */}
                <h2 className="text-2xl font-bold text-white mb-3">{portal.title}</h2>
                <p className="text-gray-400 mb-6 h-12">{portal.description}</p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {portal.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-300">
                      <span className="w-1.5 h-1.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full mr-2"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <button className={`w-full py-3 bg-gradient-to-r ${portal.gradient} text-white font-semibold rounded-lg hover:shadow-lg transition-shadow flex items-center justify-center gap-2 group`}>
                  Enter Portal
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-gray-900/50 backdrop-blur rounded-xl p-8 border border-gray-800">
          <h3 className="text-xl font-semibold text-white mb-4">Ready to Get Started?</h3>
          <p className="text-gray-400 mb-6">
            Choose your role above to create an account and start connecting with the film industry.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse More Pitches
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              Register Now
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-gray-500 text-sm">
          Demo accounts available for testing • View documentation
        </p>
      </div>
    </div>
  );
}