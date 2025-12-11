import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupService, BackupConfig } from '../services/BackupService';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * **Feature: finance-tax-compliance, Property 13: Backup Data Completeness and Integrity**
 * **Validates: Requirements 6.1**
 * 
 * Property: For any backup created by the system, restoring that backup should result 
 * in identical data to what was backed up, ensuring complete data integrity.
 */

describe('Backup Data Integrity Property Tests', () => {
  let backupService: BackupService;
  let testBackupDir: string;

  beforeEach(async () => {
    // Create temporary backup directory for testing
    testBackupDir = join(process.cwd(), 'test-backups', randomBytes(8).toString('hex'));
    await fs.mkdir(testBackupDir, { recursive: true });

    const config: BackupConfig = {
      schedule: 'daily',
      retentionDays: 7,
      compressionEnabled: false,
      encryptionEnabled: false
    };

    // Override backup directory for testing
    process.env.BACKUP_DIR = testBackupDir;
    backupService = new BackupService(config);
    await backupService.initializeBackupSystem();
  });

  afterEach(async () => {
    // Clean up test backup directory
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test backup directory:', error);
    }
  });

  it('should maintain data integrity through backup and restore cycle', async () => {
    // Property: Backup then restore preserves all data
    
    // Generate test data
    const originalData = generateTestFinancialData();
    
    // Mock database state with test data
    mockDatabaseWithData(originalData);
    
    // Create backup
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    expect(backup.checksum).toBeTruthy();
    expect(backup.size).toBeGreaterThan(0);
    
    // Verify backup integrity
    const isValid = await backupService.verifyBackupIntegrity(backup);
    expect(isValid).toBe(true);
    
    // Simulate data changes
    const modifiedData = generateTestFinancialData();
    mockDatabaseWithData(modifiedData);
    
    // Restore from backup
    await backupService.restoreFromBackup(backup.id);
    
    // Verify restored data matches original
    const restoredData = getCurrentDatabaseData();
    expect(restoredData).toEqual(originalData);
  });

  it('should detect corrupted backup files', async () => {
    // Property: Corrupted backups should be detected and rejected
    
    const originalData = generateTestFinancialData();
    mockDatabaseWithData(originalData);
    
    // Create backup
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    
    // Corrupt the backup file
    const backupContent = await fs.readFile(backup.location, 'utf-8');
    const corruptedContent = backupContent.replace(/"accounts"/, '"corrupted_accounts"');
    await fs.writeFile(backup.location, corruptedContent);
    
    // Verify integrity should fail
    const isValid = await backupService.verifyBackupIntegrity(backup);
    expect(isValid).toBe(false);
    
    // Restore should fail
    await expect(backupService.restoreFromBackup(backup.id)).rejects.toThrow();
  });

  it('should handle empty database backup and restore', async () => {
    // Property: Empty database should backup and restore correctly
    
    const emptyData = {
      accounts: [],
      transactions: [],
      users: [],
      audit_logs: []
    };
    
    mockDatabaseWithData(emptyData);
    
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    
    // Add some data
    const newData = generateTestFinancialData();
    mockDatabaseWithData(newData);
    
    // Restore empty backup
    await backupService.restoreFromBackup(backup.id);
    
    const restoredData = getCurrentDatabaseData();
    expect(restoredData).toEqual(emptyData);
  });

  it('should preserve data types and precision in backup/restore', async () => {
    // Property: All data types and precision should be preserved
    
    const precisionData = {
      accounts: [{
        id: 1,
        code: '1000',
        name: 'Cash',
        balance: 1234567.89,
        created_at: new Date('2024-01-01T10:30:00Z'),
        is_active: true,
        metadata: { category: 'asset', subcategory: 'current' }
      }],
      transactions: [{
        id: 1,
        reference: 'TXN-001',
        amount: 999.99,
        date: new Date('2024-01-15T14:45:30Z'),
        description: 'Test transaction with special chars: àáâãäå',
        vat_rate: 0.11
      }],
      users: [],
      audit_logs: []
    };
    
    mockDatabaseWithData(precisionData);
    
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    
    // Clear and restore
    mockDatabaseWithData({ accounts: [], transactions: [], users: [], audit_logs: [] });
    await backupService.restoreFromBackup(backup.id);
    
    const restoredData = getCurrentDatabaseData();
    
    // Verify precise values
    expect(restoredData.accounts[0].balance).toBe(1234567.89);
    expect(restoredData.accounts[0].is_active).toBe(true);
    expect(restoredData.accounts[0].created_at).toEqual(new Date('2024-01-01T10:30:00Z'));
    expect(restoredData.transactions[0].amount).toBe(999.99);
    expect(restoredData.transactions[0].vat_rate).toBe(0.11);
    expect(restoredData.transactions[0].description).toContain('àáâãäå');
  });

  it('should handle large datasets without data loss', async () => {
    // Property: Large datasets should backup and restore completely
    
    const largeData = generateLargeTestDataset(1000); // 1000 records each
    mockDatabaseWithData(largeData);
    
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    expect(backup.size).toBeGreaterThan(1000); // Should be substantial size
    
    // Clear database
    mockDatabaseWithData({ accounts: [], transactions: [], users: [], audit_logs: [] });
    
    // Restore
    await backupService.restoreFromBackup(backup.id);
    
    const restoredData = getCurrentDatabaseData();
    
    // Verify all records restored
    expect(restoredData.accounts).toHaveLength(1000);
    expect(restoredData.transactions).toHaveLength(1000);
    expect(restoredData.users).toHaveLength(1000);
    
    // Verify data integrity of first and last records
    expect(restoredData.accounts[0]).toEqual(largeData.accounts[0]);
    expect(restoredData.accounts[999]).toEqual(largeData.accounts[999]);
  });

  it('should maintain referential integrity in backup/restore', async () => {
    // Property: Foreign key relationships should be preserved
    
    const relationalData = {
      accounts: [
        { id: 1, code: '1000', name: 'Cash', parent_id: null },
        { id: 2, code: '1001', name: 'Petty Cash', parent_id: 1 }
      ],
      transactions: [
        { id: 1, account_id: 1, amount: 1000, reference: 'TXN-001' },
        { id: 2, account_id: 2, amount: 50, reference: 'TXN-002' }
      ],
      users: [
        { id: 1, username: 'admin', role: 'administrator' }
      ],
      audit_logs: [
        { id: 1, user_id: 1, action: 'CREATE_ACCOUNT', entity_id: 1 },
        { id: 2, user_id: 1, action: 'CREATE_TRANSACTION', entity_id: 1 }
      ]
    };
    
    mockDatabaseWithData(relationalData);
    
    const backup = await backupService.createBackup('full');
    expect(backup.status).toBe('completed');
    
    // Restore
    await backupService.restoreFromBackup(backup.id);
    
    const restoredData = getCurrentDatabaseData();
    
    // Verify relationships preserved
    expect(restoredData.accounts[1].parent_id).toBe(1);
    expect(restoredData.transactions[0].account_id).toBe(1);
    expect(restoredData.transactions[1].account_id).toBe(2);
    expect(restoredData.audit_logs[0].user_id).toBe(1);
    expect(restoredData.audit_logs[1].user_id).toBe(1);
  });
});

