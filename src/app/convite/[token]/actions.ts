"use server";

import { redirect } from "next/navigation";
import { DomainError, type ActionResult } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { acceptInvitation } from "@/lib/team";

export async function acceptInviteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  let slug: string;
  try {
    const org = await acceptInvitation({
      token: String(form.get("token") ?? ""),
      userId: user.id,
      userEmail: user.email,
    });
    slug = org.slug;
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  redirect(`/app/${slug}`);
}
