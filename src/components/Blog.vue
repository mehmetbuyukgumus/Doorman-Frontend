<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { t, locale } = useI18n();
const blogPosts = ref([]);
const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fetchBlogPosts = async () => {
  try {
    const res = await fetch(`${backendUrl}/blog-posts/`);
    if (res.ok) {
      blogPosts.value = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch blog posts:", err);
  }
};

const getLocalizedTitle = (post) => {
  return post[`title_${locale.value}`] || post.title_en;
};

const getLocalizedExcerpt = (post) => {
  return post[`excerpt_${locale.value}`] || post.excerpt_en;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString(
    locale.value === "tr" ? "tr-TR" : "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
};

onMounted(() => {
  fetchBlogPosts();
});
</script>

<template>
  <section class="blog">
    <div class="container">
      <div class="section-header">
        <span class="sub-label">{{ t("blog.label") }}</span>
        <h2 class="section-title">{{ t("blog.title") }}</h2>
        <div class="accent-line"></div>
      </div>

      <div class="article-grid">
        <article v-for="post in blogPosts" :key="post.id" class="article-card">
          <router-link
            :to="{ name: 'BlogDetail', params: { slug: post.slug } }"
            class="img-link"
          >
            <img
              :alt="getLocalizedTitle(post)"
              :src="
                post.image_url ||
                'https://via.placeholder.com/600x400?text=Doorman+Blog'
              "
            />
          </router-link>
          <div class="article-meta">
            <span>{{ t("blog.label") }}</span>
            <span class="dot"></span>
            <span>{{ formatDate(post.published_at) }}</span>
          </div>
          <h3 class="article-title">
            <router-link
              :to="{ name: 'BlogDetail', params: { slug: post.slug } }"
            >
              {{ getLocalizedTitle(post) }}
            </router-link>
          </h3>
          <p class="article-excerpt">
            {{ getLocalizedExcerpt(post) }}
          </p>
          <router-link
            :to="{ name: 'BlogDetail', params: { slug: post.slug } }"
            class="read-more"
          >
            {{ t("blog.readMore") }}
          </router-link>
        </article>

        <!-- Fallback if no posts exist -->
        <div v-if="blogPosts.length === 0" class="empty-blog">
          <p>Henüz blog yazısı eklenmemiş.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.blog {
  padding: 10rem 0 6rem 0;
  background-color: var(--background-light);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 640px) {
  .container {
    padding: 0 1.5rem;
  }
}
@media (min-width: 1024px) {
  .container {
    padding: 0 2rem;
  }
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.sub-label {
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 700;
  display: block;
  margin-bottom: 0.75rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  color: var(--primary);
  margin: 0;
}

.accent-line {
  width: 6rem;
  height: 1px;
  background-color: var(--accent);
  margin: 1.5rem auto 0;
}

.article-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
}

@media (min-width: 768px) {
  .article-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.article-card {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.img-link {
  overflow: hidden;
  margin-bottom: 1.5rem;
  display: block;
  aspect-ratio: 3/2;
}

.img-link img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s;
}

.article-card:hover .img-link img {
  transform: scale(1.05);
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.dot {
  width: 0.25rem;
  height: 0.25rem;
  background-color: var(--accent);
  border-radius: 9999px;
}

.article-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
}

.article-title a {
  color: var(--primary);
  text-decoration: none;
  transition: color 0.2s;
}

.article-card:hover .article-title a {
  color: var(--accent);
}

.article-excerpt {
  color: #4b5563;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.5;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.read-more {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-underline-offset: 4px;
  transition: color 0.2s;
}

.read-more:hover {
  color: var(--accent);
}

.empty-blog {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem;
  color: var(--primary);
  opacity: 0.6;
}
</style>
