<template>
  <ArticlesListNavigation
    v-bind="$attrs"
    :tag="tag"
    :username="username"
  />

  <div
    v-if="articlesDownloading"
    class="article-preview"
    data-testid="articles-loading"
  >
    Articles are downloading...
  </div>

  <div
    v-else-if="articles.length === 0"
    class="article-preview"
    data-testid="article-list-empty"
  >
    No articles are here... yet.
  </div>

  <template v-else>
    <div class="article-list" data-testid="article-list">
      <ArticlesListArticlePreview
        v-for="(article, index) in articles"
        :key="article.slug"
        :article="article"
        :preview-index="index + 1"
        @update="newArticle => updateArticle(index, newArticle)"
        data-testid="article-preview"
      />
    </div>

    <AppPagination
      :count="articlesCount"
      :page="page"
      @page-change="changePage"
      data-testid="pagination"
    />
  </template>
</template>

<script setup lang="ts">
import { useArticles } from 'src/composable/use-articles'
import AppPagination from './AppPagination.vue'
import ArticlesListArticlePreview from './ArticlesListArticlePreview.vue'
import ArticlesListNavigation from './ArticlesListNavigation.vue'

const {
  fetchArticles,
  articlesDownloading,
  articlesCount,
  articles,
  updateArticle,
  page,
  changePage,
  tag,
  username,
} = useArticles()

await fetchArticles()
</script>
