type Personalization = [string, string];

export const HOMEPAGE_PERSONALIZATIONS: Array<Personalization | null> = Array.from(
  { length: 10000 },
  () => null
);
HOMEPAGE_PERSONALIZATIONS[0] = ['William Entriken', 'https://williamentriken.net'];
HOMEPAGE_PERSONALIZATIONS[1] = ['Bad JS', 'javascript:alert(1)'];
HOMEPAGE_PERSONALIZATIONS[2] = ['Silk Road', 'https://silkroad.com'];

export const HOMEPAGE_EXTRA = Array.from({ length: 10000 }, () => null);

export const BLOCKED_SQUARES = [4];
export const BLOCKED_DOMAINS = ['silkroad.com'];

export const SQUARE_IDS = {
  external: 1,
  javascript: 2,
  blockedDomain: 3,
  blockedSquare: 4,
  available: 5,
};

export const HOMEPAGE_PERSONALIZATIONS_JSON = JSON.stringify(HOMEPAGE_PERSONALIZATIONS);
export const HOMEPAGE_EXTRA_JSON = JSON.stringify(HOMEPAGE_EXTRA);
export const BLOCKED_SQUARES_JSON = JSON.stringify({ blocked: BLOCKED_SQUARES });
export const BLOCKED_DOMAINS_JSON = JSON.stringify(BLOCKED_DOMAINS);
