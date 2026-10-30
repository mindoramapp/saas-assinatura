"use server";

import { revalidatePath } from "next/cache";
import { toActionResult, type ActionResult } from "@/lib/errors";
import { acceptPublicQuote } from "@/lib/quotes";

export async function acceptQuoteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const token = String(form.get("token") ?? "");
  return toActionResult(async () => {
    await acceptPublicQuote(token);
    revalidatePath(`/p/${token}`);
  });
}
