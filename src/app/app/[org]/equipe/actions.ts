"use server";

import { revalidatePath } from "next/cache";
import { toActionResult, type ActionResult } from "@/lib/errors";
import { appUrl, requireUser } from "@/lib/session";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvitation,
} from "@/lib/team";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

export async function inviteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return toActionResult(async () => {
    const invitation = await inviteMember({
      actorId: user.id,
      orgSlug,
      email: field(form, "email"),
      role: field(form, "role"),
      appUrl: appUrl(),
    });
    revalidatePath(`/app/${orgSlug}/equipe`);
    return `Convite enviado para ${invitation.email}.`;
  });
}

export async function revokeInviteAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return toActionResult(async () => {
    await revokeInvitation(user.id, orgSlug, field(form, "invitationId"));
    revalidatePath(`/app/${orgSlug}/equipe`);
  });
}

export async function changeRoleAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return toActionResult(async () => {
    await changeMemberRole({
      actorId: user.id,
      orgSlug,
      membershipId: field(form, "membershipId"),
      role: field(form, "role"),
    });
    revalidatePath(`/app/${orgSlug}/equipe`);
    return "Papel atualizado.";
  });
}

export async function removeMemberAction(
  _: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const orgSlug = field(form, "orgSlug");
  return toActionResult(async () => {
    await removeMember({
      actorId: user.id,
      orgSlug,
      membershipId: field(form, "membershipId"),
    });
    revalidatePath(`/app/${orgSlug}/equipe`);
  });
}
