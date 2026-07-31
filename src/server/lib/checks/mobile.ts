import type { CheckResult, MeasurementType } from '../../../lib/types';
import type { PageData } from '../fetchSite';
import type { RenderedPageData } from '../renderPage';

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'detected',
): CheckResult {
  return { id, category: 'mobile', label, passed, detail, severity, weight, measurementType };
}

/** A miss that's genuinely unknown rather than confirmed-absent — see CheckStatus in types.ts. */
function notVerified(id: string, label: string, reason: string): CheckResult {
  return { id, category: 'mobile', label, passed: true, detail: reason, severity: 'info', weight: 0, measurementType: 'not_available', status: 'not_verified' };
}

export function runMobileChecks(page: PageData, rendered?: RenderedPageData | null): CheckResult[] {
  const results: CheckResult[] = [];

  const viewport = page.viewport ?? '';
  const hasWidthDevice = /width\s*=\s*device-width/i.test(viewport);
  results.push(check('mobile.viewport', 'Mobile viewport meta tag configured', hasWidthDevice, viewport ? `Viewport: "${viewport}"` : 'No viewport meta tag found', 'critical', 10));

  // Real per-breakpoint horizontal-overflow measurement is the primary signal when available —
  // it's what actually determines whether mobile visitors see a broken layout. The @media
  // regex only ever sees inline <style> blocks (never a linked stylesheet, which is how almost
  // every real site ships CSS), and even a page with zero @media rules can be perfectly
  // responsive via modern CSS (flex/grid/clamp) — so it's demoted to a supplementary signal.
  const hasMediaQueriesInline = /@media/i.test(page.html);
  if (rendered) {
    const overflowing = rendered.viewportOverflow.filter((v) => v.overflowPx > 0);
    const isResponsive = overflowing.length === 0;
    results.push(
      check(
        'mobile.responsive',
        'Layout adapts to mobile screen widths',
        isResponsive,
        isResponsive
          ? `No horizontal overflow at ${rendered.viewportOverflow.map((v) => `${v.width}px`).join(', ')} viewport widths`
          : `Horizontal overflow found at ${overflowing.map((v) => `${v.width}px (+${v.overflowPx}px)`).join(', ')} — content extends beyond the visible screen`,
        'high',
        9,
        'measured',
      ),
    );
  } else if (hasMediaQueriesInline) {
    results.push(check('mobile.responsive', 'Layout adapts to mobile screen widths', true, 'Media queries detected in an inline <style> block (a linked stylesheet, the far more common case, could not be checked without rendering)', 'high', 9, 'inferred'));
  } else {
    results.push(notVerified('mobile.responsive', 'Layout adapts to mobile screen widths', 'No inline @media rules found, but most sites declare responsive CSS in a linked stylesheet this scan could not fetch and render — whether the layout actually adapts could not be confirmed without browser rendering.'));
  }

  if (rendered) {
    const { total, tooSmall } = rendered.tapTargets;
    results.push(
      check(
        'mobile.touchTargets',
        'No obviously tiny touch targets',
        total === 0 || tooSmall === 0,
        total === 0 ? 'No interactive elements found' : tooSmall === 0 ? `All ${total} interactive element(s) measured at least 24x24px` : `${tooSmall} of ${total} interactive element(s) measured under 24x24px on screen`,
        'medium',
        5,
        'measured',
      ),
    );
  } else {
    const smallTouchTargetHints = (page.html.match(/font-size:\s*(?:[0-9]|1[01])px/gi) || []).length;
    results.push(
      check(
        'mobile.touchTargets',
        'No obviously tiny touch targets',
        smallTouchTargetHints === 0,
        smallTouchTargetHints === 0 ? 'No very small tap-target sized text detected in static HTML' : `${smallTouchTargetHints} element(s) with very small font sizes detected, which often pair with small tap targets`,
        'medium',
        5,
        'inferred',
      ),
    );
  }

  const smallBaseFontHints = /font-size:\s*(?:[0-9]|1[0-2])px/i.test(page.html);
  results.push(
    check(
      'mobile.textSizing',
      'Base text size readable without zoom',
      !smallBaseFontHints,
      smallBaseFontHints ? 'Very small font sizes detected in page source' : 'No very small base font sizes detected',
      'medium',
      5,
      'inferred',
    ),
  );

  if (rendered) {
    const overflowing = rendered.viewportOverflow.filter((v) => v.overflowPx > 0);
    results.push(
      check(
        'mobile.horizontalOverflow',
        'No obvious fixed-width overflow risk',
        overflowing.length === 0,
        overflowing.length === 0 ? 'No horizontal scroll detected at any tested viewport width' : `Horizontal overflow measured at ${overflowing.map((v) => `${v.width}px`).join(', ')}`,
        'medium',
        5,
        'measured',
      ),
    );
  } else {
    const fixedWidthHints = (page.html.match(/width:\s*(?:[89]\d{2}|[1-9]\d{3,})px/gi) || []).length;
    results.push(
      check(
        'mobile.horizontalOverflow',
        'No obvious fixed-width overflow risk',
        fixedWidthHints === 0,
        fixedWidthHints === 0 ? 'No large fixed-pixel widths detected in page source' : `${fixedWidthHints} element(s) with large fixed-pixel widths detected, which can cause horizontal scrolling on mobile`,
        'medium',
        5,
        'inferred',
      ),
    );
  }

  return results;
}
