let token = '';

export function getToken() {
  return token;
}

export function setToken(t) {
  token = t;
}

export async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 403 ? 'Rate limit or insufficient permissions' : `API ${res.status}`
    );
  }
  return res.json();
}

export async function paginate(path) {
  const all = [];
  let page = 1;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await api(`${path}${sep}per_page=100&page=${page}`);
    all.push(...data);
    if (data.length < 100) return all;
    page++;
  }
}

export async function pool(tasks, concurrency = 8) {
  const results = [];
  const active = [];
  for (const task of tasks) {
    const p = task().then(r => {
      active.splice(active.indexOf(p), 1);
      return r;
    });
    active.push(p);
    results.push(p);
    if (active.length >= concurrency) await Promise.race(active);
  }
  return Promise.all(results);
}
