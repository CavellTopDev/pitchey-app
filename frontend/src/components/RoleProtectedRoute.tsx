import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { AlertTriangle, Lock } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: ('creator' | 'investor' | 'production')[];
  fallbackPath?: string;
  showErrorPage?: boolean;
}

export default function RoleProtectedRoute({ 
  children, 
  allowedRoles, 
  fallbackPath,
  showErrorPage = true 
}: RoleProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useBetterAuthStore();
  const userType = localStorage.getItem('userType') as 'creator' | 'investor' | 'production' | null;

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated || !user) {
      navigate('/portals');
      return;
    }

    // If user type doesn't match allowed roles, handle access denial
    if (!userType || !allowedRoles.includes(userType)) {
      if (fallbackPath) {
        navigate(fallbackPath);
      }
    }
  }, [isAuthenticated, user, userType, allowedRoles, fallbackPath, navigate]);

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  // If user doesn't have required role
  if (!userType || !allowedRoles.includes(userType)) {
    if (showErrorPage) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <Lock className="h-6 w-6 text-red-600" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Access Denied
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                  You don't have permission to access this page.
                </p>
                <div className="mt-4 p-4 bg-yellow-50 rounded-md">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        This page is restricted to{' '}
                        <span className="font-medium">
                          {allowedRoles.join(', ')}
                        </span>{' '}
                        accounts. You are currently logged in as{' '}
                        <span className="font-medium">{userType}</span>.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => navigate(`/${userType}/dashboard`)}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Go to My Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/browse')}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Browse Pitches
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // User has required role, render children
  return <>{children}</>;
}