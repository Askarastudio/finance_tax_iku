import React, { useState } from 'react';
import { FileImportInterface } from '../components/import/FileImportInterface';
import { DataExportInterface } from '../components/export/DataExportInterface';
import { Button } from '../components/ui/button';
import { Upload, Download } from 'lucide-react';

export const ImportExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
        <p className="text-gray-600 mt-2">
          Import and export your financial data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <Button
          variant={activeTab === 'import' ? 'default' : 'outline'}
          onClick={() => setActiveTab('import')}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Import Data
        </Button>
        <Button
          variant={activeTab === 'export' ? 'default' : 'outline'}
          onClick={() => setActiveTab('export')}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'import' && (
        <FileImportInterface 
          onImportComplete={(result) => {
            console.log('Import completed:', result);
            // Handle import completion
          }}
        />
      )}
      
      {activeTab === 'export' && (
        <DataExportInterface />
      )}
    </div>
  );
};