import './style.css';

import { api, getToken, paginate, pool, setToken } from './api.js';
import { icon, renderResults } from './render.js';

const $ = id => document.getElementById(id);
let isLoading = false;

function setTokenStatus(message = '', color = '') {
  const status = $('token-status');
  status.textContent = message;
  status.style.color = color;
}

function setLoadingState(nextIsLoading) {
  isLoading = nextIsLoading;
  $('loading').classList.toggle('hidden', !nextIsLoading);
  $('btn-load').disabled = nextIsLoading;
  $('btn-clear-token').disabled = nextIsLoading;
  $('token').readOnly = nextIsLoading;
  $('runs-limit').disabled = nextIsLoading;
}

function clearResultsView() {
  $('repos').replaceChildren();
  $('stats').textContent = '';
  $('content').classList.add('hidden');
  $('empty').classList.add('hidden');
  setButtonLabel('toggle-all', 'fa-solid fa-angles-down', 'Expand all');
}

function resetResultsView() {
  setLoadingState(false);
  clearResultsView();
}

function setButtonLabel(buttonId, iconClass, label) {
  $(buttonId).replaceChildren(icon(iconClass), document.createTextNode(` ${label}`));
}

function appendRef(map, name, sha) {
  if (!name || !sha) return;
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(sha);
}

function getRunsLimit() {
  const input = $('runs-limit');
  const rawValue = Number.parseInt(input.value, 10);
  const normalizedValue = Number.isFinite(rawValue)
    ? Math.max(100, Math.ceil(rawValue / 100) * 100)
    : 100;

  input.value = normalizedValue;
  return normalizedValue;
}

async function validateToken(token) {
  await api('/user', token);
}

async function loadLiveRefs(fullName) {
  try {
    const [branches, tags] = await Promise.all([
      paginate(`/repos/${fullName}/branches`),
      paginate(`/repos/${fullName}/tags`),
    ]);

    const branchShasByName = new Map();
    const tagShasByName = new Map();

    for (const branch of branches) {
      appendRef(branchShasByName, branch.name, branch.commit?.sha);
    }

    for (const tag of tags) {
      appendRef(tagShasByName, tag.name, tag.commit?.sha);
    }

    return {
      names: new Set([...branchShasByName.keys(), ...tagShasByName.keys()]),
      branchShasByName,
      tagShasByName,
    };
  } catch {
    return null;
  }
}

function resolveRunRefType(run, liveRefs) {
  const branchMatches = liveRefs?.branchShasByName.get(run.head_branch)?.has(run.head_sha) ?? false;
  const tagMatches = liveRefs?.tagShasByName.get(run.head_branch)?.has(run.head_sha) ?? false;

  if (branchMatches && !tagMatches) return 'branch';
  if (tagMatches && !branchMatches) return 'tag';

  const hasBranchName = liveRefs?.branchShasByName.has(run.head_branch) ?? false;
  const hasTagName = liveRefs?.tagShasByName.has(run.head_branch) ?? false;

  if (hasBranchName && !hasTagName) return 'branch';
  if (hasTagName && !hasBranchName) return 'tag';
  return 'unknown';
}

async function fetchAll() {
  const runsLimit = getRunsLimit();
  const repos = await paginate('/user/repos?sort=full_name');

  const tasks = repos.map(repo => async () => {
    try {
      const { workflows = [] } = await api(`/repos/${repo.full_name}/actions/workflows`);
      if (!workflows.length) return null;

      const latestRuns = {};
      try {
        const liveRefsCache = new Map();
        const getLiveRefs = async fullName => {
          if (!liveRefsCache.has(fullName)) {
            liveRefsCache.set(fullName, loadLiveRefs(fullName));
          }

          return liveRefsCache.get(fullName);
        };

        const workflowRuns = await paginate(
          `/repos/${repo.full_name}/actions/runs`,
          data => data.workflow_runs ?? [],
          undefined,
          runsLimit
        );

        for (const run of workflowRuns) {
          const headRepoFullName = run.head_repository?.full_name || repo.full_name;
          const liveRefs = await getLiveRefs(headRepoFullName);
          if (liveRefs && !liveRefs.names.has(run.head_branch)) continue;

          const refType = resolveRunRefType(run, liveRefs);
          const key = `${run.workflow_id}:${headRepoFullName}:${refType}:${run.head_branch}`;
          const prev = latestRuns[key];
          if (!prev || run.created_at > prev.created_at) latestRuns[key] = run;
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

async function loadData(force = false) {
  if (isLoading && !force) return;
  if (!getToken()) return alert('Enter a GitHub token first.');

  setLoadingState(true);
  clearResultsView();

  try {
    const results = await fetchAll();
    renderResults(results);
  } catch (e) {
    console.error(e);
    alert('Error: ' + e.message);
  } finally {
    setLoadingState(false);
  }
}

async function validateAndLoad() {
  if (isLoading) return;
  const val = $('token').value.trim();
  if (!val) return alert('Enter a GitHub token first.');
  setLoadingState(true);

  try {
    await validateToken(val);
    setToken(val);
    localStorage.setItem('github_token', val);
    setTokenStatus('✓ Token was accepted by GitHub.', 'var(--green)');
    await loadData(true);
  } catch (e) {
    setTokenStatus(`✗ ${e.message}`, 'var(--red)');
    setLoadingState(false);
  }
}

function toggleAll() {
  const repos = document.querySelectorAll('.repo');
  const allOpen = [...repos].every(r => r.classList.contains('open'));

  repos.forEach(r => {
    r.classList.toggle('open', !allOpen);
    r.querySelector('.repo-body').classList.toggle('hidden', allOpen);
  });

  setButtonLabel(
    'toggle-all',
    allOpen ? 'fa-solid fa-angles-down' : 'fa-solid fa-angles-up',
    allOpen ? 'Expand all' : 'Collapse all'
  );
}

function handleClearToken() {
  if (!confirm('Clear saved token?')) return;
  localStorage.removeItem('github_token');
  setToken('');
  $('token').value = '';
  setTokenStatus();
  resetResultsView();
}

$('btn-load').addEventListener('click', validateAndLoad);
$('btn-clear-token').addEventListener('click', handleClearToken);
$('toggle-all').addEventListener('click', toggleAll);

$('token').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !isLoading) validateAndLoad();
});

const savedToken = localStorage.getItem('github_token') || '';
if (savedToken) {
  setToken(savedToken);
  $('token').value = savedToken;
  setTokenStatus('✓ Token is loaded from storage.', 'var(--green)');
}
