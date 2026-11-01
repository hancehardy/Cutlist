import { describe, expect, it } from 'vitest';
import { BUILTIN_CATALOG, newFace, type Material } from './engine';
import { emptyJob, normalizeJobDoc } from './job';
import { OPTIONS, PRESETS, isCustomized, presetFor, type Preset } from './presets';
import { BUILTIN_DOOR_STYLES, BUILTIN_DRAWER_FRONT_STYLES, BUILTIN_MATERIALS, OPTION_KEYS, defaultJobMaterials, defaultShopConfig, normStyle, normType, normalizeCatalog, normalizeShopConfig, optionsFor, presetKey, sameMaterial, type ShopConfig } from './shop';

const M = (name: string, thk: string, w = '49', l = '97'): Material => ({ name, thk, w, l });
const thin: Preset = { key: 'thin', label: 'Thin stretchers', blurb: '', values: { stretcherW: '3' } };

describe('shop config', () => {
  it('starts from the built-in materials, choices, saw settings and method', () => {
    const c = defaultShopConfig();
    expect(c.presets.map(p => p.key)).toEqual(['frameless']);
    expect(c.materials).toHaveLength(9);
    expect(c.materials[0]).toEqual(M('3/4 2s Melamine', '3/4'));
    expect(c.saw).toEqual({ kerf: '3/16', edgeTrim: '1/4' });
    for (const k of OPTION_KEYS) expect(c.options[k]).toEqual(OPTIONS[k]);
    expect('caseMat' in c.options).toBe(false);
    // Copies, not the built-in arrays.
    c.options.pull!.push('x'); c.materials[0].name = 'x';
    expect(OPTIONS.pull).not.toContain('x');
    expect(BUILTIN_MATERIALS[0].name).toBe('3/4 2s Melamine');
  });

  it('cleans up choices: trims, drops blanks and duplicates, keeps order', () => {
    const c = normalizeShopConfig({ options: { pull: [' Knob', '', 'Knob', 7, null, 'Bar'] } });
    expect(c.options.pull).toEqual(['Knob', '7', 'Bar']);
    // Fields not in the document keep the built-in list; an explicit empty list stays empty.
    expect(c.options.hinge).toEqual(OPTIONS.hinge);
    expect(normalizeShopConfig({ options: { pull: [] } }).options.pull).toEqual([]);
    expect(optionsFor({ pull: [] }, 'pull')).toBeUndefined();
    expect(optionsFor({ pull: ['Knob'] }, 'pull')).toEqual(['Knob']);
  });

  it('cleans up materials: name required and unique, bad dimensions fall back', () => {
    const c = normalizeShopConfig({ materials: [
      { name: ' Ply ', thk: 0.71, w: '48', l: '96' }, { name: 'Ply', thk: '1' }, { name: '', thk: '1' }, { name: 'Odd', thk: 'x', w: -1, l: '' }, 'junk',
    ] });
    expect(c.materials).toEqual([M('Ply', '0.71', '48', '96'), M('Odd', '3/4')]);
    expect(normalizeShopConfig({ materials: [] }).materials).toEqual(BUILTIN_MATERIALS);
  });

  it("seeds the table from a version-1 document's material dropdowns", () => {
    const c = normalizeShopConfig({ version: 1, options: { caseMat: ['3/4 Baltic Birch', '5/8 Particle'], backMat: ['1/4 1s Melamine', '3/4 Baltic Birch'] } });
    expect(c.materials).toEqual([M('3/4 Baltic Birch', '3/4', '60', '60'), M('5/8 Particle', '5/8'), M('1/4 1s Melamine', '1/4')]);
  });

  it('keeps only construction rules in a method; keys are unique slugs', () => {
    const c = normalizeShopConfig({ presets: [
      { key: 'Shop Ply!', label: ' Ply ', blurb: 'x', values: { caseMat: 'A', wallTop: '84', caseThk: 0.71, pull: '  ', sheetL: 120, kerf: '1/8', stretcherW: 3 } },
      { key: 'shop-ply', label: 'Ply 2' },
      { label: '' },
      { label: 'No key' },
    ] });
    expect(c.presets.map(p => [p.key, p.label])).toEqual([['shop-ply', 'Ply'], ['shop-ply-2', 'Ply 2'], ['no-key', 'No key']]);
    expect(c.presets[0].values).toEqual({ stretcherW: '3' });
  });

  it('falls back to the built-in method and saw settings when nothing valid is given', () => {
    expect(normalizeShopConfig({ presets: [] }).presets).toEqual(PRESETS);
    expect(normalizeShopConfig({ presets: [{ label: '' }] }).presets).toEqual(PRESETS);
    expect(normalizeShopConfig({ saw: { kerf: '1/8', edgeTrim: 'no' } }).saw).toEqual({ kerf: '1/8', edgeTrim: '1/4' });
    expect(normalizeShopConfig({ saw: { edgeTrim: '0' } }).saw).toEqual({ kerf: '3/16', edgeTrim: '0' });
    expect(() => normalizeShopConfig(null)).toThrow();
  });

  it('makes unique keys', () => {
    expect(presetKey('Frameless – Melamine')).toBe('frameless-melamine');
    expect(presetKey('Frameless – Melamine', ['frameless-melamine'])).toBe('frameless-melamine-2');
    expect(presetKey('!!!')).toBe('method');
  });

  it('compares materials by value', () => {
    expect(sameMaterial(M('A', '3/4'), M('A ', '0.75'))).toBe(true);
    expect(sameMaterial(M('A', '3/4'), M('A', '3/4', '60', '60'))).toBe(false);
  });
});

