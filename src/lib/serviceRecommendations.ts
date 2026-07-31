import type { AuditResult, CategoryId, CheckResult } from './types';

export interface ServiceRecommendation {
  id: string;
  title: string;
  reason: string;
}

function findCheck(checks: CheckResult[], id: string): CheckResult | undefined {
  return checks.find((c) => c.id === id);
}

function categoryScore(audit: AuditResult, id: CategoryId): number {
  return audit.categories.find((c) => c.id === id)?.score ?? 100;
}

/**
 * A small, evidence-based rules engine — every trigger reads a real check result or category
 * score already computed by the audit. Nothing here is invented; a service is only suggested
 * because something specific was actually detected as missing or weak.
 */
export function buildServiceRecommendations(audit: AuditResult): ServiceRecommendation[] {
  const allChecks = audit.categories.flatMap((c) => c.checks);
  const candidates: ServiceRecommendation[] = [];

  const lowCategories = audit.categories.filter((c) => c.score < 50).length;
  if (lowCategories >= 3) {
    return [
      {
        id: 'complete-growth-upgrade',
        title: 'Complete Growth Upgrade',
        reason: `${lowCategories} areas of your site scored below 50/100 — a coordinated rebuild across SEO, performance and conversion would likely move the needle more than fixing issues one at a time.`,
      },
    ];
  }

  const booking = findCheck(allChecks, 'conv.bookingLink');
  if (booking && !booking.passed) {
    candidates.push({
      id: 'custom-booking-system',
      title: 'Custom Booking System',
      reason: 'No online booking or scheduling tool was detected — customers currently have to call to book, which loses enquiries outside business hours.',
    });
  }

  const contactForm = findCheck(allChecks, 'conv.contactForm');
  const primaryCta = findCheck(allChecks, 'conv.primaryCta');
  if ((contactForm && !contactForm.passed) || (primaryCta && !primaryCta.passed)) {
    candidates.push({
      id: 'lead-generation-system',
      title: 'Lead Generation System',
      reason:
        contactForm && !contactForm.passed
          ? 'No contact or enquiry form was found on the homepage — visitors have no easy way to get in touch.'
          : 'No clear call-to-action was found — visitors aren\'t being guided toward enquiring.',
    });
  }

  if (categoryScore(audit, 'seo') < 60 || categoryScore(audit, 'localSeo') < 60) {
    candidates.push({
      id: 'seo-website-growth',
      title: 'SEO & Website Growth',
      reason: `SEO/Local SEO scored ${Math.min(categoryScore(audit, 'seo'), categoryScore(audit, 'localSeo'))}/100 — there's real room to be found by more of the right searches.`,
    });
  }

  const weakDesign = ['performance', 'accessibility', 'mobile'].filter((id) => categoryScore(audit, id as CategoryId) < 60);
  if (weakDesign.length > 0) {
    candidates.push({
      id: 'website-redesign',
      title: 'Website Redesign',
      reason: `${weakDesign.map((id) => id[0].toUpperCase() + id.slice(1)).join(', ')} scored below 60/100 — a rebuild would fix these at the root rather than patching individual issues.`,
    });
  }

  const serviceContentCheck = findCheck(allChecks, 'conv.serviceDescriptions');
  if (serviceContentCheck?.passed && categoryScore(audit, 'conversion') < 70) {
    candidates.push({
      id: 'custom-web-app',
      title: 'Custom Web App',
      reason: 'Your site has substantial service content but conversion signals are still weak — a tailored dashboard, quoting tool or customer portal could do more than a standard website can.',
    });
  }

  return candidates.slice(0, 3);
}
