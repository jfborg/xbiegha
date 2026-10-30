import type { Adjustments, Project } from './model';
import { defaultAdjustments } from './model.ts';

export const lookCategories = ['Everyday', 'Sunlit', 'Film', 'Cool', 'Moody', 'B&W'] as const;
export type LookCategory = typeof lookCategories[number];
export type Look = { id: string; name: string; category: LookCategory; description: string; values: Adjustments };
function look(id: string, name: string, category: LookCategory, description: string, values: Partial<Adjustments>): Look {
  return { id, name, category, description, values: { ...defaultAdjustments, ...values } };
}

export const looks: Look[] = [
  look('soft', 'Soft', 'Everyday', 'Airy light, gentle colour.', { exposure: 10, contrast: -12, saturation: -8, warmth: 3, fade: 6 }),
  look('crisp', 'Crisp', 'Everyday', 'Clean contrast and fresh detail.', { exposure: 2, contrast: 20, saturation: 8, warmth: -6 }),
  look('daylight', 'Daylight', 'Everyday', 'A bright, natural lift.', { exposure: 12, contrast: 4, saturation: 4 }),
  look('linen', 'Linen', 'Everyday', 'Quiet colour and creamy softness.', { exposure: 6, contrast: -8, saturation: -22, warmth: 8, fade: 10 }),
  look('bloom', 'Bloom', 'Everyday', 'Fresh colour with a rosy glow.', { exposure: 7, contrast: 5, saturation: 18, warmth: 4, tint: 8 }),

  look('mediterranean', 'Golden', 'Sunlit', 'Warm light, Mediterranean colour.', { exposure: 6, contrast: 8, saturation: 12, warmth: 18, fade: 2 }),
  look('honey', 'Honey', 'Sunlit', 'Rich amber and mellow shadows.', { exposure: 3, contrast: 12, saturation: 4, warmth: 38, fade: 4, vignette: 8 }),
  look('sundaze', 'Sundaze', 'Sunlit', 'Sun-washed, faded summer days.', { exposure: 14, contrast: -16, saturation: -10, warmth: 24, fade: 16 }),
  look('terracotta', 'Terracotta', 'Sunlit', 'Earthy warmth and rich colour.', { exposure: -4, contrast: 18, saturation: -10, warmth: 30, tint: 9, vignette: 12 }),
  look('peach', 'Peach', 'Sunlit', 'Soft warmth with a peachy blush.', { exposure: 10, contrast: -6, saturation: -8, warmth: 20, tint: 15, fade: 7 }),

  look('film', 'Film', 'Film', 'Muted colour, faded shadows.', { exposure: 2, contrast: -8, saturation: -18, warmth: 10, fade: 14, vignette: 12 }),
  look('analog', 'Analog', 'Film', 'Warm colour, a little grain.', { exposure: -2, contrast: 12, saturation: -12, warmth: 16, fade: 8, grain: 24, vignette: 18 }),
  look('instant', 'Instant', 'Film', 'Nostalgic softness and rosy colour.', { exposure: 7, contrast: -14, saturation: -20, warmth: 6, tint: 12, fade: 20, grain: 12 }),
  look('postcard', 'Postcard', 'Film', 'Faded holiday colour and teal notes.', { exposure: 5, contrast: -4, saturation: 14, warmth: -8, tint: -12, fade: 14, grain: 10 }),
  look('archive', 'Archive', 'Film', 'Deep, aged colour and tactile grain.', { exposure: -8, contrast: 8, saturation: -38, warmth: 28, fade: 18, grain: 32, vignette: 25 }),

  look('alpine', 'Alpine', 'Cool', 'Fresh blue light and crisp contrast.', { exposure: 5, contrast: 14, saturation: 3, warmth: -22 }),
  look('sea-glass', 'Sea Glass', 'Cool', 'Soft aqua, washed with light.', { exposure: 8, contrast: -10, saturation: -14, warmth: -15, tint: -18, fade: 8 }),
  look('nordic', 'Nordic', 'Cool', 'Pale light and restrained colour.', { exposure: 12, contrast: -6, saturation: -32, warmth: -14, fade: 4 }),
  look('blue-hour', 'Blue Hour', 'Cool', 'Twilight blues and deep edges.', { exposure: -13, contrast: 16, saturation: -8, warmth: -34, tint: 5, vignette: 22 }),
  look('lavender', 'Lavender', 'Cool', 'A dreamy, cool lilac cast.', { exposure: 6, contrast: -12, saturation: -12, warmth: -18, tint: 25, fade: 10 }),

  look('cinema', 'Cinema', 'Moody', 'Deep contrast and cool atmosphere.', { exposure: -7, contrast: 25, saturation: -18, warmth: -10, tint: -8, fade: 3, vignette: 22 }),
  look('velvet', 'Velvet', 'Moody', 'Rich shadows and muted rose.', { exposure: -6, contrast: 18, saturation: -25, warmth: 9, tint: 16, fade: 8, vignette: 18 }),
  look('forest', 'Forest', 'Moody', 'Earthy greens and quiet shadows.', { exposure: -8, contrast: 16, saturation: -12, warmth: 2, tint: -25, fade: 4, vignette: 15 }),
  look('afterglow', 'Afterglow', 'Moody', 'Warm dusk, with a magenta edge.', { exposure: -10, contrast: 20, saturation: 8, warmth: 23, tint: 22, vignette: 20 }),
  look('storm', 'Storm', 'Moody', 'Cool, dramatic, almost monochrome.', { exposure: -12, contrast: 32, saturation: -48, warmth: -16, fade: 5, vignette: 28 }),

  look('mono', 'Mono', 'B&W', 'A timeless black-and-white contrast.', { contrast: 18, saturation: -100, vignette: 8 }),
  look('noir', 'Noir', 'B&W', 'Deep blacks and dramatic edges.', { exposure: -8, contrast: 42, saturation: -100, vignette: 28 }),
  look('silver', 'Silver', 'B&W', 'Bright, clean monochrome.', { exposure: 12, contrast: 6, saturation: -100 }),
  look('charcoal', 'Charcoal', 'B&W', 'Matte shadows and visible grain.', { exposure: -3, contrast: 10, saturation: -100, fade: 18, grain: 35, vignette: 18 }),
  look('pearl', 'Pearl', 'B&W', 'Gentle greys, soft and luminous.', { exposure: 10, contrast: -22, saturation: -100, fade: 10 }),
];

