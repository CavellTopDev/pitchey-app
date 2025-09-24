import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, ArrowLeft } from 'lucide-react';

const About: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <Film className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">Pitchey</span>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-purple-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">About Pitchey</h1>
          
          <div className="prose prose-lg max-w-none text-gray-600 space-y-6">
            <p className="text-xl font-medium text-gray-800">
              Pitchey was born out of frustration. Mine, mostly.
            </p>
            
            <p>
              As a producer, I was always looking for the next great idea. But there was nowhere simple, 
              central, or sane for people to pitch their projects. Instead, I'd get pitches sent in every 
              format under the sun: PDFs, Word docs, Google links, pitch decks that looked like they 
              were designed in the early 2000s. Half the time I couldn't even open them properly, and the 
              other half I'd lose them forever in the black hole that is my inbox.
            </p>
            
            <p>
              Meanwhile, creators had the opposite problem. No clear place to send their ideas, no way 
              to stand out, and no guarantee their pitch wouldn't just sink to the bottom of someone's 
              email pile.
            </p>
            
            <p>
              So I thought: what if there was a single place where pitches actually lived? Organized, 
              searchable, easy to send, easy to read, and impossible to lose. A place built for creators, 
              producers, and investors who all want the same thing: great stories.
            </p>
            
            <p className="text-xl font-medium text-gray-800">
              That's Pitchey.
            </p>
            
            <p>
              Think of it as the world's least annoying inbox, a marketplace where projects and people 
              actually find each other.
            </p>
            
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-gray-500 italic">— Karl King, Founder</p>
            </div>
          </div>

          <div className="mt-12 flex gap-4">
            <button 
              onClick={() => navigate('/portals')}
              className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
            >
              Get Started
            </button>
            <button 
              onClick={() => navigate('/how-it-works')}
              className="px-6 py-3 border border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition"
            >
              How It Works
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;