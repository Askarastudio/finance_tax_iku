import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, List, TreePine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountForm } from '@/components/accounts/AccountForm';
import { AccountTree } from '@/components/accounts/AccountTree';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account';

export function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

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
        description: 'Kas perusahaan',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        code: '1101',
        name: 'Kas Kecil',
        type: 'ASSET',
        parentId: '1',
        isActive: true,
        balance: '500000.00',
        description: 'Kas untuk keperluan operasional kecil',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        code: '2100',
        name: 'Utang Usaha',
        type: 'LIABILITY',
        isActive: true,
        balance: '750000.00',
        description: 'Utang kepada supplier',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    setAccounts(mockAccounts);
    setFilteredAccounts(mockAccounts);
  }, []);

  // Filter accounts based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredAccounts(accounts);
    } else {
      const filtered = accounts.filter(account =>
        account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAccounts(filtered);
    }
  }, [searchTerm, accounts]);

  const handleCreateAccount = async (data: CreateAccountRequest) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const newAccount: Account = {
        id: Date.now().toString(),
        ...data,
        isActive: true,
        balance: '0.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setAccounts(prev => [...prev, newAccount]);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAccount = async (data: UpdateAccountRequest) => {
    if (!editingAccount) return;
    
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const updatedAccount: Account = {
        ...editingAccount,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      setAccounts(prev => prev.map(acc => 
        acc.id === editingAccount.id ? updatedAccount : acc
      ));
      setEditingAccount(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;
    
    try {
      // TODO: Replace with actual API call
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAccount(null);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const getAccountTypeLabel = (type: string) => {
    const typeMap = {
      'ASSET': 'Aset',
      'LIABILITY': 'Kewajiban',
      'EQUITY': 'Ekuitas',
      'REVENUE': 'Pendapatan',
      'EXPENSE': 'Beban',
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  if (showForm) {
    return (
      <div className="container mx-auto py-6">
        <AccountForm
          account={editingAccount || undefined}
          parentAccounts={accounts.filter(acc => acc.id !== editingAccount?.id)}
          onSubmit={async (data: CreateAccountRequest | UpdateAccountRequest) => {
            if (editingAccount) {
              await handleUpdateAccount(data as UpdateAccountRequest);
            } else {
              await handleCreateAccount(data as CreateAccountRequest);
            }
          }}
          onCancel={handleCancelForm}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bagan Akun</h1>
          <p className="text-muted-foreground">Kelola chart of accounts perusahaan</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('tree')}
              className="rounded-r-none"
            >
              <TreePine className="h-4 w-4 mr-2" />
              Pohon
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4 mr-2" />
              Daftar
            </Button>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Search - only show in list mode */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan kode atau nama akun..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content based on view mode */}
      {viewMode === 'tree' ? (
        <AccountTree
          accounts={accounts}
          onAccountSelect={setSelectedAccount}
          selectedAccountId={selectedAccount?.id}
          showBalances={true}
        />
      ) : (
        /* Accounts List */
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Daftar Akun ({filteredAccounts.length})</CardTitle>
              {selectedAccount && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditAccount(selectedAccount)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAccount(selectedAccount.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Kode</th>
                    <th className="text-left py-3 px-4 font-medium">Nama</th>
                    <th className="text-left py-3 px-4 font-medium">Tipe</th>
                    <th className="text-right py-3 px-4 font-medium">Saldo</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Tidak ada akun yang ditemukan' : 'Belum ada akun'}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((account) => (
                      <tr 
                        key={account.id} 
                        className={`border-b hover:bg-muted/50 cursor-pointer ${
                          selectedAccount?.id === account.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setSelectedAccount(account)}
                      >
                        <td className="py-3 px-4 font-mono">{account.code}</td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{account.name}</div>
                            {account.description && (
                              <div className="text-sm text-muted-foreground">
                                {account.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getAccountTypeLabel(account.type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(account.balance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            account.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {account.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAccount(account);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccount(account.id);
                              }}
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
      )}
    </div>
  );
}