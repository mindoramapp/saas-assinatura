/** Erro de regra de negócio com mensagem que pode ir direto para a interface. */
export class DomainError extends Error {
  constructor(
    public readonly code:
      "forbidden" | "not_found" | "limit" | "invalid" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

/** Converte DomainError em resultado de action; outros erros sobem. */
export async function toActionResult(
  run: () => Promise<string | void>,
): Promise<ActionResult> {
  try {
    const message = await run();
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: error.message };
    throw error;
  }
}
