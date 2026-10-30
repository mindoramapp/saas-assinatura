/** Funções puras de dinheiro: usadas no servidor e no formulário (total ao vivo). */

export function quoteTotal(
  items: { quantity: number; unitCents: number }[],
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
}

/** Converte "1.234,56", "R$ 89,90" ou "1234.56" em centavos. */
export function parseMoneyToCents(value: string): number {
  const clean = value.replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}
