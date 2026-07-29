---
title: "Core Web Vitals Explained (In Plain English)"
description: "What Largest Contentful Paint, Cumulative Layout Shift and Interaction to Next Paint actually measure, why Google cares, and how to improve each one."
category: "Page Speed"
tags: ["core web vitals", "lcp", "cls", "inp", "performance"]
author: "Dean Da Dev"
publishDate: 2026-06-23
featured: false
---

"Core Web Vitals" gets thrown around a lot in SEO advice, often without explaining what it actually measures or why it matters. Here's the plain-English version.

## What are Core Web Vitals?

Core Web Vitals are three specific, measurable aspects of user experience that Google has confirmed as a ranking factor. They're not abstract "performance scores" — each one measures something a real visitor actually experiences.

### Largest Contentful Paint (LCP)

**What it measures**: how long it takes for the largest visible element (usually a hero image or headline) to fully render.

**Why it matters**: this is effectively "how long does it feel like this page took to load" from a visitor's perspective — not when the page technically finished loading everything, but when it felt usable.

**Target**: under 2.5 seconds.

**Common causes of a poor score**: large unoptimised images, slow server response time, render-blocking CSS/JavaScript delaying the main content.

### Cumulative Layout Shift (CLS)

**What it measures**: how much visible content unexpectedly shifts position while the page is loading.

**Why it matters**: you've almost certainly experienced this yourself — you go to tap a button and the page jumps just as you tap, hitting an ad or the wrong link instead. It's genuinely frustrating, and Google measures it directly.

**Target**: under 0.1 (a fairly strict threshold).

**Common causes of a poor score**: images or ads without reserved dimensions, web fonts loading in and changing text size, content injected above existing content after the initial load.

### Interaction to Next Paint (INP)

**What it measures**: how quickly the page visibly responds after a visitor clicks, taps, or types.

**Why it matters**: a page that looks loaded but doesn't respond to input feels broken, even if it technically "finished loading" already.

**Target**: under 200 milliseconds.

**Common causes of a poor score**: heavy JavaScript blocking the main thread, too many third-party scripts (analytics, chat widgets, ad tags) competing for processing time.

## How to check your Core Web Vitals

Google's own [PageSpeed Insights](https://pagespeed.web.dev) tool measures all three directly against your live site. Our [free website speed test](/tools/website-speed-test) uses that same underlying data and translates it into a prioritised, plain-English action list — as part of a broader audit covering SEO, accessibility and conversion too.

## Do Core Web Vitals actually affect rankings?

Yes, confirmed directly by Google as part of their "page experience" ranking signals — though it's one of many factors, not an overriding one. A page with excellent content and poor Core Web Vitals can still rank, but all else being equal, better Core Web Vitals give you an edge, and the user experience benefit (fewer visitors bouncing from a janky page) matters regardless of the direct ranking impact.

**Want to see your actual scores?** [Run a free website audit](/) and get real Core Web Vitals data in under 30 seconds.
