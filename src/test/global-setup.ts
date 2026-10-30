import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Banco descartável dos testes: apaga o arquivo e recria o schema do zero.
export default function setup() {
  for (const file of ["test.db", "test.db-journal"])
    rmSync(file, { force: true });
  execSync("npx prisma db push", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
