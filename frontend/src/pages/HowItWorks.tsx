import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Users, DollarSign, Rocket, Shield, TrendingUp, CheckCircle, Star, Zap, Target, Award } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const navigate = useNavigate();

  const creatorSteps = [
    {
      icon: <Film className="w-8 h-8" />,
      title: "Create Your Pitch",
      description: "Upload your screenplay, treatment, or concept with compelling visuals and detailed project information."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Protect Your Work",
      description: "Use our NDA system to protect your intellectual property while sharing with verified investors."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Connect with Investors",
      description: "Get discovered by production companies and investors actively seeking new content."
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Secure Funding",
      description: "Negotiate deals, receive funding, and bring your creative vision to life."
    }
  ];

  const investorSteps = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Browse Curated Content",
      description: "Access a diverse marketplace of pre-vetted pitches across all genres and formats."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Review Under NDA",
      description: "Sign NDAs digitally to access detailed materials and proprietary content securely."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Track Performance",
      description: "Monitor pitch engagement, market trends, and investment opportunities in real-time."
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Close Deals",
      description: "Connect directly with creators, negotiate terms, and finalize investments."
    }
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "AI-Powered Matching",
      description: "Our algorithm connects the right projects with the right investors based on genre, budget, and track record."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure Platform",
      description: "Bank-level encryption and comprehensive NDA protection for all shared materials."
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Quality Control",
      description: "All pitches are reviewed to ensure professional standards and market readiness."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Direct Communication",
      description: "Built-in messaging and video conferencing for seamless collaboration."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">How It Works</h1>
          </div>
          <button
            onClick={() => navigate('/portals')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-5xl font-bold text-white mb-6">
            Transform Your Ideas Into Reality
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Pitchey connects visionary creators with forward-thinking investors through a secure, 
            transparent marketplace designed for the entertainment industry.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/portals')}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition"
            >
              Start Your Journey
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg hover:bg-white/20 transition"
            >
              Browse Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* For Creators Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">For Creators</h3>
            <p className="text-gray-300">Turn your screenplay into your next production</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creatorSteps.map((step, index) => (
              <div key={index} className="relative">
                {index < creatorSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-purple-500 to-transparent z-0" />
                )}
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition relative z-10">
                  <div className="text-purple-400 mb-4">{step.icon}</div>
                  <h4 className="text-xl font-semibold text-white mb-2">{step.title}</h4>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Investors Section */}
      <section className="py-16 px-4 bg-black/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">For Investors</h3>
            <p className="text-gray-300">Discover the next blockbuster before anyone else</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {investorSteps.map((step, index) => (
              <div key={index} className="relative">
                {index < investorSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-green-500 to-transparent z-0" />
                )}
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-green-500/20 hover:border-green-500/40 transition relative z-10">
                  <div className="text-green-400 mb-4">{step.icon}</div>
                  <h4 className="text-xl font-semibold text-white mb-2">{step.title}</h4>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">Why Choose Pitchey?</h3>
            <p className="text-gray-300">Industry-leading features for modern content creation</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-yellow-500/20 hover:border-yellow-500/40 transition">
                <div className="text-yellow-400 mb-4">{feature.icon}</div>
                <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Metrics */}
      <section className="py-16 px-4 bg-black/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-purple-500/20">
              <div className="text-4xl font-bold text-purple-400 mb-2">500+</div>
              <p className="text-gray-300">Active Projects</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-green-500/20">
              <div className="text-4xl font-bold text-green-400 mb-2">$50M+</div>
              <p className="text-gray-300">Funded to Date</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-yellow-500/20">
              <div className="text-4xl font-bold text-yellow-400 mb-2">200+</div>
              <p className="text-gray-300">Success Stories</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-pink-500/20">
              <div className="text-4xl font-bold text-pink-400 mb-2">95%</div>
              <p className="text-gray-300">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of creators and investors transforming the entertainment industry
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate('/portals')}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition"
            >
              <Users className="inline w-5 h-5 mr-2" />
              Create Account
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg hover:bg-white/20 transition"
            >
              <Film className="inline w-5 h-5 mr-2" />
              Explore Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-md border-t border-purple-500/20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            Have questions? Contact us at{' '}
            <a href="mailto:support@pitchey.com" className="text-purple-400 hover:text-purple-300">
              support@pitchey.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorks;