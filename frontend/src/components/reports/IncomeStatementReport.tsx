import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IncomeStatementData, ReportLineItem } from '@/types/report';

interface IncomeStatementReportProps {
  data: IncomeStatementData;
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
}

export function IncomeStatementReport({ data, period, generatedAt }: IncomeStatementReportProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderLineItems = (items: ReportLineItem[], level: number = 0) => {
    return items.map((item, index) => (
      <React.Fragment key={index}>
        <tr className={level > 0 ? 'text-sm' : ''}>
          <td className={`py-2 px-4 ${level > 0 ? 'pl-8' : ''}`}>
            {item.accountCode && (
              <span className="font-mono text-xs text-muted-foreground mr-2">
                {item.accountCode}
              </span>
            )}
            {item.accountName}
          </td>
          <td className="py-2 px-4 text-right font-mono">
            {formatCurrency(item.amount)}
          </td>
          {item.percentage !== undefined && (
            <td className="py-2 px-4 text-right text-sm text-muted-foreground">
              {item.percentage.toFixed(1)}%
            </td>
          )}
        </tr>
        {item.children && renderLineItems(item.children, level + 1)}
      </React.Fragment>
    ));
  };

  const calculateMargin = (amount: number, revenue: number) => {
    return revenue !== 0 ? ((amount / revenue) * 100).toFixed(1) : '0.0';
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="text-center space-y-2 print:space-y-1">
        <h1 className="text-2xl font-bold print:text-xl">LAPORAN LABA RUGI</h1>
        <h2 className="text-lg font-medium print:text-base">INCOME STATEMENT</h2>
        <p className="text-muted-foreground print:text-black">
          Periode {formatDate(period.startDate)} - {formatDate(period.endDate)}
        </p>
        <p className="text-xs text-muted-foreground print:text-black">
          Dibuat pada: {new Date(generatedAt).toLocaleString('id-ID')}
        </p>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="print:px-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-medium">Akun</th>
                  <th className="text-right py-2 px-4 font-medium">Jumlah</th>
                  <th className="text-right py-2 px-4 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue Section */}
                <tr className="bg-muted print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">PENDAPATAN</td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                </tr>
                {renderLineItems(data.revenue.items.map(item => ({
                  ...item,
                  percentage: data.revenue.totalRevenue !== 0 ? 
                    (item.amount / data.revenue.totalRevenue) * 100 : 0
                })))}
                
                <tr className="border-t bg-blue-50 print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">Total Pendapatan</td>
                  <td className="py-2 px-4 text-right font-mono font-medium">
                    {formatCurrency(data.revenue.totalRevenue)}
                  </td>
                  <td className="py-2 px-4 text-right font-medium">100.0%</td>
                </tr>

                {/* Expenses Section */}
                <tr className="bg-muted print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">BEBAN</td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                </tr>
                {renderLineItems(data.expenses.items.map(item => ({
                  ...item,
                  percentage: data.revenue.totalRevenue !== 0 ? 
                    (item.amount / data.revenue.totalRevenue) * 100 : 0
                })))}
                
                <tr className="border-t bg-red-50 print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">Total Beban</td>
                  <td className="py-2 px-4 text-right font-mono font-medium">
                    {formatCurrency(data.expenses.totalExpenses)}
                  </td>
                  <td className="py-2 px-4 text-right font-medium">
                    {calculateMargin(data.expenses.totalExpenses, data.revenue.totalRevenue)}%
                  </td>
                </tr>

                {/* Net Income */}
                <tr className="border-t-2 border-black bg-muted print:bg-gray-200">
                  <td className="py-3 px-4 font-bold">
                    {data.netIncome >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${
                    data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  } print:text-black`}>
                    {formatCurrency(data.netIncome)}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${
                    data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  } print:text-black`}>
                    {calculateMargin(data.netIncome, data.revenue.totalRevenue)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Ratios Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 print:mt-4">
            <div className="p-4 bg-muted rounded-lg print:bg-gray-100">
              <div className="text-sm font-medium text-muted-foreground print:text-black">Gross Margin</div>
              <div className="text-lg font-bold print:text-base">
                {calculateMargin(data.netIncome, data.revenue.totalRevenue)}%
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg print:bg-gray-100">
              <div className="text-sm font-medium text-muted-foreground print:text-black">Total Pendapatan</div>
              <div className="text-lg font-bold font-mono print:text-base">
                {formatCurrency(data.revenue.totalRevenue)}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg print:bg-gray-100">
              <div className="text-sm font-medium text-muted-foreground print:text-black">Total Beban</div>
              <div className="text-lg font-bold font-mono print:text-base">
                {formatCurrency(data.expenses.totalExpenses)}
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          {data.revenue.totalRevenue > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg print:bg-gray-100">
              <h4 className="font-medium mb-2">Indikator Kinerja</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground print:text-black">Expense Ratio:</span>
                  <span className="ml-2 font-mono">
                    {calculateMargin(data.expenses.totalExpenses, data.revenue.totalRevenue)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground print:text-black">Profit Margin:</span>
                  <span className={`ml-2 font-mono ${
                    data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  } print:text-black`}>
                    {calculateMargin(data.netIncome, data.revenue.totalRevenue)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}