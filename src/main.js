import './style.css';

import { api, getToken, paginate, pool, setToken } from './api.js';
import { clearCache, loadCache, saveCache } from './cache.js';
import { renderResults } from './render.js';

const $ = id => document.getElementById(id);

async function fetchAll() {
  const repos = await paginate('/user/repos?sort=full_name');

  const tasks = repos.map(repo => async () => {
    try {
      const { workflows = [] } = await api(`/repos/${repo.full_name}/actions/workflows`);
      if (!workflows.length) return null;

      const latestRuns = {};
      try {
        const { workflow_runs = [] } = await api(
          `/repos/${repo.full_name}/actions/runs?per_page=50`
        );
        for (const run of workflow_runs) {
          const prev = latestRuns[run.workflow_id];
          if (!prev || run.created_at > prev.created_at) latestRuns[run.workflow_id] = run;
        }
      } catch {
        // ignore
      }

      return { repo, workflows, latestRuns };
    } catch {
      return null;
    }
  });

  return (await pool(tasks)).filter(Boolean);
}

async function loadData() {
  if (!getToken()) return alert('Enter a token first');

  $('loading').classList.remove('hidden');
  $('content').classList.add('hidden');
  $('empty').classList.add('hidden');

  try {
    const results = await fetchAll();
    saveCache(results);
    renderResults(results, Date.now());
  } catch (e) {
    console.error(e);
    alert('Error: ' + e.message);
  } finally {
    $('loading').classList.add('hidden');
  }
}

async function validateAndLoad() {
  const val = $('token').value.trim();
  if (!val) return alert('Enter a token first');

  setToken(val);
  $('loading').classList.remove('hidden');

  try {
    await api('/user');
    localStorage.setItem('github_token', val);
    $('token-status').innerHTML = '<span style="color:var(--green)">✓ Token valid</span>';
    await loadData();
  } catch (e) {
    $('token-status').innerHTML = `<span style="color:var(--red)">✗ ${e.message}</span>`;
    $('loading').classList.add('hidden');
  }
}

function toggleAll() {
  const repos = document.querySelectorAll('.repo');
  const allOpen = [...repos].every(r => r.classList.contains('open'));

  repos.forEach(r => {
    const body = r.querySelector('.repo-body');
    if (allOpen) {
      r.classList.remove('open');
      body.classList.add('hidden');
    } else {
      r.classList.add('open');
      body.classList.remove('hidden');
    }
  });

  $('toggle-all').innerHTML = allOpen
    ? '<i class="fa-solid fa-angles-down"></i> Expand all'
    : '<i class="fa-solid fa-angles-up"></i> Collapse all';
}

function handleClearToken() {
  if (!confirm('Clear saved token?')) return;
  localStorage.removeItem('github_token');
  clearCache();
  setToken('');
  $('token').value = '';
  $('token-status').textContent = '';
  $('content').classList.add('hidden');
}

$('btn-load').addEventListener('click', validateAndLoad);
$('btn-refresh').addEventListener('click', loadData);
$('btn-clear-token').addEventListener('click', handleClearToken);
$('toggle-all').addEventListener('click', toggleAll);

$('token').addEventListener('keydown', e => {
  if (e.key === 'Enter') validateAndLoad();
});

const savedToken = localStorage.getItem('github_token') || '';
if (savedToken) {
  setToken(savedToken);
  $('token').value = savedToken;
  $('token-status').innerHTML =
    '<span style="color:var(--green)">✓ Token loaded from storage</span>';

  const cache = loadCache();
  if (cache?.results) {
    renderResults(cache.results, cache.ts);
  }
}
