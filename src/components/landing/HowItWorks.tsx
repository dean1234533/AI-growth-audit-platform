import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    title: 'We inspect the evidence',
    description: 'Your website is checked across search visibility, speed, mobile usability, accessibility, trust and conversion.',
  },
  {
    number: '02',
    title: 'You see what matters',
    description: 'Technical findings are translated into plain English and ranked by likely impact and effort.',
  },
  {
    number: '03',
    title: 'You know what to do next',
    description: 'Work through the priorities yourself, download the report, or monitor the website for future changes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="editorial-section">
      <div className="editorial-section-grid">
        <header>
          <span className="editorial-index">02 / The method</span>
          <h2>An audit designed for decisions, not technical noise.</h2>
          <p>Most tools give you another list of warnings. Growth Audit gives every finding context, priority and a useful next step.</p>
          <a href="/#top">Run your free audit <ArrowRight className="size-4" /></a>
        </header>

        <ol className="editorial-steps">
          {STEPS.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="monitoring-band">
        <div>
          <span>After the first audit</span>
          <h3>Websites change. Your score should not be a one-off snapshot.</h3>
        </div>
        <p>A free account saves one website, records its health over time and alerts you when something important changes.</p>
        <a href="/login?mode=signup">Monitor one website free <ArrowRight className="size-4" /></a>
      </div>
    </section>
  );
}
