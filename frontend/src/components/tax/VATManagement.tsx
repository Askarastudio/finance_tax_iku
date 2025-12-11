import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calculator, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  VATRate, 
  VATTransaction, 
  VATTransactionType, 
  CreateVATRateRequest,
  CreateVATTransactionRequest,
  VAT_TRANSACTION_TYPES,
  calculateVAT,
  validateTaxId,
  formatTaxPeriod
} from '@/types/tax';

export function VATManagement() {
  const [activeTab, setActiveTab] = useState<'rates' | 'transactions' | 'calculator'>('rates');
  const [vatRates, setVatRates] = useState<VATRate[]>([]);
  const [vatTransactions, setVatTransactions] = useState<VATTransaction[]>([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingRate, setEditingRate] = useState<VATRate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculator state
  const [calculatorData, setCalculatorData] = useState({
    baseAmount: '',
    transactionType: 'STANDARD_SALE' as VATTransactionType,
    customRate: ''
  });

  // Form states
  const [rateForm, setRateForm] = useState<CreateVATRateRequest>({
    transactionType: 'STANDARD_SALE',
    rate: 11,
    effectiveDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [transactionForm, setTransactionForm] = useState<CreateVATTransactionRequest>({
    transactionId: '',
    transactionType: 'STANDARD_SALE',
    baseAmount: '',
    taxPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM
    description: ''
  });

  // Mock data
  useEffect(() => {
    const mockRates: VATRate[] = [
      {
        id: '1',
        transactionType: 'STANDARD_SALE',
        rate: 11,
        effectiveDate: '2024-01-01',
        description: 'PPN standar untuk penjualan',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        transactionType: 'EXPORT',
        rate: 0,
        effectiveDate: '2024-01-01',
        description: 'PPN untuk ekspor (tarif 0%)',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const mockTransactions: VATTransaction[] = [
      {
        id: '1',
        transactionId: 'TRX-001',
        transactionType: 'STANDARD_SALE',
        baseAmount: '10000000.00',
        vatRate: 11,
        vatAmount: '1100000.00',
        totalAmount: '11100000.00',
        taxPeriod: '2024-01',
        invoiceNumber: 'INV-001',
        counterpartyName: 'PT ABC',
        counterpartyTaxId: '01.234.567.8-901.000',
        description: 'Penjualan jasa konsultasi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    setVatRates(mockRates);
    setVatTransactions(mockTransactions);
  }, []);

  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newRate: VATRate = {
        id: Date.now().toString(),
        ...rateForm,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setVatRates(prev => [newRate, ...prev]);
      setShowRateForm(false);
      setRateForm({
        transactionType: 'STANDARD_SALE',
        rate: 11,
        effectiveDate: new Date().toISOString().split('T')[0],
        description: ''
      });
    } catch (error) {
      console.error('Error creating VAT rate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Find applicable VAT rate
      const applicableRate = vatRates.find(rate => 
        rate.transactionType === transactionForm.transactionType && rate.isActive
      );

      if (!applicableRate) {
        alert('Tarif PPN tidak ditemukan untuk jenis transaksi ini');
        return;
      }

      const baseAmount = parseFloat(transactionForm.baseAmount);
      const calculation = calculateVAT(baseAmount, applicableRate.rate, transactionForm.transactionType);

      const newTransaction: VATTransaction = {
        id: Date.now().toString(),
        ...transactionForm,
        vatRate: applicableRate.rate,
        vatAmount: calculation.vatAmount.toFixed(2),
        totalAmount: calculation.totalAmount.toFixed(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setVatTransactions(prev => [newTransaction, ...prev]);
      setShowTransactionForm(false);
      setTransactionForm({
        transactionId: '',
        transactionType: 'STANDARD_SALE',
        baseAmount: '',
        taxPeriod: new Date().toISOString().slice(0, 7),
        description: ''
      });
    } catch (error) {
      console.error('Error creating VAT transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tarif PPN ini?')) return;
    setVatRates(prev => prev.filter(rate => rate.id !== rateId));
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getTransactionTypeLabel = (type: VATTransactionType) => {
    return VAT_TRANSACTION_TYPES.find(t => t.value === type)?.label || type;
  };

  const renderCalculator = () => {
    const baseAmount = parseFloat(calculatorData.baseAmount) || 0;
    const transactionType = calculatorData.transactionType;
    const customRate = parseFloat(calculatorData.customRate);
    
    // Use custom rate if provided, otherwise find from rates
    let vatRate = customRate;
    if (!customRate) {
      const applicableRate = vatRates.find(rate => 
        rate.transactionType === transactionType && rate.isActive
      );
      vatRate = applicableRate?.rate || 0;
    }

    const calculation = baseAmount > 0 ? calculateVAT(baseAmount, vatRate, transactionType) : null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Kalkulator PPN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="calcBaseAmount">Jumlah Dasar (Rp)</Label>
                <Input
                  id="calcBaseAmount"
                  type="number"
                  value={calculatorData.baseAmount}
                  onChange={(e) => setCalculatorData(prev => ({ ...prev, baseAmount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="calcTransactionType">Jenis Transaksi</Label>
                <Select
                  value={calculatorData.transactionType}
                  onValueChange={(value) => setCalculatorData(prev => ({ ...prev, transactionType: value as VATTransactionType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_TRANSACTION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="calcCustomRate">Tarif Custom (%)</Label>
                <Input
                  id="calcCustomRate"
                  type="number"
                  step="0.01"
                  value={calculatorData.customRate}
                  onChange={(e) => setCalculatorData(prev => ({ ...prev, customRate: e.target.value }))}
                  placeholder="Kosongkan untuk tarif otomatis"
                />
              </div>
            </div>

            {calculation && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-3">Hasil Perhitungan</h4>
                <div className="space-y-2">
                  {calculation.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{item.description}</span>
                      <span className="font-mono">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        {[
          { key: 'rates', label: 'Tarif PPN', icon: <FileText className="h-4 w-4" /> },
          { key: 'transactions', label: 'Transaksi PPN', icon: <Calendar className="h-4 w-4" /> },
          { key: 'calculator', label: 'Kalkulator', icon: <Calculator className="h-4 w-4" /> }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* VAT Rates Tab */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Tarif PPN</h2>
              <p className="text-muted-foreground">Kelola tarif PPN berdasarkan jenis transaksi</p>
            </div>
            <Button onClick={() => setShowRateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Tarif
            </Button>
          </div>

          {showRateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Tambah Tarif PPN</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="transactionType">Jenis Transaksi</Label>
                      <Select
                        value={rateForm.transactionType}
                        onValueChange={(value) => setRateForm(prev => ({ ...prev, transactionType: value as VATTransactionType }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_TRANSACTION_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="rate">Tarif (%)</Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        value={rateForm.rate}
                        onChange={(e) => setRateForm(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="effectiveDate">Tanggal Berlaku</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={rateForm.effectiveDate}
                        onChange={(e) => setRateForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">Tanggal Berakhir (Opsional)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={rateForm.endDate || ''}
                        onChange={(e) => setRateForm(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Deskripsi</Label>
                    <Input
                      id="description"
                      value={rateForm.description}
                      onChange={(e) => setRateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Deskripsi tarif PPN"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowRateForm(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Daftar Tarif PPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Jenis Transaksi</th>
                      <th className="text-right py-3 px-4">Tarif</th>
                      <th className="text-left py-3 px-4">Berlaku Dari</th>
                      <th className="text-left py-3 px-4">Deskripsi</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-center py-3 px-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatRates.map(rate => (
                      <tr key={rate.id} className="border-b">
                        <td className="py-3 px-4">{getTransactionTypeLabel(rate.transactionType)}</td>
                        <td className="py-3 px-4 text-right font-mono">{rate.rate}%</td>
                        <td className="py-3 px-4">{new Date(rate.effectiveDate).toLocaleDateString('id-ID')}</td>
                        <td className="py-3 px-4">{rate.description}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            rate.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rate.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteRate(rate.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VAT Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Transaksi PPN</h2>
              <p className="text-muted-foreground">Kelola transaksi yang dikenakan PPN</p>
            </div>
            <Button onClick={() => setShowTransactionForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Transaksi
            </Button>
          </div>

          {showTransactionForm && (
            <Card>
              <CardHeader>
                <CardTitle>Tambah Transaksi PPN</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTransaction} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="transactionId">ID Transaksi</Label>
                      <Input
                        id="transactionId"
                        value={transactionForm.transactionId}
                        onChange={(e) => setTransactionForm(prev => ({ ...prev, transactionId: e.target.value }))}
                        placeholder="TRX-001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="transactionType">Jenis Transaksi</Label>
                      <Select
                        value={transactionForm.transactionType}
                        onValueChange={(value) => setTransactionForm(prev => ({ ...prev, transactionType: value as VATTransactionType }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_TRANSACTION_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="baseAmount">Jumlah Dasar (Rp)</Label>
                      <Input
                        id="baseAmount"
                        type="number"
                        value={transactionForm.baseAmount}
                        onChange={(e) => setTransactionForm(prev => ({ ...prev, baseAmount: e.target.value }))}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxPeriod">Masa Pajak</Label>
                      <Input
                        id="taxPeriod"
                        type="month"
                        value={transactionForm.taxPeriod}
                        onChange={(e) => setTransactionForm(prev => ({ ...prev, taxPeriod: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceNumber">Nomor Faktur (Opsional)</Label>
                      <Input
                        id="invoiceNumber"
                        value={transactionForm.invoiceNumber || ''}
                        onChange={(e) => setTransactionForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        placeholder="010.000-24.00000001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="counterpartyName">Nama Lawan Transaksi (Opsional)</Label>
                      <Input
                        id="counterpartyName"
                        value={transactionForm.counterpartyName || ''}
                        onChange={(e) => setTransactionForm(prev => ({ ...prev, counterpartyName: e.target.value }))}
                        placeholder="PT ABC"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Deskripsi</Label>
                    <Input
                      id="description"
                      value={transactionForm.description}
                      onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Deskripsi transaksi"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowTransactionForm(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Daftar Transaksi PPN</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">ID Transaksi</th>
                      <th className="text-left py-3 px-4">Jenis</th>
                      <th className="text-right py-3 px-4">Dasar</th>
                      <th className="text-right py-3 px-4">PPN</th>
                      <th className="text-right py-3 px-4">Total</th>
                      <th className="text-left py-3 px-4">Masa Pajak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatTransactions.map(transaction => (
                      <tr key={transaction.id} className="border-b">
                        <td className="py-3 px-4 font-mono">{transaction.transactionId}</td>
                        <td className="py-3 px-4">{getTransactionTypeLabel(transaction.transactionType)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(transaction.baseAmount)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(transaction.vatAmount)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(transaction.totalAmount)}</td>
                        <td className="py-3 px-4">{formatTaxPeriod(transaction.taxPeriod)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calculator Tab */}
      {activeTab === 'calculator' && renderCalculator()}
    </div>
  );
}