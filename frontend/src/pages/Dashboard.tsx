
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinancialMetrics {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netIncome: number;
  pendingTransactions: number;
  vatPayable: number;
  currentRatio: number;
  debtToEquityRatio: number;
  profitMargin: number;
  revenueGrowth: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

export function Dashboard() {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalAssets: 1500000000,
    totalLiabilities: 800000000,
    totalEquity: 700000000,
    monthlyRevenue: 250000000,
    monthlyExpenses: 180000000,
    netIncome: 70000000,
    pendingTransactions: 12,
    vatPayable: 25000000,
    currentRatio: 1.875,
    debtToEquityRatio: 1.14,
    profitMargin: 28,
    revenueGrowth: 12.5,
  });

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'warning',
      message: 'VAT filing due in 3 days',
      timestamp: new Date()
    },
    {
      id: '2',
      type: 'info',
      message: '12 transactions pending approval',
      timestamp: new Date()
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // API calls to fetch real-time data
      const [metricsResponse, alertsResponse] = await Promise.all([
        fetch('/api/v1/dashboard/metrics'),
        fetch('/api/v1/dashboard/alerts')
      ]);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        if (metricsData.success) {
          setMetrics(metricsData.data);
        }
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        if (alertsData.success) {
          setAlerts(alertsData.data);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Ringkasan keuangan dan aktivitas perusahaan
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Notifikasi Penting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center gap-2 text-sm">
                  {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                  {alert.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                  {alert.type === 'info' && <CheckCircle className="h-4 w-4 text-blue-600" />}
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Aset</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalAssets)}
            </div>
            <p className="text-xs text-muted-foreground">
              Posisi per hari ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kewajiban</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalLiabilities)}
            </div>
            <p className="text-xs text-muted-foreground">
              Posisi per hari ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ekuitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalEquity)}
            </div>
            <p className="text-xs text-muted-foreground">
              Posisi per hari ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih Bulan Ini</CardTitle>
            <TrendingUp className={`h-4 w-4 ${metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.revenueGrowth >= 0 ? '+' : ''}{metrics.revenueGrowth}% dari bulan lalu
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Ratio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.currentRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Likuiditas jangka pendek
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debt to Equity</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.debtToEquityRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Rasio leverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Margin keuntungan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
            <TrendingUp className={`h-4 w-4 ${metrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.revenueGrowth >= 0 ? '+' : ''}{metrics.revenueGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Pertumbuhan pendapatan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kinerja Bulanan</CardTitle>
            <CardDescription>
              Pendapatan dan pengeluaran bulan ini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pendapatan</span>
              <span className="text-sm font-bold text-green-600">
                {formatCurrency(metrics.monthlyRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pengeluaran</span>
              <span className="text-sm font-bold text-red-600">
                {formatCurrency(metrics.monthlyExpenses)}
              </span>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Laba Bersih</span>
                <span className="text-sm font-bold">
                  {formatCurrency(metrics.netIncome)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Sistem</CardTitle>
            <CardDescription>
              Aktivitas dan notifikasi terkini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Transaksi Pending</span>
              </div>
              <span className="text-sm font-bold">{metrics.pendingTransactions}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <span className="text-sm">PPN Terutang</span>
              </div>
              <span className="text-sm font-bold">
                {formatCurrency(metrics.vatPayable)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">Status Backup</span>
              </div>
              <span className="text-sm font-bold text-green-600">Aktif</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
          <CardDescription>
            Akses cepat ke fitur yang sering digunakan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <span className="text-sm font-medium">Buat Transaksi</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <span className="text-sm font-medium">Laporan Keuangan</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-orange-600" />
              <span className="text-sm font-medium">Hitung Pajak</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <TrendingDown className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <span className="text-sm font-medium">Import Data</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}