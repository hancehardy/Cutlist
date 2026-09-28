import { describe, expect, it } from 'vitest';
import { buildJob, fmt, newSection, parseDim } from './engine';
import { normalizeJobDoc, sampleJob } from './job';

describe('parseDim / fmt', () => {
  it('parses fractions, mixed numbers and decimals', () => {
    expect(parseDim('14 7/8')).toBe(14.875);
    expect(parseDim('14-7/8')).toBe(14.875);
    expect(parseDim('7/8"')).toBe(0.875);
    expect(parseDim('14.875')).toBe(14.875);
    expect(parseDim('')).toBeNaN();
    expect(parseDim('abc')).toBeNaN();
  });
  it('formats to sixteenths', () => {
    expect(fmt(14.875)).toBe('14 7/8');
    expect(fmt(11.6875)).toBe('11 11/16');
    expect(fmt(0.0625)).toBe('1/16');
    expect(fmt(15.999)).toBe('16');
    expect(fmt(14.875, 'decimal')).toBe('14.875');
  });
});

describe('3DB15 sample packet', () => {
  const job = buildJob([{ id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' }], {});
  const cab = job.cabs[0];
  const part = (desc: string) => cab.parts.find(p => p.desc === desc)!;

  it('matches the panel stock in the PDF', () => {
    expect([part('Unfinished Left End').w, part('Unfinished Left End').l]).toEqual([21, 30]);
    expect([part('Unfinished Back').w, part('Unfinished Back').l]).toEqual([14.25, 29.25]);
    expect([part('Deck').w, part('Deck').l]).toEqual([21, 13.5]);
    expect(part('Top Stretcher').qty).toBe(2);
    expect([part('Nailer').w, part('Nailer').l]).toEqual([4, 13.5]);
    expect(part('Drawer Stretcher').qty).toBe(1);
  });

  it('matches the drawer fronts in the PDF', () => {
    expect(cab.fronts.map(f => [fmt(f.w), fmt(f.l)])).toEqual([
      ['14 7/8', '6 3/16'], ['14 7/8', '11 11/16'], ['14 7/8', '11 11/16'],
    ]);
  });

  it('matches the drawer boxes in the PDF', () => {
    expect(job.drawers.map(d => [d.qty, fmt(d.w), d.dp, d.h])).toEqual([[2, '13 1/16', 18, 8], [1, '13 1/16', 18, 4]]);
  });

  it('matches the hardware in the PDF', () => {
    const guide = cab.hardware.find(h => h.item === 'Drawer Guide (pair)')!;
    expect(guide.qty).toBe(3);
    expect(guide.spec).toBe('563H4570B 18"');
  });
});

describe('configurator layouts', () => {
  it('splits drawers into partitions and extra boxes', () => {
    const job = buildJob([{ id: 1, type: '2DB', w: '30', h: '34.5', d: '24', toe: '4.5', qty: '1',
      layout: [newSection('drawer', '', { split: 2 }), newSection('drawer')] }], {});
    const cab = job.cabs[0];
    expect(cab.parts.find(p => p.desc === 'Drawer Partition')?.qty).toBe(1);
    expect(cab.drawers[0].qty).toBe(2);
  });

  it('adds roll-outs with guides and spacers', () => {
    const job = buildJob([{ id: 1, type: 'BD', w: '24', h: '34.5', d: '24', toe: '4.5', qty: '2',
      layout: [newSection('door', '', { rollouts: 2 })] }], {});
    expect(job.drawers.find(d => d.kind === 'Roll-out')?.qty).toBe(4);
    // Single door: one spacer per roll-out, on the hinge side (2 roll-outs x 2 cabinets).
    expect(job.hardware.find(h => h.item === 'Roll-out Spacer')?.qty).toBe(4);
  });

  it('warns when fixed faces do not fill the opening', () => {
    const job = buildJob([{ id: 1, type: '2DB', w: '18', h: '30', d: '21', toe: '0', qty: '1',
      layout: [newSection('drawer', '6'), newSection('drawer', '6')] }], {});
    expect(job.cabs[0].warn).toMatch(/Faces total 12/);
  });

  it('flags bad sizes and leaves them out of reports', () => {
    const job = buildJob([{ id: 1, type: 'B', w: '', h: '34.5', d: '24', toe: '4.5', qty: '1' }], {});
    expect(job.cabs[0].bad).toBe(true);
    expect(job.summary.nParts).toBe(0);
  });
});

describe('shop rules', () => {
  const rollW = (type: string, w: string, layout: ReturnType<typeof newSection>[]) =>
    buildJob([{ id: 1, type, w, h: '34.5', d: '24', toe: '4.5', qty: '1', layout }], {}).drawers.find(d => d.kind === 'Roll-out');

  it('roll-outs deduct 1" behind a single door, on the hinge side', () => {
    // inside 22 1/2 - 1 spacer - 7/16 slide clearance
    expect(fmt(rollW('BD', '24', [newSection('door', '', { rollouts: 1 })])!.w)).toBe('21 1/16');
    expect(fmt(rollW('BD', '24', [newSection('door', '', { rollouts: 1, hinge: 'R' })])!.w)).toBe('21 1/16');
  });

  it('roll-outs deduct 2" behind a pair of doors', () => {
    const job = buildJob([{ id: 1, type: 'BD', w: '30', h: '34.5', d: '24', toe: '4.5', qty: '1', layout: [newSection('door', '', { rollouts: 2 })] }], {});
    expect(fmt(job.drawers[0].w)).toBe('26 1/16');
    expect(job.hardware.find(h => h.item === 'Roll-out Spacer')?.qty).toBe(4);
  });

  it('open shelving roll-outs need no spacers', () => {
    const job = buildJob([{ id: 1, type: 'WO', w: '30', h: '34.5', d: '24', toe: '4.5', qty: '1', layout: [newSection('open', '', { rollouts: 1 })] }], {});
    expect(fmt(job.drawers[0].w)).toBe('28 1/16');
    expect(job.hardware.find(h => h.item === 'Roll-out Spacer')).toBeUndefined();
  });

  it('fronts 13" and taller get a 10" box', () => {
    const job = buildJob([{ id: 1, type: '2DB', w: '18', h: '34.5', d: '24', toe: '4.5', qty: '1' }], {});
    expect(job.cabs[0].sections[0].h).toBeGreaterThan(13);
    expect(job.drawers[0].h).toBe(10);
  });

  it('hangs wall cabinets at the wall top height (default 96")', () => {
    const cabs = [{ id: 1, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1' }];
    const at = (raw: Record<string, string>) => { const i = buildJob(cabs, raw).install; return i.floorY - i.items[0].y; };
    expect(at({})).toBe(96);
    expect(at({ wallTop: '84' })).toBe(84);
    expect(at({ wallTop: '102' })).toBe(102);
  });
});

describe('normalizeJobDoc', () => {
  it('round-trips the sample job', () => {
    expect(normalizeJobDoc(JSON.parse(JSON.stringify(sampleJob())))).toEqual(sampleJob());
  });
  it('rejects non-jobs and repairs duplicate ids', () => {
    expect(() => normalizeJobDoc({})).toThrow();
    const doc = normalizeJobDoc({ cabs: [{ id: 1, type: 'XX' }, { id: 1, type: 'W' }] });
    expect(doc.cabs.map(c => c.id)).toEqual([1, 2]);
    expect(doc.cabs[0].type).toBe('B');
  });
});
