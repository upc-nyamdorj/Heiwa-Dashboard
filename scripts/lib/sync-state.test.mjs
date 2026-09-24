import { describe, it, expect } from 'vitest';
import { diffAgainstState, seedState, linkedItemIds } from './sync-state.mjs';

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

describe('seedState', () => {
  const files = [
    { id: 'a', eTag: 'ea', name: 'a.pdf', path: 'x/a.pdf' },
    { id: 'b', eTag: 'eb', name: 'b.pdf', path: 'y/b.pdf' },
    { id: 'c', eTag: 'ec', name: 'c.pdf', path: 'c.pdf' },
  ];

  it('"all" marks every file as synced, recording its path', () => {
    const { state, seeded } = seedState({}, files, { mode: 'all' });
    expect(seeded.map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(state.b).toMatchObject({ eTag: 'eb', path: 'y/b.pdf' });
    expect(diffAgainstState(files, state)).toHaveLength(0);
  });

  it('"linked" marks only files the dataset links to, leaving the rest for extraction', () => {
    const linkedIds = linkedItemIds({
      contracts: [{ sourceFile: { itemId: 'a' } }, { sourceFile: null }],
      payments: [{ sourceFile: { itemId: 'c' } }],
      meta: { note: 'not a collection' },
    });
    const { state, seeded } = seedState({}, files, { mode: 'linked', linkedIds });
    expect(seeded.map((f) => f.id)).toEqual(['a', 'c']);
    expect(diffAgainstState(files, state).map((f) => f.id)).toEqual(['b']);
  });

  it('keeps entries already in the state untouched', () => {
    const { state, seeded } = seedState({ a: { eTag: 'old' } }, files, { mode: 'all' });
    expect(state.a).toEqual({ eTag: 'old' });
    expect(seeded).toHaveLength(2);
  });
});
