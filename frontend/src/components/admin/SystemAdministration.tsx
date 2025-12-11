import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Database, 
  Download, 
  Upload, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  HardDrive,
  Activity,
  Users,
  FileText
} from 'lucide-react';

interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  status: 'completed' | 'failed' | 'in_progress';
  type: 'full' | 'incremental';
  location: string;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  databaseSize: number;
  lastBackup: Date | null;
  systemUptime: number;
  memoryUsage: number;
  diskUsage: number;
}

export const SystemAdministration: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTransactions: 0,
    databaseSize: 0,
    lastBackup: null,
    systemUptime: 0,
    memoryUsage: 0,
    diskUsage: 0
  });
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemData = async () => {
    try {
      const [backupsResponse, statsResponse] = await Promise.all([
        fetch('/api/backup/list'),
        fetch('/api/system/stats')
      ]);

      if (backupsResponse.ok) {
        const backupsData = await backupsResponse.json();
        setBackups(backupsData.backups || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setSystemStats(statsData.stats || systemStats);
      }
    } catch (error) {
      console.error('Failed to fetch system data:', error);
    }
  };

  const createBackup = async (type: 'full' | 'incremental' = 'full') => {
    setIsCreatingBackup(true);
    try {
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });

      if (response.ok) {
        await fetchSystemData(); // Refresh backup list
      } else {
        throw new Error('Backup creation failed');
      }
    } catch (error) {
      console.error('Backup creation error:', error);
      alert('Failed to create backup. Please try again.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) {
      alert('Please select a backup to restore');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to restore this backup? This will overwrite all current data and cannot be undone.'
    );

    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/backup/restore/${selectedBackup}`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Backup restored successfully. Please refresh the application.');
      } else {
        throw new Error('Backup restoration failed');
      }
    } catch (error) {
      console.error('Backup restoration error:', error);
      alert('Failed to restore backup. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    try {
      const response = await fetch('/api/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isMaintenanceMode })
      });

      if (response.ok) {
        setIsMaintenanceMode(!isMaintenanceMode);
      } else {
        throw new Error('Failed to toggle maintenance mode');
      }
    } catch (error) {
      console.error('Maintenance mode toggle error:', error);
      alert('Failed to toggle maintenance mode. Please try again.');
    }
  };

  const verifyBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/backup/verify/${backupId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.valid ? 'Backup verification successful' : 'Backup verification failed');
      } else {
        throw new Error('Backup verification failed');
      }
    } catch (error) {
      console.error('Backup verification error:', error);
      alert('Failed to verify backup. Please try again.');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Administration</h2>
          <p className="text-gray-600">Manage backups, system maintenance, and monitoring</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isMaintenanceMode 
              ? 'bg-orange-100 text-orange-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {isMaintenanceMode ? 'Maintenance Mode' : 'Normal Operation'}
          </div>
          <Button
            onClick={toggleMaintenanceMode}
            variant={isMaintenanceMode ? 'default' : 'outline'}
          >
            <Settings className="h-4 w-4 mr-2" />
            {isMaintenanceMode ? 'Exit Maintenance' : 'Enter Maintenance'}
          </Button>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(systemStats.systemUptime)}
            </div>
            <p className="text-xs text-muted-foreground">
              Continuous operation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.activeUsers}/{systemStats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(systemStats.databaseSize)}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStats.totalTransactions.toLocaleString()} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.lastBackup 
                ? new Date(systemStats.lastBackup).toLocaleDateString()
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Automatic backup status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Backup Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={() => createBackup('full')}
                disabled={isCreatingBackup}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isCreatingBackup ? 'Creating...' : 'Create Full Backup'}
              </Button>
              <Button
                onClick={() => createBackup('incremental')}
                disabled={isCreatingBackup}
                variant="outline"
              >
                Create Incremental
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Recent Backups</h4>
              {backups.slice(0, 5).map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {backup.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {backup.status === 'failed' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {backup.status === 'in_progress' && <Clock className="h-4 w-4 text-blue-600" />}
                    <div>
                      <p className="font-medium text-sm">
                        {backup.type === 'full' ? 'Full' : 'Incremental'} Backup
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(backup.timestamp).toLocaleString()} • {formatBytes(backup.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyBackup(backup.id)}
                    >
                      <Shield className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Data Restoration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Warning</span>
              </div>
              <p className="text-sm text-orange-700">
                Data restoration will overwrite all current data. This action cannot be undone.
                Ensure you have a recent backup before proceeding.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Backup to Restore
              </label>
              <Select value={selectedBackup} onValueChange={setSelectedBackup}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a backup..." />
                </SelectTrigger>
                <SelectContent>
                  {backups
                    .filter(b => b.status === 'completed')
                    .map((backup) => (
                      <SelectItem key={backup.id} value={backup.id}>
                        {backup.type === 'full' ? 'Full' : 'Incremental'} - {' '}
                        {new Date(backup.timestamp).toLocaleString()} ({formatBytes(backup.size)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={restoreBackup}
              disabled={!selectedBackup || isRestoring}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isRestoring ? 'Restoring...' : 'Restore Selected Backup'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Memory Usage</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used Memory</span>
                  <span>{systemStats.memoryUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      systemStats.memoryUsage > 80 ? 'bg-red-600' :
                      systemStats.memoryUsage > 60 ? 'bg-orange-600' : 'bg-green-600'
                    }`}
                    style={{ width: `${systemStats.memoryUsage}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Disk Usage</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used Disk Space</span>
                  <span>{systemStats.diskUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      systemStats.diskUsage > 80 ? 'bg-red-600' :
                      systemStats.diskUsage > 60 ? 'bg-orange-600' : 'bg-green-600'
                    }`}
                    style={{ width: `${systemStats.diskUsage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Maintenance Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="font-medium">Export Audit Logs</span>
              <span className="text-sm text-gray-600">Download system logs</span>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Database className="h-6 w-6 text-green-600" />
              <span className="font-medium">Optimize Database</span>
              <span className="text-sm text-gray-600">Clean and optimize</span>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Shield className="h-6 w-6 text-purple-600" />
              <span className="font-medium">Security Scan</span>
              <span className="text-sm text-gray-600">Run security check</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};