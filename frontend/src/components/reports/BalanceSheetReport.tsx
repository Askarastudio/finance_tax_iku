import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BalanceSheetData, ReportLineItem } from '@/types/report';

interface BalanceSheetReportProps {
  data: BalanceSheetData;
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
}

export function BalanceSheetReport({ data, period, generatedAt }: BalanceSheetReportProps) {
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

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="text-center space-y-2 print:space-y-1">
        <h1 className="text-2xl font-bold print:text-xl">NERACA</h1>
        <h2 className="text-lg font-medium print:text-base">BALANCE SHEET</h2>
        <p className="text-muted-foreground print:text-black">
          Per {formatDate(period.endDate)}
        </p>
        <p className="text-xs text-muted-foreground print:text-black">
          Dibuat pada: {new Date(generatedAt).toLocaleString('id-ID')}
        </p>
      </div>

      {/* Assets */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader className="print:pb-2">
          <CardTitle className="text-lg print:text-base">ASET</CardTitle>
        </CardHeader>
        <CardContent className="print:px-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-medium">Akun</th>
                  <th className="text-right py-2 px-4 font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {/* Current Assets */}
                {data.assets.currentAssets.length > 0 && (
                  <>
                    <tr className="bg-muted print:bg-gray-100">
                      <td className="py-2 px-4 font-medium">Aset Lancar</td>
                      <td className="py-2 px-4"></td>
                    </tr>
                    {renderLineItems(data.assets.currentAssets)}
                    <tr className="border-t">
                      <td className="py-2 px-4 font-medium">Total Aset Lancar</td>
                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {formatCurrency(
                          data.assets.currentAssets.reduce((sum, item) => sum + item.amount, 0)
                        )}
                      </td>
                    </tr>
                  </>
                )}

                {/* Non-Current Assets */}
                {data.assets.nonCurrentAssets.length > 0 && (
                  <>
                    <tr className="bg-muted print:bg-gray-100">
                      <td className="py-2 px-4 font-medium">Aset Tidak Lancar</td>
                      <td className="py-2 px-4"></td>
                    </tr>
                    {renderLineItems(data.assets.nonCurrentAssets)}
                    <tr className="border-t">
                      <td className="py-2 px-4 font-medium">Total Aset Tidak Lancar</td>
                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {formatCurrency(
                          data.assets.nonCurrentAssets.reduce((sum, item) => sum + item.amount, 0)
                        )}
                      </td>
                    </tr>
                  </>
                )}

                {/* Total Assets */}
                <tr className="border-t-2 border-black bg-muted print:bg-gray-200">
                  <td className="py-3 px-4 font-bold">TOTAL ASET</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    {formatCurrency(data.assets.totalAssets)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Liabilities and Equity */}
      <Card className="print:shadow-none print:border-0">
        <CardHeader className="print:pb-2">
          <CardTitle className="text-lg print:text-base">KEWAJIBAN DAN EKUITAS</CardTitle>
        </CardHeader>
        <CardContent className="print:px-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-medium">Akun</th>
                  <th className="text-right py-2 px-4 font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {/* Current Liabilities */}
                {data.liabilities.currentLiabilities.length > 0 && (
                  <>
                    <tr className="bg-muted print:bg-gray-100">
                      <td className="py-2 px-4 font-medium">Kewajiban Lancar</td>
                      <td className="py-2 px-4"></td>
                    </tr>
                    {renderLineItems(data.liabilities.currentLiabilities)}
                    <tr className="border-t">
                      <td className="py-2 px-4 font-medium">Total Kewajiban Lancar</td>
                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {formatCurrency(
                          data.liabilities.currentLiabilities.reduce((sum, item) => sum + item.amount, 0)
                        )}
                      </td>
                    </tr>
                  </>
                )}

                {/* Non-Current Liabilities */}
                {data.liabilities.nonCurrentLiabilities.length > 0 && (
                  <>
                    <tr className="bg-muted print:bg-gray-100">
                      <td className="py-2 px-4 font-medium">Kewajiban Tidak Lancar</td>
                      <td className="py-2 px-4"></td>
                    </tr>
                    {renderLineItems(data.liabilities.nonCurrentLiabilities)}
                    <tr className="border-t">
                      <td className="py-2 px-4 font-medium">Total Kewajiban Tidak Lancar</td>
                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {formatCurrency(
                          data.liabilities.nonCurrentLiabilities.reduce((sum, item) => sum + item.amount, 0)
                        )}
                      </td>
                    </tr>
                  </>
                )}

                {/* Total Liabilities */}
                <tr className="border-t bg-muted print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">Total Kewajiban</td>
                  <td className="py-2 px-4 text-right font-mono font-medium">
                    {formatCurrency(data.liabilities.totalLiabilities)}
                  </td>
                </tr>

                {/* Equity */}
                <tr className="bg-muted print:bg-gray-100">
                  <td className="py-2 px-4 font-medium">Ekuitas</td>
                  <td className="py-2 px-4"></td>
                </tr>
                {renderLineItems(data.equity.items)}
                <tr className="border-t">
                  <td className="py-2 px-4 font-medium">Total Ekuitas</td>
                  <td className="py-2 px-4 text-right font-mono font-medium">
                    {formatCurrency(data.equity.totalEquity)}
                  </td>
                </tr>

                {/* Total Liabilities and Equity */}
                <tr className="border-t-2 border-black bg-muted print:bg-gray-200">
                  <td className="py-3 px-4 font-bold">TOTAL KEWAJIBAN DAN EKUITAS</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    {formatCurrency(data.totalLiabilitiesAndEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance Check */}
          {Math.abs(data.assets.totalAssets - data.totalLiabilitiesAndEquity) > 0.01 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md print:bg-red-100">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ Peringatan: Neraca tidak seimbang!
              </p>
              <p className="text-xs text-red-600">
                Selisih: {formatCurrency(data.assets.totalAssets - data.totalLiabilitiesAndEquity)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}