describe('jobs on shop settings', () => {
  const shop: ShopConfig = {
    ...defaultShopConfig(),
    presets: [thin, PRESETS[0]],
    materials: [M('Ply', '0.71'), M('Back', '1/4'), M('MDF', '3/4')],
    options: { ...defaultShopConfig().options, pull: ['Knob'] },
  };

  it('resolves methods against the shop list, defaulting to its first method', () => {
    expect(presetFor('thin', shop.presets)).toBe(thin);
    expect(presetFor('gone', shop.presets)).toBe(thin);
    expect(normalizeJobDoc({ cabs: [], method: 'thin' }, shop).method).toBe('thin');
    expect(normalizeJobDoc({ cabs: [], method: 'gone' }, shop).method).toBe('thin');
  });

  it('starts a blank job on the default method, materials and first hardware choices', () => {
    const doc = emptyJob(shop);
    expect(doc.method).toBe('thin');
    expect(doc.defaults).toMatchObject({ stretcherW: '3', pull: 'Knob', hinge: OPTIONS.hinge![0] });
    // First material for the case and fronts, thinnest for the back.
    expect(doc.materials).toEqual({ case: M('Ply', '0.71'), back: M('Back', '1/4'), front: M('Ply', '0.71'), toe: M('Back', '1/4') });
    expect(isCustomized(doc.method, doc.defaults, shop.presets)).toBe(false);
    expect(isCustomized(doc.method, { ...doc.defaults, stretcherW: '4' }, shop.presets)).toBe(true);
    expect(defaultJobMaterials([]).case.name).toBe('3/4 2s Melamine');
  });

  it('keeps a job\'s own material copies and rebuilds incomplete ones', () => {
    const m = { case: M('X', '5/8', '48', '96'), back: M('Y', '1/8'), front: M('Z', '3/4'), toe: M('T', '1/4') };
    expect(normalizeJobDoc({ cabs: [], materials: m }, shop).materials).toEqual(m);
    // A job saved before the toe kick material existed uses its back material for it.
    const { toe: _t, ...three } = m; void _t;
    expect(normalizeJobDoc({ cabs: [], materials: three }, shop).materials.toe).toEqual(m.back);
    expect(normalizeJobDoc({ cabs: [], materials: { case: m.case } }, shop).materials.case.name).toBe('3/4 2s Melamine');
  });

  it('migrates a job saved before materials were part of it', () => {
    const doc = normalizeJobDoc({ cabs: [], defaults: {
      caseMat: 'Ply', backMat: '1/4 1s Melamine', frontMat: 'New', caseThk: '0.71', sheetL: '120', kerf: '1/8', edgeTrim: '0', pull: 'Knob', stretcherW: '3',
    } }, shop);
    expect(doc.materials).toEqual({
      case: M('Ply', '0.71', '49', '120'),
      back: M('1/4 1s Melamine', '1/4', '49', '120'),
      front: M('New', '0.71', '49', '120'),
      toe: M('1/4 1s Melamine', '1/4', '49', '120'),
    });
    // Material, sheet and saw keys leave the job's rules; hardware and real rules stay.
    expect(doc.defaults).toEqual({ pull: 'Knob', stretcherW: '3' });
    // A job with no old material keys gets the app's melamine defaults.
    expect(normalizeJobDoc({ cabs: [] }).materials.back).toEqual(M('1/4 1s Melamine', '1/4'));
  });
});

