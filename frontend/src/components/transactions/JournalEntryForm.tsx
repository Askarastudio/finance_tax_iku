import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  JournalEntry, 
  Transaction, 
  CreateTransactionRequest, 
  UpdateTransactionRequest,
  validateJournalEntries 
} from '@/types/transaction';
import { Account } from '@/types/account';

interface JournalEntryFormProps {
  transaction?: Transaction;
  accounts: Account[];
  onSubmit: (data: CreateTransactionRequest | UpdateTransactionRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function JournalEntryForm({ 
  transaction, 
  accounts, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: JournalEntryFormProps) {
  const [formData, setFormData] = useState({
    date: transaction?.date || new Date().toISOString().split('T')[0],
    description: transaction?.description || '',
  });

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(
    transaction?.journalEntries || [
      { accountId: '', description: '', debitAmount: '', creditAmount: '' },
      { accountId: '', description: '', debitAmount: '', creditAmount: '' }
    ]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState({
    isValid: false,
    errors: [] as string[],
    totalDebit: 0,
    totalCredit: 0
  });

  const isEditing = !!transaction;

  // Validate journal entries in real-time
  useEffect(() => {
    const result = validateJournalEntries(journalEntries);
    setValidation(result);
  }, [journalEntries]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleJournalEntryChange = (index: number, field: keyof JournalEntry, value: string) => {
    const newEntries = [...journalEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };

    // Auto-populate account name when account is selected
    if (field === 'accountId' && value) {
      const account = accounts.find(acc => acc.id === value);
      if (account) {
        newEntries[index].accountCode = account.code;
        newEntries[index].accountName = account.name;
      }
    }

    setJournalEntries(newEntries);
  };

  const addJournalEntry = () => {
    setJournalEntries(prev => [
      ...prev,
      { accountId: '', description: '', debitAmount: '', creditAmount: '' }
    ]);
  };

  const removeJournalEntry = (index: number) => {
    if (journalEntries.length > 2) {
      setJournalEntries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const balanceEntries = () => {
    const totalDebit = validation.totalDebit;
    const totalCredit = validation.totalCredit;
    const difference = totalDebit - totalCredit;

    if (Math.abs(difference) > 0.01) {
      // Find the last entry with zero amount and balance it
      const newEntries = [...journalEntries];
      for (let i = newEntries.length - 1; i >= 0; i--) {
        const entry = newEntries[i];
        const debit = parseFloat(entry.debitAmount) || 0;
        const credit = parseFloat(entry.creditAmount) || 0;
        
        if (debit === 0 && credit === 0) {
          if (difference > 0) {
            // Need more credit
            newEntries[i].creditAmount = Math.abs(difference).toFixed(2);
          } else {
            // Need more debit
            newEntries[i].debitAmount = Math.abs(difference).toFixed(2);
          }
          break;
        }
      }
      setJournalEntries(newEntries);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Tanggal wajib diisi';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Deskripsi transaksi wajib diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && validation.isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const journalEntriesData = journalEntries.map(entry => ({
        accountId: entry.accountId,
        description: entry.description,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount
      }));

      if (isEditing) {
        const updateData: UpdateTransactionRequest = {
          date: formData.date,
          description: formData.description,
          journalEntries: journalEntriesData
        };
        await onSubmit(updateData);
      } else {
        const createData: CreateTransactionRequest = {
          date: formData.date,
          description: formData.description,
          journalEntries: journalEntriesData
        };
        await onSubmit(createData);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const activeAccounts = accounts.filter(acc => acc.isActive);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Tanggal *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                disabled={isLoading}
                className={errors.date ? 'border-red-500' : ''}
              />
              {errors.date && (
                <p className="text-sm text-red-600">{errors.date}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi Transaksi *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Contoh: Pembayaran sewa kantor"
                disabled={isLoading}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
            </div>
          </div>

          {/* Journal Entries */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Jurnal Entry</h3>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={balanceEntries}
                  disabled={isLoading}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Balance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addJournalEntry}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Baris
                </Button>
              </div>
            </div>

            {/* Journal Entries Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium min-w-[200px]">Akun</th>
                      <th className="text-left py-3 px-4 font-medium min-w-[200px]">Deskripsi</th>
                      <th className="text-right py-3 px-4 font-medium min-w-[120px]">Debit</th>
                      <th className="text-right py-3 px-4 font-medium min-w-[120px]">Kredit</th>
                      <th className="text-center py-3 px-4 font-medium w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map((entry, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-4">
                          <Select
                            value={entry.accountId}
                            onValueChange={(value) => handleJournalEntryChange(index, 'accountId', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih akun" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            value={entry.description}
                            onChange={(e) => handleJournalEntryChange(index, 'description', e.target.value)}
                            placeholder="Deskripsi jurnal entry"
                            disabled={isLoading}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={entry.debitAmount}
                            onChange={(e) => handleJournalEntryChange(index, 'debitAmount', e.target.value)}
                            placeholder="0.00"
                            disabled={isLoading}
                            className="text-right"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={entry.creditAmount}
                            onChange={(e) => handleJournalEntryChange(index, 'creditAmount', e.target.value)}
                            placeholder="0.00"
                            disabled={isLoading}
                            className="text-right"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeJournalEntry(index)}
                            disabled={isLoading || journalEntries.length <= 2}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 font-medium">Total</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(validation.totalDebit.toString())}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(validation.totalCredit.toString())}
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Validation Messages */}
            {validation.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">Error Validasi:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.isValid && validation.totalDebit > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-700">
                  ✓ Jurnal entry valid. Total debit dan kredit seimbang: {formatCurrency(validation.totalDebit.toString())}
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !validation.isValid}
            >
              {isLoading ? 'Menyimpan...' : (isEditing ? 'Update' : 'Simpan')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}