export const adjustmentKeys = Object.keys(defaultAdjustments) as (keyof Adjustments)[];
export function scaleLook(values: Adjustments, amount: number): Adjustments {
  const strength = Math.max(0, Math.min(100, Number.isFinite(amount) ? amount : 100)) / 100;
  return Object.fromEntries(adjustmentKeys.map(key => [key, Math.round((values[key] || 0) * strength * 100) / 100 || 0])) as Adjustments;
}
function sameAdjustments(a: Adjustments, b: Adjustments) {
  return adjustmentKeys.every(key => Math.abs((a[key] || 0) - (b[key] || 0)) < .001);
}
export function activeLook(project: Pick<Project, 'look' | 'adjustments'>): { look: Look | null; amount: number; original: boolean } {
  const selected = looks.find(item => item.id === project.look?.id);
  const amount = project.look?.amount;
  if (selected && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 100 && sameAdjustments(project.adjustments, scaleLook(selected.values, amount))) {
    return { look: selected, amount, original: false };
  }
  const matched = looks.find(item => sameAdjustments(project.adjustments, item.values));
  return { look: matched || null, amount: 100, original: sameAdjustments(project.adjustments, defaultAdjustments) };
}
// Original six-field backups remain valid; new controls default to zero.
export function readAdjustments(value: unknown): Adjustments {
  if (!value || typeof value !== 'object') throw new Error('Invalid photo adjustments in this backup.');
  const raw = value as Record<string, unknown>;
  const result = { ...defaultAdjustments };
  for (const key of adjustmentKeys) {
    const n = raw[key] === undefined && (key === 'tint' || key === 'grain') ? 0 : raw[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 100 || ['fade', 'vignette', 'grain'].includes(key) && n < 0) throw new Error('Invalid photo adjustments in this backup.');
    result[key] = n;
  }
  return result;
}
