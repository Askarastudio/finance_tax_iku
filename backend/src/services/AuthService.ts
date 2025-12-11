import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { users, UserRole, userRoleEnum, hasPermission, canAccessResource, validateUserRole } from '../db/schema/users';
import { auditLogs } from '../db/schema/audit';

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  sessionToken: string;
  expiresAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordChangeData {
  userId: string;
  currentPassword: string;
  newPassword: string;
  changedBy: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  user?: AuthenticatedUser;
  reason?: string;
}

export class AuthService {
  private static readonly SESSION_DURATION_HOURS = 8; // Indonesian compliance: 8-hour sessions
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 30;
  private activeSessions: Map<string, UserSession> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  /**
   * Authenticate user with secure session management
   */
  async authenticateUser(credentials: LoginCredentials): Promise<UserSession> {
    // Check for account lockout
    await this.checkAccountLockout(credentials.email);

    // Validate credentials
    const user = await this.validateCredentials(credentials);
    if (!user) {
      await this.recordFailedLogin(credentials.email);
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      await this.logAuditEvent(user.id, 'LOGIN_ATTEMPT_INACTIVE', 'Attempted login with inactive account');
      throw new Error('Account is inactive');
    }

    // Create session
    const session = await this.createUserSession(user);

    // Update last login time
    await this.updateLastLogin(user.id);

    // Clear failed login attempts
    this.loginAttempts.delete(credentials.email);

    // Log successful authentication
    await this.logAuditEvent(user.id, 'LOGIN_SUCCESS', `User logged in from session ${session.sessionToken.substring(0, 8)}...`);

    return session;
  }

  /**
   * Validate session token and return user information
   */
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    const session = this.activeSessions.get(sessionToken);
    
    if (!session) {
      return { isValid: false, reason: 'Session not found' };
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(sessionToken);
      await this.logAuditEvent(session.id, 'SESSION_EXPIRED', 'Session expired due to timeout');
      return { isValid: false, reason: 'Session expired' };
    }

    // Get current user data from database
    const [user] = await db.select().from(users).where(eq(users.id, session.id));
    
    if (!user || !user.isActive) {
      this.activeSessions.delete(sessionToken);
      return { isValid: false, reason: 'User not found or inactive' };
    }

    // Extend session if valid
    session.expiresAt = new Date(Date.now() + AuthService.SESSION_DURATION_HOURS * 60 * 60 * 1000);
    this.activeSessions.set(sessionToken, session);

    return {
      isValid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  }

  /**
   * Logout user and invalidate session
   */
  async logoutUser(sessionToken: string): Promise<void> {
    const session = this.activeSessions.get(sessionToken);
    
    if (session) {
      this.activeSessions.delete(sessionToken);
      await this.logAuditEvent(session.id, 'LOGOUT', 'User logged out');
    }
  }

  /**
   * Check if user has specific permission
   */
  checkPermission(userRole: UserRole, permission: string): boolean {
    return hasPermission(userRole, permission);
  }

  /**
   * Check if user can access resource with specific action
   */
  checkResourceAccess(userRole: UserRole, resource: string, action: string): boolean {
    return canAccessResource(userRole, resource, action);
  }

  /**
   * Require specific permission or throw error
   */
  requirePermission(userRole: UserRole, permission: string): void {
    if (!this.checkPermission(userRole, permission)) {
      throw new Error(`Access denied: ${permission} permission required`);
    }
  }

  /**
   * Require supervisory authorization for sensitive operations
   */
  async requireSupervisoryAuth(
    currentUserRole: UserRole,
    supervisorSessionToken: string,
    operation: string
  ): Promise<void> {
    // Check if current user needs supervisory approval
    if (currentUserRole === userRoleEnum.ADMIN) {
      return; // Admins don't need supervisory approval
    }

    // Validate supervisor session
    const supervisorValidation = await this.validateSession(supervisorSessionToken);
    if (!supervisorValidation.isValid || !supervisorValidation.user) {
      throw new Error('Invalid supervisor session');
    }

    // Check if supervisor has higher privileges
    const supervisorRole = supervisorValidation.user.role;
    if (!this.isHigherRole(supervisorRole, currentUserRole)) {
      throw new Error('Supervisor must have higher privileges than current user');
    }

    // Log supervisory authorization
    await this.logAuditEvent(
      supervisorValidation.user.id,
      'SUPERVISORY_AUTH',
      `Authorized ${operation} for user with role ${currentUserRole}`
    );
  }

