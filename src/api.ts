const GITHUB_API_BASE_URL = 'https://api.github.com';

function getErrorMessage(status: number) {
  return status === 403 ? 'Rate limit or insufficient permissions' : `API ${String(status)}`;
}

function makeCacheKey(url: string, authToken: string) {
  return `${authToken}\n${url}`;
}

interface CacheEntry {
  etag: string;
  data: unknown;
}

function makeHeaders(authToken: string, cacheEntry: CacheEntry | undefined) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (cacheEntry?.etag) headers['If-None-Match'] = cacheEntry.etag;
  return headers;
}

export function createApiClient({
  baseUrl = GITHUB_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
  let token = '';
  const cache = new Map<string, CacheEntry>();

  function clearCache() {
    cache.clear();
  }

  function getToken() {
    return token;
  }

  function setToken(nextToken: string) {
    if (nextToken !== token) clearCache();
    token = nextToken;
  }

  async function request(path: string, authToken: string): Promise<unknown> {
    const url = `${baseUrl}${path}`;
    const cacheKey = makeCacheKey(url, authToken);
    const cacheEntry = cache.get(cacheKey);
    const res = await fetchImpl(url, {
      headers: makeHeaders(authToken, cacheEntry),
    });

    if (res.status === 304) {
      if (!cacheEntry) throw new Error('API 304 without cached response');
      return cacheEntry.data;
    }

    if (!res.ok) {
      throw new Error(getErrorMessage(res.status));
    }

    const data: unknown = await res.json();
    const etag = res.headers.get('ETag');

    if (etag) {
      cache.set(cacheKey, { etag, data });
    } else {
      cache.delete(cacheKey);
    }

    return data;
  }

  async function api<T = unknown>(path: string, authToken = token): Promise<T> {
    // GitHub response contracts are declared at each endpoint call.
    return (await request(path, authToken)) as T;
  }

  async function paginate<T, TResponse = T[]>(
    path: string,
    ...[select, authToken = token, limit = Infinity]: TResponse extends T[]
      ? [select?: (data: TResponse) => T[], authToken?: string, limit?: number]
      : [select: (data: TResponse) => T[], authToken?: string, limit?: number]
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    for (;;) {
      const sep = path.includes('?') ? '&' : '?';
      const pagePath = `${path}${sep}per_page=100&page=${String(page)}`;
      const pageItems = select
        ? select(await api<TResponse>(pagePath, authToken))
        : await api<T[]>(pagePath, authToken);
      const remaining = limit - all.length;
      all.push(...pageItems.slice(0, remaining));
      if (all.length >= limit || pageItems.length < 100) return all;
      page++;
    }
  }

  return {
    api,
    clearCache,
    getToken,
    paginate,
    setToken,
  };
}

const defaultClient = createApiClient();

export function getToken() {
  return defaultClient.getToken();
}

export function setToken(t: string) {
  defaultClient.setToken(t);
}

export const api = defaultClient.api;
export const paginate = defaultClient.paginate;

export async function pool<T>(tasks: (() => Promise<T>)[], concurrency = 8) {
  const results: Promise<T>[] = [];
  const active: Promise<T>[] = [];
  for (const task of tasks) {
    const p = task().finally(() => {
      void active.splice(active.indexOf(p), 1);
    });
    active.push(p);
    results.push(p);
    if (active.length >= concurrency) await Promise.race(active);
  }
  return Promise.all(results);
}
