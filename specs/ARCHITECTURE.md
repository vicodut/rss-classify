# Architecture Fastify Modulaire

Ce guide explique l'architecture choisie et pourquoi.

---

## 🎯 Overview

```
Fastify (HTTP Server)
   ↓
Modulaire (plugin pattern)
   ↓
tsyringe (Dependency Injection)
   ↓
Services (@injectable)
   ↓
Effect (Business Logic)
```

**Résultat:** 
- ✅ Rapide (Fastify haute perf)
- ✅ Modulaire (facile à tester, à scaler)
- ✅ Type-safe (tsyringe + TypeScript)
- ✅ Évolutif (peut upgrade vers NestJS)

---

## 🏛️ Concepts Clés

### 1. Modulaire Pattern

Chaque domaine = un module autonome:

```
src/modules/
├── articles/         # Indépendant
│   ├── articles.module.ts
│   ├── articles.controller.ts
│   ├── articles.service.ts
│   └── dto/
├── feeds/            # Indépendant
│   └── ...
├── scoring/          # Indépendant
│   └── ...
└── database/         # Partagé
    └── supabase.service.ts
```

**Chaque module:**
- Enregistre ses routes (dans `module.ts`)
- Fournit un controller (gère les routes)
- Utilise un service (logique métier)

### 2. Dependency Injection (tsyringe)

Services injectés automatiquement:

```typescript
@injectable()
export class ArticlesService {
  constructor(
    @inject(SupabaseService) private db: SupabaseService,
    @inject(ScoringService) private scoring: ScoringService
  ) {}
}
```

**Avantages:**
- Pas de `new ServiceName()` everywhere
- Facile à tester (mock les dépendances)
- Une instance par service (singleton)
- Déclaratif et clair

### 3. Effect pour Business Logic

Services métier utilisent Effect:

```typescript
async rateArticle(id: string, score: number, tags: string[]) {
  const program = Effect.gen(function* () {
    // Update DB
    yield* this.db.updateArticle(id, { score, tags })
    
    // Apprendre du rating
    yield* this.scoring.learnFromRating(id, score, tags)
    
    return { success: true }
  })

  return Runtime.runPromise(program)
}
```

**Avantages:**
- Concurrency typing
- Error handling typed
- Retries/timeouts built-in
- Observability automatique

---

## 🔌 Comment Ajouter un Nouveau Module

### 1. Créer la structure

```
src/modules/comments/
├── comments.module.ts
├── comments.controller.ts
├── comments.service.ts
└── dto/
    └── create-comment.dto.ts
```

### 2. Définir le service

```typescript
// comments.service.ts
import { injectable, inject } from "tsyringe"
import { SupabaseService } from "../database/supabase.service"

@injectable()
export class CommentsService {
  constructor(@inject(SupabaseService) private db: SupabaseService) {}

  async createComment(articleId: string, text: string) {
    return this.db.createComment(articleId, text)
  }
}
```

### 3. Définir le controller

```typescript
// comments.controller.ts
import { injectable, inject } from "tsyringe"
import { FastifyRequest, FastifyReply } from "fastify"
import { CommentsService } from "./comments.service"

@injectable()
export class CommentsController {
  constructor(@inject(CommentsService) private service: CommentsService) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const { articleId } = req.params as any
    const { text } = req.body as any
    const result = await this.service.createComment(articleId, text)
    return reply.send(result)
  }
}
```

### 4. Enregistrer le module

```typescript
// comments.module.ts
import { FastifyInstance } from "fastify"
import { container } from "tsyringe"
import { CommentsController } from "./comments.controller"

export async function registerCommentsModule(app: FastifyInstance) {
  const controller = container.resolve(CommentsController)
  app.post("/articles/:articleId/comments", (req, reply) => controller.create(req, reply))
}
```

### 5. Ajouter au main.ts

```typescript
// src/main.ts
import { registerCommentsModule } from "./modules/comments/comments.module"

async function bootstrap() {
  // ...
  await registerCommentsModule(app)
  // ...
}
```

---

## 🧪 Testing

### Service (Unit Test)

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { CommentsService } from "./comments.service"

// Mock Supabase
class MockSupabaseService {
  async createComment() {
    return { id: "1", text: "test" }
  }
}

describe("CommentsService", () => {
  let service: CommentsService

  beforeEach(() => {
    // Inject mock
    const mockDb = new MockSupabaseService()
    service = new CommentsService(mockDb as any)
  })

  it("should create comment", async () => {
    const result = await service.createComment("article-1", "great!")
    expect(result.id).toBeDefined()
  })
})
```

### API (Integration Test)

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { createApp } from "./app"

describe("Comments API", () => {
  let app: any

  beforeEach(async () => {
    app = await createApp()
  })

  it("should create comment via POST", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/articles/article-1/comments",
      payload: { text: "great!" },
    })

    expect(response.statusCode).toBe(201)
  })
})
```

---

## 📊 Scaling (Quand ça grandit)

