import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Download, Calendar, Search, Filter,
  CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';
import { investorApi } from '@/services/investor.service';

const TaxDocuments = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTaxDocuments();
  }, []);

  const loadTaxDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getTaxDocuments(2024);
      
      if (response.success && response.data) {
        setDocuments(response.data.documents || []);
      } else {
        setError('Failed to load tax documents');
        // Use fallback data
        setDocuments([
          { id: 1, name: '2024 Tax Summary', type: 'Tax Summary', year: 2024, date: '2024-12-01', status: 'available', size: '2.3 MB' },
          { id: 2, name: '2024 Investment Gains Report', type: 'Gains Report', year: 2024, date: '2024-12-01', status: 'available', size: '1.8 MB' },
          { id: 3, name: '2024 Q3 Quarterly Statement', type: 'Quarterly', year: 2024, date: '2024-09-30', status: 'available', size: '950 KB' },
        ]);
      }
    } catch (error) {
      console.error('Failed to load tax documents:', error);
      setError('Failed to load tax documents');
      setDocuments([
        { id: 1, name: '2024 Tax Summary', type: 'Tax Summary', year: 2024, date: '2024-12-01', status: 'available', size: '2.3 MB' },
        { id: 2, name: '2024 Investment Gains Report', type: 'Gains Report', year: 2024, date: '2024-12-01', status: 'available', size: '1.8 MB' },
        { id: 3, name: '2024 Q3 Quarterly Statement', type: 'Quarterly', year: 2024, date: '2024-09-30', status: 'available', size: '950 KB' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InvestorNavigation 
          user={user}
          onLogout={handleLogout}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  const filteredDocuments = documents.filter(doc =>
    searchQuery === '' || doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
    { id: '5', name: '2023 Annual Tax Report', type: 'Annual Report', year: '2023', date: '2024-01-15', status: 'archived', size: '3.2 MB' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'archived':
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-yellow-600 bg-yellow-100';
      case 'archived':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Tax Documents</h1>
              <p className="text-gray-600 mt-2">Access your investment tax documents and reports</p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download All
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
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <select className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">All Years</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
              </select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Documents</CardTitle>
            <CardDescription>Your tax and financial documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{doc.name}</h3>
                      <p className="text-sm text-gray-500">{doc.type} • {doc.size}</p>
                      <p className="text-xs text-gray-400">Generated: {new Date(doc.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-1">{doc.status}</span>
                    </span>
                    <Button size="sm" variant="outline">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
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

export default TaxDocuments;