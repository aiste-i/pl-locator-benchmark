import type { Locator, Page } from '@playwright/test';
import type { StrategyName } from '..';
import {
  chooseStrategy,
  css,
  markSemantic,
  oracle,
  oracleDynamicTestId,
  oracleTestIdChain,
  oracleTestId,
  semanticNative,
  xpath,
} from './shared-realworld';

const APP_ID = 'realworld';
const MODULE_ID = 'src/locators/apps/react-realworld.locators.ts';

const meta = (logicalKey: string) => ({
  appId: APP_ID,
  moduleId: MODULE_ID,
  logicalKey,
});

export function getReactRealWorldLocators(strategy: StrategyName) {
  return {
    nav: {
      navbar: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('nav.navbar'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('navigation').first(), 'getByRole'),
        ),
        css: css({ ...meta('nav.navbar'), selector: 'nav.navbar' }),
        xpath: xpath({
          ...meta('nav.navbar'),
          selector:
            '(//nav[contains(concat(" ", normalize-space(@class), " "), " navbar ")][descendant::a[contains(concat(" ", normalize-space(@class), " "), " navbar-brand ")]])[1]',
        }),
      }),
      brandLink: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('nav.brandLink'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('link', { name: /conduit/i }).first(), 'getByRole'),
        ),
        css: css({ ...meta('nav.brandLink'), selector: '.navbar .navbar-brand' }),
        xpath: xpath({
          ...meta('nav.brandLink'),
          selector:
            '(//a[contains(concat(" ", normalize-space(@class), " "), " navbar-brand ")][ancestor::nav[contains(concat(" ", normalize-space(@class), " "), " navbar ")]])[1]',
        }),
      }),
      globalFeedTab: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('nav.globalFeedTab'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('link', { name: /^global feed$/i }).first(), 'getByRole'),
        ),
        css: css({ ...meta('nav.globalFeedTab'), selector: '.feed-toggle .nav-link[href="/?tab=all"]' }),
        xpath: xpath({
          ...meta('nav.globalFeedTab'),
          selector:
            '(//a[@href="/?tab=all" and ancestor::div[contains(concat(" ", normalize-space(@class), " "), " feed-toggle ")] and ancestor::li[contains(concat(" ", normalize-space(@class), " "), " nav-item ")]])[1]',
        }),
      }),
    },
    auth: {
      emailInput: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('auth.emailInput'), semanticEntryPoint: 'getByPlaceholder' },
          (page: Page) => markSemantic(page.getByPlaceholder(/^email$/i), 'getByPlaceholder'),
        ),
        css: css({ ...meta('auth.emailInput'), selector: 'form input[name="email"]' }),
        xpath: xpath({ ...meta('auth.emailInput'), selector: '(//div[contains(@class,"auth-page")]//input[@name="email"])[1]' }),
      }),
      passwordInput: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('auth.passwordInput'), semanticEntryPoint: 'getByPlaceholder' },
          (page: Page) => markSemantic(page.getByPlaceholder(/^password$/i), 'getByPlaceholder'),
        ),
        css: css({ ...meta('auth.passwordInput'), selector: 'form input[name="password"]' }),
        xpath: xpath({ ...meta('auth.passwordInput'), selector: '(//div[contains(@class,"auth-page")]//input[@name="password"])[1]' }),
      }),
      submitButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('auth.submitButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /sign in|sign up/i }).first(), 'getByRole'),
        ),
        css: css({ ...meta('auth.submitButton'), selector: 'form button[type="submit"]' }),
        xpath: xpath({
          ...meta('auth.submitButton'),
          selector:
            '(//button[@type="submit" and ancestor::form[.//input[@name="email"] and .//input[@name="password"]]])[1]',
        }),
      }),
    },
    home: {
      firstArticlePreview: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('home.firstArticlePreview'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('article', { name: /^article preview:/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('home.firstArticlePreview'), selector: '.article-preview:first-of-type' },
          (page: Page) => page.locator('.article-preview').first(),
        ),
        xpath: xpath(
          { ...meta('home.firstArticlePreview'), selector: '((//div[contains(@class,"article-preview")])[1])' },
          (page: Page) => page.locator('xpath=((//div[contains(@class,"article-preview")])[1])'),
        ),
      }),
      firstReadMoreLink: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('home.firstReadMoreLink'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('link', { name: /^read more about /i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('home.firstReadMoreLink'), selector: '.article-list .article-preview:first-of-type .preview-link[href^="/article/"]' },
          (page: Page) => page.locator('.article-list .article-preview').first().locator('.preview-link[href^="/article/"]'),
        ),
        xpath: xpath({ ...meta('home.firstReadMoreLink'), selector: '((//div[contains(@class,"article-preview")])[1]//a[contains(@class,"preview-link") and descendant::h1])[1]' }),
      }),
      previewDescription: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('home.previewDescription'), semanticEntryPoint: 'getByRole' },
          (preview: Locator) => markSemantic(preview.getByRole('note', { name: /^article preview description$/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('home.previewDescription'), selector: '.preview-link > p[role="note"]' },
          (preview: Locator) => preview.locator('.preview-link > p[role="note"]').first(),
        ),
        xpath: xpath(
          { ...meta('home.previewDescription'), selector: '(.//a[contains(@class,"preview-link")]/descendant::p[@role="note" or @aria-label="Article preview description"])[1]' },
          (preview: Locator) => preview.locator('xpath=(.//a[contains(@class,"preview-link")]/descendant::p[@role="note" or @aria-label="Article preview description"])[1]'),
        ),
      }),
      paginationButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('home.paginationButton'), semanticEntryPoint: 'getByRole' },
          (page: Page, pageNumber: number) =>
            markSemantic(page.getByRole('link', { name: new RegExp(`^go to page ${pageNumber}$`, 'i') }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('home.paginationButton'), selector: '.pagination .page-item > a.page-link[aria-label]' },
          (page: Page, pageNumber: number) => page.locator(`.pagination .page-item > a.page-link[aria-label="Go to page ${pageNumber}"]`),
        ),
        xpath: xpath(
          { ...meta('home.paginationButton'), selector: '//ul[contains(@class,"pagination")]/li[.//a[@aria-label="Go to page N"]]//a[@aria-label="Go to page N"]' },
          (page: Page, pageNumber: number) =>
            page.locator(`xpath=//ul[contains(@class,"pagination")]/li[.//a[@aria-label="Go to page ${pageNumber}"]]//a[@aria-label="Go to page ${pageNumber}"]`),
        ),
      }),
      paginationItem: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('home.paginationItem'), semanticEntryPoint: 'getByRole' },
          (page: Page, pageNumber: number) =>
            markSemantic(page.getByRole('listitem', { name: new RegExp(`^page ${pageNumber}$`, 'i') }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('home.paginationItem'), selector: '.pagination .page-item:has(> a.page-link[aria-label])' },
          (page: Page, pageNumber: number) =>
            page.locator(`.pagination .page-item:has(> a.page-link[aria-label="Go to page ${pageNumber}"])`).first(),
        ),
        xpath: xpath(
          { ...meta('home.paginationItem'), selector: '//ul[contains(@class,"pagination")]//li[contains(@class,"page-item") and .//a[@aria-label="Go to page N"]]' },
          (page: Page, pageNumber: number) =>
            page.locator(`xpath=//ul[contains(@class,"pagination")]//li[contains(@class,"page-item") and .//a[@aria-label="Go to page ${pageNumber}"]]`),
        ),
      }),
    },
    article: {
      title: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('article.title'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('heading', { level: 1 }).first(), 'getByRole'),
        ),
        css: css({ ...meta('article.title'), selector: '.article-page .banner h1' }),
        xpath: xpath({
          ...meta('article.title'),
          selector:
            '(//div[contains(concat(" ", normalize-space(@class), " "), " article-page ")]//div[contains(concat(" ", normalize-space(@class), " "), " banner ")]/descendant::h1)[1]',
        }),
      }),
      titleText: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('article.titleText'), semanticEntryPoint: 'getByText' },
          (page: Page, title: string) => markSemantic(page.getByText(title, { exact: true }).first(), 'getByText'),
        ),
        css: css({ ...meta('article.titleText'), selector: '.article-page .banner h1' }),
        xpath: xpath(
          { ...meta('article.titleText'), selector: '//div[contains(@class,"article-page")]//div[contains(@class,"banner")]//h1[normalize-space() = "${title}"]' },
          (page: Page, title: string) =>
            page.locator(`xpath=//div[contains(@class,"article-page")]//div[contains(@class,"banner")]//h1[normalize-space() = ${JSON.stringify(title)}]`),
        ),
      }),
      favoriteButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('article.favoriteButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /^favorite article\b/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('article.favoriteButton'), selector: '.article-page .article-meta .btn[aria-label="Favorite article"]' },
          (page: Page) => page.locator('.article-page .article-meta .btn[aria-label="Favorite article"]'),
        ),
        xpath: xpath(
          { ...meta('article.favoriteButton'), selector: '//div[contains(@class,"article-page")]//div[contains(@class,"article-meta")]//*[self::button or self::a][@aria-label="Favorite article"]' },
          (page: Page) => page.locator('xpath=//div[contains(@class,"article-page")]//div[contains(@class,"article-meta")]//*[self::button or self::a][@aria-label="Favorite article"]'),
        ),
      }),
      unfavoriteButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('article.unfavoriteButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /^unfavorite article\b/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('article.unfavoriteButton'), selector: '.article-page .article-meta .btn[aria-label="Unfavorite article"]' },
          (page: Page) => page.locator('.article-page .article-meta .btn[aria-label="Unfavorite article"]'),
        ),
        xpath: xpath(
          { ...meta('article.unfavoriteButton'), selector: '//div[contains(@class,"article-page")]//div[contains(@class,"article-meta")]//*[self::button or self::a][@aria-label="Unfavorite article"]' },
          (page: Page) => page.locator('xpath=//div[contains(@class,"article-page")]//div[contains(@class,"article-meta")]//*[self::button or self::a][@aria-label="Unfavorite article"]'),
        ),
      }),
    },
    comments: {
      textarea: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('comments.textarea'), semanticEntryPoint: 'getByPlaceholder' },
          (page: Page) => markSemantic(page.getByPlaceholder(/write a comment/i), 'getByPlaceholder'),
        ),
        css: css({ ...meta('comments.textarea'), selector: '.comment-form .form-control[name="comment"]' }),
        xpath: xpath({
          ...meta('comments.textarea'),
          selector:
            '(//form[contains(concat(" ", normalize-space(@class), " "), " comment-form ")]//div[contains(concat(" ", normalize-space(@class), " "), " card-block ")]//textarea[@name="comment" and contains(concat(" ", normalize-space(@class), " "), " form-control ")])[1]',
        }),
      }),
      submitButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('comments.submitButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /post comment/i }).first(), 'getByRole'),
        ),
        css: css({ ...meta('comments.submitButton'), selector: '.comment-form .card-footer > button.btn.btn-primary[type="submit"]' }),
        xpath: xpath({
          ...meta('comments.submitButton'),
          selector:
            '(//form[contains(concat(" ", normalize-space(@class), " "), " comment-form ")]//div[contains(concat(" ", normalize-space(@class), " "), " card-footer ")]//button[@type="submit" and ancestor::form[.//textarea[@name="comment"]]])[1]',
        }),
      }),
      deleteButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('comments.deleteButton'), semanticEntryPoint: 'getByRole' },
          (commentRoot: Locator) => markSemantic(commentRoot.getByRole('button', { name: /delete comment/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('comments.deleteButton'), selector: '.card-footer button[aria-label="Delete comment"]' },
          (commentRoot: Locator) => commentRoot.locator('.card-footer button[aria-label="Delete comment"]').first(),
        ),
        xpath: xpath(
          { ...meta('comments.deleteButton'), selector: './/div[contains(@class,"card-footer")]//button[@aria-label="Delete comment"]' },
          (commentRoot: Locator) => commentRoot.locator('xpath=.//div[contains(@class,"card-footer")]//button[@aria-label="Delete comment"]'),
        ),
      }),
    },
    profile: {
      avatarImage: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('profile.avatarImage'), semanticEntryPoint: 'getByAltText' },
          (page: Page, username: string) => markSemantic(page.getByAltText(username).first(), 'getByAltText'),
        ),
        css: css(
          { ...meta('profile.avatarImage'), selector: '.profile-page .user-info img.user-img[alt]' },
          (page: Page, username: string) => page.locator(`.profile-page .user-info img.user-img[alt="${username}"]`),
        ),
        xpath: xpath(
          { ...meta('profile.avatarImage'), selector: '//div[contains(@class,"profile-page")]//img[contains(@class,"user-img") and @alt="${username}"]' },
          (page: Page, username: string) =>
            page.locator(`xpath=//div[contains(@class,"profile-page")]//img[contains(@class,"user-img") and @alt=${JSON.stringify(username)}]`),
        ),
      }),
      followButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('profile.followButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /^follow user\b/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('profile.followButton'), selector: '.user-info .btn.action-btn[aria-label="Follow user"]' },
          (page: Page) => page.locator('.user-info .btn.action-btn[aria-label="Follow user"]'),
        ),
        xpath: xpath(
          { ...meta('profile.followButton'), selector: '//div[contains(@class,"user-info")]//button[@aria-label="Follow user"]' },
          (page: Page) => page.locator('xpath=//div[contains(@class,"user-info")]//button[@aria-label="Follow user"]'),
        ),
      }),
      unfollowButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('profile.unfollowButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /^unfollow user\b/i }).first(), 'getByRole'),
        ),
        css: css(
          { ...meta('profile.unfollowButton'), selector: '.user-info .btn.action-btn[aria-label="Unfollow user"]' },
          (page: Page) => page.locator('.user-info .btn.action-btn[aria-label="Unfollow user"]'),
        ),
        xpath: xpath(
          { ...meta('profile.unfollowButton'), selector: '//div[contains(@class,"user-info")]//button[@aria-label="Unfollow user"]' },
          (page: Page) => page.locator('xpath=//div[contains(@class,"user-info")]//button[@aria-label="Unfollow user"]'),
        ),
      }),
    },
    settings: {
      bioInput: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('settings.bioInput'), semanticEntryPoint: 'getByPlaceholder' },
          (page: Page) => markSemantic(page.getByPlaceholder(/short bio/i), 'getByPlaceholder'),
        ),
        css: css({ ...meta('settings.bioInput'), selector: '.settings-page textarea.form-control[name="bio"]' }),
        xpath: xpath({
          ...meta('settings.bioInput'),
          selector:
            '(//div[contains(concat(" ", normalize-space(@class), " "), " settings-page ")]//form//textarea[@name="bio"])[1]',
        }),
      }),
      submitButton: chooseStrategy(strategy, {
        'semantic-first': semanticNative(
          { ...meta('settings.submitButton'), semanticEntryPoint: 'getByRole' },
          (page: Page) => markSemantic(page.getByRole('button', { name: /update settings/i }).first(), 'getByRole'),
        ),
        css: css({ ...meta('settings.submitButton'), selector: 'form .btn.btn-primary.pull-xs-right' }),
        xpath: xpath({
          ...meta('settings.submitButton'),
          selector:
            '(//div[contains(concat(" ", normalize-space(@class), " "), " settings-page ")]//form[.//textarea[@name="bio"]]//button[contains(concat(" ", normalize-space(@class), " "), " btn-primary ")])[1]',
        }),
      }),
    },
  };
}