### Étape 1: Même structure (Fastify)
Tout fonctionne, aucun changement needed.

### Étape 2: Trop de complexité?
Options:
1. **Rester Fastify** - augmenter la structure
2. **Migrer vers NestJS** - 80% du code peut être réutilisé

### Étape 3: Migration vers NestJS (si besoin)

La migration est triviale car:

```typescript
// Fastify maintenant
@injectable()
export class ArticlesService {
  constructor(@inject(SupabaseService) private db: SupabaseService) {}
  async rateArticle() { /* Effect logic */ }
}

// NestJS demain (copie-colle presque)
@Injectable()
export class ArticlesService {
  constructor(private readonly db: SupabaseService) {}
  async rateArticle() { /* Effect logic */ }
}
```

**Seul change:** les décorateurs (@injectable → @Injectable) et imports.

---

## 🔄 Lifecycle (pour comprendre le flux)

### 1. Bootstrap

```
src/main.ts
  ↓
setupDIContainer()         # Enregistre tous les services
  ↓
createApp()               # Crée instance Fastify
  ↓
registerXyzModule(app)    # Chaque module enregistre ses routes
  ↓
app.listen()              # Server démarre
```

### 2. Request

```
User requête
  ↓
Fastify route handler
  ↓
Controller (inject du service)
  ↓
Service (Effect.gen() pour logique)
  ↓
DB (Supabase queries)
  ↓
Response
```

### 3. Shutdown (graceful)

```typescript
// Dans main.ts
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...')
  await app.close()
  process.exit(0)
})
```

---

## 📦 Dependencies et Pourquoi

| Package | Pourquoi |
|---------|----------|
| **fastify** | HTTP server ultra-rapide |
| **@fastify/helmet** | Security headers |
| **@fastify/cors** | Cross-origin support |
| **@fastify/rate-limit** | Rate limiting |
| **tsyringe** | DI container (léger) |
| **reflect-metadata** | Metadata pour decorators |
| **effect** | Typed effects (concurrency, errors) |
| **@ts-rest/core** | OpenAPI contract |
| **@supabase/supabase-js** | Database client |
| **zod** | Schema validation |
| **node-schedule** | Scheduled tasks |
| **node-fetch** | HTTP requests |
| **feedparser** | RSS parsing |

**Total:** ~20 dependencies (minimal!)

---

## 🚀 Performance Characteristics

### Fastify vs Express

```
Express:    ~10k req/s
Fastify:    ~25k req/s    (2.5x faster)
NestJS:     ~15k req/s    (better error handling)
```

**Notre setup (Fastify + modules):**
- Minimal overhead
- Near-native Fastify performance
- Better structure than raw Express

---

## 🎓 Learning Resources

- Fastify: https://www.fastify.io
- tsyringe: https://github.com/microsoft/tsyringe
- Effect: https://effect.website
- @ts-rest: https://ts-rest.com

---

## ⚠️ Common Pitfalls

### 1. Oublier `import "reflect-metadata"` en premier

```typescript
// ❌ WRONG
import { setupDIContainer } from "./core/di-container"
import "reflect-metadata"

// ✅ CORRECT
import "reflect-metadata"
import { setupDIContainer } from "./core/di-container"
```

### 2. Ne pas enregistrer le service dans DI container

```typescript
// ❌ WRONG
const service = new MyService() // Direct instantiation

// ✅ CORRECT
@injectable()
export class MyService { }
// Automatiquement available via container.resolve()
```

### 3. Oublier @injectable sur chaque classe

```typescript
// ❌ WRONG
export class MyService {
  constructor(@inject(OtherService) private other: OtherService) {}
}

// ✅ CORRECT
@injectable()
export class MyService {
  constructor(@inject(OtherService) private other: OtherService) {}
}
```

### 4. Mélanger sync et async

```typescript
// ❌ WRONG
const result = Runtime.runPromise(program) // Don't await!

// ✅ CORRECT
const result = await Runtime.runPromise(program)
```

---

## ✅ Checklist pour déployer

- [ ] `reflect-metadata` imported first
- [ ] All services marked @injectable
- [ ] All modules registered in main.ts
- [ ] DI container setup before modules
- [ ] Environment variables configured (.env)
- [ ] Database migrations applied
- [ ] Tests passing
- [ ] Error handling in place
- [ ] Logging configured
- [ ] Rate limiting enabled

---

## 🤔 FAQ

**Q: Quand migrer vers NestJS?**  
A: Quand tu as >10 modules ou une équipe >5 devs. Sinon Fastify suffit.

**Q: Comment tester?**  
A: Unit test services, integration test via `app.inject()`.

**Q: Comment ajouter middleware?**  
A: Via `app.register()` ou `app.addHook()` in app.ts.

**Q: Comment gérer auth?**  
A: Via `@fastify/jwt` ou guard custom dans controller.

**Q: Production-ready?**  
A: Oui! Utilise pm2 ou Docker. Voir README.

---

Bonne chance! 🚀
