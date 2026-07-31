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
  return { id, category: 'accessibility', label, passed, detail, severity, weight, measurementType };
}

/** A miss that's genuinely unknown rather than confirmed-absent — see CheckStatus in types.ts. */
function notVerified(id: string, label: string, reason: string): CheckResult {
  return { id, category: 'accessibility', label, passed: true, detail: reason, severity: 'info', weight: 0, measurementType: 'not_available', status: 'not_verified' };
}

export function runAccessibilityChecks(page: PageData, rendered?: RenderedPageData | null): CheckResult[] {
  const results: CheckResult[] = [];

  const imagesMissingAlt = page.images.filter((img) => !img.alt || img.alt.trim() === '');
  results.push(check('a11y.imageAlt', 'Images have alt text', page.images.length === 0 || imagesMissingAlt.length === 0, page.images.length === 0 ? 'No images found' : `${imagesMissingAlt.length} of ${page.images.length} images missing alt text`, 'high', 9));

  if (rendered) {
    // Real <label for>/wrapping-label/aria-label/aria-labelledby resolution, and correctly
    // excludes aria-hidden fields (e.g. a honeypot) from the requirement entirely — the static
    // heuristic below has no concept of either and can both over- and under-flag.
    const unlabeledForms = rendered.forms.filter((f) => f.unlabelledFieldCount > 0);
    results.push(check('a11y.formLabels', 'Form fields are labelled', rendered.forms.length === 0 || unlabeledForms.length === 0, rendered.forms.length === 0 ? 'No forms found' : `${unlabeledForms.length} of ${rendered.forms.length} form(s) have unlabelled fields`, 'high', 8, 'measured'));
  } else {
    const unlabeledForms = page.forms.filter((f) => !f.hasLabelsForAllInputs);
    results.push(check('a11y.formLabels', 'Form fields are labelled', page.forms.length === 0 || unlabeledForms.length === 0, page.forms.length === 0 ? 'No forms found' : `${unlabeledForms.length} of ${page.forms.length} form(s) have unlabelled fields`, 'high', 8, 'inferred'));
  }

  const unnamedButtons = page.buttons.filter((b) => !b.hasAccessibleName);
  const buttonRatio = page.buttons.length === 0 ? 0 : unnamedButtons.length / page.buttons.length;
  results.push(check('a11y.buttonAccessible', 'Buttons have accessible names', page.buttons.length === 0 || buttonRatio < 0.5, page.buttons.length === 0 ? 'No buttons found' : `${unnamedButtons.length} of ${page.buttons.length} buttons missing aria-label (text-content buttons not flagged)`, 'medium', 5));

  const levels = page.headings.map((h) => h.level);
  let hierarchyOk = true;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) hierarchyOk = false;
  }
  results.push(check('a11y.headingHierarchy', 'Heading levels do not skip', levels.length === 0 || hierarchyOk, levels.length === 0 ? 'No headings found' : hierarchyOk ? 'Heading order looks sequential' : 'Heading levels skip (e.g. H2 to H4)', 'low', 4));

  const ariaCount = (page.html.match(/aria-[a-z]+=/gi) || []).length;
  results.push(check('a11y.ariaLabels', 'ARIA attributes used where relevant', ariaCount > 0 || page.buttons.length === 0, ariaCount > 0 ? `${ariaCount} ARIA attribute(s) found` : 'No ARIA attributes found on interactive elements', 'medium', 5));

  if (rendered) {
    // Real keyboard-Tab test: each sampled element was actually focused and its computed
    // outline/box-shadow compared against its resting state — not a text search for ":focus"
    // in raw HTML, which can never see rules declared in a linked stylesheet (the normal case)
    // and says nothing about whether a matching rule is ever actually visible.
    const { sampled, withVisibleIndicator } = rendered.focusTest;
    const hasFocusStyles = sampled === 0 || withVisibleIndicator > 0;
    results.push(
      check(
        'a11y.focusStates',
        'Visible focus states defined',
        hasFocusStyles,
        sampled === 0
          ? 'No focusable elements found to test'
          : withVisibleIndicator === sampled
            ? `All ${sampled} tested element(s) showed a visible focus indicator when tabbed to`
            : withVisibleIndicator > 0
              ? `${withVisibleIndicator} of ${sampled} tested element(s) showed a visible focus indicator when tabbed to`
              : `None of the ${sampled} tested element(s) showed a visible focus indicator when tabbed to`,
        'medium',
        4,
        'measured',
      ),
    );
  } else {
    results.push(notVerified('a11y.focusStates', 'Visible focus states defined', 'Focus styles are almost always declared in a linked stylesheet, which this scan could not fetch and render, and even a static ":focus" match says nothing about whether it\'s ever actually visible — could not be confirmed without a real keyboard-focus test.'));
  }

  const hasContrastRisk = /color:\s*#(ccc|ddd|eee|ccc|d0d0d0)/i.test(page.html);
  results.push(
    check(
      'a11y.contrast',
      'No obvious low-contrast colour patterns',
      !hasContrastRisk,
      hasContrastRisk ? 'Very light text colours detected inline, which often indicates low contrast' : 'No obvious low-contrast patterns detected in inline styles',
      'medium',
      4,
      'inferred',
    ),
  );

  results.push(check('a11y.htmlLang', 'HTML lang attribute set', !!page.htmlLang, page.htmlLang ? `lang="${page.htmlLang}"` : 'No lang attribute found on <html>', 'high', 6));

  const emptyLinks = page.links.filter((l) => !l.text && !/^(#|mailto:|tel:)/.test(l.href));
  results.push(check('a11y.emptyLinks', 'No links with empty accessible text', emptyLinks.length === 0, emptyLinks.length === 0 ? 'All links have visible text' : `${emptyLinks.length} link(s) found with no text content (e.g. icon-only links without aria-label)`, 'medium', 5));

  const emptyButtons = page.buttons.filter((b) => !b.text && !b.hasAccessibleName);
  results.push(check('a11y.emptyButtons', 'No buttons with empty accessible text', emptyButtons.length === 0, page.buttons.length === 0 ? 'No buttons found' : emptyButtons.length === 0 ? 'All buttons have text or an aria-label' : `${emptyButtons.length} button(s) found with no text and no aria-label`, 'high', 6));

  const untitledIframes = page.iframes.filter((f) => !f.title);
  results.push(check('a11y.iframeTitles', 'Iframes have a title attribute', page.iframes.length === 0 || untitledIframes.length === 0, page.iframes.length === 0 ? 'No iframes found' : `${untitledIframes.length} of ${page.iframes.length} iframe(s) missing a title attribute`, 'medium', 4));

  const idCounts = new Map<string, number>();
  for (const id of page.ids) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);
  results.push(check('a11y.duplicateIds', 'No duplicate id attributes', duplicateIds.length === 0, duplicateIds.length === 0 ? 'No duplicate id attributes found' : `${duplicateIds.length} duplicate id value(s) found (e.g. "${duplicateIds[0][0]}")`, 'medium', 5));

  return results;
}
