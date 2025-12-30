import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, PlayCircle, Clock, MapPin, TrendingUp, DollarSign, Calendar, Users, MoreVertical, Eye, Edit, AlertCircle, Camera, Mic } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useAuthStore } from '../../store/authStore';
import { config } from '../../config';

interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'pre-production' | 'principal-photography' | 'additional-photography' | 'pickups' | 'wrap-pending';
  budget: number;
  startDate: string;
  expectedWrapDate: string;
  progress: number;
  team: number;
  director?: string;
  producer?: string;
  cinematographer?: string;
  location?: string;
  daysFilmed: number;
  totalShootingDays: number;
  currentPhase: 'setup' | 'filming' | 'dailies' | 'review';
  dailyProgress: number;
  budget_spent: number;
  weather_risk?: string;
  crew_status: 'full' | 'partial' | 'critical';
}

const statusColors = {
  'pre-production': 'bg-blue-100 text-blue-800 border-blue-200',
  'principal-photography': 'bg-green-100 text-green-800 border-green-200',
  'additional-photography': 'bg-orange-100 text-orange-800 border-orange-200',
  'pickups': 'bg-purple-100 text-purple-800 border-purple-200',
  'wrap-pending': 'bg-indigo-100 text-indigo-800 border-indigo-200'
};

const phaseColors = {
  setup: 'bg-gray-100 text-gray-700',
  filming: 'bg-red-100 text-red-700',
  dailies: 'bg-yellow-100 text-yellow-700',
  review: 'bg-green-100 text-green-700'
};

const crewStatusColors = {
  full: 'text-green-600',
  partial: 'text-yellow-600',
  critical: 'text-red-600'
};

