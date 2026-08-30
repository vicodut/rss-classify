# RSS Aggregator with Smart Scoring - Project Specs

## 📋 Résumé du projet

Une application RSS intelligente qui :
- ✅ Agrège les flux RSS
- ✅ Auto-score les articles selon vos préférences
- ✅ Auto-tag les articles
- ✅ Apprend de vos notes pour améliorer les scores
- ✅ Full-stack type-safe avec OpenAPI

**Stack:**
- Backend: Node.js + **Fastify** + Modulaire + Effect (TypeScript)
- Frontend: React + TanStack Query
- Database: Supabase (PostgreSQL)
- API: @ts-rest/core (OpenAPI-first)
- DI Container: tsyringe (lightweight IoC)
- Scheduler: Fastify plugins + node-schedule

---

## 🎯 Endpoints API (via `rss-aggregator-contract.ts`)

### Health
- `GET /health` → Status du service

### Articles
- `GET /articles` → List articles avec filtres (tag, score, source)
- `GET /articles/:id` → Get article détail
- `POST /articles/:id/rate` → Rate article (1-5) + tags
- `DELETE /articles/:id/rating` → Remove rating
- `DELETE /articles/:id` → Delete article
- `GET /articles/search` → Search full-text

### Feeds
- `GET /feeds` → List user's feeds
- `GET /feeds/:id` → Get feed details
- `POST /feeds` → Create new feed
- `DELETE /feeds/:id` → Delete feed
- `POST /feeds/refresh` → Fetch all feeds (ou specific)

### User Profile
- `GET /profile` → User's tag/keyword weights
- `PATCH /profile` → Update preferences
- `POST /profile/reset` → Reset all data

### Stats
- `GET /stats/summary` → Overview (total articles, avg score, etc)
- `GET /stats/trending` → Trending tags over time

---

## 📁 Project Structure (Fastify Modulaire)

```
rss-aggregator/
├── src/
│   ├── main.ts                     # ← Bootstrap entry point
│   ├── app.ts                      # Fastify instance creation
│   ├── contract.ts                 # @ts-rest OpenAPI contract
│   │
│   ├── core/
│   │   ├── di-container.ts        # tsyringe DI setup
│   │   ├── decorators.ts          # Custom decorators
│   │   ├── types.ts               # Shared types
│   │   └── config.ts              # Config service
│   │
│   ├── modules/
│   │   ├── articles/
│   │   │   ├── articles.module.ts      # Module registration
│   │   │   ├── articles.controller.ts  # Route handlers
│   │   │   ├── articles.service.ts     # Business logic (Effect)
│   │   │   └── dto/
│   │   │       ├── rate-article.dto.ts
│   │   │       └── list-articles.dto.ts
│   │   │
│   │   ├── feeds/
│   │   │   ├── feeds.module.ts
│   │   │   ├── feeds.controller.ts
│   │   │   ├── feeds.service.ts
│   │   │   ├── feeds.scheduler.ts  # Cron jobs avec node-schedule
│   │   │   └── feed-parser.ts
│   │   │
│   │   ├── scoring/
│   │   │   ├── scoring.module.ts
│   │   │   ├── scoring.service.ts  # Core scoring engine (Effect)
│   │   │   └── tagging.service.ts  # Auto-tagging logic
│   │   │
│   │   ├── profile/
│   │   │   ├── profile.module.ts
│   │   │   ├── profile.controller.ts
│   │   │   └── profile.service.ts
│   │   │
│   │   ├── stats/
│   │   │   ├── stats.module.ts
│   │   │   ├── stats.controller.ts
│   │   │   └── stats.service.ts
│   │   │
│   │   ├── health/
│   │   │   ├── health.module.ts
│   │   │   └── health.controller.ts
│   │   │
│   │   └── database/
│   │       ├── database.module.ts
│   │       └── supabase.service.ts  # DB wrapper (injectable)
│   │
│   ├── common/
│   │   ├── filters/
│   │   │   └── error.filter.ts     # Global error handler
│   │   ├── guards/
│   │   │   └── auth.guard.ts       # Auth verification
│   │   └── interceptors/
│   │       └── logging.interceptor.ts  # Request/response logging
│   │
│   └── utils/
│       └── effect-runtime.ts       # Effect.runPromise wrapper
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ArticleList.tsx
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── RatingDialog.tsx
│   │   │   ├── FeedManager.tsx
│   │   │   ├── TagFilters.tsx
│   │   │   ├── StatsView.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── hooks/
│   │   │   ├── useArticles.ts
│   │   │   ├── useFeeds.ts
│   │   │   ├── useProfile.ts
│   │   │   └── useStats.ts
│   │   ├── client.ts
│   │   └── index.css
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

**Architecture: Modulaire + DI Container**
- Chaque module = module.ts + controller + service
- Services injectés via tsyringe (@injectable + @inject)
- Services métier utilisent Effect pour logique complexe
- Fastify plugins pour composabilité
- Facile à migrer vers NestJS si besoin

---

## 🚀 Getting Started

### 1. Backend Setup (Fastify Modulaire)

```bash
# Fastify + plugins
npm install fastify @fastify/helmet @fastify/cors

