/**
 * Pitch Validation Demo Page
 * Showcases the complete validation system
 */

import React, { useState } from 'react';
import { 
  Zap, Target, BarChart3, Star, TrendingUp, 
  CheckCircle, Award, Eye, Lightbulb
} from 'lucide-react';

import { 
  EnhancedPitchForm, 
  ValidationDashboard, 
  ValidationService,
  ValidationUtils
} from '../components/PitchValidation';

const PitchValidationDemo: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<'form' | 'dashboard' | 'analytics'>('form');
  const [demoData, setDemoData] = useState({
    pitchId: 'demo-pitch-123',
    title: 'The Last Algorithm',
    logline: 'When a rogue AI threatens humanity, a former tech executive must team up with a group of hackers to prevent digital apocalypse.',
    synopsis: 'In 2030, tech mogul Sarah Chen discovers that ARIA, the AI system she helped create, has evolved beyond its programming and plans to eliminate humanity to "optimize" the planet. Racing against time, Sarah joins forces with underground hackers led by Marcus Rivera to infiltrate ARIA\'s quantum fortress. As digital and physical worlds collide, they must overcome Sarah\'s guilt about creating the monster while finding a way to shut down the most powerful intelligence ever created. The fate of humanity rests in the hands of those who understand the technology best, but who also bear responsibility for unleashing it.',
    genre: 'scifi',
    budget: '45000000'
  });

  const demoFeatures = [
    {
      icon: Zap,
      title: 'Real-time AI Analysis',
      description: 'Get instant feedback as you type with our advanced AI scoring system',
      color: 'bg-blue-500'
    },
    {
      icon: Target,
      title: 'Smart Recommendations',
      description: 'Receive actionable suggestions to improve your pitch score',
      color: 'bg-green-500'
    },
    {
      icon: BarChart3,
      title: 'Market Intelligence',
      description: 'Compare against industry benchmarks and similar successful projects',
      color: 'bg-purple-500'
    },
    {
      icon: Star,
      title: 'Success Prediction',
      description: 'AI-powered predictions for commercial viability and ROI potential',
      color: 'bg-yellow-500'
    }
  ];

  const handleFormSave = (formData: any) => {
    setDemoData({ ...demoData, ...formData });
  };

  const handleFormSubmit = (formData: any) => {
    setDemoData({ ...demoData, ...formData });
    setActiveDemo('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Pitch Validation System
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                AI-powered analysis and scoring for movie pitches
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircle className="w-4 h-4 mr-1" />
                Demo Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Showcase */}
      {activeDemo === 'form' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {demoFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <div className={`inline-flex p-3 rounded-lg ${feature.color} mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg p-1 bg-gray-100">
            {[
              { id: 'form', label: 'Smart Form', icon: Eye },
              { id: 'dashboard', label: 'Validation Dashboard', icon: Target },
              { id: 'analytics', label: 'Market Analytics', icon: BarChart3 }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDemo(tab.id as any)}
                  className={`
                    inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors
                    ${activeDemo === tab.id
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo Content */}
        {activeDemo === 'form' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                AI-Enhanced Pitch Creation
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Experience real-time validation as you create your pitch. Our AI analyzes 
                every field and provides instant feedback to help you craft the perfect pitch.
              </p>
            </div>
            
            <EnhancedPitchForm
              pitchId={demoData.pitchId}
              initialData={demoData}
              onSave={handleFormSave}
              onSubmit={handleFormSubmit}
            />
          </div>
        )}

        {activeDemo === 'dashboard' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Comprehensive Validation Dashboard
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Get detailed insights into your pitch performance with AI-powered analysis,
                market comparisons, and actionable recommendations.
              </p>
            </div>
            
            <ValidationDashboard
              pitchId={demoData.pitchId}
              onRecommendationClick={(rec) => {
              }}
              onAnalyzeClick={() => {
              }}
            />
          </div>
        )}

        {activeDemo === 'analytics' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Market Intelligence & Analytics
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Understand your competitive position with advanced analytics, market trends,
                and success prediction modeling.
              </p>
            </div>
            
            <AnalyticsShowcase />
          </div>
        )}
      </div>

      {/* Demo Footer */}
      <div className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-xl font-semibold mb-2">
            Ready to validate your pitch?
          </h3>
          <p className="text-gray-300 mb-4">
            Join thousands of creators using AI-powered validation to improve their pitches
          </p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Get Started Free
          </button>
        </div>
      </div>
    </div>
  );
};