export function getReactRealWorldOracle() {
  return {
    nav: {
      navbar: oracleTestId(meta('nav.navbar'), 'navbar'),
      brandLink: oracleTestId(meta('nav.brandLink'), 'navbar-brand'),
      globalFeedTab: oracleTestId(meta('nav.globalFeedTab'), 'nav-link-global-feed'),
      profileLink: oracleTestId(meta('nav.profileLink'), 'nav-link-profile'),
    },
    auth: {
      title: oracleTestId(meta('auth.title'), 'auth-title'),
      emailInput: oracleTestId(meta('auth.emailInput'), 'auth-email-input'),
      usernameInput: oracleTestId(meta('auth.usernameInput'), 'auth-username-input'),
      passwordInput: oracleTestId(meta('auth.passwordInput'), 'auth-password-input'),
      submitButton: oracleTestId(meta('auth.submitButton'), 'auth-submit-button'),
    },
    home: {
      firstArticlePreview: oracleTestId(meta('home.firstArticlePreview'), 'article-preview-1'),
      firstReadMoreLink: oracleTestId(meta('home.firstReadMoreLink'), 'article-read-more-1'),
      previewDescription: oracle(
        { ...meta('home.previewDescription'), selector: "getByTestId('article-description')" },
        (preview: Locator) => preview.getByTestId('article-description'),
      ),
      paginationButton: oracle(
        { ...meta('home.paginationButton'), selector: "getByTestId('pagination-link-${pageNumber}')" },
        (page: Page, pageNumber: number) => page.getByTestId(`pagination-link-${pageNumber}`),
      ),
      paginationItem: oracle(
        { ...meta('home.paginationItem'), selector: "getByTestId('pagination-item-${pageNumber}')" },
        (page: Page, pageNumber: number) => page.getByTestId(`pagination-item-${pageNumber}`),
      ),
    },
    article: {
      page: oracleTestId(meta('article.page'), 'article-page'),
      title: oracleTestId(meta('article.title'), 'article-title'),
      titleText: oracleTestId(meta('article.titleText'), 'article-title'),
      favoriteButton: oracleTestId(meta('article.favoriteButton'), 'article-favorite-btn'),
      unfavoriteButton: oracleTestId(meta('article.unfavoriteButton'), 'article-unfavorite-btn'),
    },
    comments: {
      textarea: oracleTestId(meta('comments.textarea'), 'comment-textarea'),
      submitButton: oracleTestId(meta('comments.submitButton'), 'comment-submit-button'),
      cards: oracle(
        { ...meta('comments.cards'), selector: "getByTestId('comment-card')" },
        (page: Page) => page.getByTestId('comment-card'),
      ),
      cardById: oracleDynamicTestId(
        meta('comments.cardById'),
        'comment-card-${commentId}',
        (commentId: number) => `comment-card-${commentId}`,
      ),
      card: oracleDynamicTestId(
        meta('comments.card'),
        'comment-card-${commentId}',
        (commentId: number) => `comment-card-${commentId}`,
      ),
      deleteButton: oracleTestIdChain(
        meta('comments.deleteButton'),
        ['comment-delete-button'],
      ),
    },
    profile: {
      page: oracleTestId(meta('profile.page'), 'profile-page'),
      avatarImage: oracleTestId(meta('profile.avatarImage'), 'profile-user-img'),
      bio: oracleTestId(meta('profile.bio'), 'profile-bio'),
      followButton: oracleTestId(meta('profile.followButton'), 'profile-follow-btn'),
      unfollowButton: oracleTestId(meta('profile.unfollowButton'), 'profile-unfollow-btn'),
    },
    settings: {
      page: oracleTestId(meta('settings.page'), 'settings-page'),
      bioInput: oracleTestId(meta('settings.bioInput'), 'settings-bio-textarea'),
      submitButton: oracleTestId(meta('settings.submitButton'), 'settings-submit-button'),
    },
  };
}
