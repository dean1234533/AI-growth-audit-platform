#!/usr/bin/env node
/**
 * Build-time programmatic content generator.
 *
 * Reads the source lists below, calls Cloudflare Workers AI (via the REST API — the
 * `env.AI` binding used elsewhere in this app only exists inside a deployed Worker at
 * request time, not in a local Node script) once per entry, and writes reviewable JSON
 * files into src/content/. Run this manually whenever you want to add more industries,
 * locations or combo pages — it is NOT run automatically at build or deploy time, so
 * generated content is git-versioned and reviewable before it ever ships.
 *
 * Requires two env vars (separate from the deployed app's secrets):
 *   CLOUDFLARE_API_TOKEN   — a token scoped to "Workers AI:Edit"
 *   CLOUDFLARE_ACCOUNT_ID  — your Cloudflare account ID
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run generate-content
 *
 * To scale up later: add more entries to INDUSTRIES / LOCATIONS / COMBOS below (or load
 * them from a bigger external list), rerun, review the diff in src/content/, commit, deploy.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Add more rows here to scale up — this is the entire "programmatic" part of the system.
const INDUSTRIES = ['electricians', 'plumbers', 'painters-and-decorators', 'dentists', 'restaurants'];
const LOCATIONS = [
  { slug: 'london', name: 'London', region: 'Greater London' },
  { slug: 'manchester', name: 'Manchester', region: 'North West England' },
  { slug: 'birmingham', name: 'Birmingham', region: 'West Midlands' },
  { slug: 'leeds', name: 'Leeds', region: 'West Yorkshire' },
  { slug: 'bristol', name: 'Bristol', region: 'South West England' },
];
// Curated combo pairs (not a full cross-join, to keep pages genuinely purposeful)
const COMBOS = [
  { industry: 'painters-and-decorators', location: 'london' },
  { industry: 'electricians', location: 'manchester' },
  { industry: 'plumbers', location: 'birmingham' },
  { industry: 'dentists', location: 'leeds' },
  { industry: 'restaurants', location: 'bristol' },
];

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables.');
  process.exit(1);
}

async function runAi(systemPrompt, userPrompt) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`Workers AI request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.result?.response ?? '';
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object found in AI response: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

const SYSTEM_PROMPT =
  'You are an SEO copywriter for a free AI website audit tool aimed at UK small businesses. ' +
  'Write specific, genuinely useful copy — never generic filler. Respond ONLY with a single JSON object, no markdown, no commentary.';

async function generateIndustry(slug) {
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const prompt = `Write content for a landing page: "AI Website Audit for ${name}". Respond with JSON: {"name": "${name}", "seoTitle": string, "metaDescription": string (under 160 chars), "intro": string (2-3 sentences on why website quality matters specifically for ${name} businesses), "painPoints": string[] (4 items, specific to ${name}), "whyItMatters": string (1 paragraph), "faq": [{"question": string, "answer": string}] (3 items)}`;
  const raw = await runAi(SYSTEM_PROMPT, prompt);
  return extractJson(raw);
}

async function generateLocation({ name, region }) {
  const prompt = `Write content for a landing page: "Website Audit ${name}". Respond with JSON: {"name": "${name}", "region": "${region}", "seoTitle": string, "metaDescription": string (under 160 chars), "intro": string (2-3 sentences on the local business/competitive landscape in ${name}), "painPoints": string[] (4 items relevant to businesses in ${name}), "faq": [{"question": string, "answer": string}] (3 items)}`;
  const raw = await runAi(SYSTEM_PROMPT, prompt);
  return extractJson(raw);
}

async function generateCombo(industrySlug, locationSlug, industries, locations) {
  const industryName = industries[industrySlug]?.name ?? industrySlug;
  const location = locations[locationSlug];
  const prompt = `Write content for a landing page: "Website Audit for ${industryName} in ${location.name}". Respond with JSON: {"industryName": "${industryName}", "locationName": "${location.name}", "seoTitle": string, "metaDescription": string (under 160 chars), "intro": string (2-3 sentences, specific to ${industryName} businesses competing in ${location.name}), "painPoints": string[] (4 items), "faq": [{"question": string, "answer": string}] (3 items)}`;
  const raw = await runAi(SYSTEM_PROMPT, prompt);
  const data = extractJson(raw);
  return { industrySlug, locationSlug, ...data };
}

async function writeJson(dir, slug, data) {
  const target = path.join('src/content', dir);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote src/content/${dir}/${slug}.json`);
}

async function main() {
  const industries = {};
  for (const slug of INDUSTRIES) {
    const data = await generateIndustry(slug);
    industries[slug] = data;
    await writeJson('industries', slug, data);
  }

  const locations = {};
  for (const loc of LOCATIONS) {
    const data = await generateLocation(loc);
    locations[loc.slug] = data;
    await writeJson('locations', loc.slug, data);
  }

  for (const combo of COMBOS) {
    const data = await generateCombo(combo.industry, combo.location, industries, locations);
    await writeJson('combos', `${combo.industry}-${combo.location}`, data);
  }

  console.log('\nDone. Review the diffs in src/content/ before committing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
