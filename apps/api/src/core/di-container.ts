import { container } from "tsyringe";
import type { AppConfig } from "./config.js";
import { APP_CONFIG } from "./types.js";

export function setupDIContainer(config: AppConfig) {
  container.register<AppConfig>(APP_CONFIG, { useValue: config });
  return container;
}
