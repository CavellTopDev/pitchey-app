import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Eye, Heart, Share2, Bookmark, BookmarkCheck,
  Shield, MessageSquare, Clock, Calendar, User, Tag, 
  Film, DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Calculator, PieChart, Target,
  AlertCircle, CheckCircle, XCircle, Star, ChevronRight
} from 'lucide-react';
import { pitchAPI } from '../../lib/api';
import FormatDisplay from '../../components/FormatDisplay';

interface Pitch {
  id: string;
  userId: string;
  creatorName?: string;
  creatorCompany?: string;
  title: string;
  logline: string;
  genre: string;
  format: string;
  pages?: number;
  shortSynopsis: string;
  longSynopsis?: string;
  budget: string;
  estimatedBudget?: string;
  productionTimeline?: string;
  targetAudience?: string;
  comparableFilms?: string;
  status: 'draft' | 'published' | 'in_review' | 'optioned' | 'produced';
  visibility: 'public' | 'private' | 'nda_only';
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  hasSignedNDA?: boolean;
  ndaCount?: number;
  thumbnail?: string;
  pitchDeck?: string;
  script?: string;
  trailer?: string;
  marketPotential?: string;
  revenueProjections?: string;
  distributionStrategy?: string;
}

interface InvestmentNote {
  id: string;
  content: string;
  createdAt: string;
  isPrivate: boolean;
  category: 'strength' | 'concern' | 'question' | 'general';
}

interface ROICalculation {
  investmentAmount: number;
  projectedRevenue: number;
  roi: number;
  breakEvenPoint: string;
  paybackPeriod: string;
}

const InvestorPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'diligence' | 'notes'>('overview');
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [notes, setNotes] = useState<InvestmentNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<InvestmentNote['category']>('general');
  const [roiCalculation, setRoiCalculation] = useState<ROICalculation | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [diligenceChecklist, setDiligenceChecklist] = useState({
    scriptReview: false,
    budgetAnalysis: false,
    marketResearch: false,
    teamBackground: false,
    legalClearance: false,
    distributionPlan: false,
    competitiveAnalysis: false,
    audienceTesting: false
  });

  useEffect(() => {
    if (id) {
      fetchPitchData();
      loadInvestorData();
    }
  }, [id]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      const response = await pitchAPI.getById(parseInt(id!));
      setPitch(response);
      
      // Check if pitch requires NDA and user hasn't signed
      if (response.visibility === 'nda_only' && !response.hasSignedNDA) {
        setShowNDAModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch details');
    } finally {
      setLoading(false);
    }
  };

  const loadInvestorData = async () => {
    try {
      // Load saved notes
      const savedNotes = localStorage.getItem(`investor_notes_${id}`);
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }

      // Load watchlist status
      const watchlist = JSON.parse(localStorage.getItem('investor_watchlist') || '[]');
      setIsWatchlisted(watchlist.includes(id));

      // Load diligence checklist
      const savedChecklist = localStorage.getItem(`diligence_${id}`);
      if (savedChecklist) {
        setDiligenceChecklist(JSON.parse(savedChecklist));
      }
    } catch (error) {
      console.error('Failed to load investor data:', error);
    }
  };

  const handleWatchlistToggle = () => {
    const watchlist = JSON.parse(localStorage.getItem('investor_watchlist') || '[]');
    if (isWatchlisted) {
      const updated = watchlist.filter((item: string) => item !== id);
      localStorage.setItem('investor_watchlist', JSON.stringify(updated));
      setIsWatchlisted(false);
    } else {
      watchlist.push(id);
      localStorage.setItem('investor_watchlist', JSON.stringify(watchlist));
      setIsWatchlisted(true);
    }
  };

  const handleContactCreator = () => {
    navigate(`/investor/messages/new?recipient=${pitch?.userId}&pitch=${id}`);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const note: InvestmentNote = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString(),
      isPrivate: true,
      category: noteCategory
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    localStorage.setItem(`investor_notes_${id}`, JSON.stringify(updatedNotes));
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    localStorage.setItem(`investor_notes_${id}`, JSON.stringify(updatedNotes));
  };

  const calculateROI = () => {
    if (!investmentAmount || !pitch?.estimatedBudget) return;

    const investment = parseFloat(investmentAmount);
    const budget = parseFloat(pitch.estimatedBudget.replace(/[^0-9.]/g, ''));
    
    // Simplified ROI calculation (would be more complex in reality)
    const projectedRevenue = budget * 2.5; // Assuming 2.5x return
    const roi = ((projectedRevenue - investment) / investment) * 100;
    const breakEven = investment / (projectedRevenue / 36); // Assuming 36 month period
    
    setRoiCalculation({
      investmentAmount: investment,
      projectedRevenue,
      roi,
      breakEvenPoint: `${Math.ceil(breakEven)} months`,
      paybackPeriod: `${Math.ceil(breakEven * 1.5)} months`
    });
  };

  const handleDiligenceUpdate = (key: keyof typeof diligenceChecklist) => {
    const updated = { ...diligenceChecklist, [key]: !diligenceChecklist[key] };
    setDiligenceChecklist(updated);
    localStorage.setItem(`diligence_${id}`, JSON.stringify(updated));
  };

  const getDiligenceProgress = () => {
    const completed = Object.values(diligenceChecklist).filter(Boolean).length;
    const total = Object.keys(diligenceChecklist).length;
    return (completed / total) * 100;
  };

  const getCategoryIcon = (category: InvestmentNote['category']) => {
    switch (category) {
      case 'strength': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'concern': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'question': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
            <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
            <button
              onClick={() => navigate('/investor/browse')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Browse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/investor/browse')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Browse
            </button>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleWatchlistToggle}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  isWatchlisted 
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isWatchlisted ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                {isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}
              </button>
              
              <button
                onClick={handleContactCreator}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pitch Details */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-lg mb-6">
              <div className="flex border-b">
                {['overview', 'financials', 'diligence', 'notes'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'diligence' ? 'Due Diligence' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                {pitch.thumbnail && (
                  <img 
                    src={pitch.thumbnail} 
                    alt={pitch.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{pitch.title}</h1>
                
                {pitch.creatorName && (
                  <p className="text-gray-600 mb-4">
                    by {pitch.creatorName} 
                    {pitch.creatorCompany && ` • ${pitch.creatorCompany}`}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    <FormatDisplay 
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="compact"
                    />
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {pitch.budget}
                  </span>
                </div>

                <p className="text-xl text-gray-700 mb-6 italic">"{pitch.logline}"</p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Investment Opportunity</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>
                  
                  {pitch.marketPotential && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Potential</h3>
                      <p className="text-gray-700">{pitch.marketPotential}</p>
                    </div>
                  )}
                  
                  {pitch.comparableFilms && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Success Stories</h3>
                      <p className="text-gray-700">{pitch.comparableFilms}</p>
                    </div>
                  )}
                  
                  {pitch.targetAudience && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Target Market</h3>
                      <p className="text-gray-700">{pitch.targetAudience}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Analysis</h2>
                
                {/* Budget Breakdown */}
                <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Total Budget</span>
                      <p className="text-2xl font-bold text-gray-900">{pitch.budget}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Production Timeline</span>
                      <p className="text-2xl font-bold text-gray-900">{pitch.productionTimeline || 'TBD'}</p>
                    </div>
                  </div>
                </div>

                {/* ROI Calculator */}
                <div className="mb-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">ROI Calculator</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Investment Amount ($)
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={investmentAmount}
                          onChange={(e) => setInvestmentAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={calculateROI}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Calculate
                        </button>
                      </div>
                    </div>
                    
                    {roiCalculation && (
                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-gray-600">Projected ROI</span>
                            <p className="text-xl font-bold text-green-600">
                              {roiCalculation.roi.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Break-even</span>
                            <p className="text-xl font-bold text-blue-600">
                              {roiCalculation.breakEvenPoint}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Projected Revenue</span>
                            <p className="text-xl font-bold text-gray-900">
                              ${roiCalculation.projectedRevenue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Payback Period</span>
                            <p className="text-xl font-bold text-gray-900">
                              {roiCalculation.paybackPeriod}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Revenue Projections */}
                {pitch.revenueProjections && (
                  <div className="p-6 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Projections</h3>
                    <p className="text-gray-700">{pitch.revenueProjections}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'diligence' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Due Diligence Checklist</h2>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Progress:</span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${getDiligenceProgress()}%` }}
                      />
                    </div>
                    <span className="ml-2 text-sm font-semibold">{getDiligenceProgress().toFixed(0)}%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(diligenceChecklist).map(([key, value]) => (
                    <div key={key} className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handleDiligenceUpdate(key as keyof typeof diligenceChecklist)}
                        className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label className="ml-3 flex-1 text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {value && <CheckCircle className="h-5 w-5 text-green-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Private Notes</h2>
                
                {/* Add Note Form */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex space-x-2 mb-3">
                    {(['strength', 'concern', 'question', 'general'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm capitalize ${
                          noteCategory === cat
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a private note..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Note
                  </button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-2">
                            {getCategoryIcon(note.category)}
                            <div>
                              <p className="text-gray-700">{note.content}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No notes yet. Start by adding your thoughts above.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Investment Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <span>Express Interest</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <span>Schedule Meeting</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  <span>Request More Info</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Investment Metrics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Metrics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Target className="h-4 w-4 mr-2" />
                    Min. Investment
                  </span>
                  <span className="font-semibold">$50K</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Expected Return
                  </span>
                  <span className="font-semibold text-green-600">2-3x</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Timeline
                  </span>
                  <span className="font-semibold">24-36 mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    Other Investors
                  </span>
                  <span className="font-semibold">3</span>
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Market Risk</span>
                    <span className="text-sm font-medium">Medium</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '50%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Execution Risk</span>
                    <span className="text-sm font-medium">Low</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Competition</span>
                    <span className="text-sm font-medium">High</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Documents */}
            {(pitch.pitchDeck || pitch.script) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Documents</h3>
                <div className="space-y-2">
                  {pitch.pitchDeck && (
                    <a
                      href={pitch.pitchDeck}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Investment Deck
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {pitch.script && (
                    <a
                      href={pitch.script}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Full Script
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestorPitchView;