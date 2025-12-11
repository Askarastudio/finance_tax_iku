import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock the auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    checkAuth: vi.fn(),
  }),
}));

describe('App', () => {
  it('renders login form when not authenticated', () => {
    render(<App />);
    
    expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument();
    expect(screen.getByText('Sistem Manajemen Keuangan & Pajak')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('nama@perusahaan.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Masukkan password')).toBeInTheDocument();
  });
});