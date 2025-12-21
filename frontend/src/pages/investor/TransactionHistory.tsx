import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, Download, Filter, Search, ArrowUpRight,
  ArrowDownLeft, Calendar, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

const TransactionHistory = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const transactions = [
    { id: '1', type: 'investment', title: 'The Quantum Paradox', amount: 500000, date: '2024-12-15', status: 'completed' },
    { id: '2', type: 'return', title: 'Lost Paradise - Q3 Returns', amount: 350000, date: '2024-12-10', status: 'completed' },
    { id: '3', type: 'investment', title: 'Urban Legends', amount: 250000, date: '2024-12-05', status: 'pending' },
    { id: '4', type: 'withdrawal', title: 'Profit Withdrawal', amount: 200000, date: '2024-11-30', status: 'completed' },
    { id: '5', type: 'investment', title: 'Digital Dreams', amount: 750000, date: '2024-11-20', status: 'completed' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNavigation 
        user={user}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
              <p className="text-gray-600 mt-2">All your investment transactions and returns</p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your complete transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      tx.type === 'investment' ? 'bg-purple-100' : 
                      tx.type === 'return' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {tx.type === 'investment' ? <ArrowUpRight className="h-5 w-5 text-purple-600" /> :
                       tx.type === 'return' ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> :
                       <DollarSign className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tx.title}</p>
                      <p className="text-sm text-gray-500">{new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.type === 'return' ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {tx.type === 'return' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TransactionHistory;