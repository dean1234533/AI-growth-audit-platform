import { ArrowRight, Check } from 'lucide-react';
import { PLANS } from '../../lib/plans';

const FREE = PLANS.find((plan) => plan.id === 'free')!;
const PRO = PLANS.find((plan) => plan.id === 'pro')!;

export function HomepagePricing() {
  return (
    <section className="editorial-pricing">
      <div className="editorial-pricing-head">
        <div>
          <span className="editorial-index">03 / Pricing</span>
          <h2>Start with the audit.<br />Pay when you need more.</h2>
        </div>
        <p>Run as many one-off audits as you need. An account only becomes useful when you want to save history, receive alerts or manage more websites.</p>
      </div>

      <div className="pricing-comparison">
        <Plan
          name={FREE.name}
          price={FREE.price}
          description="For auditing and monitoring one website."
          features={['Unlimited one-off audits', ...FREE.features.slice(0, 4)]}
          href="/login?mode=signup"
          action="Create free account"
        />
        <Plan
          name={PRO.name}
          price={PRO.price}
          description={`For monitoring up to ${PRO.websiteLimit} websites with more frequent insight.`}
          features={PRO.features.slice(0, 6)}
          href="/pricing"
          action="View Pro plan"
          featured
        />
      </div>
    </section>
  );
}

function Plan({
  name,
  price,
  description,
  features,
  href,
  action,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  href: string;
  action: string;
  featured?: boolean;
}) {
  return (
    <article className={featured ? 'featured' : ''}>
      <div className="plan-topline">
        <span>{name}</span>
        {featured && <small>For active monitoring</small>}
      </div>
      <strong>{price}</strong>
      <p>{description}</p>
      <ul>
        {features.map((feature) => <li key={feature}><Check className="size-4" /> {feature}</li>)}
      </ul>
      <a href={href}>{action} <ArrowRight className="size-4" /></a>
    </article>
  );
}
