<template>
  <footer data-testid="footer">
    <div class="container" data-testid="footer-container">
      <AppLink
        class="logo-font"
        name="global-feed"
        data-testid="footer-brand"
      >
        conduit
      </AppLink>
      <span class="attribution" data-testid="footer-attribution">
        An interactive learning project from <a href="https://thinkster.io" data-testid="footer-thinkster-link">Thinkster</a>. Code &amp; design licensed under MIT.
      </span>
    </div>
    <div class="container" data-testid="footer-container-extra">
      <span
        class="attribution"
        style="margin: 0"
        data-testid="footer-attribution-extra"
      >
        <a href="https://github.com/mutoe/vue3-realworld-example-app" data-testid="footer-repo-link">Real world app</a> implementation using Vue v3 with Typescript and Composition Api
      </span>
    </div>
  </footer>
</template>
