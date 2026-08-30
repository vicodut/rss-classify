import { inject, injectable } from "tsyringe";
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { APP_CONFIG } from "../../core/types.js";
import type { AppConfig } from "../../core/config.js";

const MAX_CONTENT_WORDS = 200;

/**
 * Strips HTML and truncates to title + ~200 words of content — RSS `content`
 * is stored raw from rss-parser and would otherwise pollute the embedding
 * with markup/boilerplate; explicit truncation is used rather than relying
 * on the model's implicit ~256-token limit, since blind vs. deliberate
 * lead-truncation select very different representative text.
 */
export function prepareTextForEmbedding(title: string, content: string | null): string {
  const stripped = (content ?? "").replace(/<[^>]+>/g, " ");
  const words = stripped.trim().split(/\s+/).filter(Boolean).slice(0, MAX_CONTENT_WORDS);
  return [title, ...words].join(" ").trim();
}

/**
 * Wraps the transformers.js feature-extraction pipeline. No HTTP routes —
 * this is an internal implementation detail of the tagging/scoring pipeline,
 * not exposed via the contract. The embedding model itself is shared, fixed,
 * pretrained infrastructure (see specs/ML_CLASSIFICATION_SPEC.md's
 * "Personalization boundary") — it is never fine-tuned on this app's data.
 */
@injectable()
export class EmbeddingsService {
  private extractor: FeatureExtractionPipeline | null = null;
  private loading: Promise<FeatureExtractionPipeline> | null = null;

  constructor(@inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Called once at server startup, before app.listen(), to avoid a cold-start latency spike on the first request. */
  async initialize(): Promise<void> {
    await this.getExtractor();
  }

  /** Batched: one model call for all texts, not one call per text. */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist() as number[][];
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.extractor) return Promise.resolve(this.extractor);
    if (!this.loading) {
      this.loading = pipeline("feature-extraction", this.config.EMBEDDING_MODEL).then((extractor) => {
        this.extractor = extractor;
        return extractor;
      });
    }
    return this.loading;
  }
}
