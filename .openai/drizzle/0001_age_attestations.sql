CREATE TABLE IF NOT EXISTS age_attestations (
  clerk_user_id TEXT PRIMARY KEY NOT NULL,
  attested_at TEXT NOT NULL,
  policy_version TEXT NOT NULL
);
