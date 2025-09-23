import { useState } from 'react';
import { 
  Coins, 
  Zap, 
  Star, 
  Crown, 
  TrendingUp,
  Upload,
  MessageSquare,
  Eye,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { paymentsAPI } from '../lib/apiServices';

interface CreditPurchaseProps {
  credits: any;
  onRefresh: () => void;
}

const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 9.99,
    value: '$0.10 per credit',
    icon: Zap,
    description: 'Perfect for getting started',
    popular: false,
    bonus: 0
  },
  {
    id: 'growth',
    name: 'Growth Pack',
    credits: 500,
    price: 39.99,
    value: '$0.08 per credit',
    icon: TrendingUp,
    description: 'Great for growing creators',
    popular: true,
    bonus: 50 // Bonus credits
  },
  {
    id: 'professional',
    name: 'Professional Pack',
    credits: 1000,
    price: 69.99,
    value: '$0.07 per credit',
    icon: Star,
    description: 'Best value for professionals',
    popular: false,
    bonus: 150
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 2500,
    price: 149.99,
    value: '$0.06 per credit',
    icon: Crown,
    description: 'Maximum value for power users',
    popular: false,
    bonus: 500
  }
];

const CREDIT_USAGE = [
  {
    action: 'Upload Content',
    cost: 5,
    icon: Upload,
    description: 'Upload pitch materials, trailers, or documents'
  },
  {
    action: 'Send Message',
    cost: 1,
    icon: MessageSquare,
    description: 'Send messages to potential investors or collaborators'
  },
  {
    action: 'Premium Analytics',
    cost: 10,
    icon: BarChart3,
    description: 'Access detailed analytics and insights'
  },
  {
    action: 'Priority Support',
    cost: 20,
    icon: Star,
    description: 'Get priority customer support'
  }
];

export default function CreditPurchase({ credits, onRefresh }: CreditPurchaseProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedPackage(packageId);

      const result = await paymentsAPI.purchaseCredits(packageId);
      
      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start purchase process');
      setLoading(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Your Credit Balance</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{credits?.balance || 0}</span>
              <span className="text-purple-100">credits</span>
            </div>
            <div className="mt-2 text-sm text-purple-100">
              Total purchased: {credits?.totalPurchased || 0} | 
              Total used: {credits?.totalUsed || 0}
            </div>
          </div>
          <Coins className="w-16 h-16 text-purple-200" />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Credit Usage Guide */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How Credits Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CREDIT_USAGE.map((usage, index) => {
            const Icon = usage.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{usage.action}</span>
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                      {usage.cost} credit{usage.cost > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{usage.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Star className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Pro Tip</p>
              <p className="text-sm text-blue-700">
                Larger credit packages offer better value per credit and include bonus credits!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Purchase Credits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CREDIT_PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const isSelected = selectedPackage === pkg.id;
            const totalCredits = pkg.credits + pkg.bonus;
            
            return (
              <div
                key={pkg.id}
                className={`border-2 rounded-xl p-6 relative transition-all ${
                  pkg.popular
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">{pkg.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                  
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-gray-900">
                      {pkg.credits.toLocaleString()} 
                      {pkg.bonus > 0 && (
                        <span className="text-green-600">
                          +{pkg.bonus}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">credits</div>
                    
                    {pkg.bonus > 0 && (
                      <div className="text-xs text-green-600 font-medium">
                        +{pkg.bonus} bonus credits included!
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${pkg.price}
                    </div>
                    <div className="text-sm text-gray-500">{pkg.value}</div>
                  </div>
                  
                  {totalCredits > pkg.credits && (
                    <div className="text-center text-sm text-green-600 font-medium">
                      Total: {totalCredits.toLocaleString()} credits
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  } disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {loading && isSelected ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      Purchase Credits
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Credit Transactions */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          <button
            onClick={onRefresh}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {credits?.recentTransactions?.length > 0 ? (
          <div className="space-y-3">
            {credits.recentTransactions.slice(0, 10).map((transaction: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    transaction.type === 'purchase' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {transaction.type === 'purchase' ? (
                      <Coins className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="text-xs text-red-600">-</div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${
                    transaction.type === 'purchase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'purchase' ? '+' : ''}{transaction.amount}
                  </p>
                  <p className="text-sm text-gray-500">
                    Balance: {transaction.balanceAfter}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No credit transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Purchase your first credit package to get started
            </p>
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Do credits expire?</h4>
            <p className="text-sm text-gray-600">
              No, credits never expire. Once purchased, they remain in your account until used.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Can I get a refund for unused credits?</h4>
            <p className="text-sm text-gray-600">
              Credits are non-refundable, but they never expire so you can use them at any time.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">What payment methods do you accept?</h4>
            <p className="text-sm text-gray-600">
              We accept all major credit cards, debit cards, and digital wallets through Stripe.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Can I purchase credits for my team?</h4>
            <p className="text-sm text-gray-600">
              Currently, credits are per-account. For team purchases, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}