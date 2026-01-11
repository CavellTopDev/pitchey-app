import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, TrendingUp, DollarSign, BarChart3, PieChart, FileSpreadsheet } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  type: 'monthly' | 'quarterly' | 'annual' | 'custom';
  category: 'performance' | 'portfolio' | 'tax' | 'analytics';
  date: string;
  fileSize: string;
  format: 'pdf' | 'excel' | 'csv';
  description: string;
  icon: React.ElementType;
}

const InvestorReports = () => {
    
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const reports: Report[] = [
    {
      id: '1',
      title: 'Q4 2024 Portfolio Performance',
      type: 'quarterly',
      category: 'performance',
      date: '2024-12-15',
      fileSize: '2.3 MB',
      format: 'pdf',
      description: 'Comprehensive analysis of your investment performance for Q4 2024',
      icon: TrendingUp
    },
    {
      id: '2',
      title: 'Annual Tax Report 2024',
      type: 'annual',
      category: 'tax',
      date: '2024-12-10',
      fileSize: '1.8 MB',
      format: 'pdf',
      description: 'Complete tax documentation for all investment activities in 2024',
      icon: FileText
    },
    {
      id: '3',
      title: 'November 2024 Investment Summary',
      type: 'monthly',
      category: 'portfolio',
      date: '2024-12-01',
      fileSize: '845 KB',
      format: 'excel',
      description: 'Detailed breakdown of all investments made in November 2024',
      icon: DollarSign
    },
    {
      id: '4',
      title: 'Market Analysis Report',
      type: 'custom',
      category: 'analytics',
      date: '2024-11-28',
      fileSize: '3.1 MB',
      format: 'pdf',
      description: 'In-depth analysis of entertainment industry investment trends',
      icon: BarChart3
    },
    {
      id: '5',
      title: 'Portfolio Diversification Analysis',
      type: 'quarterly',
      category: 'portfolio',
      date: '2024-11-15',
      fileSize: '1.2 MB',
      format: 'pdf',
      description: 'Analysis of portfolio distribution across different sectors',
      icon: PieChart
    },
    {
      id: '6',
      title: 'ROI Performance Metrics',
      type: 'monthly',
      category: 'performance',
      date: '2024-11-01',
      fileSize: '650 KB',
      format: 'csv',
      description: 'Detailed ROI calculations for all active investments',
      icon: FileSpreadsheet
    }
  ];

  const filteredReports = reports.filter(report => {
    const categoryMatch = selectedCategory === 'all' || report.category === selectedCategory;
    const periodMatch = selectedPeriod === 'all' || report.type === selectedPeriod;
    return categoryMatch && periodMatch;
  });

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'pdf':
        return 'text-red-600 bg-red-100';
      case 'excel':
        return 'text-green-600 bg-green-100';
      case 'csv':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'performance':
        return 'text-purple-600 bg-purple-100';
      case 'portfolio':
        return 'text-blue-600 bg-blue-100';
      case 'tax':
        return 'text-orange-600 bg-orange-100';
      case 'analytics':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Investment Reports</h1>
          <p className="text-gray-600 mt-2">
            Download and review your investment reports and tax documents
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              All Categories
            </Button>
            <Button
              variant={selectedCategory === 'performance' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('performance')}
            >
              Performance
            </Button>
            <Button
              variant={selectedCategory === 'portfolio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('portfolio')}
            >
              Portfolio
            </Button>
            <Button
              variant={selectedCategory === 'tax' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('tax')}
            >
              Tax Documents
            </Button>
            <Button
              variant={selectedCategory === 'analytics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('analytics')}
            >
              Analytics
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('all')}
            >
              All Periods
            </Button>
            <Button
              variant={selectedPeriod === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={selectedPeriod === 'quarterly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('quarterly')}
            >
              Quarterly
            </Button>
            <Button
              variant={selectedPeriod === 'annual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('annual')}
            >
              Annual
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reports</p>
                  <p className="text-2xl font-bold">{reports.length}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tax Documents</p>
                  <p className="text-2xl font-bold">
                    {reports.filter(r => r.category === 'tax').length}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Latest Report</p>
                  <p className="text-sm font-semibold">Dec 15, 2024</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Size</p>
                  <p className="text-2xl font-bold">11.8 MB</p>
                </div>
                <Download className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Icon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(report.category)}`}>
                            {report.category}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFormatColor(report.format)}`}>
                            {report.format.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {report.description}
                  </CardDescription>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(report.date).toLocaleDateString()}
                    </span>
                    <span>{report.fileSize}</span>
                  </div>
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-600">Try adjusting your filters to see more reports</p>
          </div>
        )}

        {/* Generate Custom Report */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Generate Custom Report</CardTitle>
            <CardDescription>
              Create a customized report based on your specific requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Custom Date Range
              </Button>
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Specific Projects
              </Button>
              <Button variant="outline">
                <PieChart className="h-4 w-4 mr-2" />
                Sector Analysis
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InvestorReports;