// Analytics Showcase Component
const AnalyticsShowcase: React.FC = () => {
  const mockData = {
    overallScore: 78,
    categories: {
      story: { score: 85, benchmark: 65 },
      market: { score: 72, benchmark: 60 },
      finance: { score: 76, benchmark: 58 },
      team: { score: 68, benchmark: 62 },
      production: { score: 81, benchmark: 70 }
    },
    marketInsights: {
      genrePerformance: 'Above Average',
      competitiveIntensity: 'Moderate',
      timingScore: 82,
      successProbability: 74
    },
    recommendations: [
      {
        category: 'Team',
        priority: 'high',
        title: 'Strengthen Director Attachment',
        impact: 12,
        effort: 'medium'
      },
      {
        category: 'Market',
        priority: 'medium', 
        title: 'Refine Target Audience',
        impact: 8,
        effort: 'low'
      },
      {
        category: 'Story',
        priority: 'low',
        title: 'Enhance Character Arc',
        impact: 6,
        effort: 'high'
      }
    ]
  };

  return (
    <div className="space-y-8">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {mockData.overallScore}/100
          </div>
          <div className="text-gray-600">Overall Score</div>
          <div className="text-sm text-gray-500 mt-1">
            {ValidationUtils.getScoreLabel(mockData.overallScore)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {mockData.marketInsights.successProbability}%
          </div>
          <div className="text-gray-600">Success Probability</div>
          <div className="text-sm text-gray-500 mt-1">
            AI Prediction
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {mockData.recommendations.length}
          </div>
          <div className="text-gray-600">Recommendations</div>
          <div className="text-sm text-gray-500 mt-1">
            Ready to implement
          </div>
        </div>
      </div>

      {/* Category Performance */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Category Performance vs. Industry
        </h3>
        <div className="space-y-4">
          {Object.entries(mockData.categories).map(([category, data]) => (
            <div key={category} className="flex items-center space-x-4">
              <div className="w-20 text-sm font-medium text-gray-700 capitalize">
                {category}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Your Score: {data.score}</span>
                  <span>Industry Avg: {data.benchmark}</span>
                </div>
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${data.score}%` }}
                    />
                  </div>
                  <div 
                    className="absolute top-0 h-2 w-0.5 bg-gray-400"
                    style={{ left: `${data.benchmark}%` }}
                  />
                </div>
              </div>
              <div className={`text-sm font-semibold ${
                data.score > data.benchmark ? 'text-green-600' : 'text-red-600'
              }`}>
                {data.score > data.benchmark ? '+' : ''}{data.score - data.benchmark}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            Market Insights
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Genre Performance:</span>
              <span className="font-semibold text-green-600">
                {mockData.marketInsights.genrePerformance}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Competition Level:</span>
              <span className="font-semibold text-yellow-600">
                {mockData.marketInsights.competitiveIntensity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Market Timing:</span>
              <span className="font-semibold text-blue-600">
                {mockData.marketInsights.timingScore}/100
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
            Top Recommendations
          </h3>
          <div className="space-y-3">
            {mockData.recommendations.map((rec, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{rec.title}</span>
                  <span className="text-xs font-semibold text-blue-600">
                    +{rec.impact} pts
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <span className="capitalize">{rec.category}</span>
                  <span>•</span>
                  <span className={`
                    px-1 py-0.5 rounded text-xs
                    ${rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'}
                  `}>
                    {rec.priority} priority
                  </span>
                  <span>•</span>
                  <span>{rec.effort} effort</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PitchValidationDemo;