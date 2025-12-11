import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Download, FileText, Calendar, Filter, CheckCircle, Clock } from 'lucide-react';

interface ExportConfig {
  dataType: string;
  format: string;
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    accounts?: string[];
    categories?: string[];
    status?: string;
  };
  includeHeaders: boolean;
  includeMetadata: boolean;
}

interface ExportJob {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  fileSize?: number;
}

export const DataExportInterface: React.FC = () => {
  const [config, setConfig] = useState<ExportConfig>({
    dataType: '',
    format: 'csv',
    dateRange: {
      start: '',
      end: ''
    },
    filters: {},
    includeHeaders: true,
    includeMetadata: false
  });

  const [exportJobs, setExportJobs] = useState<ExportJob[]>([
    {
      id: '1',
      name: 'Transactions Export - December 2024',
      status: 'completed',
      progress: 100,
      createdAt: new Date('2024-12-10'),
      completedAt: new Date('2024-12-10'),
      downloadUrl: '/downloads/transactions-dec-2024.csv',
      fileSize: 2.5
    },
    {
      id: '2',
      name: 'Chart of Accounts Export',
      status: 'processing',
      progress: 65,
      createdAt: new Date('2024-12-11')
    }
  ]);

  const [isExporting, setIsExporting] = useState(false);

  const dataTypes = [
    { value: 'accounts', label: 'Chart of Accounts' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'journal-entries', label: 'Journal Entries' },
    { value: 'balance-sheet', label: 'Balance Sheet' },
    { value: 'income-statement', label: 'Income Statement' },
    { value: 'cash-flow', label: 'Cash Flow Statement' },
    { value: 'tax-reports', label: 'Tax Reports' },
    { value: 'audit-trail', label: 'Audit Trail' }
  ];

  const formats = [
    { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
    { value: 'xlsx', label: 'Excel', description: 'Microsoft Excel format' },
    { value: 'pdf', label: 'PDF', description: 'Portable Document Format' },
    { value: 'xml', label: 'XML', description: 'Extensible Markup Language' },
    { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' }
  ];

  const handleConfigChange = (field: keyof ExportConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setConfig(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value
      }
    }));
  };

  const startExport = async () => {
    if (!config.dataType || !config.format) {
      alert('Please select data type and format');
      return;
    }

    setIsExporting(true);
    
    try {
      const response = await fetch('/api/export/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Export failed to start');
      }

      const result = await response.json();
      
      // Add new export job to the list
      const newJob: ExportJob = {
        id: result.jobId,
        name: `${dataTypes.find(t => t.value === config.dataType)?.label} Export - ${new Date().toLocaleDateString()}`,
        status: 'pending',
        progress: 0,
        createdAt: new Date()
      };

      setExportJobs(prev => [newJob, ...prev]);
      
      // Reset form
      setConfig({
        dataType: '',
        format: 'csv',
        dateRange: { start: '', end: '' },
        filters: {},
        includeHeaders: true,
        includeMetadata: false
      });

    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to start export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (job: ExportJob) => {
    if (job.downloadUrl) {
      const link = document.createElement('a');
      link.href = job.downloadUrl;
      link.download = job.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <FileText className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Data Export</h2>
        <p className="text-gray-600">Export your financial data in various formats</p>
      </div>

      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Type Selection */}
            <div>
              <Label htmlFor="dataType">Data Type</Label>
              <Select 
                value={config.dataType} 
                onValueChange={(value) => handleConfigChange('dataType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select data to export" />
                </SelectTrigger>
                <SelectContent>
                  {dataTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection */}
            <div>
              <Label htmlFor="format">Export Format</Label>
              <Select 
                value={config.format} 
                onValueChange={(value) => handleConfigChange('format', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <div>
                        <div className="font-medium">{format.label}</div>
                        <div className="text-sm text-gray-600">{format.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={config.dateRange.start}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={config.dateRange.end}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeHeaders"
                checked={config.includeHeaders}
                onChange={(e) => handleConfigChange('includeHeaders', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeHeaders">Include column headers</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeMetadata"
                checked={config.includeMetadata}
                onChange={(e) => handleConfigChange('includeMetadata', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeMetadata">Include metadata and audit information</Label>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={startExport}
              disabled={isExporting || !config.dataType || !config.format}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Starting Export...' : 'Start Export'}
            </Button>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exportJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <p className="font-medium text-gray-900">{job.name}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className={getStatusColor(job.status)}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {job.createdAt.toLocaleDateString()}
                      </span>
                      {job.fileSize && (
                        <span>{job.fileSize} MB</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {job.status === 'processing' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{job.progress}%</span>
                    </div>
                  )}
                  
                  {job.status === 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => downloadFile(job)}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  )}
                  
                  {job.status === 'failed' && (
                    <Button size="sm" variant="outline">
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Export Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setConfig({
                  ...config,
                  dataType: 'transactions',
                  format: 'csv',
                  dateRange: {
                    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0]
                  }
                });
              }}
            >
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="font-medium">Monthly Transactions</span>
              <span className="text-sm text-gray-600">Current month CSV export</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setConfig({
                  ...config,
                  dataType: 'balance-sheet',
                  format: 'pdf',
                  dateRange: {
                    start: '',
                    end: new Date().toISOString().split('T')[0]
                  }
                });
              }}
            >
              <FileText className="h-6 w-6 text-green-600" />
              <span className="font-medium">Balance Sheet PDF</span>
              <span className="text-sm text-gray-600">Current position report</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setConfig({
                  ...config,
                  dataType: 'accounts',
                  format: 'xlsx',
                  dateRange: { start: '', end: '' }
                });
              }}
            >
              <FileText className="h-6 w-6 text-purple-600" />
              <span className="font-medium">Chart of Accounts</span>
              <span className="text-sm text-gray-600">Complete account list</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};