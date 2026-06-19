import { describe, expect, test, vi } from 'vitest';

import { createApiClient, pool } from './api.js';

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

describe('createApiClient', () => {
  test('sends GitHub headers and caches ETag responses per URL and token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ value: 1 }, { headers: { ETag: '"repo-v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    client.setToken('token-a');

    await expect(client.api('/repos')).resolves.toEqual({ value: 1 });
    await expect(client.api('/repos')).resolves.toEqual({ value: 1 });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://api.example.test/repos', {
      headers: {
        Authorization: 'Bearer token-a',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://api.example.test/repos', {
      headers: {
        Authorization: 'Bearer token-a',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'If-None-Match': '"repo-v1"',
      },
    });
  });

  test('does not reuse cached data after token changes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ value: 'a' }, { headers: { ETag: '"v1"' } }))
      .mockResolvedValueOnce(jsonResponse({ value: 'b' }, { headers: { ETag: '"v2"' } }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    client.setToken('token-a');
    await expect(client.api('/user')).resolves.toEqual({ value: 'a' });

    client.setToken('token-b');
    await expect(client.api('/user')).resolves.toEqual({ value: 'b' });

    expect(fetchImpl.mock.calls[1][1].headers).not.toHaveProperty('If-None-Match');
  });

  test('drops cached validators when a fresh response has no ETag', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ value: 1 }, { headers: { ETag: '"v1"' } }))
      .mockResolvedValueOnce(jsonResponse({ value: 2 }))
      .mockResolvedValueOnce(jsonResponse({ value: 3 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    await client.api('/resource');
    await client.api('/resource');
    await client.api('/resource');

    expect(fetchImpl.mock.calls[1][1].headers).toHaveProperty('If-None-Match', '"v1"');
    expect(fetchImpl.mock.calls[2][1].headers).not.toHaveProperty('If-None-Match');
  });

  test('formats API errors consistently', async () => {
    const client403 = createApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({}, { status: 403 })),
    });
    const client500 = createApiClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })),
    });

    await expect(client403.api('/blocked')).rejects.toThrow(
      'Rate limit or insufficient permissions'
    );
    await expect(client500.api('/broken')).rejects.toThrow('API 500');
  });

  test('paginates selected data and respects limits across pages', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => index + 1);
    const secondPage = Array.from({ length: 100 }, (_, index) => index + 101);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: firstPage }))
      .mockResolvedValueOnce(jsonResponse({ items: secondPage }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl });

    await expect(
      client.paginate('/items?sort=name', data => data.items, undefined, 150)
    ).resolves.toEqual(Array.from({ length: 150 }, (_, index) => index + 1));

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/items?sort=name&per_page=100&page=1',
      'https://api.example.test/items?sort=name&per_page=100&page=2',
    ]);
  });
});

describe('pool', () => {
  test('keeps result order while respecting concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const resolvers = [];
    const tasks = [1, 2, 3].map(value => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => resolvers.push(resolve));
      active--;
      return value;
    });

    const promise = pool(tasks, 2);
    expect(maxActive).toBe(2);
    resolvers.shift()();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(maxActive).toBe(2);
    resolvers.shift()();
    resolvers.shift()();

    await expect(promise).resolves.toEqual([1, 2, 3]);
    expect(maxActive).toBe(2);
  });
});
