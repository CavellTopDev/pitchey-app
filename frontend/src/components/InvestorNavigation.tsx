import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Globe, Briefcase, Users, Search, Settings, Bell, 
  ChevronDown, CircleUser, TrendingUp, Star, Award, FileText,
  MessageSquare, Calendar, DollarSign, Eye, Activity, FolderOpen,
  Target, LogOut, User, CreditCard, HelpCircle, BarChart3,
  PieChart, Shield, Bookmark, HandshakeIcon, TrendingDown,
  Wallet, Building2, Filter, ArrowUpRight, History, LineChart
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface InvestorNavigationProps {
  user: any;
  onLogout: () => void;
}

export function InvestorNavigation({ user, onLogout }: InvestorNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = React.useState(3);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2" data-discover="true">
        <span className="text-2xl font-bold text-green-600">Pitchey</span>
      </Link>

      {/* Main Navigation */}
      <nav className="flex items-center gap-1">
        {/* Dashboard Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Dashboard</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/dashboard')}>
              <Home className="w-4 h-4 mr-2" />
              Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/portfolio')}>
              <Briefcase className="w-4 h-4 mr-2" />
              Portfolio Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Investment Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/reports')}>
              <FileText className="w-4 h-4 mr-2" />
              Performance Reports
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/activity')}>
              <Activity className="w-4 h-4 mr-2" />
              Recent Activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Browse Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>Browse</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/browse')}>
              <Globe className="w-4 h-4 mr-2" />
              All Opportunities
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/browse?tab=trending')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/browse?tab=new')}>
              <Star className="w-4 h-4 mr-2" />
              New Submissions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/browse?tab=featured')}>
              <Award className="w-4 h-4 mr-2" />
              Featured Deals
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/saved')}>
              <Bookmark className="w-4 h-4 mr-2" />
              Saved Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/watchlist')}>
              <Eye className="w-4 h-4 mr-2" />
              Watchlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Investments Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <DollarSign className="w-4 h-4" aria-hidden="true" />
            <span>Investments</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/investments')}>
              <Briefcase className="w-4 h-4 mr-2" />
              Active Investments
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/portfolio/performance')}>
              <LineChart className="w-4 h-4 mr-2" />
              Portfolio Performance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/returns')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Returns & ROI
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/opportunities')}>
              <ArrowUpRight className="w-4 h-4 mr-2" />
              New Opportunities
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/transactions')}>
              <History className="w-4 h-4 mr-2" />
              Transaction History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/documents')}>
              <FileText className="w-4 h-4 mr-2" />
              Investment Documents
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Due Diligence Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Shield className="w-4 h-4" aria-hidden="true" />
            <span>Due Diligence</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/ndas')}>
              <Shield className="w-4 h-4 mr-2" />
              NDA Management
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/ndas/pending')}>
              <Clock className="w-4 h-4 mr-2" />
              Pending NDAs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/ndas/signed')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Signed Agreements
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/evaluations')}>
              <FileText className="w-4 h-4 mr-2" />
              Project Evaluations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/risk-assessment')}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Risk Assessments
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Network Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Network</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/creators')}>
              <Users className="w-4 h-4 mr-2" />
              Connected Creators
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/following')}>
              <Star className="w-4 h-4 mr-2" />
              Following
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/co-investors')}>
              <HandshakeIcon className="w-4 h-4 mr-2" />
              Co-Investors
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/companies')}>
              <Building2 className="w-4 h-4 mr-2" />
              Production Companies
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/messages')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/meetings')}>
              <Calendar className="w-4 h-4 mr-2" />
              Scheduled Meetings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Search</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/search')}>
              <Search className="w-4 h-4 mr-2" />
              Search Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/search/creators')}>
              <Users className="w-4 h-4 mr-2" />
              Find Creators
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/search/genres')}>
              <Film className="w-4 h-4 mr-2" />
              Browse by Genre
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/search/advanced')}>
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/search/saved')}>
              <Bookmark className="w-4 h-4 mr-2" />
              Saved Searches
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span>Settings</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              General Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/profile')}>
              <User className="w-4 h-4 mr-2" />
              Investment Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/preferences')}>
              <Target className="w-4 h-4 mr-2" />
              Investment Preferences
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/wallet')}>
              <Wallet className="w-4 h-4 mr-2" />
              Wallet & Banking
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/notifications')}>
              <Bell className="w-4 h-4 mr-2" />
              Alert Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/compliance')}>
              <Shield className="w-4 h-4 mr-2" />
              Compliance & Legal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button 
            className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => handleNavigation('/investor/notifications')}
          >
            <Bell className="w-6 h-6" aria-hidden="true" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CircleUser className="w-5 h-5 text-green-600" aria-hidden="true" />
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user?.firstName || 'Investor'} {user?.lastName || ''}</span>
                <span className="text-sm text-gray-500">{user?.email}</span>
                <span className="text-xs text-green-600 mt-1">Accredited Investor</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/profile')}>
                <User className="w-4 h-4 mr-2" />
                Investment Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/dashboard')}>
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/portfolio')}>
                <Briefcase className="w-4 h-4 mr-2" />
                Portfolio
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/wallet')}>
              <Wallet className="w-4 h-4 mr-2" />
              Wallet & Funds
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/transactions')}>
              <History className="w-4 h-4 mr-2" />
              Transactions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Add missing imports
import { AlertTriangle, CheckCircle, Clock, Film } from 'lucide-react';