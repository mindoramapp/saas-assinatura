import { describe, expect, it } from "vitest";
import { can, canAssignRole } from "./rbac";

describe("can", () => {
  it("leitor só lê orçamentos", () => {
    expect(can("viewer", "quote:read")).toBe(true);
    expect(can("viewer", "quote:write")).toBe(false);
    expect(can("viewer", "member:invite")).toBe(false);
  });

  it("membro cria orçamentos, mas não convida nem vê a auditoria", () => {
    expect(can("member", "quote:write")).toBe(true);
    expect(can("member", "member:invite")).toBe(false);
    expect(can("member", "audit:read")).toBe(false);
  });

  it("admin gerencia a equipe, mas não a cobrança", () => {
    expect(can("admin", "member:invite")).toBe(true);
    expect(can("admin", "audit:read")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(false);
  });

  it("dono pode tudo", () => {
    expect(can("owner", "billing:manage")).toBe(true);
    expect(can("owner", "quote:read")).toBe(true);
  });

  it("papel desconhecido não pode nada", () => {
    expect(can("superuser", "quote:read")).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("admin não promove a dono nem mexe em dono", () => {
    expect(canAssignRole("admin", "member", "owner")).toBe(false);
    expect(canAssignRole("admin", "owner", "member")).toBe(false);
  });

  it("admin promove membro a admin e rebaixa a leitor", () => {
    expect(canAssignRole("admin", "member", "admin")).toBe(true);
    expect(canAssignRole("admin", "member", "viewer")).toBe(true);
  });

  it("membro não altera papéis", () => {
    expect(canAssignRole("member", "viewer", "member")).toBe(false);
  });

  it("dono pode transferir a posse", () => {
    expect(canAssignRole("owner", "admin", "owner")).toBe(true);
  });
});
