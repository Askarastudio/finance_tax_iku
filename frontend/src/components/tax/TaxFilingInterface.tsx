import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface TaxFiling {
  id: string;
  period: string;
  type: 'VAT' | 'INCOME_TAX' | 'WITHHOLDING_TAX';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submissionDate?: Date;
  dueDate: Date;
  amount: number;
}

export const TaxFilingInterface: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!selectedPeriod || !selectedType) return;
    
    setIsGenerating(true);
    try {
      // API call to generate tax report
      const response = await fetch('/api/tax/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: selectedPeriod,
          type: selectedType
        })
      });
      
      if (response.ok) {
        // Refresh filings list
        fetchFilings();
      }
    } catch (error) {
      console.error('Error generating tax report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportFiling = async (filingId: string, format: 'XML' | 'CSV') => {
    try {
      const response = await fetch(`/api/tax/export/${filingId}?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax-filing-${filingId}.${format.toLowerCase()}`;
        a.click();
      }
    } catch (error) {
      console.error('Error exporting filing:', error);
    }
  };

  const fetchFilings = async () => {
    try {
      const response = await fetch('/api/tax/filings');
      if (response.ok) {
        const data = await response.json();
        setFilings(data);
      }
    } catch (error) {
      console.error('Error fetching filings:', error);
    }
  };

  React.useEffect(() => {
    fetchFilings();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Tax Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tax Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-01">January 2024</SelectItem>
                  <SelectItem value="2024-02">February 2024</SelectItem>
                  <SelectItem value="2024-03">March 2024</SelectItem>
                  <SelectItem value="2024-Q1">Q1 2024</SelectItem>
                  <SelectItem value="2024">Annual 2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Tax Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAT">VAT (PPN)</SelectItem>
                  <SelectItem value="INCOME_TAX">Income Tax (PPh)</SelectItem>
                  <SelectItem value="WITHHOLDING_TAX">Withholding Tax (PPh Potong)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={handleGenerateReport}
            disabled={!selectedPeriod || !selectedType || isGenerating}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate Tax Report'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Filings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filings.map((filing) => (
              <div key={filing.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{filing.type} - {filing.period}</h3>
                    <p className="text-sm text-gray-600">
                      Status: <span className={`font-medium ${
                        filing.status === 'APPROVED' ? 'text-green-600' :
                        filing.status === 'REJECTED' ? 'text-red-600' :
                        filing.status === 'SUBMITTED' ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>{filing.status}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Due: {filing.dueDate.toLocaleDateString('id-ID')}
                    </p>
                    <p className="text-sm text-gray-600">
                      Amount: {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR'
                      }).format(filing.amount)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportFiling(filing.id, 'XML')}
                    >
                      Export XML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportFiling(filing.id, 'CSV')}
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {filings.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No tax filings found. Generate a tax report to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};