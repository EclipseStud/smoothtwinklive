export function parseAuthorizedParties(value = '') {
  return value.split(',').map((party) => party.trim()).filter(Boolean);
}

export async function authenticateClerkRequest(request, env, createClient) {
  if (!env?.CLERK_PUBLISHABLE_KEY || !env?.CLERK_SECRET_KEY || !env?.CLERK_AUTHORIZED_PARTIES) {
    return { ok: false, status: 503 };
  }
  try {
    const factory = createClient || (await import('@clerk/backend')).createClerkClient;
    const state = await factory({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    }).authenticateRequest(request, {
      acceptsToken: 'session_token',
      authorizedParties: parseAuthorizedParties(env.CLERK_AUTHORIZED_PARTIES),
    });
    if (!state.isAuthenticated) return { ok: false, status: 401 };
    const { userId } = state.toAuth();
    return userId ? { ok: true, userId } : { ok: false, status: 401 };
  } catch {
    return { ok: false, status: 503 };
  }
}
