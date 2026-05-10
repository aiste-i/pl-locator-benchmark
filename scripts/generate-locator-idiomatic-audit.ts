import fs from 'fs';
import path from 'path';
import { REALWORLD_APP_IDS, getAppAdapter } from '../src/apps';
import { getActiveLogicalKeys } from '../src/benchmark/realworld-corpus';
import { getByLogicalKey } from '../src/locators/apps/shared-realworld';
import type { SupportedAppId } from '../src/apps/types';

type BaselineMap = Record<string, Record<string, { css: string; xpath: string }>>;

interface AuditNote {
  cssRationale: string;
  xpathRationale: string;
  cssExpectedMutationSensitivity: string;
  xpathExpectedMutationSensitivity: string;
}

const BASELINE = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'reference', 'realworld-locator-baseline.json'), 'utf8'),
) as BaselineMap;

const NOTES: Record<string, AuditNote> = {
  'nav.navbar': {
    cssRationale: 'CSS treats the navbar shell as a short class-based landmark selector a maintainer would keep.',
    xpathRationale: 'XPath anchors the navbar through branded descendant context instead of mirroring the same class token.',
    cssExpectedMutationSensitivity: 'Sensitive to navbar class token changes and shell replacement.',
    xpathExpectedMutationSensitivity: 'Sensitive to brand-link text changes or removal of the descendant anchor.',
  },
  'nav.brandLink': {
    cssRationale: 'CSS uses the stable brand class inside the navbar with no extra ancestry.',
    xpathRationale: 'XPath resolves the brand through normalized link text inside navbar context.',
    cssExpectedMutationSensitivity: 'Sensitive to class-token changes on the brand link.',
    xpathExpectedMutationSensitivity: 'Sensitive to visible brand-text changes or alternative branding markup.',
  },
  'auth.emailInput': {
    cssRationale: 'CSS uses concise attribute-led form targeting that mirrors how engineers usually keep form selectors.',
    xpathRationale: 'XPath scopes the field through auth-page and fieldset context rather than a raw attribute transliteration.',
    cssExpectedMutationSensitivity: 'Sensitive to attribute renames such as name, type, or placeholder changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to form regrouping and auth-page structural rewrites.',
  },
  'auth.passwordInput': {
    cssRationale: 'CSS stays attribute-led and short for the password control.',
    xpathRationale: 'XPath uses auth/form context with field predicates instead of a direct CSS mirror.',
    cssExpectedMutationSensitivity: 'Sensitive to password-field attribute changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to control re-grouping or fieldset restructuring.',
  },
  'auth.submitButton': {
    cssRationale: 'CSS uses the stable submit-button contract rather than extra ancestry.',
    xpathRationale: 'XPath intentionally leans on normalized button text in form context.',
    cssExpectedMutationSensitivity: 'Sensitive to button-type changes or class-level restyling when CSS uses button contract.',
    xpathExpectedMutationSensitivity: 'Sensitive to copy changes that preserve the same action.',
  },
  'nav.globalFeedTab': {
    cssRationale: 'CSS uses feed-toggle scoping plus the link route surface that authors actually maintain.',
    xpathRationale: 'XPath uses feed-toggle context and normalized tab text, which is a more relational interpretation.',
    cssExpectedMutationSensitivity: 'Sensitive to href or route-shape changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to tab text changes or feed-toggle recontextualization.',
  },
  'home.firstReadMoreLink': {
    cssRationale: 'CSS uses concise preview-list scoping with a first-card positional intent and the preview-link class.',
    xpathRationale: 'XPath expresses first-card context plus descendant heading relation rather than the same flat surface.',
    cssExpectedMutationSensitivity: 'Sensitive to repeated-card order changes and first-of-type shifts.',
    xpathExpectedMutationSensitivity: 'Sensitive to repeated-card reshaping or link-heading relation changes.',
  },
  'comments.textarea': {
    cssRationale: 'CSS uses comment-form plus textarea attributes without over-specifying the full card tree.',
    xpathRationale: 'XPath scopes the textarea through comment-form and local content container context.',
    cssExpectedMutationSensitivity: 'Sensitive to placeholder/name changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to form-container reshaping around the comment editor.',
  },
  'comments.submitButton': {
    cssRationale: 'CSS uses footer-local button targeting inside the comment form.',
    xpathRationale: 'XPath uses footer context and normalized button text to express relational meaning.',
    cssExpectedMutationSensitivity: 'Sensitive to footer/button class changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to button copy changes or footer regrouping.',
  },
  'settings.bioInput': {
    cssRationale: 'CSS treats the settings bio field as a concise attribute-based form selector.',
    xpathRationale: 'XPath scopes the same field through settings-page context and local field predicates.',
    cssExpectedMutationSensitivity: 'Sensitive to placeholder/name/aria-label changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to settings-form restructuring or field regrouping.',
  },
  'settings.submitButton': {
    cssRationale: 'CSS uses the primary settings button surface without deep ancestry.',
    xpathRationale: 'XPath resolves the button by normalized action text inside settings context.',
    cssExpectedMutationSensitivity: 'Sensitive to class/submit-contract changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to button copy changes.',
  },
  'article.favoriteButton': {
    cssRationale: 'CSS uses article-meta-local class and aria-label surfaces that feel native to CSS locator authoring.',
    xpathRationale: 'XPath emphasizes banner/article-meta ancestry and target-role relation.',
    cssExpectedMutationSensitivity: 'Sensitive to aria-label and button-class changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to meta-container moves or action relocation inside the detail header.',
  },
  'home.previewDescription': {
    cssRationale: 'CSS uses direct child structure under the preview link because that is the short readable selector engineers keep.',
    xpathRationale: 'XPath uses descendant context and semantic predicates on the preview description node.',
    cssExpectedMutationSensitivity: 'Sensitive to wrapper insertion or child-depth changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to descendant-shape rewrites and semantic attribute changes.',
  },
  'comments.deleteButton': {
    cssRationale: 'CSS targets the delete affordance through local footer scope and aria-label, not the entire card chain.',
    xpathRationale: 'XPath uses footer ancestry and role/button predicates inside the repeated comment container.',
    cssExpectedMutationSensitivity: 'Sensitive to local footer markup and aria-label changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to footer/container relation changes inside repeated comment cards.',
  },
  'article.title': {
    cssRationale: 'CSS keeps the title selector short and shell-scoped to the article banner.',
    xpathRationale: 'XPath uses banner ancestry and normalized heading presence instead of a direct CSS mirror.',
    cssExpectedMutationSensitivity: 'Sensitive to banner/title tag changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to heading relocation within the article hero.',
  },
  'home.paginationButton': {
    cssRationale: 'CSS uses the concrete button/link control surface under a page-item parent.',
    xpathRationale: 'XPath expresses pagination through list-item context and descendant control predicates.',
    cssExpectedMutationSensitivity: 'Sensitive to direct-child pagination reshaping.',
    xpathExpectedMutationSensitivity: 'Sensitive to pagination-container or control-context rewrites.',
  },
  'home.paginationItem': {
    cssRationale: 'CSS intentionally uses a parent-selection relation with :has() because that is an idiomatic CSS strength.',
    xpathRationale: 'XPath uses list-item predicates with descendant control checks, which is native XPath style.',
    cssExpectedMutationSensitivity: 'Sensitive to parent-child pagination relation changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to repeated-list and control-containment changes.',
  },
  'profile.followButton': {
    cssRationale: 'CSS uses the profile action-button class cluster plus aria-label in the user-info panel.',
    xpathRationale: 'XPath resolves the control through user-info ancestry and action-role context.',
    cssExpectedMutationSensitivity: 'Sensitive to action-btn class drift or aria-label changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to profile-header restructuring around the follow control.',
  },
  'profile.unfollowButton': {
    cssRationale: 'CSS uses the same action-button idiom for the toggled unfollow state.',
    xpathRationale: 'XPath stays relational by user-info context and normalized action identity.',
    cssExpectedMutationSensitivity: 'Sensitive to action-btn class drift or aria-label changes.',
    xpathExpectedMutationSensitivity: 'Sensitive to profile-header restructuring around the unfollow control.',
  },
};

