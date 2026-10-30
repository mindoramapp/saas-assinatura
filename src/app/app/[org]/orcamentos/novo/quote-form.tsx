"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, buttonClass } from "@/components/ui";
import { parseMoneyToCents } from "@/lib/money";
import { formatBRL } from "@/lib/plans";
import { createQuoteAction } from "../actions";

type Item = {
  id: number;
  description: string;
  quantity: string;
  price: string;
};

let nextId = 1;
const emptyItem = (): Item => ({
  id: nextId++,
  description: "",
  quantity: "1",
  price: "",
});

export function QuoteForm({ orgSlug }: { orgSlug: string }) {
  const [items, setItems] = useState<Item[]>(() => [emptyItem()]);
  const total = items.reduce(
    (sum, i) =>
      sum + (Number(i.quantity) || 0) * (parseMoneyToCents(i.price) || 0),
    0,
  );

  function update(id: number, patch: Partial<Item>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  return (
    <ActionForm action={createQuoteAction} className="space-y-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map(({ description, quantity, price }) => ({
            description,
            quantity,
            price,
          })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            label="Título"
            name="title"
            required
            placeholder="Ex.: Reforma do banheiro"
          />
        </div>
        <Field
          label="Nome do cliente"
          name="clientName"
          required
          placeholder="Ex.: Carla Souza"
        />
        <Field
          label="E-mail do cliente (opcional)"
          name="clientEmail"
          type="email"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Itens
        </legend>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_4.5rem_7rem_auto] items-end gap-2"
            >
              <label className="text-xs text-slate-500">
                {index === 0 && <span className="mb-1 block">Descrição</span>}
                <input
                  aria-label={`Descrição do item ${index + 1}`}
                  value={item.description}
                  onChange={(e) =>
                    update(item.id, { description: e.target.value })
                  }
                  required
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Serviço ou produto"
                />
              </label>
              <label className="text-xs text-slate-500">
                {index === 0 && <span className="mb-1 block">Qtd.</span>}
                <input
                  aria-label={`Quantidade do item ${index + 1}`}
                  value={item.quantity}
                  onChange={(e) =>
                    update(item.id, { quantity: e.target.value })
                  }
                  inputMode="numeric"
                  required
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-500">
                {index === 0 && <span className="mb-1 block">Preço (R$)</span>}
                <input
                  aria-label={`Preço do item ${index + 1}`}
                  value={item.price}
                  onChange={(e) => update(item.id, { price: e.target.value })}
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setItems((list) => list.filter((i) => i.id !== item.id))
                }
                disabled={items.length === 1}
                className={buttonClass("ghost", "px-2")}
                aria-label={`Remover item ${index + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((list) => [...list, emptyItem()])}
          className={buttonClass("secondary", "mt-3")}
        >
          + Adicionar item
        </button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Observações (opcional)
          </span>
          <textarea
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            placeholder="Prazo de entrega, forma de pagamento…"
          />
        </label>
        <Field
          label="Validade (dias)"
          name="validDays"
          type="number"
          min={1}
          max={180}
          defaultValue={15}
          required
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          Total:{" "}
          <strong className="text-xl text-slate-900" data-testid="total">
            {formatBRL(total)}
          </strong>
        </p>
        <SubmitButton>Criar orçamento</SubmitButton>
      </div>
    </ActionForm>
  );
}
