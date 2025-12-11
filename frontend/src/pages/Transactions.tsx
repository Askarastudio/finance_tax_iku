import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Eye, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JournalEntryForm } from '@/components/transactions/JournalEntryForm';
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '@/types/transaction';
import { Account } from '@/types/account';

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });
  const [accountFilter, setAccountFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for development
  useEffect(() => {
    const mockAccounts: Account[] = [
      {
        id: '1',
        code: '1100',
        name: 'Kas',
        type: 'ASSET',
        isActive: true,
        balance: '1000000.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        code: '5100',
        name: 'Beban Sewa',
        type: 'EXPENSE',
        isActive: true,
        balance: '0.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        code: '4100',
        name: 'Pendapatan Jasa',
        type: 'REVENUE',
        isActive: true,
        balance: '0.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockTransactions: Transaction[] = [
      {
        id: '1',
        referenceNumber: 'TRX-2024-001',
        date: '2024-01-15',
        description: 'Pembayaran sewa kantor bulan Januari',
        totalAmount: '5000000.00',
        journalEntries: [
          {
            id: '1',
            accountId: '2',
            accountCode: '5100',
            accountName: 'Beban Sewa',
            description: 'Sewa kantor Januari 2024',
            debitAmount: '5000000.00',
            creditAmount: '0.00'
          },
          {
            id: '2',
            accountId: '1',
            accountCode: '1100',
            accountName: 'Kas',
            description: 'Pembayaran sewa kantor',
            debitAmount: '0.00',
            creditAmount: '5000000.00'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        referenceNumber: 'TRX-2024-002',
        date: '2024-01-16',
        description: 'Penerimaan pendapatan jasa konsultasi',
        totalAmount: '10000000.00',
        journalEntries: [
          {
            id: '3',
            accountId: '1',
            accountCode: '1100',
            accountName: 'Kas',
            description: 'Penerimaan jasa konsultasi',
            debitAmount: '10000000.00',
            creditAmount: '0.00'
          },
          {
            id: '4',
            accountId: '3',
            accountCode: '4100',
            accountName: 'Pendapatan Jasa',
            description: 'Jasa konsultasi PT ABC',
            debitAmount: '0.00',
            creditAmount: '10000000.00'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    setAccounts(mockAccounts);
    setTransactions(mockTransactions);
    setFilteredTransactions(mockTransactions);
  }, []);

  // Filter transactions
  useEffect(() => {
    let filtered = transactions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.journalEntries.some(entry => 
          entry.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Date filter
    if (dateFilter.from) {
      filtered = filtered.filter(transaction => transaction.date >= dateFilter.from);
    }
    if (dateFilter.to) {
      filtered = filtered.filter(transaction => transaction.date <= dateFilter.to);
    }

    // Account filter
    if (accountFilter && accountFilter !== 'all') {
      filtered = filtered.filter(transaction =>
        transaction.journalEntries.some(entry => entry.accountId === accountFilter)
      );
    }

    setFilteredTransactions(filtered);
  }, [searchTerm, dateFilter, accountFilter, transactions]);

  const handleCreateTransaction = async (data: CreateTransactionRequest) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        referenceNumber: `TRX-${new Date().getFullYear()}-${String(transactions.length + 1).padStart(3, '0')}`,
        ...data,
        totalAmount: data.journalEntries.reduce((sum, entry) => 
          sum + Math.max(parseFloat(entry.debitAmount) || 0, parseFloat(entry.creditAmount) || 0), 0
        ).toString(),
        journalEntries: data.journalEntries.map((entry, index) => ({
          id: `${Date.now()}-${index}`,
          ...entry,
          accountCode: accounts.find(acc => acc.id === entry.accountId)?.code,
          accountName: accounts.find(acc => acc.id === entry.accountId)?.name,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setTransactions(prev => [newTransaction, ...prev]);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTransaction = async (data: UpdateTransactionRequest) => {
    if (!editingTransaction) return;
    
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const updatedTransaction: Transaction = {
        ...editingTransaction,
        ...data,
        totalAmount: data.journalEntries?.reduce((sum, entry) => 
          sum + Math.max(parseFloat(entry.debitAmount) || 0, parseFloat(entry.creditAmount) || 0), 0
        ).toString() || editingTransaction.totalAmount,
        journalEntries: data.journalEntries?.map((entry, index) => ({
          id: editingTransaction.journalEntries[index]?.id || `${Date.now()}-${index}`,
          ...entry,
          accountCode: accounts.find(acc => acc.id === entry.accountId)?.code,
          accountName: accounts.find(acc => acc.id === entry.accountId)?.name,
        })) || editingTransaction.journalEntries,
        updatedAt: new Date().toISOString(),
      };
      
      setTransactions(prev => prev.map(trx => 
        trx.id === editingTransaction.id ? updatedTransaction : trx
      ));
      setEditingTransaction(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    
    try {
      // TODO: Replace with actual API call
      setTransactions(prev => prev.filter(trx => trx.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleViewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetails(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (showForm) {
    return (
      <div className="container mx-auto py-6">
        <JournalEntryForm
          transaction={editingTransaction || undefined}
          accounts={accounts}
          onSubmit={async (data: CreateTransactionRequest | UpdateTransactionRequest) => {
            if (editingTransaction) {
              await handleUpdateTransaction(data as UpdateTransactionRequest);
            } else {
              await handleCreateTransaction(data as CreateTransactionRequest);
            }
          }}
          onCancel={handleCancelForm}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (showDetails && selectedTransaction) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Detail Transaksi</h1>
            <p className="text-muted-foreground">{selectedTransaction.referenceNumber}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => handleEditTransaction(selectedTransaction)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDetails(false)}
            >
              Kembali
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Transaksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Nomor Referensi</Label>
                <p className="font-mono">{selectedTransaction.referenceNumber}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Tanggal</Label>
                <p>{formatDate(selectedTransaction.date)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Total Amount</Label>
                <p className="font-mono">{formatCurrency(selectedTransaction.totalAmount)}</p>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Deskripsi</Label>
              <p>{selectedTransaction.description}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jurnal Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Akun</th>
                    <th className="text-left py-3 px-4 font-medium">Deskripsi</th>
                    <th className="text-right py-3 px-4 font-medium">Debit</th>
                    <th className="text-right py-3 px-4 font-medium">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransaction.journalEntries.map((entry, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-mono text-sm">{entry.accountCode}</div>
                          <div className="font-medium">{entry.accountName}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{entry.description}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {entry.debitAmount !== '0.00' && entry.debitAmount !== '0' && entry.debitAmount ? 
                          formatCurrency(entry.debitAmount) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {entry.creditAmount !== '0.00' && entry.creditAmount !== '0' && entry.creditAmount ? 
                          formatCurrency(entry.creditAmount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted">
                  <tr>
                    <td colSpan={2} className="py-3 px-4 font-medium">Total</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(
                        selectedTransaction.journalEntries
                          .reduce((sum, entry) => sum + (parseFloat(entry.debitAmount) || 0), 0)
                          .toString()
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(
                        selectedTransaction.journalEntries
                          .reduce((sum, entry) => sum + (parseFloat(entry.creditAmount) || 0), 0)
                          .toString()
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Transaksi</h1>
          <p className="text-muted-foreground">Kelola transaksi dan jurnal entry</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Transaksi
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="Dari tanggal"
                value={dateFilter.from}
                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="Sampai tanggal"
                value={dateFilter.to}
                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter akun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua akun</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Referensi</th>
                  <th className="text-left py-3 px-4 font-medium">Tanggal</th>
                  <th className="text-left py-3 px-4 font-medium">Deskripsi</th>
                  <th className="text-right py-3 px-4 font-medium">Total</th>
                  <th className="text-center py-3 px-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm || dateFilter.from || dateFilter.to || accountFilter ? 
                        'Tidak ada transaksi yang ditemukan' : 'Belum ada transaksi'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono">{transaction.referenceNumber}</td>
                      <td className="py-3 px-4">{formatDate(transaction.date)}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.journalEntries.length} jurnal entries
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(transaction.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTransaction(transaction)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTransaction(transaction)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}