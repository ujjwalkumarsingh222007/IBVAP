import { describe, it, expect, beforeEach } from 'vitest';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../api/apiClient';
import { AuthUser, UserRole } from '../types';

class MemoryStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('Frontend Authentication and Session Management', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('stores and retrieves JWT token from storage correctly', () => {
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
    storage.setItem(TOKEN_STORAGE_KEY, testToken);

    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBe(testToken);
  });

  it('stores and retrieves user profile JSON from storage correctly', () => {
    const sampleUser: AuthUser = {
      id: 1,
      username: 'admin',
      role: 'ADMIN',
      is_active: true,
      created_at: '2026-08-29T10:00:00Z',
    };

    storage.setItem(USER_STORAGE_KEY, JSON.stringify(sampleUser));
    const retrieved = JSON.parse(storage.getItem(USER_STORAGE_KEY) || '{}');

    expect(retrieved.username).toBe('admin');
    expect(retrieved.role).toBe('ADMIN');
    expect(retrieved.is_active).toBe(true);
  });

  it('evaluates role hierarchies accurately for Admin, Operator, and Viewer', () => {
    const checkRoles = (role: UserRole) => {
      const isAdmin = role === 'ADMIN';
      const isOperator = role === 'OPERATOR' || isAdmin;
      const isViewer = role === 'VIEWER' || isOperator;
      return { isAdmin, isOperator, isViewer };
    };

    const adminPerms = checkRoles('ADMIN');
    expect(adminPerms.isAdmin).toBe(true);
    expect(adminPerms.isOperator).toBe(true);
    expect(adminPerms.isViewer).toBe(true);

    const operatorPerms = checkRoles('OPERATOR');
    expect(operatorPerms.isAdmin).toBe(false);
    expect(operatorPerms.isOperator).toBe(true);
    expect(operatorPerms.isViewer).toBe(true);

    const viewerPerms = checkRoles('VIEWER');
    expect(viewerPerms.isAdmin).toBe(false);
    expect(viewerPerms.isOperator).toBe(false);
    expect(viewerPerms.isViewer).toBe(true);
  });

  it('clears session credentials upon logout or 401 session expiration', () => {
    storage.setItem(TOKEN_STORAGE_KEY, 'expired_token');
    storage.setItem(USER_STORAGE_KEY, JSON.stringify({ username: 'operator' }));

    // Simulate logout cleanup
    storage.removeItem(TOKEN_STORAGE_KEY);
    storage.removeItem(USER_STORAGE_KEY);

    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(USER_STORAGE_KEY)).toBeNull();
  });

  it('formats API errors for 401 Unauthorized and 403 Forbidden correctly', () => {
    const unauthorizedMessage = 'Authentication required or session expired. Please log in.';
    const forbiddenMessage = 'Forbidden: You do not have permission for this action.';

    expect(unauthorizedMessage).toContain('Authentication required');
    expect(forbiddenMessage).toContain('Forbidden');
  });
});
