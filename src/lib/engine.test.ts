import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG, buildJob, defaultLayout, facesFromSections, fmt, newFace, newSection, parseDim, resolveDefaults, resolveFaces, sheetTotals, type CabCatalog } from './engine';
import { emptyJob, normalizeJobDoc, sampleJob } from './job';
import { PRESETS, isCustomized, type Preset } from './presets';
import { defaultShopConfig } from './shop';

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
});

describe('normalizeJobDoc', () => {
  it('round-trips the sample job', () => {
    expect(normalizeJobDoc(JSON.parse(JSON.stringify(sampleJob())))).toEqual(sampleJob());
  });
  it('rejects non-jobs and repairs duplicate ids', () => {
    expect(() => normalizeJobDoc({})).toThrow();
    const doc = normalizeJobDoc({ cabs: [{ id: 1, type: 'XX' }, { id: 1, type: 'W' }, { id: 3 }] });
    expect(doc.cabs.map(c => c.id)).toEqual([1, 4, 3]);
    // Unknown codes are kept (the box may come back in the catalog); a missing one gets the first box.
    expect(doc.cabs.map(c => c.type)).toEqual(['XX', 'W', 'B']);
  });
});

describe('job setup', () => {
  it('new jobs start on setup; saved jobs without the flag open on items', () => {
    expect(emptyJob().setupDone).toBe(false);
    expect(normalizeJobDoc({ cabs: [] }).setupDone).toBe(true);
    expect(normalizeJobDoc({ cabs: [], setupDone: false }).setupDone).toBe(false);
  });

  it('drops rules the app no longer has (e.g. the old wall top height)', () => {
    const doc = normalizeJobDoc({ cabs: [], defaults: { wallTop: '84', pull: 'Knob' } });
    expect(doc.defaults).toEqual({ pull: 'Knob' });
    expect(isCustomized(doc.method, normalizeJobDoc({ cabs: [], defaults: { wallTop: '84' } }).defaults)).toBe(false);
  });

  const thin: Preset = { key: 'thin', label: 'Thin stretchers', blurb: '', values: { stretcherW: '3' } };
  const shop = { ...defaultShopConfig(), presets: [PRESETS[0], thin] };

  it('falls back to the standard method for unknown methods', () => {
    expect(normalizeJobDoc({ cabs: [], method: 'face-frame' }).method).toBe('frameless');
    expect(normalizeJobDoc({ cabs: [], method: 'thin' }, shop).method).toBe('thin');
    expect(normalizeJobDoc({ cabs: [], method: 'thin' }).method).toBe('frameless');
  });

  it('detects edits to the construction rules, and only those', () => {
    expect(isCustomized('frameless', {})).toBe(false);
    expect(isCustomized('thin', { ...thin.values }, shop.presets)).toBe(false);
    expect(isCustomized('thin', {}, shop.presets)).toBe(true);
    // Hardware is not part of a method.
    expect(isCustomized('frameless', { pull: 'Knob' })).toBe(false);
    // Typing the shop-standard value back in is not a customization.
    expect(isCustomized('frameless', { stretcherW: '4' })).toBe(false);
    expect(isCustomized('frameless', { stretcherW: '3' })).toBe(true);
  });
});

