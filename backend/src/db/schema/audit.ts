import { pgTable, uuid, varchar, text, json, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Audit action types
export const auditActionEnum = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT'
} as const;

export type AuditAction = typeof auditActionEnum[keyof typeof auditActionEnum];

// Audit resource types
export const auditResourceEnum = {
  USER: 'USER',
  ACCOUNT: 'ACCOUNT',
  TRANSACTION: 'TRANSACTION',
  REPORT: 'REPORT',
  TAX: 'TAX',
  BACKUP: 'BACKUP',
  SYSTEM: 'SYSTEM'
} as const;

export type AuditResource = typeof auditResourceEnum[keyof typeof auditResourceEnum];

// Audit log table definition
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: varchar('action', { length: 20 }).notNull().$type<AuditAction>(),
  resource: varchar('resource', { length: 20 }).notNull().$type<AuditResource>(),
  resourceId: uuid('resource_id'), // ID of the affected resource
  details: json('details'), // Additional context about the action
  ipAddress: varchar('ip_address', { length: 45 }), // Support IPv6
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  userIdx: index('audit_logs_user_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  resourceIdx: index('audit_logs_resource_idx').on(table.resource),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
  resourceIdIdx: index('audit_logs_resource_id_idx').on(table.resourceId)
}));

// Audit log relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));

// Audit logging helper functions
export interface AuditLogData {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export function createAuditLogEntry(data: AuditLogData) {
  return {
    id: crypto.randomUUID(),
    userId: data.userId,
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId || null,
    details: data.details || null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    timestamp: new Date()
  };
}

// Audit trail validation
export function validateAuditAction(action: string): action is AuditAction {
  return Object.values(auditActionEnum).includes(action as AuditAction);
}

export function validateAuditResource(resource: string): resource is AuditResource {
  return Object.values(auditResourceEnum).includes(resource as AuditResource);
}