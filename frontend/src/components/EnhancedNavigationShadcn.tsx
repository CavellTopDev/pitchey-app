import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, LogOut, Plus, Eye, Coins, CreditCard, Bell,
  Users, Home, Film, Search, Shield, BarChart3, FileText,
  Settings, UserCircle, ChevronDown, Briefcase, TrendingUp,
  Calendar, MessageSquare, Star, Globe, PlayCircle, Upload,
  FolderOpen, UserPlus, Layers, Target, Activity, Award,
  DollarSign, PieChart, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { NDANotificationBadge } from './NDANotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useState } from 'react';

interface EnhancedNavigationShadcnProps {
  user: any;
  userType: 'creator' | 'investor' | 'production';
  onLogout: () => void;
}

export function EnhancedNavigationShadcn({ 
  user, 
  userType, 
  onLogout
}: EnhancedNavigationShadcnProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPortalPrefix = () => {
    switch (userType) {
      case 'creator': return '/creator';
      case 'investor': return '/investor';
      case 'production': return '/production';
      default: return '';
    }
  };

  const portalPrefix = getPortalPrefix();

  const dashboardMenuItems = {
    creator: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Metrics', href: `${portalPrefix}/metrics`, icon: PieChart },
      { label: 'Activity', href: `${portalPrefix}/activity`, icon: Activity },
    ],
    investor: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Portfolio', href: `${portalPrefix}/portfolio`, icon: Briefcase },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Reports', href: `${portalPrefix}/reports`, icon: FileText },
    ],
    production: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Pipeline', href: `${portalPrefix}/pipeline`, icon: Layers },
      { label: 'Activity', href: `${portalPrefix}/activity`, icon: Activity },
    ]
  };

  const browseMenuItems = [
    { label: 'All Pitches', href: '/marketplace', icon: Globe },
    { label: 'By Genre', href: '/browse/genres', icon: Film },
    { label: 'Trending', href: '/browse/trending', icon: TrendingUp },
    { label: 'New Releases', href: '/browse/new', icon: Star },
    { label: 'Top Rated', href: '/browse/top-rated', icon: Award },
    { label: 'Coming Soon', href: '/coming-soon', icon: Clock },
  ];

  const projectMenuItems = {
    creator: [
      { label: 'My Pitches', href: `${portalPrefix}/pitches`, icon: Film },
      { label: 'Create New', href: `${portalPrefix}/pitch/new`, icon: Plus },
      { label: 'Analytics', href: `${portalPrefix}/pitch-analytics`, icon: BarChart3 },
      { label: 'NDAs', href: `${portalPrefix}/ndas`, icon: Shield },
    ],
    investor: [
      { label: 'Invested Projects', href: `${portalPrefix}/investments`, icon: DollarSign },
      { label: 'Saved Pitches', href: `${portalPrefix}/saved`, icon: Star },
      { label: 'NDA Requests', href: `${portalPrefix}/ndas`, icon: Shield },
      { label: 'Watchlist', href: `${portalPrefix}/watchlist`, icon: Eye },
    ],
    production: [
      { label: 'Active Projects', href: `${portalPrefix}/projects`, icon: Briefcase },
      { label: 'Submissions', href: `${portalPrefix}/submissions`, icon: Upload },
      { label: 'In Development', href: `${portalPrefix}/development`, icon: Target },
      { label: 'Completed', href: `${portalPrefix}/completed`, icon: CheckCircle },
    ]
  };

  const teamMenuItems = [
    { label: 'Team Overview', href: '/team', icon: Users },
    { label: 'Members', href: '/team/members', icon: UserPlus },
    { label: 'Roles', href: '/team/roles', icon: Shield },
    { label: 'Invitations', href: '/team/invite', icon: MessageSquare },
  ];

  const searchMenuItems = [
    { label: 'Search All', href: '/search', icon: Search },
    { label: 'Advanced Search', href: '/search/advanced', icon: Target },
    { label: 'Search by Genre', href: '/search/genre', icon: Film },
    { label: 'Search by Format', href: '/search/format', icon: PlayCircle },
  ];

  const settingsMenuItems = [
    { label: 'Profile', href: `${portalPrefix}/settings/profile`, icon: UserCircle },
    { label: 'Notifications', href: '/settings/notifications', icon: Bell },
    { label: 'Privacy', href: '/settings/privacy', icon: Shield },
    { label: 'Billing', href: `${portalPrefix}/billing`, icon: CreditCard },
  ];

  const navigationItemStyle = "flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer";
  const activeItemStyle = "flex items-center gap-2 px-3 py-2 text-purple-600 bg-purple-50 rounded-lg";

  return (
    <header className="bg-white border-b">
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-purple-600">Pitchey</span>
            </Link>

            {/* Center Navigation with Dropdowns */}
            <nav className="flex items-center gap-1">
              {/* Dashboard Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Dashboard</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {dashboardMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Browse Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Globe className="w-4 h-4" />
                  <span>Browse</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Browse Content</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {browseMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Projects/Pitches Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Briefcase className="w-4 h-4" />
                  <span>{userType === 'creator' ? 'Pitches' : 'Projects'}</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>
                    {userType === 'creator' ? 'My Pitches' : 'Projects'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {projectMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Team Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Users className="w-4 h-4" />
                  <span>Team</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Team Management</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {teamMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Search Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {searchMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {settingsMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Credits (Creator only) */}
              {userType === 'creator' && (
                <button 
                  onClick={() => navigate(`${portalPrefix}/billing`)}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition"
                >
                  <Coins className="w-4 h-4" />
                  <span>0 Credits</span>
                </button>
              )}

              {/* NDA Notifications */}
              <NDANotificationBadge />

              {/* General Notifications */}
              <NotificationBell />

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div>
                      <div className="font-medium">{user?.name || 'User'}</div>
                      <div className="text-sm text-gray-500">{user?.email || ''}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`${portalPrefix}/profile`)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`${portalPrefix}/settings`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={onLogout}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 h-16">
          <Link to="/" className="text-xl font-bold text-purple-600">Pitchey</Link>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="px-4 pb-4 space-y-2">
            <Link
              to={`${portalPrefix}/dashboard`}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="w-5 h-5" />
              Dashboard
            </Link>
            <Link
              to="/marketplace"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Globe className="w-5 h-5" />
              Browse
            </Link>
            <Link
              to={`${portalPrefix}/pitches`}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Film className="w-5 h-5" />
              {userType === 'creator' ? 'My Pitches' : 'Projects'}
            </Link>
            <button
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg w-full text-left"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

export default EnhancedNavigationShadcn;