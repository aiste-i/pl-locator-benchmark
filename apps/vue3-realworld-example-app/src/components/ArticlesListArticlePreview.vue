<template>
  <div data-testid="article-preview">
    <div
      class="article-preview"
      role="article"
      :aria-label="`Article preview: ${article.title}`"
      :data-testid="`article-preview-${previewIndex}`"
    >
      <div class="article-meta">
        <AppLink
          name="profile"
          :params="{ username: props.article.author.username }"
          data-testid="article-author-link"
        >
          <img :alt="props.article.author.username" :src="article.author.image" data-testid="article-author-img">
        </AppLink>
        <div class="info">
          <AppLink
            class="author"
            name="profile"
            :params="{ username: props.article.author.username }"
            data-testid="article-author-name"
          >
            {{ article.author.username }}
          </AppLink>
          <span class="date" data-testid="article-date">{{ new Date(article.createdAt).toDateString() }}</span>
        </div>
        <button
          class="btn btn-sm pull-xs-right"
          :class="[article.favorited ? 'btn-primary' : 'btn-outline-primary']"
          :aria-label="article.favorited ? 'Unfavorite article' : 'Favorite article'"
          :disabled="favoriteProcessGoing"
          @click="() => favoriteArticle()"
          :data-testid="article.favorited ? 'article-unfavorite-btn' : 'article-favorite-btn'"
        >
          <i class="ion-heart" /> {{ article.favoritesCount }}
        </button>
      </div>

      <AppLink
        class="preview-link"
        name="article"
        :params="{ slug: props.article.slug }"
        :aria-label="`Read more about ${article.title}`"
        data-testid="article-link"
      >
        <h1 data-testid="article-title">{{ article.title }}</h1>
        <p role="note" aria-label="Article preview description" data-testid="article-description">{{ article.description }}</p>
        <span :data-testid="`article-read-more-${previewIndex}`">Read more...</span>
        <ul class="tag-list" data-testid="article-tag-list">
          <li
            v-for="tag in article.tagList"
            :key="tag"
            class="tag-default tag-pill tag-outline"
            data-testid="article-tag-item"
          >
            {{ tag }}
          </li>
        </ul>
      </AppLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFavoriteArticle } from 'src/composable/use-favorite-article'
import type { Article } from 'src/services/api'

interface Props {
  article: Article
  previewIndex: number
}
interface Emits {
  (e: 'update', article: Article): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const {
  favoriteProcessGoing,
  favoriteArticle,
} = useFavoriteArticle({
  isFavorited: computed(() => props.article.favorited),
  articleSlug: computed(() => props.article.slug),
  onUpdate: (newArticle: Article): void => emit('update', newArticle),
})
</script>
