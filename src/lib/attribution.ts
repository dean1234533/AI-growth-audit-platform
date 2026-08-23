export const OUTREACH_CHANNELS = ['email', 'whatsapp', 'instagram', 'facebook', 'linkedin'] as const;

export interface AttributionContext {
  version: 1;
  website?: string;
  channel?: (typeof OUTREACH_CHANNELS)[number];
  leadId?: string;
  leadCollection?: string;
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function decodeAttribution(search: string): AttributionContext | null {
  const referral = new URLSearchParams(search).get('r');
  if (!referral || referral.length > 2_000) return null;
  try {
    const raw = JSON.parse(decodeBase64Url(referral)) as Record<string, unknown>;
    if (raw.v !== 1) return null;
    const channel = OUTREACH_CHANNELS.includes(raw.channel as (typeof OUTREACH_CHANNELS)[number])
      ? (raw.channel as AttributionContext['channel'])
      : undefined;
    const website = cleanString(raw.site, 500);
    const leadId = cleanString(raw.leadId, 200);
    const leadCollection = cleanString(raw.leadCollection, 100);
    if (!website && !leadId) return null;
    return { version: 1, website, channel, leadId, leadCollection };
  } catch {
    return null;
  }
}

