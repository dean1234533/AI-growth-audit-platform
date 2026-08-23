import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AuditIntakeContext } from '../../lib/api';

interface HeroProps {
  onAnalyse: (url: string, context?: AuditIntakeContext) => void;
  loading: boolean;
  errorMessage: string | null;
  compact?: boolean;
  initialUrl?: string;
}

const SCORE_ROWS = [
  { name: 'Search visibility', score: 82, status: 'Strong', detail: 'Titles, indexing and content signals' },
  { name: 'Performance', score: 61, status: '4 actions', detail: 'Mobile speed and Core Web Vitals' },
  { name: 'Conversion', score: 54, status: 'Priority', detail: 'Calls to action and enquiry journey' },
];

const SAMPLE_ACTIONS = [
  { number: '01', title: 'Make the enquiry journey obvious', category: 'Conversion', impact: 'High impact', effort: 'Low effort', outcome: 'More visitors reach the contact step' },
  { number: '02', title: 'Reduce mobile loading time', category: 'Performance', impact: 'High impact', effort: 'Medium effort', outcome: 'Fewer people leave before the page opens' },
  { number: '03', title: 'Strengthen local search signals', category: 'Local SEO', impact: 'Medium impact', effort: 'Low effort', outcome: 'Improve visibility for nearby searches' },
];

export function Hero({ onAnalyse, loading, errorMessage, compact = false, initialUrl = '' }: HeroProps) {
  const [url, setUrl] = useState(initialUrl);
  const [showDetails, setShowDetails] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;
    onAnalyse(url.trim(), {
      businessName: businessName.trim(),
      businessType: businessType.trim(),
      location: location.trim(),
    });
  }

  const form = (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="editorial-audit-form">
        <label htmlFor={compact ? 'audit-url-compact' : 'audit-url'}>Enter your website</label>
        <div className="editorial-audit-control">
          <span>https://</span>
          <input
            id={compact ? 'audit-url-compact' : 'audit-url'}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbusiness.co.uk"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>{loading ? 'Analysing…' : 'Audit my website'}</button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-medium text-[#667085]">
        <span>Free to run · no account · results in about 30 seconds</span>
        {!compact && <a href="/login" className="font-semibold text-[#101828] hover:text-brand-600">Already monitoring a site? Log in</a>}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((value) => !value)}
        aria-expanded={showDetails}
        aria-controls="optional-business-details"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#101828]"
      >
        Add business details for a more relevant audit
        <ChevronDown className={`size-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {showDetails && (
        <div id="optional-business-details" className="editorial-context">
          <input type="text" placeholder="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          <input type="text" placeholder="Business type" value={businessType} onChange={(event) => setBusinessType(event.target.value)} />
          <input type="text" placeholder="Town or city" value={location} onChange={(event) => setLocation(event.target.value)} />
        </div>
      )}

      {errorMessage && <p className="mt-3 text-sm font-semibold text-rose-600">{errorMessage}</p>}
    </div>
  );

  if (compact) return <div className="mx-auto max-w-4xl">{form}</div>;

  return (
    <section id="top" className="editorial-hero">
      <div className="hero-blueprint" aria-hidden="true">
        <svg viewBox="0 0 720 500" role="presentation">
          <g className="hero-blueprint-grid">
            <path d="M80 42V458M160 42V458M240 42V458M320 42V458M400 42V458M480 42V458M560 42V458M640 42V458" />
            <path d="M40 90H680M40 170H680M40 250H680M40 330H680M40 410H680" />
          </g>
          <circle className="hero-blueprint-orbit" cx="480" cy="214" r="154" />
          <circle className="hero-blueprint-orbit hero-blueprint-orbit-inner" cx="480" cy="214" r="104" />
          <path className="hero-blueprint-path" d="M82 386C164 340 202 365 266 302S390 263 438 194 548 114 646 78" />
          <path className="hero-blueprint-area" d="M82 386C164 340 202 365 266 302S390 263 438 194 548 114 646 78V438H82Z" />
          <g className="hero-blueprint-points">
            <circle cx="82" cy="386" r="7" />
            <circle cx="266" cy="302" r="7" />
            <circle cx="438" cy="194" r="7" />
            <circle cx="646" cy="78" r="7" />
          </g>
          <g className="hero-blueprint-marks">
            <path d="M48 42H112M80 18V66" />
            <path d="M608 438H672M640 414V462" />
          </g>
        </svg>
        <span className="hero-blueprint-label hero-blueprint-label-a">VISIBILITY / 82</span>
        <span className="hero-blueprint-label hero-blueprint-label-b">GROWTH SIGNAL</span>
      </div>
      <div className="editorial-hero-copy">
        <div>
          <span className="editorial-index">01 / Website growth audit</span>
          <h1>
            Your website should <span className="hero-word-blue">bring you work.</span>{' '}
            Find out <span className="hero-word-mint">why it isn’t.</span>
          </h1>
        </div>
        <div className="editorial-intro">
          <p>See where your website loses visibility, trust and enquiries—then get a clear order for improving it.</p>
          <dl>
            <div><dt>Checks</dt><dd>SEO, speed, accessibility, conversion and local search</dd></div>
            <div><dt>Output</dt><dd>A scored report with prioritised actions</dd></div>
          </dl>
        </div>
      </div>

      <div className="editorial-form-wrap">{form}</div>

      <div className="result-stage">
        <div className="result-float result-float-quality"><span>Scan quality</span><strong>Full browser audit</strong></div>
        <div className="result-float result-float-growth"><span>Estimated upside</span><strong>+2–5 enquiries</strong><small>per month</small></div>
        <div className="result-preview" aria-label="Example Growth Audit result">
        <div className="result-score">
          <div className="result-score-head">
            <span>Example result</span>
            <small>northstar-plumbing.co.uk</small>
          </div>
          <div className="result-score-value">
            <strong>68</strong>
            <div><span>Website health</span><b>Needs attention</b></div>
          </div>
          <dl className="result-score-stats">
            <div><dt>Checks run</dt><dd>37</dd></div>
            <div><dt>Passed</dt><dd>26</dd></div>
            <div><dt>Priorities</dt><dd>3</dd></div>
          </dl>
          <small className="result-score-time">Full scan · completed in 28 seconds</small>
        </div>
        <div className="result-breakdown">
          <div className="result-section-head">
            <span className="result-label">Category breakdown</span>
            <small>3 of 7 shown</small>
          </div>
          {SCORE_ROWS.map((row) => (
            <div className="result-row" key={row.name}>
              <div><span>{row.name}</span><em>{row.status}</em><strong>{row.score}</strong></div>
              <div className="result-track"><i style={{ width: `${row.score}%` }} /></div>
              <small>{row.detail}</small>
            </div>
          ))}
          <div className="result-benchmark"><span>Portfolio benchmark</span><strong>+6</strong><small>points above similar local-business sites</small></div>
        </div>
        <div className="result-actions">
          <div className="result-section-head">
            <span className="result-label">First actions</span>
            <small>Ranked by likely value</small>
          </div>
          <ol>
            {SAMPLE_ACTIONS.map((action) => (
              <li key={action.number}>
                <b>{action.number}</b>
                <div>
                  <small>{action.category}</small>
                  <strong>{action.title}</strong>
                  <p>{action.outcome}</p>
                  <div><span>{action.impact}</span><span>{action.effort}</span></div>
                </div>
              </li>
            ))}
          </ol>
          <div className="result-more">+ 8 more recommendations in the full report <span>View report →</span></div>
        </div>
        </div>
      </div>
    </section>
  );
}
