/**
 * Real, deterministic 32-bit hashing.
 * FNV-1a (32-bit) gives a fast string hash; the MurmurHash3 finalizer (fmix32)
 * then mixes the bits so that similar keys ("seg_001", "seg_002") land far apart.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fmix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** hash32(s) = fmix32(fnv1a(s)), an unsigned 32-bit integer. */
export const hash32 = (s: string): number => fmix32(fnv1a(s));

export const U32 = 4294967296;
