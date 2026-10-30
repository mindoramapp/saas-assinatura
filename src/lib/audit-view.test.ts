import { describe, expect, it } from "vitest";
import { audit } from "@/lib/audit";
import { listAuditLogs, toCsv } from "@/lib/audit-view";
import { addMember, makeOrg } from "@/test/factories";

describe("auditoria", () => {
  it("mostra quem fez cada ação, com 'Sistema (Stripe)' para webhooks", async () => {
    const org = await makeOrg();
    const { user } = await addMember(org.id, "owner", "Marta");
    await audit({
      orgId: org.id,
      actorId: user.id,
      action: "member.invited",
      target: "x@y.dev",
    });
    await audit({
      orgId: org.id,
      actorId: null,
      action: "billing.subscription_updated",
    });
    const logs = await listAuditLogs(org.id);
    expect(logs.map((l) => l.actor).sort()).toEqual([
      "Marta",
      "Sistema (Stripe)",
    ]);
    expect(logs.find((l) => l.action === "member.invited")?.label).toBe(
      "Convidou uma pessoa",
    );
  });

  it("CSV escapa aspas e neutraliza fórmulas", () => {
    expect(toCsv([['a"b', "=HYPERLINK(1)", "ok"]])).toBe(
      '"a""b","\'=HYPERLINK(1)","ok"',
    );
  });
});
