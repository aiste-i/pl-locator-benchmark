<template>
  <div class="home-page" data-testid="home-page">
    <div class="banner" data-testid="home-banner">
      <div class="container">
        <h1 class="logo-font" data-testid="home-logo">
          conduit
        </h1>
        <p data-testid="home-tagline">A place to share your knowledge.</p>
      </div>
    </div>

    <div class="container page">
      <div class="row">
        <div class="col-md-9" data-testid="article-list-container">
          <Suspense>
            <ArticlesList
              use-global-feed
              use-my-feed
              use-tag-feed
            />
            <template #fallback>
              <div data-testid="articles-loading">
                Articles are downloading...
              </div>
            </template>
          </Suspense>
        </div>

        <div class="col-md-3">
          <div class="sidebar" data-testid="home-sidebar">
            <Suspense>
              <PopularTags />
              <template #fallback>
                <div data-testid="tags-loading">
                  Popular tags are downloading...
                </div>
              </template>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ArticlesList from 'src/components/ArticlesList.vue'
import PopularTags from 'src/components/PopularTags.vue'
</script>