# DI Container + Effect
npm install tsyringe reflect-metadata effect

# @ts-rest (OpenAPI contract)
npm install @ts-rest/core

# Database + Validation
npm install @supabase/supabase-js zod

# RSS Parsing + Scheduling
npm install node-fetch feedparser cheerio node-schedule

# Dev tools
npm install -D typescript @types/node @types/fastify tsx vitest
```

### 2. Frontend Setup

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install @ts-rest/react-query
npm install axios
```

### 3. Database (Supabase)

```sql
-- Run in Supabase SQL Editor

CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
  predicted_score FLOAT CHECK (predicted_score >= 0 AND predicted_score <= 5),
  created_at TIMESTAMP DEFAULT now(),
  published_at TIMESTAMP,
  source_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  UNIQUE(user_id, url)
);

CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  last_fetched TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_weights JSONB DEFAULT '{"Tech": 0.5, "Politics": 0.5, "Art": 0.5, "Science": 0.5, "Sports": 0.5, "Business": 0.5, "Health": 0.5, "Entertainment": 0.5, "Education": 0.5}',
  keyword_weights JSONB DEFAULT '{}',
  total_articles_rated INT DEFAULT 0,
  average_rating FLOAT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS Policies
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own articles"
  ON articles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can rate own articles"
  ON articles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users see own feeds"
  ON feeds FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX articles_user_score ON articles(user_id, predicted_score DESC);
CREATE INDEX articles_tags ON articles USING GIN(tags);
CREATE INDEX articles_published ON articles(published_at DESC);
```

---

## 🏗️ Architecture Modulaire avec Fastify

### DI Container (tsyringe)

```typescript
// src/core/di-container.ts
import { container } from "tsyringe"
import { SupabaseService } from "../modules/database/supabase.service"
import { ArticlesService } from "../modules/articles/articles.service"
import { FeedsService } from "../modules/feeds/feeds.service"
import { ScoringService } from "../modules/scoring/scoring.service"

export function setupDIContainer() {
  // Register singletons (une instance partout)
  container.registerSingleton(SupabaseService)
  container.registerSingleton(ScoringService)
  container.registerSingleton(ArticlesService)
  container.registerSingleton(FeedsService)
  return container
}
```

### Module Pattern

Chaque module = `module.ts` qui enregistre les routes:

```typescript
// src/modules/articles/articles.module.ts
import { FastifyInstance } from "fastify"
import { container } from "tsyringe"
import { ArticlesController } from "./articles.controller"
import { ArticlesService } from "./articles.service"

export async function registerArticlesModule(app: FastifyInstance) {
  const controller = container.resolve(ArticlesController)
  
  app.get("/articles", (req, reply) => controller.list(req, reply))
  app.post("/articles/:id/rate", (req, reply) => controller.rate(req, reply))
  app.delete("/articles/:id/rating", (req, reply) => controller.removeRating(req, reply))
}
```

### Services avec @injectable

Services automatiquement injectés via tsyringe:

