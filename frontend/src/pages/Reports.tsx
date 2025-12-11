import React, { useState } from 'react';
import { ArrowLeft, Printer, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportGenerator } from '@/components/reports/ReportGenerator';
import { ReportExportInterface } from '@/components/reports/ReportExportInterface';
import { BalanceSheetReport } from '@/components/reports/BalanceSheetReport';
import { IncomeStatementReport } from '@/components/reports/IncomeStatementReport';
import { 
  ReportType, 
  ReportFilter, 
  ReportData, 
  ReportExportOptions,
  BalanceSheetData,
  IncomeStatementData 
} from '@/types/report';

export function Reports() {
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportInterface, setShowExportInterface] = useState(false);

  const handleGenerateReport = async (type: ReportType, filter: ReportFilter) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

      // Mock data generation based on report type
      let reportData: ReportData;

      if (type === 'balance-sheet') {
        const balanceSheetData: BalanceSheetData = {
          assets: {
            currentAssets: [
              { accountCode: '1100', accountName: 'Kas', amount: 50000000 },
              { accountCode: '1200', accountName: 'Piutang Usaha', amount: 25000000 },
              { accountCode: '1300', accountName: 'Persediaan', amount: 15000000 },
            ],
            nonCurrentAssets: [
              { accountCode: '1500', accountName: 'Peralatan', amount: 100000000 },
              { accountCode: '1600', accountName: 'Akumulasi Penyusutan Peralatan', amount: -20000000 },
            ],
            totalAssets: 170000000
          },
          liabilities: {
            currentLiabilities: [
              { accountCode: '2100', accountName: 'Utang Usaha', amount: 15000000 },
              { accountCode: '2200', accountName: 'Utang Gaji', amount: 5000000 },
            ],
            nonCurrentLiabilities: [
              { accountCode: '2500', accountName: 'Utang Bank Jangka Panjang', amount: 50000000 },
            ],
            totalLiabilities: 70000000
          },
          equity: {
            items: [
              { accountCode: '3100', accountName: 'Modal Saham', amount: 80000000 },
              { accountCode: '3200', accountName: 'Laba Ditahan', amount: 20000000 },
            ],
            totalEquity: 100000000
          },
          totalLiabilitiesAndEquity: 170000000
        };

        reportData = {
          type: 'balance-sheet',
          title: 'Neraca',
          period: filter,
          generatedAt: new Date().toISOString(),
          data: balanceSheetData
        };
      } else if (type === 'income-statement') {
        const incomeStatementData: IncomeStatementData = {
          revenue: {
            items: [
              { accountCode: '4100', accountName: 'Pendapatan Jasa', amount: 150000000 },
              { accountCode: '4200', accountName: 'Pendapatan Lain-lain', amount: 5000000 },
            ],
            totalRevenue: 155000000
          },
          expenses: {
            items: [
              { accountCode: '5100', accountName: 'Beban Gaji', amount: 60000000 },
              { accountCode: '5200', accountName: 'Beban Sewa', amount: 24000000 },
              { accountCode: '5300', accountName: 'Beban Listrik', amount: 6000000 },
              { accountCode: '5400', accountName: 'Beban Penyusutan', amount: 10000000 },
              { accountCode: '5500', accountName: 'Beban Lain-lain', amount: 5000000 },
            ],
            totalExpenses: 105000000
          },
          netIncome: 50000000
        };

        reportData = {
          type: 'income-statement',
          title: 'Laporan Laba Rugi',
          period: filter,
          generatedAt: new Date().toISOString(),
          data: incomeStatementData
        };
      } else {
        // Cash flow - placeholder for now
        reportData = {
          type: 'cash-flow',
          title: 'Laporan Arus Kas',
          period: filter,
          generatedAt: new Date().toISOString(),
          data: {
            operatingActivities: { items: [], netCashFromOperating: 0 },
            investingActivities: { items: [], netCashFromInvesting: 0 },
            financingActivities: { items: [], netCashFromFinancing: 0 },
            netCashFlow: 0,
            beginningCash: 0,
            endingCash: 0
          }
        };
      }

      setCurrentReport(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async (type: ReportType, filter: ReportFilter, options: ReportExportOptions) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate export
      
      // For now, just trigger browser print for PDF
      if (options.format === 'pdf') {
        window.print();
      } else {
        alert(`Export ke ${options.format.toUpperCase()} akan segera tersedia`);
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBackToGenerator = () => {
    setCurrentReport(null);
  };

  const renderReport = () => {
    if (!currentReport) return null;

    switch (currentReport.type) {
      case 'balance-sheet':
        return (
          <BalanceSheetReport
            data={currentReport.data as BalanceSheetData}
            period={currentReport.period}
            generatedAt={currentReport.generatedAt}
          />
        );
      case 'income-statement':
        return (
          <IncomeStatementReport
            data={currentReport.data as IncomeStatementData}
            period={currentReport.period}
            generatedAt={currentReport.generatedAt}
          />
        );
      case 'cash-flow':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-bold">Laporan Arus Kas</h2>
            <p className="text-muted-foreground mt-2">Fitur akan segera tersedia</p>
          </div>
        );
      default:
        return null;
    }
  };

  if (currentReport) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Report Header Actions */}
        <div className="flex justify-between items-center print:hidden">
          <Button
            variant="outline"
            onClick={handleBackToGenerator}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Generator
          </Button>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowExportInterface(!showExportInterface)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Export Options
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportReport(
                currentReport.type, 
                currentReport.period, 
                { format: 'pdf', includeDetails: true }
              )}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Quick Export PDF
            </Button>
          </div>
        </div>

        {/* Export Interface */}
        {showExportInterface && (
          <div className="print:hidden">
            <ReportExportInterface
              onExport={(options) => handleExportReport(currentReport.type, currentReport.period, options)}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Report Content */}
        <div className="bg-white print:bg-white">
          {renderReport()}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Laporan Keuangan</h1>
        <p className="text-muted-foreground">Generate dan export laporan keuangan</p>
      </div>

      {/* Report Generator */}
      <ReportGenerator
        onGenerateReport={handleGenerateReport}
        onExportReport={handleExportReport}
        isLoading={isLoading}
      />
    </div>
  );
}