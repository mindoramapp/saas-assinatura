import type { ReactNode } from "react";
import { quoteTotal } from "@/lib/money";
import { formatBRL } from "@/lib/plans";

type Props = {
  orgName: string;
  brandColor: string | null;
  quote: {
    number: number;
    title: string;
    clientName: string;
    notes: string | null;
    validUntil: Date;
    createdAt: Date;
    items: {
      id: string;
      description: string;
      quantity: number;
      unitCents: number;
    }[];
  };
  footer?: ReactNode;
};

/** O orçamento como o cliente vê: usado na página pública e na pré-visualização interna. */
export function QuoteDocument({ orgName, brandColor, quote, footer }: Props) {
  const color = brandColor ?? "#1f57d6";
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
      <header
        className="px-6 py-6 text-white sm:px-8"
        style={{ backgroundColor: color }}
      >
        <p className="text-sm font-medium opacity-90">{orgName}</p>
        <h1 className="mt-1 text-2xl font-bold">{quote.title}</h1>
        <p className="mt-2 text-sm opacity-90">
          Orçamento #{quote.number} · para {quote.clientName}
        </p>
      </header>
      <div className="px-6 py-6 sm:px-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qtd.</th>
              <th className="pb-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-3 pr-2">
                  {item.description}
                  <span className="block text-xs text-slate-500">
                    {formatBRL(item.unitCents)} cada
                  </span>
                </td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right font-medium">
                  {formatBRL(item.quantity * item.unitCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-3xl font-extrabold" style={{ color }}>
            {formatBRL(quoteTotal(quote.items))}
          </span>
        </div>
        {quote.notes && (
          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-700">
            {quote.notes}
          </p>
        )}
        <p className="mt-6 text-xs text-slate-500">
          Emitido em {quote.createdAt.toLocaleDateString("pt-BR")} · válido até{" "}
          {quote.validUntil.toLocaleDateString("pt-BR")}
        </p>
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </article>
  );
}