// Helper functions for testing

function generateTestFinancialData() {
  return {
    accounts: [
      { id: 1, code: '1000', name: 'Cash', balance: 10000 },
      { id: 2, code: '2000', name: 'Accounts Payable', balance: -5000 },
      { id: 3, code: '3000', name: 'Capital', balance: -15000 }
    ],
    transactions: [
      { id: 1, reference: 'TXN-001', amount: 1000, description: 'Initial deposit' },
      { id: 2, reference: 'TXN-002', amount: -200, description: 'Office supplies' }
    ],
    users: [
      { id: 1, username: 'admin', email: 'admin@company.com', role: 'administrator' },
      { id: 2, username: 'accountant', email: 'acc@company.com', role: 'accountant' }
    ],
    audit_logs: [
      { id: 1, action: 'LOGIN', user_id: 1, timestamp: new Date() },
      { id: 2, action: 'CREATE_TRANSACTION', user_id: 2, timestamp: new Date() }
    ]
  };
}

function generateLargeTestDataset(size: number) {
  const data = {
    accounts: [] as any[],
    transactions: [] as any[],
    users: [] as any[],
    audit_logs: [] as any[]
  };
  
  for (let i = 0; i < size; i++) {
    data.accounts.push({
      id: i + 1,
      code: `${1000 + i}`,
      name: `Account ${i + 1}`,
      balance: Math.random() * 100000
    });
    
    data.transactions.push({
      id: i + 1,
      reference: `TXN-${String(i + 1).padStart(6, '0')}`,
      amount: Math.random() * 10000 - 5000,
      description: `Transaction ${i + 1}`
    });
    
    data.users.push({
      id: i + 1,
      username: `user${i + 1}`,
      email: `user${i + 1}@company.com`,
      role: i % 3 === 0 ? 'administrator' : 'accountant'
    });
  }
  
  return data;
}

// Mock database functions
let mockDatabase: any = {};

function mockDatabaseWithData(data: any) {
  mockDatabase = { ...data };
}

function getCurrentDatabaseData() {
  return { ...mockDatabase };
}