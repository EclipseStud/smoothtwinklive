CREATE TABLE IF NOT EXISTS preview_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  attested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  policy_version TEXT NOT NULL
);
