import "reflect-metadata";
import { config as loadEnvFile } from "dotenv";
import { loadConfig } from "./core/config.js";

loadEnvFile({ path: ".env.local" });
import { setupDIContainer } from "./core/di-container.js";
import { createApp } from "./app.js";

async function bootstrap() {
  const config = loadConfig();
  setupDIContainer(config);

  const app = await createApp(config);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });

  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
