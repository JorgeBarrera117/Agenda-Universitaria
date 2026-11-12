/**
 * Compara dos versiones "1.7.10.52" (acepta "v" inicial y sufijos "-beta"). Devuelve un número
 * positivo si a es más nueva que b, negativo si es más antigua y 0 si son iguales.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
