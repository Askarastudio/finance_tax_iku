import { Elysia, t } from 'elysia';
import { BackupService, BackupConfig } from '../services/BackupService';

const defaultBackupConfig: BackupConfig = {
  schedule: 'daily',
  retentionDays: 30,
  compressionEnabled: true,
  encryptionEnabled: false
};

const backupService = new BackupService(defaultBackupConfig);

export const BackupController = new Elysia({ prefix: '/api/backup' })
  .post('/create', async ({ body }) => {
    try {
      const { type = 'full' } = body as { type?: 'full' | 'incremental' };
      const backup = await backupService.createBackup(type);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, {
    body: t.Object({
      type: t.Optional(t.Union([t.Literal('full'), t.Literal('incremental')]))
    })
  })

  .get('/list', async () => {
    try {
      const backups = await backupService.listBackups();
      
      return {
        success: true,
        backups
      };
    } catch (error) {
      console.error('Failed to list backups:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  .post('/restore/:id', async ({ params }) => {
    try {
      await backupService.restoreFromBackup(params.id);
      
      return {
        success: true,
        message: 'Backup restored successfully'
      };
    } catch (error) {
      console.error('Backup restoration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  .delete('/:id', async ({ params }) => {
    try {
      await backupService.deleteBackup(params.id);
      
      return {
        success: true,
        message: 'Backup deleted successfully'
      };
    } catch (error) {
      console.error('Backup deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  .post('/verify/:id', async ({ params }) => {
    try {
      const backups = await backupService.listBackups();
      const backup = backups.find(b => b.id === params.id);
      
      if (!backup) {
        return {
          success: false,
          error: 'Backup not found'
        };
      }

      const isValid = await backupService.verifyBackupIntegrity(backup);
      
      return {
        success: true,
        valid: isValid,
        backup
      };
    } catch (error) {
      console.error('Backup verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  .get('/status', async () => {
    try {
      const backups = await backupService.listBackups();
      const recentBackups = backups.slice(0, 5);
      
      const stats = {
        totalBackups: backups.length,
        completedBackups: backups.filter(b => b.status === 'completed').length,
        failedBackups: backups.filter(b => b.status === 'failed').length,
        totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0),
        lastBackup: backups[0] || null,
        recentBackups
      };
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Failed to get backup status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })

  .post('/initialize', async () => {
    try {
      await backupService.initializeBackupSystem();
      
      return {
        success: true,
        message: 'Backup system initialized successfully'
      };
    } catch (error) {
      console.error('Backup system initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });