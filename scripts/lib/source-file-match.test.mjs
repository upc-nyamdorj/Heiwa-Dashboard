import { describe, it, expect } from 'vitest';
import {
  planBackfill, applyPlan, resolveCandidate, normaliseName, rowFolder,
} from './source-file-match.mjs';

const file = (name, folderPath = '', id = name) => ({ id, name, webUrl: `https://sp/${id}`, folderPath });

describe('normalisation', () => {
  // "й" is и + combining breve when decomposed, which is how a name typed on
  // macOS can reach us; Graph hands back the composed form.
  it('folds case and composes Cyrillic, so a Mac-typed name matches a Graph one', () => {
    const composed = 'ЭСПМ интернэйшнл.pdf';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);
    expect(normaliseName(decomposed)).toBe(normaliseName(composed.toUpperCase()));
  });

  it('takes the directory portion off a stored path', () => {
    expect(rowFolder('1. Ажил/2. Тал ХХК/Гэрээ/004.pdf')).toBe('1. ажил/2. тал ххк/гэрээ');
    expect(rowFolder('004.pdf')).toBe('');
  });
});

describe('resolving which file a row means', () => {
  it('takes the only candidate', () => {
    expect(resolveCandidate({ path: 'anywhere/004.pdf' }, [file('004.pdf', 'other')]).id).toBe('004.pdf');
  });

  it('uses the folder when two files share a name', () => {
    const a = file('004.pdf', 'Гэрээ', 'a');
    const b = file('004.pdf', 'Төлбөр', 'b');
    expect(resolveCandidate({ path: 'Тал/Төлбөр/004.pdf' }, [a, b]).id).toBe('b');
  });

  it('reports rather than guesses when the folder cannot separate them', () => {
    const a = file('004.pdf', 'Гэрээ/2024', 'a');
    const b = file('004.pdf', 'Гэрээ/2025', 'b');
    expect(resolveCandidate({ path: 'Тал/Архив/004.pdf' }, [a, b])).toBeNull();
  });

  it('refuses to pick when the row has no path to go on', () => {
    expect(resolveCandidate({ path: '004.pdf' }, [file('004.pdf', 'x', 'a'), file('004.pdf', 'y', 'b')])).toBeNull();
  });
});

describe('planning a backfill', () => {
  const dataset = {
    documents: [
      { filename: '004.pdf', path: 'Тал/Гэрээ/004.pdf' },
      { filename: 'missing.pdf', path: 'Тал/missing.pdf' },
      { filename: '004.pdf', path: 'Тал/Гэрээ/004.pdf', sourceFile: { name: 'x', webUrl: 'y', itemId: 'z' } },
    ],
    // The same PDF is a row here and in documents — normal, both get the link.
    contracts: [{ filename: '004.pdf', path: 'Тал/Гэрээ/004.pdf' }],
    drawings: [{ no: 1, company: 'Тал ХХК' }],
  };
  const files = [file('004.pdf', 'Тал/Гэрээ', 'item-004')];

  it('links every row that points at the same file', () => {
    const plan = planBackfill(dataset, files);
    expect(plan.updates).toHaveLength(2);
    expect(plan.updates.map((u) => u.collection).sort()).toEqual(['contracts', 'documents']);
    expect(plan.updates[0].sourceFile).toEqual({
      name: '004.pdf', webUrl: 'https://sp/item-004', itemId: 'item-004',
    });
    expect(plan.filesUsed.size).toBe(1);
  });

  it('leaves rows that already have a link alone', () => {
    expect(planBackfill(dataset, files).skipped.alreadyLinked).toBe(1);
  });

  it('reports a file it could not find instead of inventing one', () => {
    const plan = planBackfill(dataset, files);
    expect(plan.unmatched).toEqual([{ collection: 'documents', index: 1, filename: 'missing.pdf' }]);
  });

  it('skips drawings, which have no filename to match on', () => {
    expect(planBackfill(dataset, files).skipped.notBackfillable).toBe(1);
  });

  it('applies to a copy, touching only the planned rows', () => {
    const plan = planBackfill(dataset, files);
    const next = applyPlan(dataset, plan);
    expect(dataset.documents[0].sourceFile).toBeUndefined();
    expect(next.documents[0].sourceFile.itemId).toBe('item-004');
    expect(next.documents[1].sourceFile).toBeUndefined();
    expect(next.drawings).toEqual(dataset.drawings);
  });

  it('is idempotent — a second pass finds nothing left to do', () => {
    const once = applyPlan(dataset, planBackfill(dataset, files));
    const twice = planBackfill(once, files);
    expect(twice.updates).toHaveLength(0);
    expect(twice.skipped.alreadyLinked).toBe(3);
  });

  it('relink re-matches rows whose linked item is gone, and leaves live links alone', () => {
    const stale = { name: '004.pdf', webUrl: 'old', itemId: 'deleted-copy' };
    const ds = {
      documents: [
        { filename: '004.pdf', path: 'Тал/Гэрээ/004.pdf', sourceFile: stale },
        { filename: '004.pdf', path: 'Тал/Гэрээ/004.pdf', sourceFile: { name: '004.pdf', webUrl: 'w', itemId: 'item-004' } },
        { filename: 'missing.pdf', path: 'Тал/missing.pdf', sourceFile: { ...stale, itemId: 'also-gone' } },
      ],
    };
    expect(planBackfill(ds, files).updates).toHaveLength(0);

    const plan = planBackfill(ds, files, { relink: true });
    expect(plan.relinked).toBe(1);
    expect(plan.updates).toEqual([
      { collection: 'documents', index: 0, sourceFile: { name: '004.pdf', webUrl: 'https://sp/item-004', itemId: 'item-004' } },
    ]);
    expect(plan.skipped.alreadyLinked).toBe(1);
    expect(plan.unmatched).toEqual([{ collection: 'documents', index: 2, filename: 'missing.pdf', stale: true }]);
  });
});