function classifyCssSurface(selector: string): { label: string; coarse: string } {
  if (selector.includes(':has(')) return { label: 'parent relation via :has()', coarse: 'relational' };
  if (selector.includes(':first-of-type') || selector.includes(':nth-')) return { label: 'positional structure', coarse: 'structural' };
  if (selector.includes('[') && selector.includes('.')) return { label: 'class plus attribute', coarse: 'attribute' };
  if (selector.includes('[')) return { label: 'attribute predicate', coarse: 'attribute' };
  if (selector.includes('>')) return { label: 'direct-child structure', coarse: 'structural' };
  if (selector.includes('.')) return { label: 'class token', coarse: 'structural' };
  return { label: 'tag structure', coarse: 'structural' };
}

function classifyXpathSurface(selector: string): { label: string; coarse: string } {
  if (selector.includes('normalize-space()')) return { label: 'normalized text predicate', coarse: 'text' };
  if (selector.includes('ancestor::') || selector.includes('descendant::')) return { label: 'axis-based context', coarse: 'relational' };
  if (selector.includes('[.//') || selector.includes('//*[self::')) return { label: 'relational predicate', coarse: 'relational' };
  if (selector.includes('@') && selector.includes('contains(@class')) return { label: 'context plus attribute predicate', coarse: 'attribute' };
  if (selector.includes('@')) return { label: 'attribute predicate', coarse: 'attribute' };
  return { label: 'structural path', coarse: 'structural' };
}

