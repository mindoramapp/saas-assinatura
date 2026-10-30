import { db } from "@/lib/db";

export const AUDIT_LABELS: Record<string, string> = {
  "org.created": "Criou a organização",
  "org.settings_updated": "Alterou as configurações",
  "member.invited": "Convidou uma pessoa",
  "member.invite_revoked": "Cancelou um convite",
  "member.joined": "Entrou na equipe",
  "member.role_changed": "Mudou o papel de alguém",
  "member.removed": "Removeu alguém da equipe",
  "billing.checkout_started": "Abriu o checkout",
  "billing.plan_change_requested": "Pediu troca de plano",
  "billing.cancel_requested": "Pediu cancelamento",
  "billing.subscription_updated": "Assinatura atualizada (Stripe)",
  "billing.subscription_canceled": "Assinatura cancelada (Stripe)",
  "quote.deleted": "Apagou um orçamento",
  "audit.exported": "Exportou a auditoria",
};

export async function audit(entry: {
  orgId: string;
  actorId: string | null;
  action: keyof typeof AUDIT_LABELS | (string & {});
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target,
      metadata: JSON.stringify(entry.metadata ?? {}),
    },
  });
}
