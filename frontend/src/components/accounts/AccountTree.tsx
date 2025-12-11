import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Account } from '@/types/account';

interface AccountTreeProps {
  accounts: Account[];
  onAccountSelect?: (account: Account) => void;
  selectedAccountId?: string;
  showBalances?: boolean;
}

interface TreeNode {
  account: Account;
  children: TreeNode[];
  level: number;
}

export function AccountTree({ 
  accounts, 
  onAccountSelect, 
  selectedAccountId,
  showBalances = true 
}: AccountTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  // Build hierarchical tree structure
  const treeData = useMemo(() => {
    const filteredAccounts = showInactive 
      ? accounts 
      : accounts.filter(acc => acc.isActive);

    // Create a map for quick lookup
    const accountMap = new Map<string, Account>();
    filteredAccounts.forEach(account => {
      accountMap.set(account.id, account);
    });

    // Build tree structure
    const buildTree = (parentId: string | null = null, level: number = 0): TreeNode[] => {
      return filteredAccounts
        .filter(account => account.parentId === parentId)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(account => ({
          account,
          children: buildTree(account.id, level + 1),
          level
        }));
    };

    return buildTree();
  }, [accounts, showInactive]);

  const toggleExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.account.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const getAccountTypeColor = (type: string) => {
    const colors = {
      'ASSET': 'text-blue-600 bg-blue-50',
      'LIABILITY': 'text-red-600 bg-red-50',
      'EQUITY': 'text-green-600 bg-green-50',
      'REVENUE': 'text-purple-600 bg-purple-50',
      'EXPENSE': 'text-orange-600 bg-orange-50',
    };
    return colors[type as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const renderTreeNode = (node: TreeNode) => {
    const { account, children, level } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(account.id);
    const isSelected = selectedAccountId === account.id;

    return (
      <div key={account.id} className="select-none">
        {/* Account Row */}
        <div
          className={`flex items-center py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md ${
            isSelected ? 'bg-primary/10 border border-primary/20' : ''
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => onAccountSelect?.(account)}
        >
          {/* Expand/Collapse Button */}
          <div className="w-6 h-6 flex items-center justify-center mr-2">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(account.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>

          {/* Account Code */}
          <div className="font-mono text-sm font-medium min-w-[80px] mr-3">
            {account.code}
          </div>

          {/* Account Name */}
          <div className="flex-1 min-w-0 mr-3">
            <div className="font-medium truncate">{account.name}</div>
            {account.description && (
              <div className="text-xs text-muted-foreground truncate">
                {account.description}
              </div>
            )}
          </div>

          {/* Account Type Badge */}
          <div className={`px-2 py-1 rounded-full text-xs font-medium mr-3 ${getAccountTypeColor(account.type)}`}>
            {account.type}
          </div>

          {/* Balance */}
          {showBalances && (
            <div className="text-right min-w-[120px] mr-3">
              <div className="font-mono text-sm">
                {formatCurrency(account.balance)}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="min-w-[60px] text-center">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              account.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {account.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Struktur Bagan Akun</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Sembunyikan Nonaktif
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Tampilkan Nonaktif
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={expandAll}>
              Buka Semua
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Tutup Semua
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="flex items-center py-2 px-3 border-b font-medium text-sm text-muted-foreground">
          <div className="w-6 mr-2"></div>
          <div className="min-w-[80px] mr-3">Kode</div>
          <div className="flex-1 mr-3">Nama Akun</div>
          <div className="min-w-[80px] mr-3 text-center">Tipe</div>
          {showBalances && (
            <div className="min-w-[120px] mr-3 text-right">Saldo</div>
          )}
          <div className="min-w-[60px] text-center">Status</div>
        </div>

        {/* Tree Content */}
        <div className="max-h-[600px] overflow-y-auto">
          {treeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {showInactive ? 'Tidak ada akun' : 'Tidak ada akun aktif'}
            </div>
          ) : (
            treeData.map(node => renderTreeNode(node))
          )}
        </div>

        {/* Summary */}
        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map(type => {
              const typeAccounts = accounts.filter(acc => 
                acc.type === type && (showInactive || acc.isActive)
              );
              const totalBalance = typeAccounts.reduce(
                (sum, acc) => sum + parseFloat(acc.balance), 
                0
              );
              
              return (
                <div key={type} className="text-center">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getAccountTypeColor(type)}`}>
                    {type}
                  </div>
                  <div className="mt-1 font-mono text-xs">
                    {typeAccounts.length} akun
                  </div>
                  {showBalances && (
                    <div className="font-mono text-xs text-muted-foreground">
                      {formatCurrency(totalBalance.toString())}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}