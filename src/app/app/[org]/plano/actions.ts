"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  changePlan,
  completeFakeCheckout,
  endPeriodNow,
  setCancelAtPeriodEnd,
  startCheckout,
} from "@/lib/billing/billing";
import { DomainError, type ActionResult } from "@/lib/errors";
import { appUrl, requireUser } from "@/lib/session";
import type { BillingNotice } from "./notices";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

/**
 * Roda a operação de cobrança e volta para a página do plano com um aviso na
 * URL: o cartão que disparou a ação pode sumir (vira o plano "Atual"), então a
 * mensagem não pode ficar presa ao formulário.
 */
async function runAndNotify(
  orgSlug: string,
  run: () => Promise<BillingNotice>,
): Promise<ActionResult> {
  let notice: BillingNotice;
  try {
    notice = await run();
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath(`/app/${orgSlug}`, "layout");
  redirect(`/app/${orgSlug}/plano?aviso=${notice}`);
}

export async function checkoutAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  let url: string;
  try {
    url = await startCheckout({
      actorId: user.id,
      orgSlug: field(form, "orgSlug"),
      plan: field(form, "plan"),
      appUrl: appUrl(),
    });
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  redirect(url);
}

export async function payFakeCheckoutAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return runAndNotify(orgSlug, async () => {
    await completeFakeCheckout({
      actorId: user.id,
      orgSlug,
      plan: field(form, "plan"),
    });
    return "assinado";
  });
}

export async function changePlanAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return runAndNotify(orgSlug, async () => {
    const { direction } = await changePlan({
      actorId: user.id,
      orgSlug,
      plan: field(form, "plan"),
    });
    return direction;
  });
}

export async function cancelAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  const cancel = field(form, "cancel") === "1";
  return runAndNotify(orgSlug, async () => {
    await setCancelAtPeriodEnd({ actorId: user.id, orgSlug, cancel });
    return cancel ? "cancelado" : "reativado";
  });
}

export async function endPeriodAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return runAndNotify(orgSlug, async () => {
    await endPeriodNow({ actorId: user.id, orgSlug });
    return "encerrado";
  });
}
