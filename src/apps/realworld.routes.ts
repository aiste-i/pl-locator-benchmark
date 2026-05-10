import type { AppPathBuilder } from './types';

export const realworldPaths: AppPathBuilder = {
  home: () => '/',
  login: () => '/login',
  register: () => '/register',
  settings: () => '/settings',
  editor: (slug?: string) => (slug ? `/editor/${slug}` : '/editor'),
  article: (slug: string) => `/article/${slug}`,
  profile: (username: string) => `/profile/@${username}`,
  profileFavorites: (username: string) => `/profile/@${username}/favorites`,
  tag: (tag: string, page?: number) => {
    const params = new URLSearchParams({ tag });
    if (page && page > 1) params.set('page', String(page));
    return `/?${params.toString()}`;
  },
  followingFeed: (page?: number) => {
    const params = new URLSearchParams({ tab: 'feed' });
    if (page && page > 1) params.set('page', String(page));
    return `/?${params.toString()}`;
  },
};
