<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import Navbar from "../components/Navbar.vue";

const route = useRoute();
const { t, locale } = useI18n();
const post = ref(null);
const isLoading = ref(true);
const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fetchPost = async () => {
  try {
    // We can fetch by ID from admin if we had it, but for public we can filter by slug
    // Let's assume we fetch all and find by slug for now, or use a dedicated slug endpoint
    const res = await fetch(`${backendUrl}/blog-posts/`);
    if (res.ok) {
      const posts = await res.json();
      post.value = posts.find((p) => p.slug === route.params.slug);
    }
  } catch (err) {
    console.error("Failed to fetch post:", err);
  } finally {
    isLoading.value = false;
  }
};

const localizedTitle = computed(() => {
  if (!post.value) return "";
  return post.value[`title_${locale.value}`] || post.value.title_en;
});

const localizedContent = computed(() => {
  if (!post.value) return "";
  return post.value[`content_${locale.value}`] || post.value.content_en;
});

const formattedDate = computed(() => {
  if (!post.value) return "";
  return new Date(post.value.published_at).toLocaleDateString(
    locale.value === "tr" ? "tr-TR" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
});

onMounted(() => {
  fetchPost();
});
</script>

<template>
  <div class="blog-detail-view">
    <Navbar />

    <main v-if="post" class="post-content-wrapper">
      <div class="container">
        <div class="post-header">
          <router-link :to="{ name: 'Blog' }" class="back-link">
            <span class="material-icons-outlined">arrow_back</span>
            {{ t("blog.label") }}
          </router-link>

          <h1 class="post-title">{{ localizedTitle }}</h1>

          <div class="post-meta">
            <div class="author-info" v-if="post.author">
              <span class="material-icons-outlined">person</span>
              {{ post.author.full_name || post.author.email }}
            </div>
            <div class="date-info">
              <span class="material-icons-outlined">calendar_today</span>
              {{ formattedDate }}
            </div>
          </div>
        </div>

        <div v-if="post.image_url" class="featured-image">
          <img :src="post.image_url" :alt="localizedTitle" />
        </div>

        <div class="post-body ql-editor" v-html="localizedContent"></div>
      </div>
    </main>

    <div v-else-if="isLoading" class="loading-state">
      <div class="loader"></div>
    </div>

    <div v-else class="not-found">
      <div class="container">
        <h2>Post Not Found</h2>
        <router-link :to="{ name: 'Blog' }">Back to Blog</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blog-detail-view {
  background: white;
  min-height: 100vh;
}

.post-content-wrapper {
  padding-top: 10rem;
  padding-bottom: 6rem;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 2rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.back-link:hover {
  opacity: 1;
}

.post-title {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--primary);
  line-height: 1.2;
  margin-bottom: 1.5rem;
}

.post-meta {
  display: flex;
  gap: 2rem;
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 3rem;
}

.post-meta div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.post-meta .material-icons-outlined {
  font-size: 1.125rem;
  color: var(--accent);
}

.featured-image {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 3rem;
}

.featured-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-body {
  font-size: 1.125rem;
  line-height: 1.8;
  color: #374151;
  font-weight: 300;
}

/* Typography for Quill Content */
.post-body :deep(h1),
.post-body :deep(h2),
.post-body :deep(h3) {
  font-family: var(--font-display);
  color: var(--primary);
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.post-body :deep(p) {
  margin-bottom: 1.5rem;
}

.post-body :deep(ul),
.post-body :deep(ol) {
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.post-body :deep(li) {
  margin-bottom: 0.5rem;
}

.post-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 2rem 0;
}

.post-body :deep(blockquote) {
  border-left: 4px solid var(--accent);
  padding-left: 1.5rem;
  font-style: italic;
  margin: 2rem 0;
  color: #6b7280;
}

.loading-state,
.not-found {
  padding-top: 10rem;
  text-align: center;
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid var(--background-light);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .post-title {
    font-size: 2.25rem;
  }
}
</style>
