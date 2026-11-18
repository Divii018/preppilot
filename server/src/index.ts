import { config } from "./config.js";
import { createApp } from "./app.js";
import { createProvider } from "./ai/index.js";
import { migrate, pool } from "./db/index.js";

async function main() {
  await migrate();
  const ai = createProvider();
  const app = createApp(ai);
  const server = app.listen(config.PORT, () => {
    console.log(`PrepPilot API on http://localhost:${config.PORT} (AI provider: ${ai.name})`);
  });

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