describe('materials', () => {
  const cab = { id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' };
  const M = (name: string, thk: string, w = '49', l = '97') => ({ name, thk, w, l });

  it('takes case and back thickness from the materials', () => {
    const job = buildJob([cab], {}, 'fraction', { case: M('Ply', '0.71'), back: M('Thin', '1/2'), front: M('Ply', '0.71') });
    expect([job.d.caseThk, job.d.backThk]).toEqual([0.71, 0.5]);
    expect(job.cabs[0].parts.find(p => p.desc === 'Deck')!.l).toBeCloseTo(15 - 2 * 0.71);
    expect(job.materials.map(m => m.name)).toEqual(['Thin', 'Ply']);
    // Bad dimensions fall back to the app defaults.
    expect(buildJob([cab], {}, 'fraction', { case: M('Ply', 'x'), back: M('Thin', '0'), front: M('Ply', '') }).d.caseThk).toBe(0.75);
  });

  it('plans each material on its own sheet; the case wins a name clash', () => {
    const job = buildJob([cab], {}, 'fraction', { case: M('A', '3/4'), back: M('B', '1/4', '60', '60'), front: M('A', '3/4', '48', '96') });
    const plan = (n: string) => job.sawPlans.find(p => p.name === n)!;
    expect([plan('B').L, plan('B').W]).toEqual([60, 60]);
    expect([plan('A').L, plan('A').W]).toEqual([97, 49]);
    expect(plan('B').sheets[0].title).toContain('(60 x 60)');
  });

  it('means 3/4 and 1/4 melamine on 49 x 97 when a job has none', () => {
    const job = buildJob([cab], {});
    expect(job.d.sheets).toEqual({});
    expect(job.sawPlans.map(p => [p.name, p.L, p.W])).toEqual([['1/4 1s Melamine', 97, 49], ['3/4 2s Melamine', 97, 49]]);
  });
});

describe('captured back, set in 3/4"', () => {
  const part = (job: ReturnType<typeof buildJob>, desc: string) => job.cabs[0].parts.find(p => p.desc === desc)!;

  it('sizes the back to the opening plus a 3/8" groove all round', () => {
    const job = buildJob([{ id: 1, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1' }], {});
    // inside 28 1/2 + 3/4 by inside 28 1/2 + 3/4
    expect([part(job, 'Unfinished Back').w, part(job, 'Unfinished Back').l]).toEqual([29.25, 29.25]);
    const deeper = buildJob([{ id: 1, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1' }], { backGroove: '1/4' });
    expect(part(deeper, 'Unfinished Back').w).toBe(29);
  });

  it('stops shelves, partitions and spacers at the front of the back', () => {
    const wall = buildJob([{ id: 1, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1' }], {});
    // 12 - 3/4 inset - 1/4 back - 1 setback
    expect(part(wall, 'Adjustable Shelf').w).toBe(10);
    const base = buildJob([{ id: 1, type: 'BD', w: '30', h: '34.5', d: '24', toe: '4.5', qty: '1',
      layout: [newSection('drawer', '6', { split: 2 }), newSection('door', '', { rollouts: 1 })] }], {});
    expect(part(base, 'Drawer Partition').w).toBe(23);
    expect(base.cabs[0].hardware.find(h => h.item === 'Roll-out Spacer')!.spec).toBe('1 x 3 x 22');
  });

  it('keeps ends, deck and top full depth', () => {
    const wall = buildJob([{ id: 1, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1' }], {});
    expect(['Unfinished Left End', 'Bottom', 'Top'].map(dsc => part(wall, dsc).w)).toEqual([12, 12, 12]);
  });
});

describe('panel saw optimizer', () => {
  const plan = (cabs: Parameters<typeof buildJob>[0], raw = {}) => buildJob(cabs, raw).sawPlans;
  const kitchen = [
    { id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' },
    { id: 2, type: 'B', w: '24', h: '34.5', d: '24', toe: '4.5', qty: '3' },
    { id: 3, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '2' },
    { id: 4, type: 'T', w: '18', h: '84', d: '24', toe: '4.5', qty: '1' },
  ];

  it('places every part once, inside the trimmed sheet, without overlaps, as rip-then-crosscut', () => {
    const job = buildJob(kitchen, {});
    const k = job.d.kerf, t = job.d.edgeTrim;
    for (const p of job.sawPlans) {
      const expected = job.materials.find(m => m.name === p.name)!.rows.reduce((a, r) => a + r.qty, 0);
      const placed = p.sheets.flatMap(s => s.parts);
      expect(placed.length + p.oversize.length).toBe(expected);
      expect(new Set(placed.map(x => x.id)).size).toBe(placed.length);
      for (const s of p.sheets) {
        for (const a of s.parts) {
          expect(a.x).toBeGreaterThanOrEqual(t - 1e-9);
          expect(a.y).toBeGreaterThanOrEqual(t - 1e-9);
          expect(a.x + a.along).toBeLessThanOrEqual(p.L + 1e-9);
          expect(a.y + a.across).toBeLessThanOrEqual(p.W + 1e-9);
          // Each part lies in exactly one strip and is no wider than it.
          const strip = s.strips.find(st => Math.abs(st.y - a.y) < 1e-9)!;
          expect(strip).toBeDefined();
          expect(a.across).toBeLessThanOrEqual(strip.w + 1e-9);
          expect(a.recut).toBe(a.across < strip.w - 1e-9);
          for (const b of s.parts) {
            if (a === b) continue;
            const apart = a.x + a.along + k <= b.x + 1e-9 || b.x + b.along + k <= a.x + 1e-9
              || a.y + a.across + k <= b.y + 1e-9 || b.y + b.across + k <= a.y + 1e-9;
            expect(apart).toBe(true);
          }
        }
        // Strips don't overlap across the sheet width.
        const ys = [...s.strips].sort((x, y) => x.y - y.y);
        for (let i = 1; i < ys.length; i++) expect(ys[i].y).toBeGreaterThanOrEqual(ys[i - 1].y + ys[i - 1].w + k - 1e-9);
        // Cut order: trims, then rips, then crosscuts/recuts.
        const order = s.cuts.map(c => (c.kind === 'trim' ? 0 : c.kind === 'rip' ? 1 : 2));
        expect(order).toEqual([...order].sort());
        expect(s.cuts.map(c => c.n)).toEqual(s.cuts.map((_, i) => i + 1));
      }
    }
  });

  it('trims one long and one short edge first, per the edge trim rule', () => {
    const s = plan([kitchen[0]])[0].sheets[0];
    expect(s.cuts.slice(0, 2).map(c => c.text)).toEqual(['Trim 1/4" off the long edge', 'Trim 1/4" off the short edge']);
    const none = plan([kitchen[0]], { edgeTrim: '0' })[0].sheets[0];
    expect(none.cuts.some(c => c.kind === 'trim')).toBe(false);
  });

  it('drops a narrower part into a wider strip with a recut instead of opening a new strip', () => {
    const job = buildJob([{ id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' }], {});
    const back = job.sawPlans.find(p => p.name === '1/4 1s Melamine')!.sheets[0];
    expect(back.strips).toHaveLength(1);
    const caseSheet = job.sawPlans.find(p => p.name === '3/4 2s Melamine')!.sheets[0];
    // 21" strip holds the ends and the deck; the narrower deck needs no recut (it is 21 across).
    expect(caseSheet.parts.filter(p => p.recut).every(p => caseSheet.cuts.some(c => c.kind === 'recut' && c.text.includes(`#${p.id} `)))).toBe(true);
  });

  it('flags parts larger than the trimmed sheet', () => {
    const p = plan([{ id: 1, type: 'T', w: '18', h: '98', d: '24', toe: '0', qty: '1' }]);
    expect(p.flatMap(x => x.oversize.map(o => o.name))).toContain('Unfinished Left End');
  });
});

describe('cabinet catalog', () => {
  const d = resolveDefaults();
  const cab = (type: string, h = '30', catalog?: CabCatalog) =>
    buildJob([{ id: 1, type, w: '30', h, d: '12', toe: '0', qty: '1' }], {}, 'fraction', null, catalog).cabs[0];

  it('keeps the standard layouts of the built-in boxes', () => {
    expect(defaultLayout('B', d, 34.5).map(s => [s.kind, s.h, s.shelves])).toEqual([['drawer', d.smallFront, 0], ['door', '', 1]]);
    expect(defaultLayout('T', d, 84).map(s => [s.kind, s.h, s.shelves])).toEqual([['door', '', 3], ['door', d.tallLowerDoor, 1]]);
    expect(defaultLayout('SB', d, 34.5).map(s => s.kind)).toEqual(['false', 'door']);
    // Wall boxes get one shelf under 30" and two from 30".
    expect(defaultLayout('W', d, 24)[0].shelves).toBe(1);
    expect(defaultLayout('W', d, 30)[0].shelves).toBe(2);
    expect(defaultLayout('WO', d, 42)[0].shelves).toBe(2);
  });

  it('builds the case from the category style, not the category name', () => {
    const catalog: CabCatalog = {
      categories: [{ key: 'upper', label: 'Uppers', style: 'wall' }, { key: 'larder', label: 'Larders', style: 'tall' }, { key: 'low', label: 'Lows', style: 'base' }],
      types: [
        { code: 'U', cat: 'upper', label: 'Upper', img: '', h: '30', d: '12', toe: '0', faces: [newFace('door', '', { shelves: 2 })] },
        { code: 'L', cat: 'larder', label: 'Larder', img: '', h: '84', d: '24', toe: '4 1/2', faces: [newFace('door')] },
        { code: 'LD', cat: 'low', label: 'Low drawers', img: '', h: '34 1/2', d: '24', toe: '4 1/2', faces: [newFace('drawer', '8'), newFace('drawer')] },
      ],
    };
    const names = (c: ReturnType<typeof cab>) => c.parts.map(p => `${p.qty} ${p.desc}`);
    expect(names(cab('U', '30', catalog))).toEqual(expect.arrayContaining(['1 Bottom', '1 Top', '2 Nailer']));
    expect(names(cab('U', '30', catalog))).not.toContain('2 Top Stretcher');
    expect(names(cab('L', '84', catalog))).toEqual(expect.arrayContaining(['1 Deck', '1 Top', '1 Nailer']));
    const low = cab('LD', '34 1/2', catalog);
    expect(names(low)).toEqual(expect.arrayContaining(['1 Deck', '2 Top Stretcher', '1 Nailer']));
    // A fixed face height is a plain dimension.
    expect(low.sections[0].h).toBe(8);
    expect(low.cat).toBe('low');
  });

  it('warns about a box that is not in the catalog and builds it as the first box', () => {
    const c = cab('ZZ');
    expect(c.warn).toContain('Unknown cabinet type ZZ');
    expect(c.label).toContain(BUILTIN_CATALOG.types[0].label);
    expect(cab('W').warn).toBe('');
  });
});

describe('saving a job cabinet\'s faces as a box', () => {
  const d = resolveDefaults();

  it('turns configured sections into box faces, keeping rule heights as rules', () => {
    const layout = [
      newSection('drawer', '6 3/16'),            // equals the top drawer front rule
      newSection('door', '', { shelves: 2, rollouts: 1, hinge: 'R' }),
      newSection('drawer', '7 1/2', { split: 2 }),
      newSection('open', '', { shelves: 1 }),
    ];
    const faces = facesFromSections(layout, d);
    expect(faces.map(f => f.h)).toEqual(['smallFront', '', '7 1/2', '']);
    expect(faces[1]).toMatchObject({ kind: 'door', split: 0, shelves: 2, rollouts: 1, hinge: 'R' });
    expect(faces[2]).toMatchObject({ kind: 'drawer', split: 2, shelves: 0, rollouts: 0 });
    // Round trip: resolving the saved faces gives the same sections back.
    expect(resolveFaces(faces, d, 34.5).map(s => [s.kind, s.h, s.split, s.shelves])).toEqual([
      ['drawer', d.smallFront, 1, 0], ['door', '', 0, 2], ['drawer', 7.5, 2, 0], ['open', '', 1, 1],
    ]);
    // A method with a different top drawer height moves the saved drawer with it.
    expect(resolveFaces(faces, resolveDefaults({ smallFront: '7' }), 34.5)[0].h).toBe(7);
  });

  it('keeps auto shelves while the count still matches, when editing a box in Admin', () => {
    const prev = [newFace('door', '', { shelves: 'auto' })];
    const layout = resolveFaces(prev, d, 30).map(s => ({ ...s, h: '' as const, rollouts: 2 }));
    expect(facesFromSections(layout, d, { prev, H: 30 })[0]).toMatchObject({ shelves: 'auto', rollouts: 2 });
    // Changing the count makes it a fixed number; without the previous faces it is always a number.
    expect(facesFromSections(layout.map(s => ({ ...s, shelves: 3 })), d, { prev, H: 30 })[0].shelves).toBe(3);
    expect(facesFromSections(layout, d)[0].shelves).toBe(2);
  });

  it('builds the same cabinet from the saved box as from the custom layout', () => {
    const layout = [newSection('false', '6 3/16'), newSection('door', '', { shelves: 1, rollouts: 2 })];
    const custom = buildJob([{ id: 1, type: 'B', w: '30', h: '34 1/2', d: '24', toe: '4 1/2', qty: '1', layout }], {}).cabs[0];
    const catalog: CabCatalog = { ...BUILTIN_CATALOG, types: [...BUILTIN_TYPES_WITH({ code: 'B-C', cat: 'base', label: 'Saved', img: '', h: '34 1/2', d: '24', toe: '4 1/2', faces: facesFromSections(layout, d) })] };
    const saved = buildJob([{ id: 1, type: 'B-C', w: '30', h: '34 1/2', d: '24', toe: '4 1/2', qty: '1' }], {}, 'fraction', null, catalog).cabs[0];
    expect(saved.parts).toEqual(custom.parts);
    expect(saved.fronts).toEqual(custom.fronts);
    expect(saved.drawers).toEqual(custom.drawers);
    expect(saved.hardware).toEqual(custom.hardware);
  });
});
const BUILTIN_TYPES_WITH = (t: CabCatalog['types'][number]) => [...BUILTIN_CATALOG.types, t];

describe('sheet material summary', () => {
  it('totals the sheets of each material from the saw plans', () => {
    const job = buildJob([
      { id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' },
      { id: 2, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '4' },
    ], {});
    const t = sheetTotals(job.sawPlans);
    expect(t.map(x => [x.name, x.sheets])).toEqual(job.sawPlans.map(p => [p.name, p.sheets.length]));
    expect(t.reduce((n, x) => n + x.sheets, 0)).toBe(job.summary.sheets);
    // Every placed part is counted once, on a 97 x 49 sheet, with a sane yield.
    expect(t.reduce((n, x) => n + x.parts, 0)).toBe(job.summary.nParts);
    for (const x of t) { expect([x.L, x.W]).toEqual([97, 49]); expect(x.yieldPct).toBeGreaterThan(0); expect(x.yieldPct).toBeLessThanOrEqual(100); expect(x.oversize).toBe(0); }
  });

  it('estimates edge banding per material: fronts all round, case parts and stretchers on the exposed edge', () => {
    const job = buildJob([{ id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1' }], {});
    const cab = job.cabs[0];
    const band = (desc: string) => cab.parts.find(p => p.desc === desc)!.band;
    expect(band('Unfinished Left End')).toBe(30);
    expect(band('Deck')).toBe(13.5);
    expect(band('Top Stretcher')).toBe(13.5);
    expect(band('Drawer Stretcher')).toBe(13.5);
    expect(band('Nailer')).toBe(0);
    expect(band('Unfinished Back')).toBe(0);
    expect(cab.fronts.map(fr => fr.band)).toEqual([2 * (14.875 + 6.1875), 2 * (14.875 + 11.6875), 2 * (14.875 + 11.6875)]);
    // ends 60 + deck 13.5 + 2 top stretchers 27 + drawer stretcher 13.5 + fronts 148.375 = 262.375 in
    const t = sheetTotals(job.sawPlans, job.materials);
    expect(t.find(x => x.name === '3/4 2s Melamine')!.bandLf).toBeCloseTo(262.375 / 12, 6);
    expect(t.find(x => x.name === '1/4 1s Melamine')!.bandLf).toBe(0);
    // Quantities multiply the banding.
    const two = buildJob([{ id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '2' }], {});
    expect(two.materials.find(m => m.name === '3/4 2s Melamine')!.bandLf).toBeCloseTo((2 * 262.375) / 12, 6);
  });

  it('reports parts too big for the sheet instead of counting them', () => {
    const job = buildJob([{ id: 1, type: 'T', w: '18', h: '98', d: '24', toe: '0', qty: '1' }], {});
    const caseTotal = sheetTotals(job.sawPlans).find(x => x.name === '3/4 2s Melamine')!;
    expect(caseTotal.oversize).toBe(2);
    // Case parts and the doors share the material; every one is either placed or listed as oversize.
    const all = [...job.cabs[0].parts, ...job.cabs[0].fronts].filter(p => p.mat === '3/4 2s Melamine').reduce((n, p) => n + p.qty, 0);
    expect(caseTotal.parts + caseTotal.oversize).toBe(all);
  });
});

describe('front styles', () => {
  const cab = { id: 1, type: 'B', w: '30', h: '34 1/2', d: '24', toe: '4 1/2', qty: '1' };
  const slab = { name: 'Slab', slab: true, grain: 'Vertical' as const };

  it('cuts only slab fronts; ordered styles still appear on the door list', () => {
    const ordered = buildJob([cab], {}, 'fraction', null, undefined, { door: { name: 'Shaker', slab: false, grain: 'Vertical' }, drawer: slab });
    expect(ordered.doors.map(r => [r.type, r.cut]).sort()).toEqual([['DF', true], ['DR', false]]);
    const front = ordered.materials.find(m => m.name === '3/4 2s Melamine')!;
    expect(front.rows.some(r => r.desc.startsWith('Door'))).toBe(false);
    expect(front.rows.some(r => r.desc.startsWith('Drawer Front'))).toBe(true);
    expect(ordered.sawPlans.flatMap(p => p.sheets.flatMap(s => s.parts.map(x => x.name))).some(n => n.startsWith('Door'))).toBe(false);
    // Ordered doors carry no banding; drawer fronts still do.
    const doors = ordered.cabs[0].fronts.filter(f => f.desc.startsWith('Door'));
    expect(doors.every(f => !f.cut && f.band === 0)).toBe(true);
    expect(ordered.d.doorStyle).toBe('Shaker');
    // Both slab: everything is cut, as with no styles at all.
    const all = buildJob([cab], {}, 'fraction', null, undefined, { door: slab, drawer: slab });
    expect(all.materials.find(m => m.name === '3/4 2s Melamine')!.rows.filter(r => r.desc.startsWith('Door') || r.desc.startsWith('Drawer Front'))).toHaveLength(2);
    expect(all.summary.nParts).toBe(buildJob([cab], {}).summary.nParts);
  });

  it('runs drawer and false fronts with the drawer front style grain; doors stay vertical', () => {
    const job = buildJob([cab, { ...cab, id: 2, type: 'SB' }], {}, 'fraction', null, undefined, { door: slab, drawer: { name: 'Slab H', slab: true, grain: 'Horizontal' } });
    const fronts = job.cabs.flatMap(c => c.fronts);
    expect(fronts.filter(f => f.desc.startsWith('Door')).every(f => f.grain === 'Vertical')).toBe(true);
    expect(fronts.filter(f => /Drawer Front|False Front/.test(f.desc)).every(f => f.grain === 'Horizontal')).toBe(true);
    expect(job.doors.filter(r => r.type === 'DR').every(r => r.grain === 'Vertical' && r.cut)).toBe(true);
    expect(job.doors.filter(r => r.type !== 'DR').every(r => r.grain === 'Horizontal')).toBe(true);
    const row = job.materials.find(m => m.name === '3/4 2s Melamine')!.rows.find(r => r.desc.startsWith('Drawer Front'))!;
    expect(row.grainTxt).toBe('Horizontal (along W)');
    expect(job.d.fronts).toMatchObject({ drawerGrain: 'Horizontal', drawerFrontStyle: 'Slab H', doorSlab: true, drawerSlab: true });
  });
});
