const GITHUB_API_BASE_URL = 'https://api.github.com';

function getErrorMessage(status) {
  return status === 403 ? 'Rate limit or insufficient permissions' : `API ${status}`;
}

function makeCacheKey(url, authToken) {
  return `${authToken}\n${url}`;
}

function makeHeaders(authToken, cacheEntry) {
  const headers = {
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
} = {}) {
  let token = '';
  const cache = new Map();

  function clearCache() {
    cache.clear();
  }

  function getToken() {
    return token;
  }

  function setToken(nextToken) {
    if (nextToken !== token) clearCache();
    token = nextToken;
  }

  async function api(path, authToken = token) {
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

    const data = await res.json();
    const etag = res.headers.get('ETag');

    if (etag) {
      cache.set(cacheKey, { etag, data });
    } else {
      cache.delete(cacheKey);
    }

    return data;
  }

  async function paginate(path, select = data => data, authToken = token, limit = Infinity) {
    const all = [];
    let page = 1;
    while (true) {
      const sep = path.includes('?') ? '&' : '?';
      const data = await api(`${path}${sep}per_page=100&page=${page}`, authToken);
      const pageItems = select(data);
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

export function setToken(t) {
  defaultClient.setToken(t);
}

export async function api(path, authToken = getToken()) {
  return defaultClient.api(path, authToken);
}

export async function paginate(
  path,
  select = data => data,
  authToken = getToken(),
  limit = Infinity
) {
  return defaultClient.paginate(path, select, authToken, limit);
}

export async function pool(tasks, concurrency = 8) {
  const results = [];
  const active = [];
  for (const task of tasks) {
    const p = task().finally(() => {
      active.splice(active.indexOf(p), 1);
    });
    active.push(p);
    results.push(p);
    if (active.length >= concurrency) await Promise.race(active);
  }
  return Promise.all(results);
}
