"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, toActionResult, type ActionResult } from "@/lib/errors";
import {
  createQuote,
  deleteQuote,
  markQuoteSent,
  parseMoneyToCents,
  setBrandColor,
} from "@/lib/quotes";
import { requireUser } from "@/lib/session";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

type RawItem = { description: string; quantity: string; price: string };

export async function createQuoteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  let quoteId: string;
  try {
    let rawItems: RawItem[];
    try {
      rawItems = JSON.parse(field(form, "items")) as RawItem[];
    } catch {
      throw new DomainError("invalid", "Itens inválidos.");
    }
    const quote = await createQuote(user.id, orgSlug, {
      title: field(form, "title"),
      clientName: field(form, "clientName"),
      clientEmail: field(form, "clientEmail"),
      notes: field(form, "notes"),
      validDays: field(form, "validDays"),
      items: rawItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitCents: parseMoneyToCents(item.price),
      })),
    });
    quoteId = quote.id;
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/app/${orgSlug}`);
  redirect(`/app/${orgSlug}/orcamentos/${quoteId}`);
}

export async function markSentAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  const quoteId = field(form, "quoteId");
  return toActionResult(async () => {
    await markQuoteSent(user.id, orgSlug, quoteId);
    revalidatePath(`/app/${orgSlug}`, "layout");
  });
}

export async function deleteQuoteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  try {
    await deleteQuote(user.id, orgSlug, field(form, "quoteId"));
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/app/${orgSlug}`);
  redirect(`/app/${orgSlug}`);
}

export async function brandColorAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return toActionResult(async () => {
    await setBrandColor(user.id, orgSlug, field(form, "color"));
    revalidatePath(`/app/${orgSlug}`, "layout");
    return "Cor da marca salva. Ela já aparece nos seus orçamentos.";
  });
}
