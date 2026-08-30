import "reflect-metadata";
import { config as loadEnvFile } from "dotenv";
import { loadConfig } from "./core/config.js";

loadEnvFile({ path: ".env.local" });
import { container } from "tsyringe";
import { setupDIContainer } from "./core/di-container.js";
import { createApp } from "./app.js";
import { startFeedsScheduler } from "./modules/feeds/feeds.scheduler.js";
import { EmbeddingsService } from "./modules/embeddings/embeddings.service.js";

async function bootstrap() {
  const config = loadConfig();
  setupDIContainer(config);

  const app = await createApp(config);

  // Warmed here rather than lazily on first request, to avoid a cold-start
  // latency spike hitting whichever request happens to be first.
  await container.resolve(EmbeddingsService).initialize();
  app.log.info("Embedding model warmed");

  await app.listen({ port: config.PORT, host: "0.0.0.0" });

  const scheduler = startFeedsScheduler(config, app.log);

  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    scheduler.cancel();
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
