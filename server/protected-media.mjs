export const MEDIA_BY_ID = Object.freeze({
  'creator-1': { key: 'creator/creator-censored-1.jpg', contentType: 'image/jpeg' },
  'creator-2': { key: 'creator/creator-censored-2.jpg', contentType: 'image/jpeg' },
});

const headersFor = (contentType) => ({
  'Content-Type': contentType,
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Vary': 'Cookie',
});

export async function getProtectedMedia(env, mediaId, seedPayloads = {}) {
  const media = MEDIA_BY_ID[mediaId];
  if (!media) return new Response('Not found', { status: 404 });
  try {
    let object = await env.MEDIA.get(media.key);
    if (!object) {
      const seed = seedPayloads[mediaId];
      if (!seed) return new Response('Not found', { status: 404 });
      await env.MEDIA.put(media.key, seed, { httpMetadata: { contentType: media.contentType } });
      object = await env.MEDIA.get(media.key);
    }
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(await object.arrayBuffer(), { headers: headersFor(media.contentType) });
  } catch {
    return new Response('Service unavailable', { status: 503 });
  }
}
