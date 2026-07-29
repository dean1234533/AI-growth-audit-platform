import type { CollectionEntry } from 'astro:content';

const WORDS_PER_MINUTE = 200;

export function getReadingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function getRelatedPosts(
  current: CollectionEntry<'blog'>,
  all: CollectionEntry<'blog'>[],
  limit = 3,
): CollectionEntry<'blog'>[] {
  const others = all.filter((p) => p.id !== current.id);

  const sameCategory = others.filter((p) => p.data.category === current.data.category);
  const sharedTag = others.filter(
    (p) => p.data.category !== current.data.category && p.data.tags.some((t) => current.data.tags.includes(t)),
  );
  const rest = others.filter((p) => !sameCategory.includes(p) && !sharedTag.includes(p));

  return [...sameCategory, ...sharedTag, ...rest].slice(0, limit);
}

export function sortByDateDesc(posts: CollectionEntry<'blog'>[]): CollectionEntry<'blog'>[] {
  return [...posts].sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}
