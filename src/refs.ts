import type { WorkflowRun } from './types';

export interface LiveRefs {
  names: Set<string>;
  branchShasByName: Map<string, Set<string>>;
  tagShasByName: Map<string, Set<string>>;
}

export function appendRef(map: Map<string, Set<string>>, name: string, sha: string | undefined) {
  if (!name || !sha) return;
  const shas = map.get(name) ?? new Set<string>();
  shas.add(sha);
  map.set(name, shas);
}

export function resolveRunRefType(
  run: Pick<WorkflowRun, 'head_branch' | 'head_sha'>,
  liveRefs: Pick<LiveRefs, 'branchShasByName' | 'tagShasByName'> | null
) {
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
