import { AuthState } from "@/middleware/auth.middleware.ts";

export function Navigation({ user }: { user?: AuthState['user'] }) {
  return (
    <nav class="bg-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <a href="/" class="flex-shrink-0 flex items-center">
              <span class="text-2xl font-bold text-purple-600">Pitchey</span>
            </a>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <a href="/pitches" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                Browse Pitches
              </a>
              {user?.userType === 'creator' && (
                <a href="/upload" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                  Upload Pitch
                </a>
              )}
              <a href="/how-it-works" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                How It Works
              </a>
            </div>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <>
                <a href="/dashboard" class="px-3 py-2 text-sm font-medium text-gray-700">
                  Dashboard
                </a>
                <a href="/profile" class="ml-4">
                  <img
                    class="h-8 w-8 rounded-full"
                    src={user.profileImage || '/default-avatar.png'}
                    alt={user.username}
                  />
                </a>
                <form method="POST" action="/logout">
                  <button type="submit" class="ml-4 px-3 py-2 text-sm font-medium text-gray-700">
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href="/login" class="px-3 py-2 text-sm font-medium text-gray-700">
                  Log In
                </a>
                <a href="/register" class="ml-4 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">
                  Sign Up
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}