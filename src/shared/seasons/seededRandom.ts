/**
 * Pseudoaleatorio con semilla (mulberry32): mismas posiciones en cada render, así los copos o
 * las chispas no saltan de sitio al actualizarse la página.
 */
export function seededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
