<script setup>
import { useI18n } from "vue-i18n";
import Navbar from "../components/Navbar.vue";
import Blog from "../components/Blog.vue";

const { t } = useI18n();
</script>

<template>
  <div class="blog-view">
    <Navbar />
    <main class="results-container">
      <Blog />
    </main>
  </div>
</template>

<style scoped>
.blog-view {
  background: white;
  min-height: 100vh;
}

.results-container {
  padding-top: 0;
}
</style>