  /**
   * Create new user with role-based validation
   */
  async createUser(userData: CreateUserData, createdBy: string): Promise<AuthenticatedUser> {
    // Validate role
    if (!validateUserRole(userData.role)) {
      throw new Error(`Invalid user role: ${userData.role}`);
    }

    // Check if email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, userData.email));
    if (existingUser.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(userData.password);

    // Create user
    const [newUser] = await db.insert(users).values({
      email: userData.email,
      name: userData.name,
      passwordHash,
      role: userData.role,
      updatedAt: new Date()
    }).returning();

    // Log user creation
    await this.logAuditEvent(createdBy, 'USER_CREATED', `Created user ${userData.email} with role ${userData.role}`);

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      isActive: newUser.isActive,
      lastLoginAt: newUser.lastLoginAt,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    };
  }

  /**
   * Change user password with validation
   */
  async changePassword(data: PasswordChangeData): Promise<void> {
    // Get current user
    const [user] = await db.select().from(users).where(eq(users.id, data.userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(data.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(data.newPassword);

    // Update password
    await db.update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      })
      .where(eq(users.id, data.userId));

    // Invalidate all sessions for this user
    await this.invalidateUserSessions(data.userId);

    // Log password change
    await this.logAuditEvent(data.changedBy, 'PASSWORD_CHANGED', `Password changed for user ${user.email}`);
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string, deactivatedBy: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Update user status
    await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Invalidate all sessions for this user
    await this.invalidateUserSessions(userId);

    // Log deactivation
    await this.logAuditEvent(deactivatedBy, 'USER_DEACTIVATED', `Deactivated user ${user.email}`);
  }

  /**
   * Get all active sessions (for admin monitoring)
   */
  getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Force logout all sessions for a user
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    const sessionsToRemove: string[] = [];
    
    for (const [token, session] of this.activeSessions.entries()) {
      if (session.id === userId) {
        sessionsToRemove.push(token);
      }
    }

    for (const token of sessionsToRemove) {
      this.activeSessions.delete(token);
    }

    await this.logAuditEvent(userId, 'SESSIONS_INVALIDATED', 'All user sessions invalidated');
  }

  /**
   * Validate credentials against database
   */
  private async validateCredentials(credentials: LoginCredentials): Promise<AuthenticatedUser | null> {
    const [user] = await db.select().from(users).where(eq(users.email, credentials.email));
    
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(credentials.password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Create user session with secure token
   */
  private async createUserSession(user: AuthenticatedUser): Promise<UserSession> {
    const sessionToken = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + AuthService.SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const session: UserSession = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      sessionToken,
      expiresAt
    };

    this.activeSessions.set(sessionToken, session);
    return session;
  }

  /**
   * Generate secure session token
   */
  private generateSecureToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const combined = `${timestamp}-${random}`;
    
    // In production, use proper cryptographic token generation
    return Buffer.from(combined).toString('base64');
  }

  /**
   * Hash password using secure algorithm
   */
  private async hashPassword(password: string): Promise<string> {
    // In production, use bcrypt or similar
    // For now, using simple base64 encoding (NOT SECURE)
    return Buffer.from(password).toString('base64');
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // In production, use bcrypt.compare or similar
    const expectedHash = Buffer.from(password).toString('base64');
    return expectedHash === hash;
  }

  /**
   * Update user's last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await db.update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  private async checkAccountLockout(email: string): Promise<void> {
    const attempts = this.loginAttempts.get(email);
    
    if (attempts && attempts.count >= AuthService.MAX_LOGIN_ATTEMPTS) {
      const lockoutExpiry = new Date(attempts.lastAttempt.getTime() + AuthService.LOCKOUT_DURATION_MINUTES * 60 * 1000);
      
      if (new Date() < lockoutExpiry) {
        throw new Error(`Account locked due to too many failed login attempts. Try again after ${lockoutExpiry.toLocaleTimeString()}`);
      } else {
        // Lockout period expired, reset attempts
        this.loginAttempts.delete(email);
      }
    }
  }

  /**
   * Record failed login attempt
   */
  private async recordFailedLogin(email: string): Promise<void> {
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();
    
    this.loginAttempts.set(email, attempts);

    // Log failed login attempt
    await this.logAuditEvent('SYSTEM', 'LOGIN_FAILED', `Failed login attempt for email: ${email}`);
  }

  /**
   * Check if one role is higher than another
   */
  private isHigherRole(role1: UserRole, role2: UserRole): boolean {
    const roleHierarchy = {
      [userRoleEnum.VIEWER]: 1,
      [userRoleEnum.BOOKKEEPER]: 2,
      [userRoleEnum.ACCOUNTANT]: 3,
      [userRoleEnum.ADMIN]: 4
    };

    return roleHierarchy[role1] > roleHierarchy[role2];
  }

  /**
   * Log audit event for compliance
   */
  private async logAuditEvent(userId: string, action: string, details: string): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        action,
        details,
        timestamp: new Date(),
        ipAddress: 'system', // In production, capture actual IP
        userAgent: 'system'  // In production, capture actual user agent
      });
    } catch (error) {
      // Log audit failures but don't throw to avoid breaking main functionality
      console.error('Failed to log audit event:', error);
    }
  }
}