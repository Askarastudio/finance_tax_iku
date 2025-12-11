export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  BOOKKEEPER = 'BOOKKEEPER',
  FINANCIAL_MANAGER = 'FINANCIAL_MANAGER',
  TAX_OFFICER = 'TAX_OFFICER',
  VIEWER = 'VIEWER'
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}