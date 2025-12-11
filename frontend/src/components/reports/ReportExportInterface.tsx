import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, File, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ReportExportOptions } from '@/types/report';

interface ExportJob {
  id: string;
  reportType: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileName: string;
  fileSize?: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
}

interface ReportExportInterfaceProps {
  onExport: (options: ReportExportOptions) => Promise<void>;
  isLoading?: boolean;
}

export function ReportExportInterface({ onExport, isLoading = false }: ReportExportInterfaceProps) {
  const [exportOptions, setExportOptions] = useState<ReportExportOptions>({
    format: 'pdf',
    includeDetails: true,
    includeComparison: false
  });
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Mock export jobs for demonstration
  useEffect(() => {
    const mockJobs: ExportJob[] = [
      {
        id: '1',
        reportType: 'Neraca',
        format: 'PDF',
        status: 'completed',
        progress: 100,
        fileName: 'neraca_2024_01.pdf',
        fileSize: 245760,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3500000).toISOString(),
        downloadUrl: '#'
      },
      {
        id: '2',
        reportType: 'Laporan Laba Rugi',
        format: 'Excel',
        status: 'processing',
        progress: 65,
        fileName: 'laba_rugi_2024_01.xlsx',
        createdAt: new Date(Date.now() - 300000).toISOString()
      },
      {
        id: '3',
        reportType: 'Neraca',
        format: 'CSV',
        status: 'failed',
        progress: 0,
        fileName: 'neraca_2024_01.csv',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        error: 'Insufficient data for the selected period'
      }
    ];
    setExportJobs(mockJobs);
  }, []);

  const handleExportOptionsChange = (field: keyof ReportExportOptions, value: any) => {
    setExportOptions(prev => ({ ...prev, [field]: value }));
  };

  const handleExport = async () => {
    await onExport(exportOptions);
    
    // Add new job to history (mock)
    const newJob: ExportJob = {
      id: Date.now().toString(),
      reportType: 'Current Report',
      format: exportOptions.format.toUpperCase(),
      status: 'pending',
      progress: 0,
      fileName: `report_${Date.now()}.${exportOptions.format}`,
      createdAt: new Date().toISOString()
    };
    
    setExportJobs(prev => [newJob, ...prev]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-600" />;
      case 'excel':
      case 'xlsx':
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case 'csv':
        return <File className="h-4 w-4 text-blue-600" />;
      default:
        return <File className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return 'Selesai';
      case 'processing':
        return 'Memproses';
      case 'pending':
        return 'Menunggu';
      case 'failed':
        return 'Gagal';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Opsi Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Format Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: 'pdf', label: 'PDF', description: 'Format untuk pencetakan dan presentasi', icon: <FileText className="h-5 w-5" /> },
              { value: 'excel', label: 'Excel', description: 'Format untuk analisis lebih lanjut', icon: <FileSpreadsheet className="h-5 w-5" /> },
              { value: 'csv', label: 'CSV', description: 'Format data untuk import ke sistem lain', icon: <File className="h-5 w-5" /> }
            ].map((format) => (
              <div
                key={format.value}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  exportOptions.format === format.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleExportOptionsChange('format', format.value)}
              >
                <div className="flex items-center mb-2">
                  {format.icon}
                  <span className="ml-2 font-medium">{format.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">{format.description}</div>
              </div>
            ))}
          </div>

          {/* Additional Options */}
          <div className="space-y-3 pt-4 border-t">
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

            {exportOptions.includeComparison && (
              <div className="ml-6 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="comparisonStart">Periode Pembanding - Mulai</Label>
                  <input
                    type="date"
                    id="comparisonStart"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    onChange={(e) => handleExportOptionsChange('comparisonPeriod', {
                      ...exportOptions.comparisonPeriod,
                      startDate: e.target.value
                    })}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="comparisonEnd">Periode Pembanding - Selesai</Label>
                  <input
                    type="date"
                    id="comparisonEnd"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    onChange={(e) => handleExportOptionsChange('comparisonPeriod', {
                      ...exportOptions.comparisonPeriod,
                      endDate: e.target.value
                    })}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleExport}
              disabled={isLoading}
              className="min-w-[120px]"
            >
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? 'Mengexport...' : 'Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Riwayat Export</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showHistory ? 'Sembunyikan' : 'Tampilkan'} Riwayat
            </Button>
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent>
            <div className="space-y-3">
              {exportJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada riwayat export
                </div>
              ) : (
                exportJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      {getFormatIcon(job.format)}
                      <div>
                        <div className="font-medium">{job.fileName}</div>
                        <div className="text-sm text-muted-foreground">
                          {job.reportType} • {formatDate(job.createdAt)}
                          {job.fileSize && ` • ${formatFileSize(job.fileSize)}`}
                        </div>
                        {job.error && (
                          <div className="text-sm text-red-600 mt-1">{job.error}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Status */}
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(job.status)}
                        <span className="text-sm">{getStatusText(job.status)}</span>
                      </div>

                      {/* Progress Bar */}
                      {(job.status === 'processing' || job.status === 'pending') && (
                        <div className="w-24">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-center mt-1">{job.progress}%</div>
                        </div>
                      )}

                      {/* Download Button */}
                      {job.status === 'completed' && job.downloadUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(job.downloadUrl, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary */}
            {exportJobs.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-green-600">
                      {exportJobs.filter(job => job.status === 'completed').length}
                    </div>
                    <div className="text-muted-foreground">Selesai</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-yellow-600">
                      {exportJobs.filter(job => job.status === 'processing' || job.status === 'pending').length}
                    </div>
                    <div className="text-muted-foreground">Memproses</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">
                      {exportJobs.filter(job => job.status === 'failed').length}
                    </div>
                    <div className="text-muted-foreground">Gagal</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">
                      {exportJobs.reduce((total, job) => total + (job.fileSize || 0), 0) > 0 
                        ? formatFileSize(exportJobs.reduce((total, job) => total + (job.fileSize || 0), 0))
                        : '0 Bytes'}
                    </div>
                    <div className="text-muted-foreground">Total Size</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}