/** Nombre comparable: sin tildes, mayúsculas ni espacios extra ("Cálculo  I" ≈ "calculo i"). */
export function comparableName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
