// Update this one value when the StripChat user ID changes.
export const STRIPCHAT_USER_ID = 'SmoothTwinkVibes';

export function getStripchatUrl(userId = STRIPCHAT_USER_ID) {
  return `https://stripchat.com/${encodeURIComponent(userId)}/follow-me`;
}

export const liveSources = ['x', 'reddit', 'bluesky', 'ad', 'direct'];
