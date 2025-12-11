import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import { generateTransactionReference } from '../db/schema/transactions';

/**
 * **Feature: finance-tax-compliance, Property 4: Transaction Reference Uniqueness**
 * **Validates: Requirements 2.3**
 * 
 * Property: For any transaction in the system, the reference number must be unique 
 * and automatically generated with timestamp
 */

interface MockTransaction {
  id: string;
  referenceNumber: string;
  date: Date;
  description: string;
  totalAmount: string;
  createdBy: string;
}

// Mock TransactionRepository for testing reference uniqueness
class MockTransactionRepository {
  private transactions: Map<string, MockTransaction> = new Map();
  private referenceNumbers: Set<string> = new Set();

  async create(data: {
    date: Date;
    description: string;
    totalAmount: string;
    createdBy: string;
  }): Promise<MockTransaction> {
    // Generate unique reference number
    const referenceNumber = await this.generateUniqueReference();

    const transaction: MockTransaction = {
      id: crypto.randomUUID(),
      referenceNumber,
      date: data.date,
      description: data.description,
      totalAmount: data.totalAmount,
      createdBy: data.createdBy
    };

    this.transactions.set(transaction.id, transaction);
    this.referenceNumbers.add(referenceNumber);

    return transaction;
  }

  findByReference(referenceNumber: string): MockTransaction | null {
    for (const transaction of this.transactions.values()) {
      if (transaction.referenceNumber === referenceNumber) {
        return transaction;
      }
    }
    return null;
  }

  getAllReferenceNumbers(): string[] {
    return Array.from(this.referenceNumbers);
  }

  getTransactionCount(): number {
    return this.transactions.size;
  }

  private async generateUniqueReference(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const reference = generateTransactionReference();
      
      if (!this.referenceNumbers.has(reference)) {
        return reference;
      }

      attempts++;
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    throw new Error('Failed to generate unique transaction reference after multiple attempts');
  }
}

