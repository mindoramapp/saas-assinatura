import { db } from "@/lib/db";

type Email = { to: string; subject: string; html: string };

/**
 * Com RESEND_API_KEY, envia pela API do Resend. Sem a chave (dev, testes, demo),
 * guarda na caixa de saída, visível em /dev/emails.
 */
export async function sendEmail(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await db.outboxEmail.create({ data: email });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Orçaí <nao-responda@orcai.dev>",
      ...email,
    }),
  });
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}`);
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
