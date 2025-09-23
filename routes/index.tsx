import { define } from "../utils.ts";

export default define.page(function HomePage() {
  return (
    <div class="min-h-screen bg-gray-50">
      {/* Hero Section */}
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
                <a href="/how-it-works" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                  How It Works
                </a>
              </div>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:items-center">
              <a href="/login" class="px-3 py-2 text-sm font-medium text-gray-700">
                Log In
              </a>
              <a href="/register" class="ml-4 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">
                Sign Up
              </a>
            </div>
          </div>
        </div>
      </nav>
      
      <div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div class="text-center">
            <h1 class="text-4xl md:text-6xl font-bold mb-6">
              Where Great Ideas Meet Investment
            </h1>
            <p class="text-xl md:text-2xl mb-8">
              Connect creators, production companies, and investors through secure pitch sharing
            </p>
            <div class="space-x-4">
              <a href="/register" class="inline-block px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100">
                Get Started
              </a>
              <a href="/how-it-works" class="inline-block px-8 py-3 bg-purple-700 text-white rounded-lg font-semibold hover:bg-purple-800">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 class="text-3xl font-bold text-gray-900 mb-8">Platform Features</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-xl font-semibold mb-2">Secure Pitches</h3>
            <p class="text-gray-600">Upload and share your creative projects with built-in NDA protection.</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-xl font-semibold mb-2">Connect Industry</h3>
            <p class="text-gray-600">Reach production companies and investors looking for the next big project.</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-xl font-semibold mb-2">Track Analytics</h3>
            <p class="text-gray-600">Monitor views, engagement, and interest in your pitches.</p>
          </div>
        </div>
      </div>
      
      {/* How It Works */}
      <div class="bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 class="text-3xl font-bold text-center text-gray-900 mb-12">How Pitchey Works</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="text-center">
              <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl">📝</span>
              </div>
              <h3 class="text-xl font-semibold mb-2">Upload Your Pitch</h3>
              <p class="text-gray-600">
                Creators upload their scripts, treatments, and pitch decks securely
              </p>
            </div>
            <div class="text-center">
              <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl">🔒</span>
              </div>
              <h3 class="text-xl font-semibold mb-2">NDA Protection</h3>
              <p class="text-gray-600">
                Automatic NDA signing protects your intellectual property
              </p>
            </div>
            <div class="text-center">
              <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl">🤝</span>
              </div>
              <h3 class="text-xl font-semibold mb-2">Connect & Deal</h3>
              <p class="text-gray-600">
                Production companies and investors connect with creators
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div class="bg-gray-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 class="text-3xl font-bold text-gray-900 mb-4">Ready to pitch your next big idea?</h2>
          <p class="text-xl text-gray-600 mb-8">Join thousands of creators already using Pitchey</p>
          <a href="/register" class="inline-block px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
            Start Free Trial
          </a>
        </div>
      </div>
      
      {/* Footer */}
      <footer class="bg-gray-900 text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 class="text-lg font-semibold mb-4">Pitchey</h3>
              <p class="text-gray-400">Where ideas meet investment</p>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-4">Platform</h4>
              <ul class="space-y-2 text-gray-400">
                <li><a href="/how-it-works" class="hover:text-white">How it Works</a></li>
                <li><a href="/pricing" class="hover:text-white">Pricing</a></li>
                <li><a href="/features" class="hover:text-white">Features</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-4">Company</h4>
              <ul class="space-y-2 text-gray-400">
                <li><a href="/about" class="hover:text-white">About</a></li>
                <li><a href="/contact" class="hover:text-white">Contact</a></li>
                <li><a href="/careers" class="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-4">Legal</h4>
              <ul class="space-y-2 text-gray-400">
                <li><a href="/terms" class="hover:text-white">Terms</a></li>
                <li><a href="/privacy" class="hover:text-white">Privacy</a></li>
                <li><a href="/nda" class="hover:text-white">NDA Policy</a></li>
              </ul>
            </div>
          </div>
          <div class="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>© 2025 Pitchey. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
});