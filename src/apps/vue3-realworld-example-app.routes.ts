import type { AppPathBuilder } from './types';

export const vue3RealWorldPaths: AppPathBuilder = {
  home: () => '/#/',
  login: () => '/#/login',
  register: () => '/#/register',
  settings: () => '/#/settings',
  editor: (slug?: string) => (slug ? `/#/article/${slug}/edit` : '/#/article/create'),
  article: (slug: string) => `/#/article/${slug}`,
  profile: (username: string) => `/#/profile/${username}`,
  profileFavorites: (username: string) => `/#/profile/${username}/favorites`,
  tag: (tag: string, page?: number) => {
    const path = `/#/tag/${tag}`;
    return page && page > 1 ? `${path}?page=${page}` : path;
  },
  followingFeed: () => '/#/my-feeds',
};
