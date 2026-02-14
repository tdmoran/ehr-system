import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from './request';

describe('request', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ patients: [] }),
    });

    const result = await request<{ patients: [] }>('/patients');
    expect(result.data).toEqual({ patients: [] });
    expect(result.error).toBeUndefined();
  });

  it('returns error on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    const result = await request('/patients/999');
    expect(result.error).toBe('Not found');
    expect(result.data).toBeUndefined();
  });

  it('returns validation error details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Validation failed',
        details: [
          { field: 'email', message: 'required' },
          { field: 'name', message: 'too short' },
        ],
      }),
    });

    const result = await request('/patients', { method: 'POST' });
    expect(result.error).toContain('email: required');
    expect(result.error).toContain('name: too short');
  });

  it('returns network error on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const result = await request('/patients');
    expect(result.error).toBe('Network error. Please try again.');
  });

  it('includes auth token in headers when available', async () => {
    localStorage.setItem('token', 'test-jwt-token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await request('/auth/me');

    const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const [, options] = callArgs;
    expect(options.headers).toHaveProperty('Authorization', 'Bearer test-jwt-token');
  });

  it('does not include auth header when no token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await request('/auth/login');

    const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const [, options] = callArgs;
    expect(options.headers).not.toHaveProperty('Authorization');
  });
});
