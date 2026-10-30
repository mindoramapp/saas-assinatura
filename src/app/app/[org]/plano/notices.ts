export type BillingNotice =
  | "assinado"
  | "upgrade"
  | "downgrade"
  | "cancelado"
  | "reativado"
  | "encerrado";

export function noticeText(notice: unknown, planName: string): string | null {
  switch (notice) {
    case "assinado":
      return `Pagamento confirmado! Sua empresa agora está no plano ${planName}. 🎉`;
    case "upgrade":
      return `Upgrade feito! Agora você está no ${planName}.`;
    case "downgrade":
      return `Plano alterado para ${planName}.`;
    case "cancelado":
      return "Assinatura cancelada. Você continua com o plano até o fim do período.";
    case "reativado":
      return "Cancelamento desfeito. Sua assinatura segue normalmente.";
    case "encerrado":
      return "Período encerrado: a empresa voltou ao plano Grátis.";
    default:
      return null;
  }
}
