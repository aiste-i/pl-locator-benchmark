import { APIRequestContext } from '@playwright/test';
import { API_BASE } from './config';

export interface UserCredentials {
  email: string;
  password: string;
  username: string;
}

export interface ApiUser {
  username: string;
  email: string;
  bio: string | null;
  image: string | null;
  token: string;
}

export interface PublicArticleSummary {
  slug: string;
  title: string;
  description: string;
  authorUsername: string;
}

export async function registerUserObjectViaAPI(request: APIRequestContext, user: UserCredentials): Promise<ApiUser> {
  const response = await request.post(`${API_BASE}/users`, {
    data: {
      user: {
        username: user.username,
        email: user.email,
        password: user.password,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to register user: ${response.status()}`);
  }
  const data = await response.json();
  return data.user;
}

export async function registerUserViaAPI(request: APIRequestContext, user: UserCredentials): Promise<string> {
  const registeredUser = await registerUserObjectViaAPI(request, user);
  return registeredUser.token;
}

export async function loginUserObjectViaAPI(request: APIRequestContext, email: string, password: string): Promise<ApiUser> {
  const response = await request.post(`${API_BASE}/users/login`, {
    data: {
      user: {
        email,
        password,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to login: ${response.status()}`);
  }
  const data = await response.json();
  return data.user;
}

export async function loginUserViaAPI(request: APIRequestContext, email: string, password: string): Promise<string> {
  const loggedInUser = await loginUserObjectViaAPI(request, email, password);
  return loggedInUser.token;
}

export async function createArticleViaAPI(
  request: APIRequestContext,
  token: string,
  article: { title: string; description: string; body: string; tagList?: string[] },
  waitOptions?: { timeoutMs?: number; intervalMs?: number },
): Promise<string> {
  const response = await request.post(`${API_BASE}/articles`, {
    headers: {
      Authorization: `Token ${token}`,
    },
    data: {
      article: {
        title: article.title,
        description: article.description,
        body: article.body,
        tagList: article.tagList || [],
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create article: ${response.status()}`);
  }
  const data = await response.json();
  const slug = data.article.slug;
  await waitForArticleViaAPI(request, slug, waitOptions);
  return slug;
}

export async function updateUserViaAPI(
  request: APIRequestContext,
  token: string,
  updates: { image?: string; bio?: string; username?: string; email?: string },
): Promise<void> {
  const response = await request.put(`${API_BASE}/user`, {
    headers: {
      Authorization: `Token ${token}`,
    },
    data: {
      user: updates,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to update user: ${response.status()}`);
  }
}

export async function createCommentViaAPI(
  request: APIRequestContext,
  token: string,
  articleSlug: string,
  body: string,
): Promise<number> {
  const response = await request.post(`${API_BASE}/articles/${articleSlug}/comments`, {
    headers: {
      Authorization: `Token ${token}`,
    },
    data: {
      comment: {
        body,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create comment: ${response.status()}`);
  }
  const data = await response.json();
  const commentId = data.comment.id;
  await waitForCommentViaAPI(request, articleSlug, commentId, token);
  return commentId;
}

export async function waitForArticleViaAPI(
  request: APIRequestContext,
  articleSlug: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/articles/${articleSlug}`);
    if (response.ok()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for article "${articleSlug}" to become available via API`);
}

export async function waitForCommentViaAPI(
  request: APIRequestContext,
  articleSlug: string,
  commentId: number,
  token?: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/articles/${articleSlug}/comments`, {
      headers: token ? {
        Authorization: `Token ${token}`,
      } : undefined,
    });
    if (response.ok()) {
      const data = await response.json();
      if (data.comments?.some((comment: { id?: number }) => comment.id === commentId)) {
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for comment ${commentId} on article "${articleSlug}" to become available via API`);
}

export async function waitForProfileViaAPI(
  request: APIRequestContext,
  username: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/profiles/${username}`);
    if (response.ok()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for profile "${username}" to become available via API`);
}

export async function getFirstPublicArticleSummary(request: APIRequestContext): Promise<PublicArticleSummary> {
  const response = await request.get(`${API_BASE}/articles?limit=1&offset=0`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch public articles: ${response.status()}`);
  }

  const data = await response.json();
  const article = data.articles?.[0];
  if (!article?.slug || !article?.title || !article?.author?.username) {
    throw new Error('Public articles feed did not return a usable article');
  }

  return {
    slug: article.slug,
    title: article.title,
    description: article.description ?? '',
    authorUsername: article.author.username,
  };
}

export async function waitForAuthorArticleCountViaAPI(
  request: APIRequestContext,
  username: string,
  minimumCount: number,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/articles?author=${encodeURIComponent(username)}&limit=1&offset=0`);
    if (response.ok()) {
      const data = await response.json();
      if ((data.articlesCount ?? 0) >= minimumCount) {
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for author "${username}" to reach ${minimumCount} visible articles via API`);
}

export async function waitForTagArticleCountViaAPI(
  request: APIRequestContext,
  tag: string,
  minimumCount: number,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE}/articles?tag=${encodeURIComponent(tag)}&limit=1&offset=0`);
    if (response.ok()) {
      const data = await response.json();
      if ((data.articlesCount ?? 0) >= minimumCount) {
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for tag "${tag}" to reach ${minimumCount} visible articles via API`);
}

export async function createManyArticles(
  request: APIRequestContext,
  token: string,
  count: number,
  tag: string = 'paginationtest',
): Promise<string[]> {
  const slugs: string[] = [];
  const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
  for (let i = 0; i < count; i++) {
    const slug = await createArticleViaAPI(request, token, {
      title: `Test Article ${uniqueId} Number ${i}`,
      description: `Description for test article ${i}`,
      body: `Body content for test article ${i}. Created with ID ${uniqueId}.`,
      tagList: [tag],
    });
    slugs.push(slug);
    // Small pause between articles to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return slugs;
}
