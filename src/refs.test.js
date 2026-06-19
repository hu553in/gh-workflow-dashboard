import { describe, expect, test } from 'vitest';

import { appendRef, resolveRunRefType } from './refs.js';

function liveRefs({ branches = {}, tags = {} } = {}) {
  const branchShasByName = new Map(
    Object.entries(branches).map(([name, shas]) => [name, new Set(shas)])
  );
  const tagShasByName = new Map(Object.entries(tags).map(([name, shas]) => [name, new Set(shas)]));

  return {
    branchShasByName,
    tagShasByName,
  };
}

describe('appendRef', () => {
  test('stores multiple SHAs per ref name and ignores incomplete refs', () => {
    const refs = new Map();

    appendRef(refs, 'main', 'sha-1');
    appendRef(refs, 'main', 'sha-2');
    appendRef(refs, '', 'sha-3');
    appendRef(refs, 'empty', '');

    expect(refs).toEqual(new Map([['main', new Set(['sha-1', 'sha-2'])]]));
  });
});

describe('resolveRunRefType', () => {
  test('prefers exact branch SHA matches', () => {
    expect(
      resolveRunRefType(
        { head_branch: 'release', head_sha: 'branch-sha' },
        liveRefs({
          branches: { release: ['branch-sha'] },
          tags: { release: ['tag-sha'] },
        })
      )
    ).toBe('branch');
  });

  test('prefers exact tag SHA matches', () => {
    expect(
      resolveRunRefType(
        { head_branch: 'v1.0.0', head_sha: 'tag-sha' },
        liveRefs({
          branches: { 'v1.0.0': ['branch-sha'] },
          tags: { 'v1.0.0': ['tag-sha'] },
        })
      )
    ).toBe('tag');
  });

  test('falls back to unique ref names when SHAs do not disambiguate', () => {
    expect(
      resolveRunRefType(
        { head_branch: 'main', head_sha: 'old-sha' },
        liveRefs({ branches: { main: ['new-sha'] } })
      )
    ).toBe('branch');
    expect(
      resolveRunRefType(
        { head_branch: 'v1.0.0', head_sha: 'old-sha' },
        liveRefs({ tags: { 'v1.0.0': ['new-sha'] } })
      )
    ).toBe('tag');
  });

  test('returns unknown for missing or ambiguous refs', () => {
    expect(resolveRunRefType({ head_branch: 'missing', head_sha: 'sha' }, liveRefs())).toBe(
      'unknown'
    );
    expect(
      resolveRunRefType(
        { head_branch: 'same-name', head_sha: 'old-sha' },
        liveRefs({
          branches: { 'same-name': ['branch-sha'] },
          tags: { 'same-name': ['tag-sha'] },
        })
      )
    ).toBe('unknown');
  });
});