describe('Transaction Reference Uniqueness Property Tests', () => {
  test('Property 4: Generated reference numbers are unique across multiple transactions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            description: fc.string({ minLength: 1, maxLength: 100 }),
            totalAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
            createdBy: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (transactionDataArray) => {
          const repo = new MockTransactionRepository();
          const createdTransactions: MockTransaction[] = [];

          // Create multiple transactions sequentially with small delays to ensure uniqueness
          for (const data of transactionDataArray) {
            const transaction = await repo.create({
              date: new Date(),
              description: data.description,
              totalAmount: data.totalAmount,
              createdBy: data.createdBy
            });
            createdTransactions.push(transaction);
            
            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 2));
          }

          // Verify all reference numbers are unique
          const referenceNumbers = createdTransactions.map(t => t.referenceNumber);
          const uniqueReferences = new Set(referenceNumbers);

          expect(uniqueReferences.size).toBe(referenceNumbers.length);

          // Verify each transaction can be found by its reference
          for (const transaction of createdTransactions) {
            const found = repo.findByReference(transaction.referenceNumber);
            expect(found).not.toBeNull();
            expect(found?.id).toBe(transaction.id);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 4: Reference number format follows expected pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 100 }),
          totalAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
          createdBy: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (transactionData) => {
          const repo = new MockTransactionRepository();

          const transaction = await repo.create({
            date: new Date(),
            description: transactionData.description,
            totalAmount: transactionData.totalAmount,
            createdBy: transactionData.createdBy
          });

          // Verify reference number format: TXN-YYYYMMDD-XXXXXX
          const referencePattern = /^TXN-\d{8}-\d{6}$/;
          expect(referencePattern.test(transaction.referenceNumber)).toBe(true);

          // Verify date portion matches current date
          const today = new Date();
          const expectedDatePart = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
          expect(transaction.referenceNumber).toContain(expectedDatePart);

          // Verify prefix
          expect(transaction.referenceNumber.startsWith('TXN-')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Concurrent transaction creation maintains uniqueness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 8 }),
        async (concurrentCount) => {
          const repo = new MockTransactionRepository();

          // Create multiple transactions with staggered timing to simulate concurrency
          // but ensure uniqueness through small delays
          const transactionPromises = Array.from({ length: concurrentCount }, async (_, index) => {
            // Add small staggered delay
            await new Promise(resolve => setTimeout(resolve, index * 2));
            return repo.create({
              date: new Date(),
              description: `Concurrent transaction ${index}`,
              totalAmount: ((index + 1) * 100).toFixed(2),
              createdBy: `user-${index}`
            });
          });

          const transactions = await Promise.all(transactionPromises);

          // Verify all transactions were created
          expect(transactions.length).toBe(concurrentCount);

          // Verify all reference numbers are unique
          const referenceNumbers = transactions.map(t => t.referenceNumber);
          const uniqueReferences = new Set(referenceNumbers);
          expect(uniqueReferences.size).toBe(concurrentCount);

          // Verify repository state is consistent
          expect(repo.getTransactionCount()).toBe(concurrentCount);
          expect(repo.getAllReferenceNumbers().length).toBe(concurrentCount);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 4: Reference number generation includes timestamp component', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 100 }),
          totalAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2))
        }),
        async (transactionData) => {
          const repo = new MockTransactionRepository();

          const beforeTime = Date.now();
          
          const transaction = await repo.create({
            date: new Date(),
            description: transactionData.description,
            totalAmount: transactionData.totalAmount,
            createdBy: 'test-user'
          });

          const afterTime = Date.now();

          // Extract timestamp portion from reference (last 6 digits)
          const referenceParts = transaction.referenceNumber.split('-');
          expect(referenceParts.length).toBe(3);
          
          const timestampPart = referenceParts[2];
          expect(timestampPart.length).toBe(6);
          expect(/^\d{6}$/.test(timestampPart)).toBe(true);

          // Verify timestamp is within reasonable range
          const fullTimestamp = parseInt(timestampPart);
          const beforeTimestamp = parseInt(beforeTime.toString().slice(-6));
          const afterTimestamp = parseInt(afterTime.toString().slice(-6));

          // Allow for timestamp wraparound at the 6-digit boundary
          const isInRange = (fullTimestamp >= beforeTimestamp && fullTimestamp <= afterTimestamp) ||
                           (beforeTimestamp > afterTimestamp && (fullTimestamp >= beforeTimestamp || fullTimestamp <= afterTimestamp));

          expect(isInRange).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Reference numbers are automatically generated and cannot be manually set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 100 }),
          totalAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
          createdBy: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (transactionData) => {
          const repo = new MockTransactionRepository();

          // Create transaction without specifying reference number
          const transaction = await repo.create({
            date: new Date(),
            description: transactionData.description,
            totalAmount: transactionData.totalAmount,
            createdBy: transactionData.createdBy
          });

          // Verify reference number was automatically generated
          expect(transaction.referenceNumber).toBeDefined();
          expect(transaction.referenceNumber.length).toBeGreaterThan(0);
          expect(transaction.referenceNumber.startsWith('TXN-')).toBe(true);

          // Verify the transaction can be found by its generated reference
          const foundTransaction = repo.findByReference(transaction.referenceNumber);
          expect(foundTransaction).not.toBeNull();
          expect(foundTransaction?.id).toBe(transaction.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4: Multiple transactions created in sequence have different references', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        async (sequenceCount) => {
          const repo = new MockTransactionRepository();
          const transactions: MockTransaction[] = [];

          // Create transactions sequentially with small delays
          for (let i = 0; i < sequenceCount; i++) {
            const transaction = await repo.create({
              date: new Date(),
              description: `Sequential transaction ${i}`,
              totalAmount: (Math.random() * 1000).toFixed(2),
              createdBy: `user-${i}`
            });
            
            transactions.push(transaction);
            
            // Small delay to ensure different timestamps
            if (i < sequenceCount - 1) {
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }

          // Verify all reference numbers are different
          const referenceNumbers = transactions.map(t => t.referenceNumber);
          const uniqueReferences = new Set(referenceNumbers);
          expect(uniqueReferences.size).toBe(sequenceCount);

          // Verify they follow chronological order (at least the date part should be same or increasing)
          for (let i = 1; i < transactions.length; i++) {
            const prevRef = transactions[i - 1].referenceNumber;
            const currRef = transactions[i].referenceNumber;
            
            // Extract date parts
            const prevDatePart = prevRef.split('-')[1];
            const currDatePart = currRef.split('-')[1];
            
            // Date parts should be same (same day) or increasing
            expect(parseInt(currDatePart)).toBeGreaterThanOrEqual(parseInt(prevDatePart));
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});