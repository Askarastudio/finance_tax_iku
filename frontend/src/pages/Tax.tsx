import React, { useState } from 'react';
import { VATManagement } from '../components/tax/VATManagement';
import { TaxFilingInterface } from '../components/tax/TaxFilingInterface';

export const Tax: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vat' | 'filing'>('vat');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tax Management</h1>
        <p className="text-gray-600">Manage VAT calculations and tax filings</p>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('vat')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'vat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            VAT Management
          </button>
          <button
            onClick={() => setActiveTab('filing')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'filing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tax Filing
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'vat' && <VATManagement />}
        {activeTab === 'filing' && <TaxFilingInterface />}
      </div>
    </div>
  );
};