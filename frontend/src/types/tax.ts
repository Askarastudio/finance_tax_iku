export type VATTransactionType = 
  | 'STANDARD_SALE'      // Penjualan standar 11%
  | 'STANDARD_PURCHASE'  // Pembelian standar 11%
  | 'EXPORT'             // Ekspor 0%
  | 'IMPORT'             // Impor 11%
  | 'EXEMPT'             // Tidak kena pajak
  | 'LUXURY_GOODS'       // Barang mewah (PPnBM)
  | 'FINAL_TAX';         // PPh final

export interface VATRate {
  id: string;
  transactionType: VATTransactionType;
  rate: number; // Percentage (e.g., 11 for 11%)
  effectiveDate: string;
  endDate?: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VATTransaction {
  id: string;
  transactionId: string;
  transactionType: VATTransactionType;
  baseAmount: string; // Amount before VAT
  vatRate: number;
  vatAmount: string; // Calculated VAT amount
  totalAmount: string; // Base + VAT
  taxPeriod: string; // YYYY-MM format
  invoiceNumber?: string;
  counterpartyName?: string;
  counterpartyTaxId?: string; // NPWP
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface VATReport {
  id: string;
  period: string; // YYYY-MM format
  totalSalesVAT: string;
  totalPurchaseVAT: string;
  netVATPayable: string; // Sales VAT - Purchase VAT
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  submittedAt?: string;
  approvedAt?: string;
  transactions: VATTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVATRateRequest {
  transactionType: VATTransactionType;
  rate: number;
  effectiveDate: string;
  endDate?: string;
  description: string;
}

export interface CreateVATTransactionRequest {
  transactionId: string;
  transactionType: VATTransactionType;
  baseAmount: string;
  taxPeriod: string;
  invoiceNumber?: string;
  counterpartyName?: string;
  counterpartyTaxId?: string;
  description: string;
}

export interface VATCalculationResult {
  baseAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  breakdown: {
    description: string;
    amount: number;
  }[];
}

export const VAT_TRANSACTION_TYPES = [
  { value: 'STANDARD_SALE', label: 'Penjualan Standar', defaultRate: 11, description: 'Penjualan barang/jasa kena pajak standar' },
  { value: 'STANDARD_PURCHASE', label: 'Pembelian Standar', defaultRate: 11, description: 'Pembelian barang/jasa kena pajak standar' },
  { value: 'EXPORT', label: 'Ekspor', defaultRate: 0, description: 'Penjualan ekspor (tarif 0%)' },
  { value: 'IMPORT', label: 'Impor', defaultRate: 11, description: 'Pembelian impor' },
  { value: 'EXEMPT', label: 'Tidak Kena Pajak', defaultRate: 0, description: 'Transaksi yang tidak dikenakan PPN' },
  { value: 'LUXURY_GOODS', label: 'Barang Mewah', defaultRate: 11, description: 'Barang kena pajak penjualan atas barang mewah' },
  { value: 'FINAL_TAX', label: 'PPh Final', defaultRate: 0, description: 'Transaksi dengan PPh final' }
];

export function calculateVAT(baseAmount: number, vatRate: number, transactionType: VATTransactionType): VATCalculationResult {
  const vatAmount = (baseAmount * vatRate) / 100;
  const totalAmount = baseAmount + vatAmount;

  const breakdown = [
    { description: 'Jumlah Dasar Pengenaan Pajak', amount: baseAmount },
    { description: `PPN ${vatRate}%`, amount: vatAmount }
  ];

  // Add luxury tax if applicable
  if (transactionType === 'LUXURY_GOODS') {
    const luxuryTaxRate = 20; // Example rate
    const luxuryTax = (baseAmount * luxuryTaxRate) / 100;
    breakdown.push({ description: `PPnBM ${luxuryTaxRate}%`, amount: luxuryTax });
    return {
      baseAmount,
      vatRate,
      vatAmount: vatAmount + luxuryTax,
      totalAmount: baseAmount + vatAmount + luxuryTax,
      breakdown: [...breakdown, { description: 'Total', amount: baseAmount + vatAmount + luxuryTax }]
    };
  }

  breakdown.push({ description: 'Total', amount: totalAmount });

  return {
    baseAmount,
    vatRate,
    vatAmount,
    totalAmount,
    breakdown
  };
}

export function validateTaxId(taxId: string): boolean {
  // Indonesian NPWP format: XX.XXX.XXX.X-XXX.XXX
  const npwpPattern = /^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/;
  return npwpPattern.test(taxId);
}

export function formatTaxPeriod(period: string): string {
  const [year, month] = period.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}