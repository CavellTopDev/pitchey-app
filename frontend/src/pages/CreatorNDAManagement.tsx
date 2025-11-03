import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ComprehensiveNDAManagement from '../components/NDA/ComprehensiveNDAManagement';
import BackButton from '../components/BackButton';

export default function CreatorNDAManagement() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
                <p className="text-sm text-gray-600">Comprehensive NDA workflow and analytics</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <ComprehensiveNDAManagement 
        userType="creator" 
        userId={user?.id || 0}
      />
    </div>
  );
}