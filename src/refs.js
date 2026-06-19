export function appendRef(map, name, sha) {
  if (!name || !sha) return;
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(sha);
}

export function resolveRunRefType(run, liveRefs) {
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