export default function ProductionProjectsActive() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  useEffect(() => {
    fetchActiveProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, statusFilter, phaseFilter, locationFilter]);

  const fetchActiveProjects = async () => {
    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/production`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`Failed to fetch active projects: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching active projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load active projects');
      // Fallback to demo data for development
      setProjects([
        {
          id: '1',
          title: 'The Last Symphony',
          genre: 'Drama',
          status: 'principal-photography',
          budget: 2500000,
          startDate: '2024-10-01',
          expectedWrapDate: '2024-12-15',
          progress: 65,
          team: 45,
          director: 'Sarah Johnson',
          producer: 'Michael Chen',
          cinematographer: 'Alex Rivera',
          location: 'Prague, Czech Republic',
          daysFilmed: 42,
          totalShootingDays: 65,
          currentPhase: 'filming',
          dailyProgress: 85,
          budget_spent: 1625000,
          weather_risk: 'low',
          crew_status: 'full'
        },
        {
          id: '2',
          title: 'Urban Legends',
          genre: 'Horror',
          status: 'additional-photography',
          budget: 1800000,
          startDate: '2024-09-15',
          expectedWrapDate: '2024-11-30',
          progress: 92,
          team: 32,
          director: 'James Park',
          producer: 'Lisa Wong',
          cinematographer: 'David Miller',
          location: 'Vancouver, Canada',
          daysFilmed: 55,
          totalShootingDays: 60,
          currentPhase: 'review',
          dailyProgress: 95,
          budget_spent: 1656000,
          crew_status: 'partial'
        },
        {
          id: '3',
          title: 'Space Odyssey',
          genre: 'Sci-Fi',
          status: 'pre-production',
          budget: 8500000,
          startDate: '2024-12-01',
          expectedWrapDate: '2025-03-15',
          progress: 15,
          team: 78,
          director: 'Maria Garcia',
          producer: 'Tom Wilson',
          location: 'Los Angeles, CA',
          daysFilmed: 0,
          totalShootingDays: 85,
          currentPhase: 'setup',
          dailyProgress: 0,
          budget_spent: 1275000,
          weather_risk: 'medium',
          crew_status: 'critical'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = projects.filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesPhase = phaseFilter === 'all' || project.currentPhase === phaseFilter;
      const matchesLocation = locationFilter === 'all' || project.location?.toLowerCase().includes(locationFilter.toLowerCase());

      return matchesStatus && matchesPhase && matchesLocation;
    });

    setFilteredProjects(filtered);
  };

  const stats = {
    total: projects.length,
    filming: projects.filter(p => p.status === 'principal-photography').length,
    preProduction: projects.filter(p => p.status === 'pre-production').length,
    pickups: projects.filter(p => p.status === 'pickups').length,
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: projects.reduce((sum, p) => sum + p.budget_spent, 0),
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
    crewIssues: projects.filter(p => p.crew_status === 'critical').length
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'from-green-500 to-emerald-500';
    if (progress >= 60) return 'from-blue-500 to-cyan-500';
    if (progress >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getBudgetUsageColor = (spent: number, total: number) => {
    const percentage = (spent / total) * 100;
    if (percentage > 90) return 'text-red-600';
    if (percentage > 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const uniqueLocations = [...new Set(projects.map(p => p.location).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Active Productions"
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Productions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Camera className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Currently Filming</p>
                <p className="text-2xl font-bold text-green-600">{stats.filming}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Budget Spent</p>
                <p className="text-2xl font-bold text-gray-900">${(stats.totalSpent / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-500">of ${(stats.totalBudget / 1000000).toFixed(1)}M</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Crew Issues</p>
                <p className={`text-2xl font-bold ${stats.crewIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.crewIssues}
                </p>
              </div>
              <AlertCircle className={`w-8 h-8 ${stats.crewIssues > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Status</option>
              <option value="pre-production">Pre-Production</option>
              <option value="principal-photography">Principal Photography</option>
              <option value="additional-photography">Additional Photography</option>
              <option value="pickups">Pickups</option>
              <option value="wrap-pending">Wrap Pending</option>
            </select>

            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Phases</option>
              <option value="setup">Setup</option>
              <option value="filming">Filming</option>
              <option value="dailies">Dailies</option>
              <option value="review">Review</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : error && projects.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                      <p className="text-sm text-gray-600">{project.genre}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <p className="text-sm text-gray-500">{project.location}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status]}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${phaseColors[project.currentPhase]}`}>
                        {project.currentPhase}
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Shooting Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Shooting Progress</span>
                      <span className="font-medium">{project.daysFilmed}/{project.totalShootingDays} days</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div 
                        className={`bg-gradient-to-r ${getProgressColor(project.progress)} h-2.5 rounded-full transition-all duration-300`}
                        style={{ width: `${(project.daysFilmed / project.totalShootingDays) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Overall Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Overall Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`bg-gradient-to-r ${getProgressColor(project.progress)} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget</p>
                      <p className="font-semibold">${(project.budget / 1000000).toFixed(1)}M</p>
                      <p className={`text-xs ${getBudgetUsageColor(project.budget_spent, project.budget)}`}>
                        {((project.budget_spent / project.budget) * 100).toFixed(1)}% used
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Team Size</p>
                      <p className="font-semibold">{project.team} members</p>
                      <p className={`text-xs ${crewStatusColors[project.crew_status]}`}>
                        Crew: {project.crew_status}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Expected Wrap</p>
                      <p className="font-semibold">{new Date(project.expectedWrapDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Daily Progress</p>
                      <p className="font-semibold">{project.dailyProgress}%</p>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="border-t pt-4 mb-4">
                    {project.director && (
                      <p className="text-sm text-gray-600 mb-1">
                        Director: <span className="font-medium text-gray-900">{project.director}</span>
                      </p>
                    )}
                    {project.producer && (
                      <p className="text-sm text-gray-600 mb-1">
                        Producer: <span className="font-medium text-gray-900">{project.producer}</span>
                      </p>
                    )}
                    {project.cinematographer && (
                      <p className="text-sm text-gray-600">
                        DP: <span className="font-medium text-gray-900">{project.cinematographer}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <Mic className="w-4 h-4 mr-1" />
                      Dailies
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && !loading && (
          <div className="text-center py-12">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No active productions found</p>
            <p className="text-sm text-gray-400">
              Projects will appear here when they enter production phase
            </p>
          </div>
        )}
      </div>
    </div>
  );
}