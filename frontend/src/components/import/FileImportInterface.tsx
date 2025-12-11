import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface ImportError {
  row: number;
  column: string;
  message: string;
  value: string;
}

interface ImportPreview {
  headers: string[];
  rows: any[][];
  totalRows: number;
  validRows: number;
  errors: ImportError[];
}

interface FileImportProps {
  onImportComplete?: (result: any) => void;
}

export const FileImportInterface: React.FC<FileImportProps> = ({ onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const importTypes = [
    { value: 'accounts', label: 'Chart of Accounts' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'journal-entries', label: 'Journal Entries' },
    { value: 'customers', label: 'Customers' },
    { value: 'suppliers', label: 'Suppliers' },
    { value: 'tax-rates', label: 'Tax Rates' }
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/xml',
      'text/xml'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('File type not supported. Please upload CSV, Excel, or XML files.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size too large. Please upload files smaller than 10MB.');
      return;
    }

    setSelectedFile(file);
    setPreview(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const validateAndPreview = async () => {
    if (!selectedFile || !importType) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', importType);

      const response = await fetch('/api/import/validate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const result = await response.json();
      setPreview(result);
    } catch (error) {
      console.error('Validation error:', error);
      alert('Error validating file. Please check the format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const performImport = async () => {
    if (!selectedFile || !importType || !preview) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', importType);
      formData.append('confirmed', 'true');

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        onImportComplete?.(result);
        
        // Reset form
        setSelectedFile(null);
        setImportType('');
        setPreview(null);
        setIsUploading(false);
        setUploadProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Import error:', error);
      alert('Error importing file. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Data Import</h2>
        <p className="text-gray-600">Import data from CSV, Excel, or XML files</p>
      </div>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Select File and Import Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Import Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Type
            </label>
            <Select value={importType} onValueChange={setImportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select what you want to import" />
              </SelectTrigger>
              <SelectContent>
                {importTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">
                Drop your file here, or click to browse
              </p>
              <p className="text-sm text-gray-600">
                Supports CSV, Excel (.xlsx, .xls), and XML files up to 10MB
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              id="file-upload"
              accept=".csv,.xlsx,.xls,.xml"
              onChange={handleFileInputChange}
            />
            <label
              htmlFor="file-upload"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Choose File
            </label>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={validateAndPreview}
              disabled={!selectedFile || !importType || isProcessing}
            >
              {isProcessing ? 'Validating...' : 'Validate & Preview'}
            </Button>
            
            {preview && (
              <Button
                onClick={performImport}
                disabled={isUploading || preview.errors.length > 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {isUploading ? `Importing... ${uploadProgress}%` : 'Import Data'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing data...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview and Validation Results */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {preview.errors.length === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Import Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{preview.totalRows}</p>
                <p className="text-sm text-gray-600">Total Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{preview.validRows}</p>
                <p className="text-sm text-gray-600">Valid Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{preview.errors.length}</p>
                <p className="text-sm text-gray-600">Errors</p>
              </div>
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-900 mb-2">Validation Errors</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {preview.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="font-medium">Row {error.row}, Column {error.column}:</span> {error.message}
                      {error.value && <span className="text-gray-600"> (Value: "{error.value}")</span>}
                    </div>
                  ))}
                  {preview.errors.length > 10 && (
                    <p className="text-sm text-gray-600">
                      ... and {preview.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Data Preview */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Data Preview (First 5 Rows)</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.map((header, index) => (
                        <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 text-sm text-gray-900 border-r">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};