function pairClassification(cssSelector: string, xpathSelector: string): 'matched-surface' | 'family-distinct' {
  const cssSurface = classifyCssSurface(cssSelector);
  const xpathSurface = classifyXpathSurface(xpathSelector);
  return cssSurface.coarse === xpathSurface.coarse ? 'matched-surface' : 'family-distinct';
}

function currentSelectors(appId: SupportedAppId, logicalKey: string): { css: string; xpath: string } {
  const adapter = getAppAdapter(appId);
  const cssMeta = (getByLogicalKey(adapter.getLocators('css'), logicalKey) as { __familyMeta?: { selector?: string } }).__familyMeta;
  const xpathMeta = (getByLogicalKey(adapter.getLocators('xpath'), logicalKey) as { __familyMeta?: { selector?: string } }).__familyMeta;

  if (!cssMeta?.selector || !xpathMeta?.selector) {
    throw new Error(`Missing css/xpath selectors for ${appId} ${logicalKey}`);
  }

  return {
    css: cssMeta.selector,
    xpath: xpathMeta.selector,
  };
}

function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const rows = REALWORLD_APP_IDS.flatMap(appId =>
    getActiveLogicalKeys().map(logicalKey => {
      const before = BASELINE[appId]?.[logicalKey];
      const after = currentSelectors(appId, logicalKey);
      const note = NOTES[logicalKey];
      if (!before) {
        throw new Error(`Missing locator baseline for ${appId} ${logicalKey}`);
      }
      if (!note) {
        throw new Error(`Missing audit note for ${logicalKey}`);
      }

      return {
        appId,
        logicalKey,
        currentCssLocator: before.css,
        currentXPathLocator: before.xpath,
        currentCssSurface: classifyCssSurface(before.css).label,
        currentXPathSurface: classifyXpathSurface(before.xpath).label,
        currentPairClassification: pairClassification(before.css, before.xpath),
        refactoredCssLocator: after.css,
        refactoredXPathLocator: after.xpath,
        refactoredCssSurface: classifyCssSurface(after.css).label,
        refactoredXPathSurface: classifyXpathSurface(after.xpath).label,
        cssRationale: note.cssRationale,
        xpathRationale: note.xpathRationale,
        cssExpectedMutationSensitivity: note.cssExpectedMutationSensitivity,
        xpathExpectedMutationSensitivity: note.xpathExpectedMutationSensitivity,
        refactoredPairClassification: pairClassification(after.css, after.xpath),
      };
    }),
  );

  const beforeMatched = rows.filter(row => row.currentPairClassification === 'matched-surface').length;
  const afterMatched = rows.filter(row => row.refactoredPairClassification === 'matched-surface').length;
  const summary = {
    totalActiveLocatorRows: rows.length,
    before: {
      matchedSurfaceCount: beforeMatched,
      matchedSurfacePercentage: Number((beforeMatched / rows.length).toFixed(4)),
      familyDistinctCount: rows.length - beforeMatched,
      familyDistinctPercentage: Number(((rows.length - beforeMatched) / rows.length).toFixed(4)),
    },
    after: {
      matchedSurfaceCount: afterMatched,
      matchedSurfacePercentage: Number((afterMatched / rows.length).toFixed(4)),
      familyDistinctCount: rows.length - afterMatched,
      familyDistinctPercentage: Number(((rows.length - afterMatched) / rows.length).toFixed(4)),
    },
  };

  fs.writeFileSync(path.join(reportsDir, 'realworld-locator-idiomatic-audit.json'), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(reportsDir, 'realworld-css-xpath-overlap.json'), JSON.stringify(summary, null, 2));
}

main();
