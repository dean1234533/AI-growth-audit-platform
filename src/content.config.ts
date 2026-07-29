import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      'SEO',
      'Website Design',
      'Local SEO',
      'Google Business Profile',
      'Page Speed',
      'Accessibility',
      'Conversions',
      'Marketing',
      'Small Business',
      'AI',
      'Web Development',
      'Analytics',
      'Content Marketing',
      'UX',
      'Branding',
      'Lead Generation',
      'Case Studies',
    ]),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Dean Da Dev'),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    featuredImage: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const faqContentSchema = z.object({
  question: z.string(),
  answer: z.string(),
  category: z.string(),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/faq' }),
  schema: faqContentSchema,
});

const industryContentSchema = z.object({
  name: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  intro: z.string(),
  painPoints: z.array(z.string()),
  whyItMatters: z.string(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const industries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/industries' }),
  schema: industryContentSchema,
});

const locationContentSchema = z.object({
  name: z.string(),
  region: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  intro: z.string(),
  painPoints: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const locations = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/locations' }),
  schema: locationContentSchema,
});

const toolContentSchema = z.object({
  name: z.string(),
  category: z.enum(['seo', 'performance', 'accessibility', 'trust', 'mobile', 'conversion', 'localSeo']),
  seoTitle: z.string(),
  metaDescription: z.string(),
  intro: z.string(),
  whatWeCheck: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tools' }),
  schema: toolContentSchema,
});

const comboContentSchema = z.object({
  industrySlug: z.string(),
  locationSlug: z.string(),
  industryName: z.string(),
  locationName: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  intro: z.string(),
  painPoints: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const combos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/combos' }),
  schema: comboContentSchema,
});

const compareContentSchema = z.object({
  competitor: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  intro: z.string(),
  competitorStrengths: z.array(z.string()),
  ourStrengths: z.array(z.string()),
  verdict: z.string(),
});

const compare = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/compare' }),
  schema: compareContentSchema,
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Dean Da Dev'),
  }),
});

export const collections = { blog, faq, industries, locations, tools, combos, compare, guides };
