import { describe, it, expect } from 'vitest';
import { diffAgainstState } from './sync-state.mjs';

describe('diffAgainstState', () => {
  it('treats a file not present in the state as changed', () => {
    const changed = diffAgainstState([{ id: 'a', eTag: 'e1' }], {});
    expect(changed).toHaveLength(1);
  });

  it('treats a file with a different eTag than recorded as changed', () => {
    const changed = diffAgainstState([{ id: 'a', eTag: 'e2' }], { a: { eTag: 'e1' } });
    expect(changed).toHaveLength(1);
  });

  it('skips a file whose eTag matches the recorded state', () => {
    const changed = diffAgainstState([{ id: 'a', eTag: 'e1' }], { a: { eTag: 'e1' } });
    expect(changed).toHaveLength(0);
  });

  it('only returns the files that actually changed out of a mixed batch', () => {
    const files = [{ id: 'a', eTag: 'e1' }, { id: 'b', eTag: 'e2-new' }, { id: 'c', eTag: 'e3' }];
    const state = { a: { eTag: 'e1' }, b: { eTag: 'e2-old' }, c: { eTag: 'e3' } };
    const changed = diffAgainstState(files, state);
    expect(changed.map((f) => f.id)).toEqual(['b']);
  });
});
