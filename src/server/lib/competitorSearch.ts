// Automatic competitor discovery via the Brave Web Search API (real search results — Workers
// AI has no internet access and would otherwise have to hallucinate URLs, which we won't do).

// Directory/marketplace/social sites that show up for almost any local-business search but
// aren't themselves a competing business — excluded so "Find Competitors" doesn't suggest
// e.g. Houzz or Facebook as a business to monitor.
const DIRECTORY_BLOCKLIST = [
  'houzz.com',
  'bark.com',
  'trustatrader.com',
  'checkatrade.com',
  'ratedpeople.com',
  'mybuilder.com',
  'yell.com',
  'thomsonlocal.com',
  'hamuch.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'yelp.com',
  'google.com',
  'wikipedia.org',
  'tripadvisor.com',
  'indeed.com',
  'reddit.com',
  'pinterest.com',
  'youtube.com',
  'gumtree.com',
  'amazon.co.uk',
  'amazon.com',
];

export interface CompetitorSuggestion {
  name: string;
  url: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isBlocked(hostname: string): boolean {
  return DIRECTORY_BLOCKLIST.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
}

interface BraveSearchResponse {
  web?: { results?: { title: string; url: string }[] };
}

/** Runs a Brave web search and returns real, deduped, non-directory results — excludes the audited site's own domain. */
export async function findCompetitors(apiKey: string, searchQuery: string, ownHostname: string, limit = 5): Promise<CompetitorSuggestion[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=20`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
  });
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`);

  const json = (await res.json()) as BraveSearchResponse;
  const results = json.web?.results ?? [];

  const seen = new Set<string>([ownHostname]);
  const suggestions: CompetitorSuggestion[] = [];

  for (const result of results) {
    const hostname = hostnameOf(result.url);
    if (!hostname || seen.has(hostname) || isBlocked(hostname)) continue;
    seen.add(hostname);
    suggestions.push({ name: hostname, url: result.url });
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

interface WorkersAiBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }>;
}

/** Extracts a short "business type + location" search query from a page title — grounded in
 * the site's own real title text, not invented. Falls back to the raw title if AI is unavailable. */
export async function buildCompetitorSearchQuery(ai: WorkersAiBinding | undefined, pageTitle: string | null, hostname: string): Promise<string> {
  const fallback = pageTitle?.trim() || hostname;
  if (!ai) return fallback;

  try {
    const result = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content:
            'Extract a short web search query for finding similar/competing businesses, from a website title. ' +
            'Format: "<business type> in <location>" or just "<business type>" if no location is present. ' +
            'Reply with ONLY the query text, nothing else.',
        },
        { role: 'user', content: pageTitle ?? hostname },
      ],
      max_tokens: 30,
    });
    const cleaned = result?.response?.trim().replace(/^["'“”]+|["'“”]+$/g, '');
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}
