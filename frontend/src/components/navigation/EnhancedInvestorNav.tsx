import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, BarChart3, Activity, LineChart, Briefcase, Clock, CheckCircle,
  FolderOpen, Globe, Bookmark, Eye, DollarSign, FileText, PieChart,
  TrendingUp, AlertTriangle, Users, Building2, UserCheck, Wallet,
  CreditCard, Settings, Shield, Receipt, Calculator, FileCheck
} from 'lucide-react';
import { INVESTOR_ROUTES } from '../../config/navigation.routes';

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number | string;
  isNew?: boolean;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const investorNavigationSections: NavigationSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', path: INVESTOR_ROUTES.dashboard, icon: Home },
      { label: 'Portfolio', path: INVESTOR_ROUTES.portfolio, icon: Briefcase, isNew: true },
      { label: 'Analytics', path: INVESTOR_ROUTES.analytics, icon: BarChart3, isNew: true },
      { label: 'Activity', path: INVESTOR_ROUTES.activity, icon: Activity, isNew: true },
      { label: 'Performance', path: INVESTOR_ROUTES.performance, icon: LineChart, isNew: true },
    ],
  },
  {
    title: 'Investments',
    items: [
      { label: 'Active Deals', path: INVESTOR_ROUTES.deals, icon: Briefcase, isNew: true },
      { label: 'Pending Deals', path: INVESTOR_ROUTES.pendingDeals, icon: Clock, isNew: true },
      { label: 'All Investments', path: INVESTOR_ROUTES.allInvestments, icon: FolderOpen, isNew: true },
      { label: 'Completed Projects', path: INVESTOR_ROUTES.completedProjects, icon: CheckCircle, isNew: true },
      { label: 'ROI Analysis', path: INVESTOR_ROUTES.roiAnalysis, icon: PieChart, isNew: true },
    ],
  },
  {
    title: 'Discover',
    items: [
      { label: 'Browse All', path: INVESTOR_ROUTES.browse, icon: Globe },
      { label: 'Discover', path: INVESTOR_ROUTES.discover, icon: TrendingUp },
      { label: 'Saved', path: INVESTOR_ROUTES.saved, icon: Bookmark, isNew: true },
      { label: 'Watchlist', path: INVESTOR_ROUTES.watchlist, icon: Eye, isNew: true },
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Overview', path: INVESTOR_ROUTES.financialOverview, icon: DollarSign, isNew: true },
      { label: 'Transactions', path: INVESTOR_ROUTES.transactionHistory, icon: Receipt, isNew: true },
      { label: 'Budget', path: INVESTOR_ROUTES.budgetAllocation, icon: Calculator, isNew: true },
      { label: 'Reports', path: INVESTOR_ROUTES.reports, icon: FileText, isNew: true },
      { label: 'Tax Documents', path: INVESTOR_ROUTES.taxDocuments, icon: FileCheck, isNew: true },
    ],
  },
  {
    title: 'Market',
    items: [
      { label: 'Market Trends', path: INVESTOR_ROUTES.marketTrends, icon: TrendingUp, isNew: true },
      { label: 'Risk Assessment', path: INVESTOR_ROUTES.riskAssessment, icon: AlertTriangle, isNew: true },
    ],
  },
  {
    title: 'Network',
    items: [
      { label: 'My Network', path: INVESTOR_ROUTES.network, icon: Users, isNew: true },
      { label: 'Co-Investors', path: INVESTOR_ROUTES.coInvestors, icon: UserCheck, isNew: true },
      { label: 'Creators', path: INVESTOR_ROUTES.creators, icon: Users, isNew: true },
      { label: 'Production Companies', path: INVESTOR_ROUTES.productionCompanies, icon: Building2, isNew: true },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Wallet', path: INVESTOR_ROUTES.wallet, icon: Wallet, isNew: true },
      { label: 'Payment Methods', path: INVESTOR_ROUTES.paymentMethods, icon: CreditCard, isNew: true },
      { label: 'NDA Requests', path: INVESTOR_ROUTES.ndaRequests, icon: Shield },
      { label: 'Settings', path: INVESTOR_ROUTES.settings, icon: Settings },
    ],
  },
];

export function EnhancedInvestorNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold text-green-600 mb-6">Investor Portal</h2>
        
        {investorNavigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                      transition-colors duration-200
                      ${isActive 
                        ? 'bg-green-50 text-green-600 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.isNew && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        NEW
                      </span>
                    )}
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}