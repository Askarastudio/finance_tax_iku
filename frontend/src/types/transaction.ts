export interface JournalEntry {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  date: string;
  description: string;
  totalAmount: string;
  journalEntries: JournalEntry[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateTransactionRequest {
  date: string;
  description: string;
  journalEntries: Omit<JournalEntry, 'id'>[];
}

export interface UpdateTransactionRequest {
  date?: string;
  description?: string;
  journalEntries?: Omit<JournalEntry, 'id'>[];
}

export function validateJournalEntries(entries: JournalEntry[]): {
  isValid: boolean;
  errors: string[];
  totalDebit: number;
  totalCredit: number;
} {
  const errors: string[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  if (entries.length < 2) {
    errors.push('Minimal harus ada 2 jurnal entry');
  }

  entries.forEach((entry, index) => {
    const debit = parseFloat(entry.debitAmount) || 0;
    const credit = parseFloat(entry.creditAmount) || 0;

    if (!entry.accountId) {
      errors.push(`Baris ${index + 1}: Akun harus dipilih`);
    }

    if (!entry.description.trim()) {
      errors.push(`Baris ${index + 1}: Deskripsi harus diisi`);
    }

    if (debit === 0 && credit === 0) {
      errors.push(`Baris ${index + 1}: Debit atau kredit harus diisi`);
    }

    if (debit > 0 && credit > 0) {
      errors.push(`Baris ${index + 1}: Tidak boleh mengisi debit dan kredit bersamaan`);
    }

    if (debit < 0 || credit < 0) {
      errors.push(`Baris ${index + 1}: Jumlah tidak boleh negatif`);
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  const difference = Math.abs(totalDebit - totalCredit);
  if (difference > 0.01) { // Allow small rounding differences
    errors.push(`Total debit (${totalDebit.toLocaleString('id-ID')}) harus sama dengan total kredit (${totalCredit.toLocaleString('id-ID')})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalDebit,
    totalCredit
  };
}