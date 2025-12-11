export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Date;
  source: string;
}

export interface CurrencyConversion {
  originalAmount: string;
  originalCurrency: string;
  convertedAmount: string;
  convertedCurrency: string;
  exchangeRate: number;
  conversionDate: Date;
}

export interface MultiCurrencyJournalEntry {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  currency: string;
  originalAmount?: string;
  originalCurrency?: string;
  exchangeRate?: number;
  description?: string;
}

export class CurrencyService {
  private static readonly BASE_CURRENCY = 'IDR'; // Indonesian Rupiah
  private exchangeRates: Map<string, ExchangeRate> = new Map();

  constructor() {
    // Initialize with some default exchange rates for testing
    this.initializeDefaultRates();
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: string,
    fromCurrency: string,
    toCurrency: string,
    effectiveDate?: Date
  ): Promise<CurrencyConversion> {
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Amount must be a valid number greater than zero');
    }

    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount,
        convertedCurrency: toCurrency,
        exchangeRate: 1.0,
        conversionDate: effectiveDate || new Date()
      };
    }

    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency, effectiveDate);
    const convertedAmount = (numericAmount * exchangeRate).toFixed(2);

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount,
      convertedCurrency: toCurrency,
      exchangeRate,
      conversionDate: effectiveDate || new Date()
    };
  }

  /**
   * Convert multi-currency journal entries to base currency (IDR)
   */
  async convertJournalEntriesToBaseCurrency(
    entries: MultiCurrencyJournalEntry[],
    effectiveDate?: Date
  ): Promise<MultiCurrencyJournalEntry[]> {
    const convertedEntries: MultiCurrencyJournalEntry[] = [];

    for (const entry of entries) {
      const currency = entry.currency || CurrencyService.BASE_CURRENCY;
      
      if (currency === CurrencyService.BASE_CURRENCY) {
        // Already in base currency
        convertedEntries.push({
          ...entry,
          currency: CurrencyService.BASE_CURRENCY
        });
      } else {
        // Convert to base currency
        const debitConversion = entry.debitAmount !== '0.00' 
          ? await this.convertCurrency(entry.debitAmount, currency, CurrencyService.BASE_CURRENCY, effectiveDate)
          : null;
          
        const creditConversion = entry.creditAmount !== '0.00'
          ? await this.convertCurrency(entry.creditAmount, currency, CurrencyService.BASE_CURRENCY, effectiveDate)
          : null;

        convertedEntries.push({
          accountId: entry.accountId,
          debitAmount: debitConversion?.convertedAmount || '0.00',
          creditAmount: creditConversion?.convertedAmount || '0.00',
          currency: CurrencyService.BASE_CURRENCY,
          originalAmount: debitConversion?.originalAmount || creditConversion?.originalAmount,
          originalCurrency: currency,
          exchangeRate: debitConversion?.exchangeRate || creditConversion?.exchangeRate,
          description: entry.description
        });
      }
    }

    return convertedEntries;
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    effectiveDate?: Date
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const rateKey = `${fromCurrency}_${toCurrency}`;
    const rate = this.exchangeRates.get(rateKey);

    if (rate) {
      return rate.rate;
    }

    // Try reverse rate
    const reverseKey = `${toCurrency}_${fromCurrency}`;
    const reverseRate = this.exchangeRates.get(reverseKey);
    
    if (reverseRate) {
      return 1 / reverseRate.rate;
    }

    // Try cross-currency conversion through IDR
    if (fromCurrency !== CurrencyService.BASE_CURRENCY && toCurrency !== CurrencyService.BASE_CURRENCY) {
      try {
        const fromToBase = await this.getExchangeRate(fromCurrency, CurrencyService.BASE_CURRENCY, effectiveDate);
        const baseToTarget = await this.getExchangeRate(CurrencyService.BASE_CURRENCY, toCurrency, effectiveDate);
        return fromToBase * baseToTarget;
      } catch {
        // Fall through to error
      }
    }

    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
  }

  /**
   * Set exchange rate for currency pair
   */
  setExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    effectiveDate?: Date,
    source?: string
  ): void {
    if (rate <= 0) {
      throw new Error('Exchange rate must be greater than zero');
    }

    const exchangeRate: ExchangeRate = {
      fromCurrency,
      toCurrency,
      rate,
      effectiveDate: effectiveDate || new Date(),
      source: source || 'manual'
    };

    this.exchangeRates.set(`${fromCurrency}_${toCurrency}`, exchangeRate);
  }

  /**
   * Validate currency conversion accuracy
   */
  validateConversion(conversion: CurrencyConversion): boolean {
    const originalAmount = parseFloat(conversion.originalAmount);
    const convertedAmount = parseFloat(conversion.convertedAmount);
    const expectedAmount = originalAmount * conversion.exchangeRate;
    
    // Allow for small floating point differences (0.01)
    return Math.abs(convertedAmount - expectedAmount) < 0.01;
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    const currencies = new Set<string>();
    
    for (const rate of this.exchangeRates.values()) {
      currencies.add(rate.fromCurrency);
      currencies.add(rate.toCurrency);
    }
    
    currencies.add(CurrencyService.BASE_CURRENCY);
    
    return Array.from(currencies).sort();
  }

  /**
   * Initialize default exchange rates for testing
   */
  private initializeDefaultRates(): void {
    // Sample exchange rates (in real implementation, these would come from external API)
    this.setExchangeRate('USD', 'IDR', 15750.00, new Date(), 'default');
    this.setExchangeRate('EUR', 'IDR', 17200.00, new Date(), 'default');
    this.setExchangeRate('SGD', 'IDR', 11650.00, new Date(), 'default');
    this.setExchangeRate('JPY', 'IDR', 105.50, new Date(), 'default');
    this.setExchangeRate('CNY', 'IDR', 2180.00, new Date(), 'default');
  }

  /**
   * Calculate cross-currency rate through base currency
   */
  async getCrossCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    effectiveDate?: Date
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    // If direct rate exists, use it
    try {
      return await this.getExchangeRate(fromCurrency, toCurrency, effectiveDate);
    } catch {
      // Calculate through base currency
      const fromToBase = await this.getExchangeRate(fromCurrency, CurrencyService.BASE_CURRENCY, effectiveDate);
      const baseToTarget = await this.getExchangeRate(CurrencyService.BASE_CURRENCY, toCurrency, effectiveDate);
      
      return fromToBase * baseToTarget;
    }
  }
}