import type { Locator, Page } from '@playwright/test';

export type SemanticLocator = Locator & { semanticEntryPoint?: string };
export type RawLocatorFactory<TArgs extends any[] = any[]> = (...args: TArgs) => SemanticLocator;

export interface RealWorldNavLocators {
  navbar(page: Page): SemanticLocator;
  brandLink(page: Page): SemanticLocator;
  homeLink(page: Page): SemanticLocator;
  loginLink(page: Page): SemanticLocator;
  registerLink(page: Page): SemanticLocator;
  editorLink(page: Page): SemanticLocator;
  settingsLink(page: Page): SemanticLocator;
  profileLink(page: Page, username: string): SemanticLocator;
  globalFeedTab(page: Page): SemanticLocator;
  yourFeedTab(page: Page): SemanticLocator;
  tagFeedTab(page: Page, tag: string): SemanticLocator;
}

export interface RealWorldAuthLocators {
  title(page: Page): SemanticLocator;
  usernameInput(page: Page): SemanticLocator;
  emailInput(page: Page): SemanticLocator;
  emailLabelInput(page: Page): SemanticLocator;
  passwordInput(page: Page): SemanticLocator;
  submitButton(page: Page): SemanticLocator;
  errorList(page: Page): SemanticLocator;
  switchLink(page: Page): SemanticLocator;
}

export interface RealWorldHomeLocators {
  banner(page: Page): SemanticLocator;
  sidebar(page: Page): SemanticLocator;
  tagList(page: Page): SemanticLocator;
  tagItem(page: Page, tag: string): SemanticLocator;
  firstTag(page: Page): SemanticLocator;
  articlePreviewList(page: Page): SemanticLocator;
  articlePreview(page: Page, title: string): SemanticLocator;
  firstArticlePreview(page: Page): SemanticLocator;
  firstReadMoreLink(page: Page): SemanticLocator;
  previewTitle(preview: Locator): SemanticLocator;
  previewDescription(preview: Locator): SemanticLocator;
  previewAuthor(preview: Locator): SemanticLocator;
  previewTag(preview: Locator, tag: string): SemanticLocator;
  paginationButton(page: Page, pageNumber: number): SemanticLocator;
  paginationItem(page: Page, pageNumber: number): SemanticLocator;
  emptyFeedMessage(page: Page): SemanticLocator;
}

export interface RealWorldEditorLocators {
  titleInput(page: Page): SemanticLocator;
  descriptionInput(page: Page): SemanticLocator;
  bodyInput(page: Page): SemanticLocator;
  tagInput(page: Page): SemanticLocator;
  tagList(page: Page): SemanticLocator;
  tagRemoveButtons(page: Page): SemanticLocator;
  publishButton(page: Page): SemanticLocator;
  errorList(page: Page): SemanticLocator;
}

export interface RealWorldArticleLocators {
  page(page: Page): SemanticLocator;
  title(page: Page): SemanticLocator;
  titleText(page: Page, title: string): SemanticLocator;
  content(page: Page): SemanticLocator;
  body(page: Page): SemanticLocator;
  tagList(page: Page): SemanticLocator;
  tag(page: Page, tag: string): SemanticLocator;
  favoriteButton(page: Page): SemanticLocator;
  unfavoriteButton(page: Page): SemanticLocator;
  deleteButton(page: Page): SemanticLocator;
  editButton(page: Page): SemanticLocator;
  followButton(page: Page): SemanticLocator;
  authorLink(page: Page, username?: string): SemanticLocator;
}

export interface RealWorldCommentLocators {
  form(page: Page): SemanticLocator;
  textarea(page: Page): SemanticLocator;
  submitButton(page: Page): SemanticLocator;
  list(page: Page): SemanticLocator;
  card(page: Page, commentText: string): SemanticLocator;
  firstCard(page: Page): SemanticLocator;
  deleteButton(commentRoot: Locator): SemanticLocator;
  authMessage(page: Page): SemanticLocator;
  loginLink(page: Page): SemanticLocator;
  registerLink(page: Page): SemanticLocator;
  errorList(page: Page): SemanticLocator;
}

export interface RealWorldProfileLocators {
  page(page: Page): SemanticLocator;
  userInfo(page: Page): SemanticLocator;
  avatarImage(page: Page, username: string): SemanticLocator;
  username(page: Page): SemanticLocator;
  bio(page: Page): SemanticLocator;
  followButton(page: Page): SemanticLocator;
  unfollowButton(page: Page): SemanticLocator;
  editButton(page: Page): SemanticLocator;
  myPostsTab(page: Page): SemanticLocator;
  favoritedPostsTab(page: Page): SemanticLocator;
  articleList(page: Page): SemanticLocator;
}

export interface RealWorldSettingsLocators {
  page(page: Page): SemanticLocator;
  imageInput(page: Page): SemanticLocator;
  usernameInput(page: Page): SemanticLocator;
  bioInput(page: Page): SemanticLocator;
  emailInput(page: Page): SemanticLocator;
  passwordInput(page: Page): SemanticLocator;
  submitButton(page: Page): SemanticLocator;
  logoutButton(page: Page): SemanticLocator;
  errorList(page: Page): SemanticLocator;
}

export interface RealWorldFeedbackLocators {
  errorList(page: Page): SemanticLocator;
  connectingText(page: Page): SemanticLocator;
}

export interface RealWorldLocators {
  nav: RealWorldNavLocators;
  auth: RealWorldAuthLocators;
  home: RealWorldHomeLocators;
  editor: RealWorldEditorLocators;
  article: RealWorldArticleLocators;
  comments: RealWorldCommentLocators;
  profile: RealWorldProfileLocators;
  settings: RealWorldSettingsLocators;
  feedback: RealWorldFeedbackLocators;
}

export type RealWorldOracleLocators = RealWorldLocators;
