import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Testes de integração usam um SQLite próprio, recriado a cada execução.
    globalSetup: ["./src/test/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      STRIPE_SECRET_KEY: "sk_test_fake",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      STRIPE_PRICE_PRO: "price_pro_mensal",
      STRIPE_PRICE_BUSINESS: "price_business_mensal",
      BETTER_AUTH_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    // Um arquivo por vez: todos compartilham o mesmo banco de teste.
    fileParallelism: false,
  },
});
