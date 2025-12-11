import React, { useState } from 'react';
import { Calendar, FileText, Download, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportType, ReportFilter, ReportExportOptions } from '@/types/report';

interface ReportGeneratorProps {
  onGenerateReport: (type: ReportType, filter: ReportFilter) => Promise<void>;
  onExportReport: (type: ReportType, filter: ReportFilter, options: ReportExportOptions) => Promise<void>;
  isLoading?: boolean;
}

export function ReportGenerator({ 
  onGenerateReport, 
  onExportReport, 
  isLoading = false 
}: ReportGeneratorProps) {
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('balance-sheet');
  const [filter, setFilter] = useState<ReportFilter>({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    endDate: new Date().toISOString().split('T')[0], // Today
    includeInactive: false
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportOptions, setExportOptions] = useState<ReportExportOptions>({
    format: 'pdf',
    includeDetails: true,
    includeComparison: false
  });

  const reportTypes = [
    { value: 'balance-sheet', label: 'Neraca (Balance Sheet)', description: 'Posisi keuangan pada tanggal tertentu' },
    { value: 'income-statement', label: 'Laporan Laba Rugi', description: 'Pendapatan dan beban dalam periode tertentu' },
    { value: 'cash-flow', label: 'Laporan Arus Kas', description: 'Arus kas masuk dan keluar dalam periode tertentu' }
  ];

  const exportFormats = [
    { value: 'pdf', label: 'PDF', description: 'Format untuk pencetakan dan presentasi' },
    { value: 'excel', label: 'Excel', description: 'Format untuk analisis lebih lanjut' },
    { value: 'csv', label: 'CSV', description: 'Format data untuk import ke sistem lain' }
  ];

  const handleFilterChange = (field: keyof ReportFilter, value: any) => {
    setFilter(prev => ({ ...prev, [field]: value }));
  };

  const handleExportOptionsChange = (field: keyof ReportExportOptions, value: any) => {
    setExportOptions(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateReport = async () => {
    await onGenerateReport(selectedReportType, filter);
  };

  const handleExportReport = async () => {
    await onExportReport(selectedReportType, filter, exportOptions);
  };

  const validateDateRange = () => {
    if (filter.startDate && filter.endDate) {
      return new Date(filter.startDate) <= new Date(filter.endDate);
    }
    return true;
  };

  const getReportDescription = () => {
    const reportType = reportTypes.find(type => type.value === selectedReportType);
    return reportType?.description || '';
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Pilih Jenis Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTypes.map((type) => (
              <div
                key={type.value}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedReportType === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedReportType(type.value as ReportType)}
              >
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">{getReportDescription()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Date Range and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Periode dan Filter
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Sembunyikan' : 'Tampilkan'} Advanced
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                {selectedReportType === 'balance-sheet' ? 'Tanggal Laporan' : 'Tanggal Mulai'}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={filter.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                disabled={isLoading}
              />
            </div>
            {selectedReportType !== 'balance-sheet' && (
              <div className="space-y-2">
                <Label htmlFor="endDate">Tanggal Selesai</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {!validateDateRange() && (
            <div className="text-sm text-red-600">
              Tanggal mulai harus lebih kecil atau sama dengan tanggal selesai
            </div>
          )}

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeInactive"
                  checked={filter.includeInactive}
                  onChange={(e) => handleFilterChange('includeInactive', e.target.checked)}
                  disabled={isLoading}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="includeInactive">Sertakan akun yang tidak aktif</Label>
              </div>
            </div>
          )}

          {/* Quick Date Presets */}
          <div className="space-y-2">
            <Label>Preset Periode</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Bulan Ini', getValue: () => {
                  const now = new Date();
                  return {
                    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                  };
                }},
                { label: 'Bulan Lalu', getValue: () => {
                  const now = new Date();
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                  return {
                    startDate: lastMonth.toISOString().split('T')[0],
                    endDate: lastDayOfLastMonth.toISOString().split('T')[0]
                  };
                }},
                { label: 'Tahun Ini', getValue: () => {
                  const now = new Date();
                  return {
                    startDate: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                  };
                }},
                { label: 'Tahun Lalu', getValue: () => {
                  const now = new Date();
                  return {
                    startDate: new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0],
                    endDate: new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0]
                  };
                }}
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dates = preset.getValue();
                    setFilter(prev => ({ ...prev, ...dates }));
                  }}
                  disabled={isLoading}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Opsi Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exportFormats.map((format) => (
              <div
                key={format.value}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  exportOptions.format === format.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleExportOptionsChange('format', format.value)}
              >
                <div className="font-medium">{format.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{format.description}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeDetails"
                checked={exportOptions.includeDetails}
                onChange={(e) => handleExportOptionsChange('includeDetails', e.target.checked)}
                disabled={isLoading}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeDetails">Sertakan detail akun</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeComparison"
                checked={exportOptions.includeComparison}
                onChange={(e) => handleExportOptionsChange('includeComparison', e.target.checked)}
                disabled={isLoading}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeComparison">Sertakan perbandingan periode sebelumnya</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button
          variant="outline"
          onClick={handleExportReport}
          disabled={isLoading || !validateDateRange()}
        >
          <Download className="h-4 w-4 mr-2" />
          {isLoading ? 'Mengexport...' : 'Export'}
        </Button>
        <Button
          onClick={handleGenerateReport}
          disabled={isLoading || !validateDateRange()}
        >
          <Eye className="h-4 w-4 mr-2" />
          {isLoading ? 'Membuat...' : 'Lihat Laporan'}
        </Button>
      </div>
    </div>
  );
}