import type { AppPathBuilder } from './types';

export const angularRealWorldPaths: AppPathBuilder = {
  home: () => '/',
  login: () => '/login',
  register: () => '/register',
  settings: () => '/settings',
  editor: (slug?: string) => (slug ? `/editor/${slug}` : '/editor'),
  article: (slug: string) => `/article/${slug}`,
  profile: (username: string) => `/profile/${username}`,
  profileFavorites: (username: string) => `/profile/${username}/favorites`,
  tag: (tag: string, page?: number) => (page && page > 1 ? `/tag/${tag}?page=${page}` : `/tag/${tag}`),
  followingFeed: (page?: number) => (page && page > 1 ? `/?feed=following&page=${page}` : '/?feed=following'),
};
