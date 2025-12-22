import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, Plus, Trash2, Shield, Check,
  Building2, AlertCircle, Edit2, Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

interface PaymentMethod {
  id: number;
  type: 'card' | 'bank' | 'wire';
  brand?: string;
  name: string;
  last4: string;
  expiryDate?: string;
  isDefault: boolean;
  status: 'active' | 'expired' | 'pending';
  addedDate: string;
}

const PaymentMethods = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'card' | 'bank' | 'wire'>('card');

  // Mock payment methods data
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 1,
      type: 'card',
      brand: 'Visa',
      name: 'Business Card',
      last4: '4242',
      expiryDate: '12/2025',
      isDefault: true,
      status: 'active',
      addedDate: '2024-01-15'
    },
    {
      id: 2,
      type: 'bank',
      name: 'Chase Business Checking',
      last4: '9821',
      isDefault: false,
      status: 'active',
      addedDate: '2024-02-10'
    },
    {
      id: 3,
      type: 'card',
      brand: 'Mastercard',
      name: 'Corporate Card',
      last4: '8456',
      expiryDate: '06/2024',
      isDefault: false,
      status: 'expired',
      addedDate: '2023-11-20'
    },
    {
      id: 4,
      type: 'wire',
      name: 'International Wire Transfer',
      last4: '5678',
      isDefault: false,
      status: 'active',
      addedDate: '2024-03-05'
    }
  ]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSetDefault = (id: number) => {
    setLoading(true);
    setTimeout(() => {
      setPaymentMethods(methods => 
        methods.map(method => ({
          ...method,
          isDefault: method.id === id
        }))
      );
      toast.success('Default payment method updated');
      setLoading(false);
    }, 1000);
  };

  const handleDelete = (id: number) => {
    const method = paymentMethods.find(m => m.id === id);
    if (method?.isDefault) {
      toast.error('Cannot delete default payment method');
      return;
    }

    if (confirm('Are you sure you want to remove this payment method?')) {
      setLoading(true);
      setTimeout(() => {
        setPaymentMethods(methods => methods.filter(m => m.id !== id));
        toast.success('Payment method removed');
        setLoading(false);
      }, 1000);
    }
  };

  const handleAddPaymentMethod = () => {
    toast.success('Redirecting to secure payment setup...');
    // In production, this would redirect to Stripe/payment processor
    setShowAddModal(false);
  };

  const getCardBrandIcon = (brand?: string) => {
    // In production, you'd have actual brand logos
    return <CreditCard className="h-8 w-12 text-gray-600" />;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'card':
        return <CreditCard className="h-5 w-5" />;
      case 'bank':
        return <Building2 className="h-5 w-5" />;
      case 'wire':
        return <Shield className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InvestorNavigation 
        userName={user?.username || user?.email || 'Investor'} 
        onLogout={handleLogout}
      />

      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Payment Methods</h1>
              <p className="text-muted-foreground mt-2">
                Manage your payment methods for investments and transactions
              </p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </div>

          {/* Security Notice */}
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Bank-Level Security</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your payment information is encrypted and secured with industry-standard protection. 
                    We never store sensitive card details on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods List */}
          <div className="space-y-4">
            {paymentMethods.map(method => (
              <Card key={method.id} className={method.status === 'expired' ? 'opacity-75' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {method.type === 'card' ? (
                        <div className="p-2 bg-gray-100 rounded">
                          {getCardBrandIcon(method.brand)}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-100 rounded-full">
                          {getTypeIcon(method.type)}
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{method.name}</h3>
                          {method.isDefault && (
                            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              Default
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(method.status)}`}>
                            {method.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>•••• {method.last4}</span>
                          {method.expiryDate && (
                            <span>Expires {method.expiryDate}</span>
                          )}
                          <span>Added {new Date(method.addedDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!method.isDefault && method.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={loading}
                        >
                          Set Default
                        </Button>
                      )}
                      {method.status === 'expired' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Update
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(method.id)}
                        disabled={loading || method.isDefault}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {method.status === 'expired' && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="text-sm text-red-800">
                        This payment method has expired. Please update the information to continue using it.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Payment Method Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Add Payment Method</CardTitle>
                  <CardDescription>Choose a payment method type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedType('card')}
                      className={`w-full p-4 border rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                        selectedType === 'card' ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <CreditCard className="h-5 w-5" />
                      <div className="text-left">
                        <p className="font-medium">Credit or Debit Card</p>
                        <p className="text-sm text-muted-foreground">Add a card for quick payments</p>
                      </div>
                      {selectedType === 'card' && <Check className="h-5 w-5 text-primary ml-auto" />}
                    </button>

                    <button
                      onClick={() => setSelectedType('bank')}
                      className={`w-full p-4 border rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                        selectedType === 'bank' ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                      <div className="text-left">
                        <p className="font-medium">Bank Account</p>
                        <p className="text-sm text-muted-foreground">Connect via ACH transfer</p>
                      </div>
                      {selectedType === 'bank' && <Check className="h-5 w-5 text-primary ml-auto" />}
                    </button>

                    <button
                      onClick={() => setSelectedType('wire')}
                      className={`w-full p-4 border rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                        selectedType === 'wire' ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <Shield className="h-5 w-5" />
                      <div className="text-left">
                        <p className="font-medium">Wire Transfer</p>
                        <p className="text-sm text-muted-foreground">For large transactions</p>
                      </div>
                      {selectedType === 'wire' && <Check className="h-5 w-5 text-primary ml-auto" />}
                    </button>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleAddPaymentMethod}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Additional Information */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Accepted Payment Methods</h4>
                <p className="text-sm text-muted-foreground">
                  We accept all major credit cards (Visa, Mastercard, American Express), 
                  ACH bank transfers, and wire transfers for investments over $100,000.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Processing Times</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Credit/Debit Cards: Instant</li>
                  <li>• ACH Transfers: 2-3 business days</li>
                  <li>• Wire Transfers: 1-2 business days</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Security & Compliance</h4>
                <p className="text-sm text-muted-foreground">
                  All transactions are PCI DSS compliant and protected by 256-bit SSL encryption. 
                  We partner with Stripe and Plaid for secure payment processing.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;