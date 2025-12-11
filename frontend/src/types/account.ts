export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  isActive: boolean;
  balance: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  parent?: Account;
  children?: Account[];
}

export interface CreateAccountRequest {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  description?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const ACCOUNT_TYPES: { value: AccountType; label: string; prefix: string }[] = [
  { value: 'ASSET', label: 'Aset', prefix: '1' },
  { value: 'LIABILITY', label: 'Kewajiban', prefix: '2' },
  { value: 'EQUITY', label: 'Ekuitas', prefix: '3' },
  { value: 'REVENUE', label: 'Pendapatan', prefix: '4' },
  { value: 'EXPENSE', label: 'Beban', prefix: '5' },
];

export function validateAccountCode(code: string): boolean {
  const codePattern = /^[1-5]\d{3}$/;
  return codePattern.test(code);
}

export function getAccountTypeFromCode(code: string): AccountType | null {
  if (!validateAccountCode(code)) return null;
  
  const firstDigit = code.charAt(0);
  switch (firstDigit) {
    case '1': return 'ASSET';
    case '2': return 'LIABILITY';
    case '3': return 'EQUITY';
    case '4': return 'REVENUE';
    case '5': return 'EXPENSE';
    default: return null;
  }
}

export function validateAccountHierarchy(parentCode: string, childCode: string): boolean {
  if (parentCode.length >= childCode.length) return false;
  return childCode.startsWith(parentCode);
}