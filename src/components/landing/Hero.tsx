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
      <div className="hero-score-pattern" aria-hidden="true">
        <svg viewBox="0 0 1120 610" role="presentation">
          <g className="hero-score-grid">
            <path d="M40 90H1080M40 210H1080M40 330H1080M40 450H1080M160 30V580M360 30V580M560 30V580M760 30V580M960 30V580" />
          </g>
          <path className="hero-score-route" d="M100 468C210 390 236 438 342 322S536 260 620 154 812 92 1022 174" />

          <g className="hero-score-node hero-score-node-main" transform="translate(188 170)">
            <circle className="track" r="78" />
            <circle className="progress blue" r="78" pathLength="100" strokeDasharray="68 32" />
            <text className="value" y="14">68</text>
            <text className="label" y="112">OVERALL</text>
          </g>
          <g className="hero-score-node" transform="translate(530 102)">
            <circle className="track" r="52" />
            <circle className="progress mint" r="52" pathLength="100" strokeDasharray="82 18" />
            <text className="value small" y="10">82</text>
            <text className="label" y="82">SEARCH</text>
          </g>
          <g className="hero-score-node" transform="translate(880 155)">
            <circle className="track" r="61" />
            <circle className="progress blue" r="61" pathLength="100" strokeDasharray="61 39" />
            <text className="value small" y="10">61</text>
            <text className="label" y="91">SPEED</text>
          </g>
          <g className="hero-score-node" transform="translate(390 414)">
            <circle className="track" r="46" />
            <circle className="progress mint" r="46" pathLength="100" strokeDasharray="54 46" />
            <text className="value mini" y="9">54</text>
            <text className="label" y="74">CONVERSION</text>
          </g>
          <g className="hero-score-node" transform="translate(716 438)">
            <circle className="track" r="72" />
            <circle className="progress mint" r="72" pathLength="100" strokeDasharray="97 3" />
            <text className="value" y="13">97</text>
            <text className="label" y="105">SEO</text>
          </g>
          <g className="hero-score-node" transform="translate(1030 394)">
            <circle className="track" r="42" />
            <circle className="progress blue" r="42" pathLength="100" strokeDasharray="76 24" />
            <text className="value mini" y="8">76</text>
            <text className="label" y="69">TRUST</text>
          </g>

          <g className="hero-score-marks">
            <path d="M70 46H118M94 22V70M990 540H1038M1014 516V564" />
            <text x="70" y="590">37 CHECKS / 7 CATEGORIES / 3 PRIORITIES</text>
          </g>
        </svg>
      </div>
      <div className="hero-mobile-score-pattern" aria-hidden="true">
        <span className="hero-mobile-score score-82"><b>82</b><small>SEARCH</small></span>
        <span className="hero-mobile-score score-61"><b>61</b><small>SPEED</small></span>
        <span className="hero-mobile-score score-97"><b>97</b><small>SEO</small></span>
        <span className="hero-mobile-score score-54"><b>54</b><small>CONVERT</small></span>
      </div>
      <div className="editorial-hero-copy">
        <div>
          <span className="editorial-index">01 / Independent site diagnosis</span>
          <h1>
            See what’s <span className="hero-word-blue">holding</span> your site back.{' '}
            Fix what matters <span className="hero-word-mint">first.</span>
          </h1>
        </div>
        <div className="editorial-intro">
          <p>Get a clear diagnosis of the issues affecting visibility, speed, trust and enquiries—ranked by what will make the biggest difference.</p>
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
