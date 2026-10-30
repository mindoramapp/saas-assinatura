"use server";

import { redirect } from "next/navigation";
import { DomainError, type ActionResult } from "@/lib/errors";
import { createOrganization } from "@/lib/orgs";
import { requireUser } from "@/lib/session";

export async function createOrgAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  let slug: string;
  try {
    slug = (await createOrganization(user.id, String(form.get("name") ?? "")))
      .slug;
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
  redirect(`/app/${slug}`);
}
