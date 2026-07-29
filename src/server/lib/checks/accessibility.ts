import type { CheckResult } from '../../../lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'accessibility', label, passed, detail, severity, weight };
}

export function runAccessibilityChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];

  const imagesMissingAlt = page.images.filter((img) => !img.alt || img.alt.trim() === '');
  results.push(check('a11y.imageAlt', 'Images have alt text', page.images.length === 0 || imagesMissingAlt.length === 0, page.images.length === 0 ? 'No images found' : `${imagesMissingAlt.length} of ${page.images.length} images missing alt text`, 'high', 9));

  const unlabeledForms = page.forms.filter((f) => !f.hasLabelsForAllInputs);
  results.push(check('a11y.formLabels', 'Form fields are labelled', page.forms.length === 0 || unlabeledForms.length === 0, page.forms.length === 0 ? 'No forms found' : `${unlabeledForms.length} of ${page.forms.length} form(s) have unlabelled fields`, 'high', 8));

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

  const hasFocusStyles = /:focus/i.test(page.html) || /outline\s*:/i.test(page.html);
  results.push(check('a11y.focusStates', 'Visible focus states defined', hasFocusStyles, hasFocusStyles ? 'Focus-related CSS detected' : 'No :focus or outline styling detected in page source', 'medium', 4));

  const hasContrastRisk = /color:\s*#(ccc|ddd|eee|ccc|d0d0d0)/i.test(page.html);
  results.push(check('a11y.contrast', 'No obvious low-contrast colour patterns', !hasContrastRisk, hasContrastRisk ? 'Very light text colours detected inline, which often indicates low contrast' : 'No obvious low-contrast patterns detected in inline styles', 'medium', 4));

  return results;
}