describe('cabinet catalog config', () => {
  it('starts from the built-in categories and boxes, as copies', () => {
    const c = defaultShopConfig().catalog;
    expect(c).toEqual(BUILTIN_CATALOG);
    c.types[0].faces[0].kind = 'open'; c.categories[0].label = 'x';
    expect(BUILTIN_CATALOG.types[0].faces[0].kind).toBe('drawer');
    expect(BUILTIN_CATALOG.categories[0].label).toBe('Base');
    expect(normalizeShopConfig({}).catalog).toEqual(BUILTIN_CATALOG);
  });

  it('cleans up categories: label required, unique slug keys, known styles', () => {
    const c = normalizeCatalog({ categories: [{ key: 'Up per!', label: ' Uppers ', style: 'wall' }, { key: 'up-per', label: 'Again', style: 'weird' }, { label: '' }, 'x'], types: [] });
    expect(c.categories).toEqual([{ key: 'up-per', label: 'Uppers', style: 'wall' }, { key: 'up-per-2', label: 'Again', style: 'base' }]);
    // No boxes given: the built-in boxes move into the first category when theirs is gone.
    expect(new Set(c.types.map(t => t.cat))).toEqual(new Set(['up-per']));
  });

  it('cleans up boxes: unique codes, category fallback, faces validated', () => {
    const c = normalizeCatalog({ types: [
      { code: ' U ', cat: 'wall', label: '', img: '/assets/sku/wall-std.png', h: 'x', d: 0, toe: -1, faces: [
        { kind: 'door', h: 'smallFront', split: 9, shelves: 'auto', rollouts: 7, hinge: 'R' },
        { kind: 'drawer', h: '7 1/2', split: 0, shelves: 3, rollouts: 2 },
        { kind: 'door', h: 'nonsense' },
        { kind: 'shelf' },
      ] },
      { code: 'U', cat: 'nowhere', label: 'dup' },
      { code: 'E', cat: 'nowhere', faces: [] },
    ] });
    expect(c.categories).toEqual(BUILTIN_CATALOG.categories);
    expect(c.types.map(t => t.code)).toEqual(['U', 'E']);
    expect(c.types[0]).toMatchObject({ cat: 'wall', label: 'U', h: '30', d: '24', toe: '0' });
    expect(c.types[0].faces).toEqual([
      { kind: 'door', h: 'smallFront', split: 4, shelves: 'auto', rollouts: 5, hinge: 'R' },
      { kind: 'drawer', h: '7 1/2', split: 1, shelves: 0, rollouts: 0, hinge: 'L' },
      { kind: 'door', h: '', split: 0, shelves: 0, rollouts: 0, hinge: 'L' },
    ]);
    expect(c.types[1]).toMatchObject({ cat: 'base', label: 'E', faces: [newFace('door')] });
  });

  it('keeps a job\'s box codes as saved', () => {
    expect(normalizeJobDoc({ cabs: [{ type: 'ZZ' }, {}] }).cabs.map(c => c.type)).toEqual(['ZZ', 'B']);
  });
});

describe('a box posted from a job', () => {
  it('needs a code and lands in a known category', () => {
    const cats = BUILTIN_CATALOG.categories;
    expect(normType({ label: 'No code' }, cats)).toBeNull();
    expect(normType('x', cats)).toBeNull();
    expect(normType({ code: 'B-C', cat: 'island', h: '34 1/2', d: '24', toe: '4 1/2', faces: [newFace('drawer', 'smallFront')] }, cats))
      .toEqual({ code: 'B-C', cat: 'base', label: 'B-C', img: '', h: '34 1/2', d: '24', toe: '4 1/2', faces: [newFace('drawer', 'smallFront')] });
  });
});

