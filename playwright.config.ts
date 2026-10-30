import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const url = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: url, trace: "retain-on-failure" },
  // Local: usa o Google Chrome do sistema (sem baixar navegador). CI: Chromium do Playwright.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    // Banco E2E descartável, recriado a cada execução.
    command: `rm -f e2e.db && npx prisma db push && npm run build && npx next start -p ${port}`,
    url,
    reuseExistingServer: false,
    timeout: 420_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      BETTER_AUTH_URL: url,
      APP_URL: url,
      BILLING_MODE: "fake",
      RESEND_API_KEY: "",
      AUTH_RATE_LIMIT: "off",
      PLATFORM_ADMIN_EMAILS: "admin@orcai.dev",
    },
  },
});
