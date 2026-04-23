<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const properties = ref([]);
const isLoading = ref(true);
const backendUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const fetchProperties = async () => {
  try {
    const res = await fetch(`${backendUrl}/properties`);
    const data = await res.json();
    // Filter for active or exclusive listings, sort by newest first, and limit to 3
    properties.value = data
      .filter((p) => p.status === "active" || p.status === "exclusive")
      .sort((a, b) => b.id - a.id)
      .slice(0, 3);
  } catch (err) {
    console.error("Failed to fetch properties", err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchProperties);
</script>

<template>
  <section class="portfolio">
    <div class="container">
      <div class="section-header">
        <div class="header-left">
          <span class="sub-label">{{ t("portfolio.label") }}</span>
          <h2 class="section-title">{{ t("portfolio.title") }}</h2>
        </div>
        <a href="#" class="view-all-link">
          {{ t("portfolio.viewAll") }}
          <span class="material-icons-outlined">arrow_forward</span>
        </a>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else class="property-grid">
        <div
          v-for="prop in properties"
          :key="prop.id"
          class="property-card"
          @click="$router.push(`/property/${prop.id}`)"
        >
          <div class="image-wrapper">
            <!-- Use first media if available, otherwise placeholder -->
            <img
              :alt="prop.title"
              :src="
                prop.media && prop.media.length > 0
                  ? prop.media.find((m) => m.is_thumbnail)?.url ||
                    prop.media[0].url
                  : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
              "
            />
            <div v-if="prop.status === 'exclusive'" class="badge">
              {{ t("portfolio.exclusive") }}
            </div>
            <div v-else-if="prop.status === 'sold'" class="badge sold">
              {{ t("property.sold") }}
            </div>
            <div v-else-if="prop.status === 'rented'" class="badge rented">
              {{ t("property.rented") }}
            </div>
            <div v-else-if="prop.status === 'active'" class="badge active">
              {{
                prop.listing_type === "buy"
                  ? t("property.forSale")
                  : t("property.forRent")
              }}
            </div>
          </div>
          <h3 class="card-title">{{ prop.title }}</h3>
          <p class="card-specs">
            {{ prop.details?.sqft }} m² • {{ prop.details?.bedrooms }}
            {{ t("hero.search.rooms") }}
          </p>
          <p class="card-price">
            €
            {{
              Number(prop.price).toLocaleString("de-DE", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })
            }}
          </p>
        </div>

        <!-- Static Fallback if no properties in DB -->
        <template v-if="properties.length === 0">
          <div class="property-card">
            <div class="image-wrapper">
              <img
                alt="Modern Parisian Apartment"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsyq_WjHR6tTCOh8TJWOMqXHHvoDXiAfhhtL-96w1GR6JWS8V1bs55lS2otsopiAIiUNnBgtWeAri_ddcX6j5cf-eZd8Wo_e1lTKqkOAidIfjKN2YkdB50LCelHX0XjZUtVvUzJTYrEc3pgndqslTMqeYZdyuJIUqc-AA800gT_T7zzMWWFn5IyMeRRVl6aN-y2WMMHSTDP9_NhySJM2r2ZZGlo_wa7ysk7nS41X0IIcSpcfcLi58lbRWNyvYVHeH3MhN7A3tU_-9m"
              />
              <div class="badge">{{ t("portfolio.exclusive") }}</div>
            </div>
            <h3 class="card-title">Avenue Montaigne</h3>
            <p class="card-specs">Paris 8th • 240 m² • 3 Bedrooms</p>
            <p class="card-price">€ 4,200,000</p>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.portfolio {
  padding: 5rem 0;
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
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 3rem;
}

.sub-label {
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 700;
  display: block;
  margin-bottom: 0.5rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  color: var(--primary);
  margin: 0;
}

.view-all-link {
  display: none;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  padding-bottom: 0.25rem;
  font-weight: 600;
  transition: border-color 0.2s;
}

@media (min-width: 768px) {
  .view-all-link {
    display: flex;
  }
}

.view-all-link:hover {
  border-color: var(--accent);
}

.view-all-link .material-icons-outlined {
  font-size: 0.875rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 42, 53, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .property-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.property-card {
  cursor: pointer;
}

.image-wrapper {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4/5;
  margin-bottom: 1rem;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s;
}

.property-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background-color: rgba(0, 42, 53, 0.9);
  color: var(--accent);
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  backdrop-filter: blur(4px);
}

.badge.sold {
  background-color: #ef4444;
  color: white;
}

.badge.rented {
  background-color: #0ea5e9;
  color: white;
}

.badge.active {
  background-color: var(--primary);
  color: var(--accent);
}

.card-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
  color: var(--primary);
  transition: color 0.2s;
}

.property-card:hover .card-title {
  color: var(--accent);
}

.card-specs {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.card-price {
  font-family: serif;
  font-style: italic;
  font-size: 1.125rem;
  color: var(--primary);
  margin: 0;
}
</style>
