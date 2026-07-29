import type { CheckResult } from '../../../lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'mobile', label, passed, detail, severity, weight };
}

export function runMobileChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];

  const viewport = page.viewport ?? '';
  const hasWidthDevice = /width\s*=\s*device-width/i.test(viewport);
  results.push(check('mobile.viewport', 'Mobile viewport meta tag configured', hasWidthDevice, viewport ? `Viewport: "${viewport}"` : 'No viewport meta tag found', 'critical', 10));

  const hasMediaQueries = /@media/i.test(page.html);
  results.push(check('mobile.responsive', 'Responsive CSS (media queries) detected', hasMediaQueries, hasMediaQueries ? 'Media queries detected in page source' : 'No @media queries detected — layout may not adapt to mobile', 'high', 9));

  const smallTouchTargetHints = (page.html.match(/font-size:\s*(?:[0-9]|1[01])px/gi) || []).length;
  results.push(check('mobile.touchTargets', 'No obviously tiny touch targets', smallTouchTargetHints === 0, smallTouchTargetHints === 0 ? 'No very small tap-target sized text detected' : `${smallTouchTargetHints} element(s) with very small font sizes detected, which often pair with small tap targets`, 'medium', 5));

  const smallBaseFontHints = /font-size:\s*(?:[0-9]|1[0-2])px/i.test(page.html);
  results.push(check('mobile.textSizing', 'Base text size readable without zoom', !smallBaseFontHints, smallBaseFontHints ? 'Very small font sizes detected in page source' : 'No very small base font sizes detected', 'medium', 5));

  return results;
}
