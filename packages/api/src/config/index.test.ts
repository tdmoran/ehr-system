import { describe, it, expect } from 'vitest';
import { config } from './index.js';

describe('config', () => {
  it('has expected default values in development', () => {
    expect(config.port).toBe(3000);
    expect(config.database.maxConnections).toBe(20);
    expect(config.database.idleTimeoutMs).toBe(30000);
    expect(config.database.connectionTimeoutMs).toBe(5000);
    expect(config.jwt.expiresIn).toBe('8h');
    expect(config.requestTimeoutMs).toBe(30000);
  });

  it('has upload config with sensible defaults', () => {
    expect(config.uploads.maxFileSizeMb).toBeGreaterThan(0);
    expect(config.uploads.allowedMimeTypes).toContain('application/pdf');
    expect(config.uploads.allowedMimeTypes).toContain('image/jpeg');
  });

  it('has rate limit config', () => {
    expect(config.rateLimit.authWindowMs).toBeGreaterThan(0);
    expect(config.rateLimit.authMaxRequests).toBeGreaterThan(0);
  });
});
