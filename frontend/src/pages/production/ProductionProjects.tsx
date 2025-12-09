import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Clock, CheckCircle, AlertCircle, TrendingUp, DollarSign, Calendar, Users, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useAuthStore } from '../../store/authStore';

interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'development' | 'production' | 'post-production' | 'completed';
  budget: number;
  startDate: string;
  endDate?: string;
  progress: number;
  team: number;
  director?: string;
  producer?: string;
  risk: 'low' | 'medium' | 'high';
}

const statusColors = {
  development: 'bg-blue-100 text-blue-800',
  production: 'bg-purple-100 text-purple-800',
  'post-production': 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800'
};

const riskColors = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600'
};

export default function ProductionProjects() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading projects
    setTimeout(() => {
      setProjects([
        {
          id: '1',
          title: 'The Last Symphony',
          genre: 'Drama',
          status: 'production',
          budget: 2500000,
          startDate: '2024-10-01',
          progress: 65,
          team: 45,
          director: 'Sarah Johnson',
          producer: 'Michael Chen',
          risk: 'low'
        },
        {
          id: '2',
          title: 'Digital Rebellion',
          genre: 'Sci-Fi',
          status: 'post-production',
          budget: 5000000,
          startDate: '2024-08-15',
          progress: 85,
          team: 78,
          director: 'Alex Rivera',
          producer: 'Emma Watson',
          risk: 'medium'
        },
        {
          id: '3',
          title: 'Ocean\'s Secret',
          genre: 'Thriller',
          status: 'development',
          budget: 3200000,
          startDate: '2024-12-01',
          progress: 25,
          team: 12,
          director: 'James Park',
          risk: 'low'
        },
        {
          id: '4',
          title: 'Time Traveler\'s Dilemma',
          genre: 'Sci-Fi',
          status: 'development',
          budget: 8000000,
          startDate: '2025-01-15',
          progress: 10,
          team: 8,
          risk: 'high'
        },
        {
          id: '5',
          title: 'The Forgotten City',
          genre: 'Mystery',
          status: 'completed',
          budget: 1800000,
          startDate: '2024-03-01',
          endDate: '2024-11-30',
          progress: 100,
          team: 35,
          director: 'Maria Garcia',
          producer: 'David Lee',
          risk: 'low'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredProjects = filter === 'all' 
    ? projects 
    : projects.filter(p => p.status === filter);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status !== 'completed').length,
    budget: projects.reduce((sum, p) => sum + p.budget, 0),
    teamSize: projects.reduce((sum, p) => sum + p.team, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Production Projects"
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Film className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(stats.budget / 1000000).toFixed(1)}M
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">{stats.teamSize}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px">
              {['all', 'development', 'production', 'post-production', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`
                    py-3 px-6 text-sm font-medium capitalize border-b-2 transition-colors
                    ${filter === status
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {status.replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                      <p className="text-sm text-gray-600">{project.genre}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget</p>
                      <p className="font-semibold">${(project.budget / 1000000).toFixed(1)}M</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Team Size</p>
                      <p className="font-semibold">{project.team} members</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Start Date</p>
                      <p className="font-semibold">{new Date(project.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Risk Level</p>
                      <p className={`font-semibold ${riskColors[project.risk]}`}>
                        {project.risk.charAt(0).toUpperCase() + project.risk.slice(1)}
                      </p>
                    </div>
                  </div>

                  {/* Team Info */}
                  {(project.director || project.producer) && (
                    <div className="border-t pt-4 mb-4">
                      {project.director && (
                        <p className="text-sm text-gray-600">
                          Director: <span className="font-medium text-gray-900">{project.director}</span>
                        </p>
                      )}
                      {project.producer && (
                        <p className="text-sm text-gray-600">
                          Producer: <span className="font-medium text-gray-900">{project.producer}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && !loading && (
          <div className="text-center py-12">
            <Film className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No projects found</p>
          </div>
        )}
      </div>
    </div>
  );
}