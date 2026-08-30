import { container } from "tsyringe";
import type { AppConfig } from "./config.js";
import { APP_CONFIG } from "./types.js";
import { ScoringService } from "../modules/scoring/scoring.service.js";
import { ClassificationService } from "../modules/scoring/classification.service.js";
import { ArticlesService } from "../modules/articles/articles.service.js";
import { FeedsService } from "../modules/feeds/feeds.service.js";
import { ProfileService } from "../modules/profile/profile.service.js";
import { StatsService } from "../modules/stats/stats.service.js";
import { EmbeddingsService } from "../modules/embeddings/embeddings.service.js";

export function setupDIContainer(config: AppConfig) {
  container.register<AppConfig>(APP_CONFIG, { useValue: config });

  container.registerSingleton(ScoringService);
  container.registerSingleton(ClassificationService);
  container.registerSingleton(EmbeddingsService);
  container.registerSingleton(ArticlesService);
  container.registerSingleton(FeedsService);
  container.registerSingleton(ProfileService);
  container.registerSingleton(StatsService);

  return container;
}
