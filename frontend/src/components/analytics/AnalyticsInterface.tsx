import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, BarChart3, PieChart, AlertTriangle } from 'lucide-react';

interface TrendData {
  period: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  cashFlow: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  threshold: number;
  currentValue: number;
}

export const AnalyticsInterface: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6months');
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock trend data
  const mockTrendData: TrendData[] = [
    { period: 'Jan 2024', revenue: 220000000, expenses: 160000000, netIncome: 60000000, cashFlow: 45000000 },
    { period: 'Feb 2024', revenue: 235000000, expenses: 170000000, netIncome: 65000000, cashFlow: 50000000 },
    { period: 'Mar 2024', revenue: 250000000, expenses: 180000000, netIncome: 70000000, cashFlow: 55000000 },
    { period: 'Apr 2024', revenue: 240000000, expenses: 175000000, netIncome: 65000000, cashFlow: 48000000 },
    { period: 'May 2024', revenue: 260000000, expenses: 185000000, netIncome: 75000000, cashFlow: 60000000 },
    { period: 'Jun 2024', revenue: 275000000, expenses: 190000000, netIncome: 85000000, cashFlow: 65000000 },
  ];

  const mockAlerts: Alert[] = [
    {
      id: '1',
      type: 'warning',
      message: 'Cash flow below threshold',
      threshold: 70000000,
      currentValue: 65000000
    },
    {
      id: '2',
      type: 'error',
      message: 'Expense ratio exceeding budget',
      threshold: 70,
      currentValue: 75
    },
    {
      id: '3',
      type: 'info',
      message: 'Revenue growth target achieved',
      threshold: 10,
      currentValue: 12.5
    }
  ];

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // API calls would go here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setTrendData(mockTrendData);
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPeriod]);

  const calculateGrowthRate = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getLatestData = () => {
    if (trendData.length === 0) return null;
    return trendData[trendData.length - 1];
  };

  const getPreviousData = () => {
    if (trendData.length < 2) return null;
    return trendData[trendData.length - 2];
  };

  const latestData = getLatestData();
  const previousData = getPreviousData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Trends</h2>
          <p className="text-gray-600">Financial performance analysis and trend monitoring</p>
        </div>
        
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="6months">Last 6 Months</SelectItem>
            <SelectItem value="12months">Last 12 Months</SelectItem>
            <SelectItem value="24months">Last 24 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Performance Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-lg border ${
                alert.type === 'error' ? 'border-red-200 bg-red-50' :
                alert.type === 'warning' ? 'border-orange-200 bg-orange-50' :
                'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{alert.message}</span>
                  <div className="text-sm text-gray-600">
                    {alert.type === 'info' ? 
                      `Target: ${alert.threshold}% | Current: ${alert.currentValue}%` :
                      `Threshold: ${formatCurrency(alert.threshold)} | Current: ${formatCurrency(alert.currentValue)}`
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue vs Expenses Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trendData.map((data) => (
                <div key={data.period} className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{data.period}</span>
                    <span>{formatCurrency(data.netIncome)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.max(10, (data.netIncome / data.revenue) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cash Flow Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestData && previousData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Current Month</p>
                    <p className="text-2xl font-bold">{formatCurrency(latestData.cashFlow)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Growth Rate</p>
                    <p className={`text-2xl font-bold ${
                      calculateGrowthRate(latestData.cashFlow, previousData.cashFlow) >= 0 ? 
                      'text-green-600' : 'text-red-600'
                    }`}>
                      {calculateGrowthRate(latestData.cashFlow, previousData.cashFlow).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                {trendData.map((data) => (
                  <div key={data.period} className="flex justify-between items-center">
                    <span className="text-sm">{data.period}</span>
                    <span className="font-medium">{formatCurrency(data.cashFlow)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Budget vs Actual Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <h3 className="font-medium text-gray-900">Revenue Performance</h3>
                <div className="mt-2">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(latestData.revenue)}
                  </div>
                  <p className="text-sm text-gray-600">vs Budget: 250M (110%)</p>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="font-medium text-gray-900">Expense Control</h3>
                <div className="mt-2">
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(latestData.expenses)}
                  </div>
                  <p className="text-sm text-gray-600">vs Budget: 180M (105%)</p>
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="font-medium text-gray-900">Net Income</h3>
                <div className="mt-2">
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(latestData.netIncome)}
                  </div>
                  <p className="text-sm text-gray-600">vs Budget: 70M (121%)</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={fetchAnalyticsData} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
        <Button variant="outline">
          Export Analytics Report
        </Button>
        <Button variant="outline">
          Configure Alerts
        </Button>
      </div>
    </div>
  );
};