```typescript
// src/modules/articles/articles.service.ts
import { injectable, inject } from "tsyringe"
import { Effect } from "effect"
import { SupabaseService } from "../database/supabase.service"
import { ScoringService } from "../scoring/scoring.service"

@injectable()
export class ArticlesService {
  constructor(
    @inject(SupabaseService) private db: SupabaseService,
    @inject(ScoringService) private scoring: ScoringService
  ) {}

  rateArticle(id: string, score: number, tags: string[]): Effect.Effect<any, Error> {
    return Effect.gen(function* () {
      yield* this.db.updateArticle(id, { score, tags })
      yield* this.scoring.learnFromRating(id, score, tags)
      return { success: true }
    })
  }
}
```

### Migration Future vers NestJS

La structure est **80% compatible** avec NestJS:

```typescript
// NestJS version (presque identique!)
@Controller("articles")
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService
  ) {}

  @Post(":id/rate")
  async rate(@Param("id") id: string, @Body() body: any) {
    return this.articlesService.rateArticle(id, body.score, body.tags)
  }
}
```

Services + Effect logic = **100% réutilisables**

---

## 🎮 Core Features to Implement

### Phase 1: MVP (Week 1)

#### Backend
- [ ] Express setup + middleware
- [ ] @ts-rest endpoints (basic CRUD)
- [ ] Supabase integration
- [ ] Simple scoring (heuristique tag-based)
- [ ] Feed fetcher (Effect + concurrency)

**Key files:**
- `src/server/index.ts` - Express + @ts-rest
- `src/services/FeedService.ts` - RSS fetching (Effect)
- `src/services/ScoringService.ts` - Tag-based scoring
- `src/routes/articles.ts` - Article endpoints

#### Frontend
- [ ] React + TanStack Query setup
- [ ] Article list view
- [ ] Basic filtering (by tag)
- [ ] Simple rating dialog

**Key files:**
- `frontend/src/hooks/useArticles.ts`
- `frontend/src/components/ArticleList.tsx`
- `frontend/src/components/RatingDialog.tsx`

### Phase 2: Auto-Tagging (Week 2)

#### Backend
- [ ] TaggingService (keyword extraction)
- [ ] Auto-tag on fetch
- [ ] Manual tag override

**Logic:**
```typescript
// Extract keywords from title + content
// Map to predefined tags (Tech, Politics, etc)
// Store with article
```

### Phase 3: Smart Scoring (Week 3)

#### Backend
- [ ] Learn from user ratings
- [ ] Update tag_weights based on feedback
- [ ] Keyword matching in content
- [ ] Score recalculation on every rating

**Logic:**
```typescript
// For each rating:
// 1. Calculate which tags/keywords user liked
// 2. Increase weight for those tags
// 3. Recalculate score for all articles
// 4. Re-rank list
```

#### Frontend
- [ ] Stats dashboard
- [ ] Profile view (tag preferences)
- [ ] Trending tags chart

### Phase 4: Polish (Week 4)

- [ ] Search by title/content
- [ ] Export articles (JSON, CSV)
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Error handling + retry logic

---

## ⚡ Pourquoi Fastify Modulaire?

**Fastify:**
- 3-5x plus rapide qu'Express
- Plugins system = modulaire naturellement
- Lightweight (pas de boilerplate NestJS)
- Perfect pour MVP + open source

**Modulaire (tsyringe + DI):**
- Structure claire et scalable
- Services testables et injectables
- Facile à comprendre pour contributeurs
- **80% compatible NestJS** (migration facile si besoin)

**Effect:**
- Typed errors, concurrency, retries built-in
- Core business logic en Effect
- Reste vrai même si on upgrade vers NestJS

**Résultat:**
- ✅ Rapide à développer (MVP)
- ✅ Performant (haute charge)
- ✅ Maintenable (architecture claire)
- ✅ Évolutif (upgrade path vers NestJS si besoin)

---

## 📝 Key Implementation Notes

### Effect Usage

**Concurrency - Fetch multiple feeds in parallel:**
```typescript
const articles = yield* Effect.forEach(
  feeds,
  (feed) => FeedService.fetchFeed(feed.url),
  { concurrency: 3 }  // Don't overwhelm servers
)
```

**Error Handling - Typed errors:**
```typescript
class FeedFetchError extends Error {
  readonly _tag = "FeedFetchError"
  constructor(readonly feedUrl: string, message: string) {
    super(message)
  }
}

const fetchFeed = (url: string): Effect<Article[], FeedFetchError> => {
  return Effect.gen(function* () {
    const response = yield* Effect.promise(() => 
      fetch(url).catch(e => new FeedFetchError(url, e.message))
    )
    // ... parse
  })
}
```

