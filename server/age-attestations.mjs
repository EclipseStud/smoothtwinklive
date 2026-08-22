const READ_SQL = `SELECT 1 AS allowed
FROM age_attestations
WHERE clerk_user_id = ? AND policy_version = ?
LIMIT 1`;

const WRITE_SQL = `INSERT INTO age_attestations (clerk_user_id, attested_at, policy_version)
VALUES (?, ?, ?)
ON CONFLICT(clerk_user_id) DO UPDATE SET
  attested_at = excluded.attested_at,
  policy_version = excluded.policy_version`;

export async function hasCurrentAttestation(db, userId, policyVersion) {
  const row = await db.prepare(READ_SQL).bind(userId, policyVersion).first();
  return Boolean(row?.allowed);
}

export async function recordAttestation(db, userId, policyVersion, now = new Date()) {
  await db.prepare(WRITE_SQL).bind(userId, now.toISOString(), policyVersion).run();
}
