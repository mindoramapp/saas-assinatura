import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 7 },
  databaseHooks: {
    // Cada login conta para "usuários ativos" no painel de métricas.
    session: {
      create: {
        after: async (session) => {
          await track("user.signed_in", { userId: session.userId });
        },
      },
    },
  },
  // nextCookies deve ser o último plugin: grava o cookie quando o login roda numa server action.
  plugins: [nextCookies()],
});