describe('front styles config', () => {
  it('starts from the built-in styles and keeps the drawer box list as an option', () => {
    const c = defaultShopConfig();
    expect(c.doorStyles).toEqual(BUILTIN_DOOR_STYLES);
    expect(c.drawerFrontStyles).toEqual(BUILTIN_DRAWER_FRONT_STYLES);
    expect(OPTION_KEYS).toContain('drawerStyle');
    expect(OPTION_KEYS).not.toContain('doorStyle');
    expect('doorStyle' in normalizeShopConfig({ options: { doorStyle: ['x'] } }).options).toBe(false);
  });

  it('cleans up styles: name required and unique, slab inferred from the name, grain validated', () => {
    expect(normStyle({ name: ' Slab (Paint) ' })).toEqual({ name: 'Slab (Paint)', slab: true, grain: 'Vertical' });
    expect(normStyle({ name: 'Shaker', grain: 'Horizontal' })).toEqual({ name: 'Shaker', slab: false, grain: 'Horizontal' });
    expect(normStyle({ name: 'Flat', slab: true, grain: 'sideways' })).toEqual({ name: 'Flat', slab: true, grain: 'Vertical' });
    expect(normStyle({ name: '' })).toBeNull();
    const c = normalizeShopConfig({ doorStyles: [{ name: 'A' }, { name: 'A', slab: true }, 'junk', { name: 'B', slab: false }] });
    expect(c.doorStyles).toEqual([{ name: 'A', slab: false, grain: 'Vertical' }, { name: 'B', slab: false, grain: 'Vertical' }]);
    expect(normalizeShopConfig({ doorStyles: [] }).doorStyles).toEqual(BUILTIN_DOOR_STYLES);
  });

  it('seeds styles from an older document\'s door style dropdown', () => {
    const c = normalizeShopConfig({ options: { doorStyle: ['Slab (Melamine)', 'Raised panel'] } });
    expect(c.doorStyles).toEqual([{ name: 'Slab (Melamine)', slab: true, grain: 'Vertical' }, { name: 'Raised panel', slab: false, grain: 'Vertical' }]);
    expect(c.drawerFrontStyles.map(s => s.name)).toEqual(['Slab (Melamine)', 'Raised panel']);
  });

  it('gives jobs their front styles: copies on new jobs, migrated from the old door style on old ones', () => {
    const shop: ShopConfig = { ...defaultShopConfig(), doorStyles: [{ name: 'Shaker', slab: false, grain: 'Vertical' }], drawerFrontStyles: [{ name: 'Slab H', slab: true, grain: 'Horizontal' }] };
    const fresh = emptyJob(shop);
    expect(fresh.fronts).toEqual({ door: { name: 'Shaker', slab: false, grain: 'Vertical' }, drawer: { name: 'Slab H', slab: true, grain: 'Horizontal' } });
    expect(fresh.defaults.drawerStyle).toBe('5 Piece Drawer');
    const old = normalizeJobDoc({ cabs: [], defaults: { doorStyle: 'Slab (Veneer)', drawerStyle: 'Metal Box', pull: 'Knob' } });
    expect(old.fronts).toEqual({ door: { name: 'Slab (Veneer)', slab: true, grain: 'Vertical' }, drawer: { name: 'Slab (Veneer)', slab: true, grain: 'Vertical' } });
    expect(old.defaults).toEqual({ drawerStyle: 'Metal Box', pull: 'Knob' });
    const kept = normalizeJobDoc({ cabs: [], fronts: { door: { name: 'X', slab: false }, drawer: { name: 'Y', slab: true, grain: 'Horizontal' } } });
    expect(kept.fronts).toEqual({ door: { name: 'X', slab: false, grain: 'Vertical' }, drawer: { name: 'Y', slab: true, grain: 'Horizontal' } });
  });
});

describe('accessory boxes in the catalog', () => {
  it('ships an Accessory category of panels and validates panel settings', () => {
    const c = defaultShopConfig().catalog;
    expect(c.categories.find(x => x.key === 'accessory')?.style).toBe('panel');
    expect(c.types.filter(t => t.cat === 'accessory').map(t => [t.code, t.w, t.panel?.band, t.panel?.mat])).toEqual([['FIL', '3', 'long', 'front'], ['EP', '24', 'long', 'front'], ['TK', '96', 'none', 'toe']]);
    const n = normType({ code: 'X', cat: 'accessory', faces: [{ kind: 'door' }], d: '24', toe: '4', w: 'abc', panel: { mat: 'nowhere', grain: 'Horizontal', band: 'some' } }, c.categories)!;
    expect(n).toMatchObject({ faces: [], d: '0', toe: '0', panel: { mat: 'front', grain: 'Horizontal', band: 'long' } });
    expect(n.w).toBeUndefined();
    expect(normType({ code: 'Y', cat: 'base', w: '18' }, c.categories)).toMatchObject({ w: '18' });
    expect(normType({ code: 'Z', cat: 'base' }, c.categories)!.panel).toBeUndefined();
  });
});

describe('accessory migration', () => {
  it('adds the Accessory panels once to a shop saved before version 3, and not again after', () => {
    const old = { version: 2, catalog: { categories: [{ key: 'base', label: 'Base', style: 'base' }], types: [{ code: 'B', cat: 'base', faces: [{ kind: 'door' }] }] } };
    const c = normalizeShopConfig(old);
    expect(c.version).toBe(3);
    expect(c.catalog.categories.map(x => [x.key, x.style])).toEqual([['base', 'base'], ['accessory', 'panel']]);
    expect(c.catalog.types.map(t => t.code)).toEqual(['B', 'FIL', 'EP', 'TK']);
    // The admin removes them; a version-3 document stays as saved.
    const trimmed = normalizeShopConfig({ ...c, catalog: { categories: [c.catalog.categories[0]], types: [c.catalog.types[0]] } });
    expect(trimmed.catalog.categories.map(x => x.key)).toEqual(['base']);
    expect(trimmed.catalog.types.map(t => t.code)).toEqual(['B']);
  });
});
