// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 bytes
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.PORT = '3001';
process.env.API_PREFIX = 'api/v1';
process.env.BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};
