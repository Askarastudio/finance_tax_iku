import { UserRole } from '../db/schema/users';

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  token?: string;
  message?: string;
}

export class DemoAuthService {
  private static demoUsers: DemoUser[] = [
    {
      id: '1',
      email: 'admin@company.com',
      name: 'Administrator',
      role: 'ADMIN' as UserRole,
      password: 'admin123'
    },
    {
      id: '2',
      email: 'accountant@company.com',
      name: 'Akuntan',
      role: 'ACCOUNTANT' as UserRole,
      password: 'accountant123'
    },
    {
      id: '3',
      email: 'bookkeeper@company.com',
      name: 'Pembukuan',
      role: 'BOOKKEEPER' as UserRole,
      password: 'bookkeeper123'
    },
    {
      id: '4',
      email: 'viewer@company.com',
      name: 'Viewer',
      role: 'VIEWER' as UserRole,
      password: 'viewer123'
    }
  ];

  private static activeSessions: Map<string, DemoUser> = new Map();

  static authenticate(credentials: LoginCredentials): AuthResponse {
    const user = this.demoUsers.find(
      u => u.email === credentials.email && u.password === credentials.password
    );

    if (!user) {
      return {
        success: false,
        message: 'Email atau password salah'
      };
    }

    // Generate simple token
    const token = this.generateToken(user);
    this.activeSessions.set(token, user);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  static validateToken(token: string): AuthResponse {
    const user = this.activeSessions.get(token);
    
    if (!user) {
      return {
        success: false,
        message: 'Invalid token'
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  static logout(token: string): void {
    this.activeSessions.delete(token);
  }

  static getDemoUsers(): Omit<DemoUser, 'password'>[] {
    return this.demoUsers.map(({ password, ...user }) => user);
  }

  private static generateToken(user: DemoUser): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `demo_${user.id}_${timestamp}_${random}`;
  }
}