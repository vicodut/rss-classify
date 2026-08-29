export class ArticleNotFoundError {
  readonly _tag = "ArticleNotFoundError";
}

export class ProfileNotFoundError {
  readonly _tag = "ProfileNotFoundError";
}

export class ArticleDbError {
  readonly _tag = "ArticleDbError";
  constructor(readonly message: string) {}
}