**Retries - Automatic retry with backoff:**
```typescript
yield* fetchFeed(url).pipe(
  Effect.retry({
    times: 3,
    delay: () => Duration.millis(1000),
    schedule: Schedule.exponential("100 millis")
  })
)
```

### Scoring Algorithm

**Phase 1 - Simple:**
```
score = 0
for each tag in article.tags:
  score += userProfile.tagWeights[tag] * 0.6

for each keyword in article.title + content:
  if keyword in userProfile.keywords:
    score += userProfile.keywordWeights[keyword] * 0.4

return Math.min(Math.max(score, 0), 5)
```

**Phase 2 - Learning:**
```
On user rates article:
  1. For each tag in article:
     if userRating >= 4:  // User liked it
       tagWeights[tag] += 0.05
     if userRating <= 2:  // User didn't like it
       tagWeights[tag] -= 0.05
  
  2. Clamp weights to [0, 1]
  3. Recalculate scores for ALL articles
  4. Update database
```

---

## 🔌 Database Queries

### Get articles for user (sorted by predicted score)
```typescript
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('user_id', userId)
  .gte('predicted_score', minScore)
  .eq('tags', tag)  // or array contains
  .order('predicted_score', { ascending: false })
  .limit(20)
```

### Update article rating + recalculate
```typescript
await supabase
  .from('articles')
  .update({ 
    user_rating: score,
    tags: newTags 
  })
  .eq('id', articleId)
```

### Get user profile
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single()
```

---

## 🧪 Testing

### Unit Tests (Vitest)
```typescript
describe('ScoringService', () => {
  it('should score articles based on tag weights', () => {
    const article = { tags: ['Tech', 'AI'] }
    const profile = { tagWeights: { Tech: 0.9, AI: 0.8 } }
    const score = scoreArticle(article, profile)
    expect(score).toBe(0.85) // Average
  })
})
```

### Integration Tests
- Test with real Supabase instance
- Test Effect concurrency limits
- Test error handling + retries

---

## 📦 Environment Variables

```env
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Backend
NODE_ENV=development
PORT=3000

# Feed fetching
RSS_FETCH_TIMEOUT=10000
RSS_FETCH_CONCURRENCY=3

# Scheduler
REFRESH_INTERVAL_MS=3600000  # 1 hour
```

---

## 🚢 Deployment

### Backend (Vercel / Railway)
```bash
npm run build
npm start
```

### Frontend (Vercel / Netlify)
```bash
npm run build
npm run deploy
```

### Database (Supabase Cloud)
- Managed PostgreSQL
- Automatic backups
- Scalable

---

## 🎓 Learning Resources

- Effect docs: https://effect.website
- @ts-rest docs: https://ts-rest.com
- TanStack Query: https://tanstack.com/query
- Supabase JS: https://supabase.com/docs

---

## ✅ Checklist pour Claude Code

- [ ] Setup express + @ts-rest
- [ ] Implement all endpoints (routes)
- [ ] Connect Supabase
- [ ] Implement ScoringService with Effect
- [ ] Implement FeedService with Effect + concurrency
- [ ] Setup React + TanStack Query frontend
- [ ] Create ArticleList component
- [ ] Create RatingDialog component
- [ ] Create FeedManager component
- [ ] Add error handling + retry logic
- [ ] Add tests
- [ ] Deploy backend
- [ ] Deploy frontend

---

## 🏗️ Architecture Détaillée

**Voir:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) pour:
- 🏛️ Pattern modulaire expliqué
- 🔌 Comment ajouter un nouveau module
- 🧪 Testing strategy
- 📊 Scaling & migration vers NestJS
- ⚠️ Common pitfalls

---

## 📞 Questions?

Si besoin:
1. Check `rss-aggregator-contract.ts` pour l'API complète
2. Check `ARCHITECTURE.md` pour comprendre la structure
3. Check `IMPLEMENTATION_EXAMPLES.md` pour les exemples
4. Check `package.json.template` pour les dépendances

Bonne chance! 🚀
