<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useContact } from "../services/contactService";
import Navbar from "../components/Navbar.vue";

const { t, locale } = useI18n();
const { openContact } = useContact();
const route = useRoute();
const router = useRouter();
const property = ref(null);

const handleInquiry = () => {
  if (property.value) {
    openContact(property.value);
  }
};
const isLoading = ref(true);
const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

const localizedDescription = computed(() => {
  if (!property.value || !property.value.details) return "";
  const details = property.value.details;

  // Try to find description in current language
  if (locale.value === "en" && details.description_en)
    return details.description_en;
  if (locale.value === "fr" && details.description_fr)
    return details.description_fr;
  if (locale.value === "tr" && details.description_tr)
    return details.description_tr;

  // Fallback to main description or any available description
  return (
    details.description ||
    details.description_en ||
    details.description_fr ||
    details.description_tr ||
    "No description available."
  );
});

const getAssetUrl = (name) => {
  return new URL(`../assets/transport_public/${name}.png`, import.meta.url)
    .href;
};

const transportGroups = computed(() => {
  if (!property.value?.details?.transport_info) return [];

  const items = property.value.details.transport_info
    .split(", ")
    .filter((l) => l);
  const map = new Map();

  items.forEach((item) => {
    const lower = item.toLowerCase();
    let category = "";
    if (lower.includes("metro")) category = "metro";
    else if (lower.includes("rer")) category = "rer";
    else if (lower.includes("train")) category = "train";
    else if (lower.includes("tram")) category = "tram";

    if (category) {
      if (!map.has(category)) map.set(category, new Set());
      const specific = lower.replace(/\s+/g, "");
      if (specific !== category) {
        map.get(category).add(specific);
      }
    }
  });

  return Array.from(map.entries()).map(([category, lines]) => ({
    category,
    categoryIcon: getAssetUrl(category),
    lineIcons: Array.from(lines).map((l) => getAssetUrl(l)),
  }));
});
const formattedFloor = computed(() => {
  const details = property.value?.details;
  if (!details || details.floor === null) return null;

  const floor = details.floor;
  const total = details.total_floors;

  // Ground Floor
  if (floor === 0) return t("property.groundFloor");

  // Top Floor (if total exists and floor matches)
  if (total && floor === total) return t("property.topFloor");

  // X of Y
  if (total) {
    return t("property.floorOf", { floor, total });
  }

  // Fallback
  return floor;
});

const mapUrl = computed(() => {
  const details = property.value?.details;
  if (!details || details.lat == null || details.lng == null) return null;

  const lat = parseFloat(details.lat);
  const lng = parseFloat(details.lng);
  // Slightly wider area to not show the exact building too clearly
  const zoom = 0.008;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - zoom}%2C${lat - zoom}%2C${lng + zoom}%2C${lat + zoom}&layer=mapnik`;
});

const formattedAvailability = computed(() => {
  const dateStr = property.value?.details?.available_date;
  if (!dateStr || dateStr.trim() === "") {
    return t("property.availableNow");
  }
  return t("property.availableFrom", { date: dateStr.trim() });
});

const activeImageIndex = ref(0);
const isLightboxOpen = ref(false);
const lightboxIndex = ref(0);

const openLightbox = (index) => {
  lightboxIndex.value = index;
  isLightboxOpen.value = true;
  document.body.style.overflow = "hidden"; // Prevent scrolling
};

const closeLightbox = () => {
  isLightboxOpen.value = false;
  document.body.style.overflow = "auto";
};

const nextImage = (e) => {
  if (e) e.stopPropagation();
  if (property.value.media && property.value.media.length > 0) {
    lightboxIndex.value =
      (lightboxIndex.value + 1) % property.value.media.length;
  }
};

const prevImage = (e) => {
  if (e) e.stopPropagation();
  if (property.value.media && property.value.media.length > 0) {
    lightboxIndex.value =
      (lightboxIndex.value - 1 + property.value.media.length) %
      property.value.media.length;
  }
};

// Keyboard support
const handleKeydown = (e) => {
  if (!isLightboxOpen.value) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") nextImage();
  if (e.key === "ArrowLeft") prevImage();
};

const fetchProperty = async () => {
  try {
    const res = await fetch(`${backendUrl}/properties/${route.params.id}`);
    if (!res.ok) throw new Error("Property not found");
    property.value = await res.json();

    // Set thumbnail as active image if marked
    const thumbIdx = property.value.media?.findIndex((m) => m.is_thumbnail);
    if (thumbIdx !== -1) activeImageIndex.value = thumbIdx;
  } catch (err) {
    console.error(err);
    router.push("/");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchProperty();
  window.addEventListener("keydown", handleKeydown);
});

import { onUnmounted } from "vue";
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = "auto";
});
</script>

<template>
  <div class="property-detail">
    <Navbar />

    <main v-if="property" class="detail-container">
      <div class="detail-grid">
        <!-- Image Section -->
        <div class="image-section">
          <div class="main-image">
            <img
              :src="
                property.media?.length
                  ? property.media[activeImageIndex].url
                  : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200'
              "
              :alt="property.title"
              @click="openLightbox(activeImageIndex)"
              class="clickable-image"
            />
            <div v-if="property.status === 'sold'" class="status-overlay sold">
              {{ t("property.sold") }}
            </div>
            <div
              v-else-if="property.status === 'rented'"
              class="status-overlay rented"
            >
              {{ t("property.rented") }}
            </div>
            <div
              v-else-if="property.status === 'active'"
              class="status-overlay active"
            >
              {{
                property.listing_type === "buy"
                  ? t("property.forSale")
                  : t("property.forRent")
              }}
            </div>
          </div>
          <div v-if="property.media?.length > 1" class="thumbnail-grid">
            <div
              v-for="(img, idx) in property.media"
              :key="idx"
              class="thumb"
              @click="openLightbox(idx)"
            >
              <img :src="img.url" alt="Gallery image" />
            </div>
          </div>
        </div>

        <!-- Info Section -->
        <div class="info-section">
          <div class="breadcrumb">
            <router-link to="/">{{ t("portfolio.title") }}</router-link> /
            {{ property.title }}
          </div>

          <div class="title-row">
            <h1 class="property-title">{{ property.title }}</h1>
          </div>

          <div class="price-section">
            <span class="price-type-label">{{
              property.status === "sold"
                ? t("property.sold")
                : property.status === "rented"
                  ? t("property.rented")
                  : property.listing_type === "buy"
                    ? t("property.forSale")
                    : t("property.forRent")
            }}</span>
            <div class="price-display">
              <span class="currency-symbol">€</span>
              <span class="price-amount">{{
                Number(property.price)
                  .toFixed(0)
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
              }}</span>
            </div>
          </div>

          <div class="specs-grid">
            <div class="spec-item">
              <span class="material-icons-outlined">square_foot</span>
              <div>
                <label>{{ t("hero.search.maxArea") }}</label>
                <span>{{ property.details?.sqft }} m²</span>
              </div>
            </div>
            <div class="spec-item">
              <span class="material-icons-outlined">bed</span>
              <div>
                <label>{{ t("hero.search.rooms") }}</label>
                <span>{{
                  t("property.rooms", { n: property.details?.bedrooms })
                }}</span>
              </div>
            </div>
            <div class="spec-item">
              <span class="material-icons-outlined">bathtub</span>
              <div>
                <label>{{ t("property.bathrooms") }}</label>
                <span>{{ property.details?.bathrooms }}</span>
              </div>
            </div>
            <div class="spec-item" v-if="formattedFloor">
              <span class="material-icons-outlined">layers</span>
              <div>
                <label>{{ t("property.floor") }}</label>
                <span>{{ formattedFloor }}</span>
              </div>
            </div>
            <div class="spec-item">
              <span class="material-icons-outlined">event_available</span>
              <div>
                <label>{{ t("property.availability") }}</label>
                <span>{{ formattedAvailability }}</span>
              </div>
            </div>
          </div>

          <!-- Feature Icons -->
          <div class="features-list">
            <div
              v-if="property.details?.energy_class"
              class="feature-tag dpe"
              :class="property.details.energy_class"
            >
              <span class="material-icons-outlined">bolt</span>
              DPE: {{ property.details.energy_class }}
            </div>
            <div v-if="property.details?.has_parking" class="feature-tag">
              <span class="material-icons-outlined">local_parking</span>
              {{ t("property.parking") }}
            </div>
            <div v-if="property.details?.has_balcony" class="feature-tag">
              <span class="material-icons-outlined">balcony</span>
              {{ t("property.balcony") }}
            </div>
            <div v-if="property.details?.has_cave" class="feature-tag">
              <span class="material-icons-outlined">inventory_2</span>
              {{ t("property.cave") }}
            </div>
            <div v-if="property.details?.has_elevator" class="feature-tag">
              <span class="material-icons-outlined">elevator</span>
              {{ t("property.elevator") }}
            </div>
          </div>

          <!-- Transport Logos Section -->
          <div v-if="transportGroups.length > 0" class="transport-section">
            <h3>{{ t("property.transport") }}</h3>
            <div class="transport-list">
              <div
                v-for="group in transportGroups"
                :key="group.category"
                class="transport-group"
              >
                <!-- Main Category Icon (Metro, RER, etc.) -->
                <img
                  :src="group.categoryIcon"
                  :alt="group.category"
                  class="category-icon"
                  @error="(e) => (e.target.style.display = 'none')"
                />
                <!-- Specific Line Icons (1, 2, A, B, etc.) -->
                <img
                  v-for="iconUrl in group.lineIcons"
                  :key="iconUrl"
                  :src="iconUrl"
                  class="line-icon"
                  @error="(e) => (e.target.style.display = 'none')"
                />
              </div>
            </div>
          </div>

          <div class="description-box">
            <h3>{{ t("property.description") }}</h3>
            <p>
              {{ localizedDescription }}
            </p>
          </div>

          <!-- Mini Map -->
          <div v-if="mapUrl" class="map-section">
            <h3>{{ t("property.location") }}</h3>
            <div class="mini-map">
              <iframe
                width="100%"
                height="250"
                frameborder="0"
                scrolling="no"
                marginheight="0"
                marginwidth="0"
                :src="mapUrl"
              ></iframe>
              <div class="map-privacy-circle"></div>
            </div>
          </div>

          <button
            class="contact-btn"
            @click="handleInquiry"
            :disabled="property.status !== 'active'"
            :class="{ disabled: property.status !== 'active' }"
          >
            {{
              property.status === "active"
                ? t("property.contactBtn")
                : property.status === "sold"
                  ? "SOLD"
                  : "RENTED"
            }}
          </button>
        </div>
      </div>
    </main>

    <div v-else-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>

    <!-- Lightbox Modal -->
    <Transition name="fade">
      <div v-if="isLightboxOpen" class="lightbox" @click="closeLightbox">
        <button class="lightbox-close" @click="closeLightbox">
          <span class="material-icons-outlined">close</span>
        </button>

        <button
          v-if="property.media?.length > 1"
          class="lightbox-nav prev"
          @click.stop="prevImage"
        >
          <span class="material-icons-outlined">chevron_left</span>
        </button>

        <div class="lightbox-content" @click.stop>
          <img :src="property.media[lightboxIndex].url" :alt="property.title" />
          <div class="lightbox-caption">
            <span>{{ property.title }}</span>
            <span class="counter"
              >{{ lightboxIndex + 1 }} / {{ property.media.length }}</span
            >
          </div>
        </div>

        <button
          v-if="property.media?.length > 1"
          class="lightbox-nav next"
          @click.stop="nextImage"
        >
          <span class="material-icons-outlined">chevron_right</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.property-detail {
  background-color: var(--background-light);
  min-height: 100vh;
}

.detail-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8rem 2rem 4rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4rem;
}

@media (min-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1.5fr 1fr;
  }
}

/* Image Styles */
.image-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-image {
  aspect-ratio: 16/10;
  overflow: hidden;
  border-radius: 4px;
}

.main-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.thumb {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 2px;
  cursor: pointer;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.thumb:hover img {
  transform: scale(1.05);
}

/* Info Styles */
.breadcrumb {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9ca3af;
  margin-bottom: 2rem;
}

.breadcrumb a {
  color: inherit;
  text-decoration: none;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 0.5rem;
}

.property-title {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--primary);
  margin: 0;
}

.feature-tag.dpe {
  color: white;
  border: none;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.feature-tag.dpe .material-icons-outlined {
  color: white;
  font-size: 1.1rem;
}

.feature-tag.dpe.A {
  background: #008066;
}
.feature-tag.dpe.B {
  background: #339933;
}
.feature-tag.dpe.C {
  background: #99cc33;
}
.feature-tag.dpe.D {
  background: #ffcc33;
}
.feature-tag.dpe.E {
  background: #ff9933;
}
.feature-tag.dpe.F {
  background: #ff6633;
}
.feature-tag.dpe.G {
  background: #ff3333;
}

.property-address {
  font-size: 1.1rem;
  color: #6b7280;
  margin-bottom: 2rem;
}

.price-section {
  margin-bottom: 3rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.price-type-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 700;
  color: #9ca3af;
  margin-bottom: 0.75rem;
}

.price-display {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--primary);
}

.currency-symbol {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 500;
  color: #6b7280;
}

.price-amount {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
}

.spec-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.spec-item .material-icons-outlined {
  color: var(--accent);
  font-size: 1.5rem;
}

.spec-item label {
  display: block;
  font-size: 0.6rem;
  text-transform: uppercase;
  font-weight: 700;
  color: #9ca3af;
}

.spec-item span {
  font-weight: 600;
  color: var(--primary);
}

.features-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 3rem;
}

.feature-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--primary);
  font-weight: 600;
}

.feature-tag .material-icons-outlined {
  font-size: 1.1rem;
  color: var(--accent);
}

.transport-section {
  margin-top: 2rem;
  margin-bottom: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-light);
}

.transport-section h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  margin-bottom: 2rem;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
}

.transport-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
}

.transport-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.transport-group img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.description-box h3,
.map-section h3 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--primary);
}

.description-box p {
  line-height: 1.8;
  color: #4b5563;
  margin-bottom: 3rem;
}

.map-section {
  margin-bottom: 3rem;
}

.mini-map {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  background: #f3f4f6;
  height: 250px;
}

.map-privacy-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  background: rgba(0, 42, 53, 0.1);
  border: 2px solid var(--primary);
  border-radius: 50%;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.contact-btn {
  width: 100%;
  background-color: var(--primary);
  color: var(--accent);
  padding: 1.25rem;
  border: none;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    transform 0.2s,
    background-color 0.2s;
}

.contact-btn.disabled {
  background-color: #9ca3af;
  color: white;
  cursor: not-allowed;
  transform: none;
}

.contact-btn:not(.disabled):hover {
  background-color: #003a4a;
  transform: translateY(-2px);
}

.main-image {
  position: relative;
  aspect-ratio: 16/10;
  overflow: hidden;
  border-radius: 4px;
}

.status-overlay {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  padding: 0.5rem 1.5rem;
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  color: white;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.status-overlay.sold {
  background-color: #ef4444;
}

.status-overlay.rented {
  background-color: #0ea5e9;
}

.status-overlay.active {
  background-color: var(--primary);
  color: var(--accent);
}

.loading-state {
  height: 60vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(0, 42, 53, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.clickable-image {
  cursor: pointer;
  transition: transform 0.3s;
}

.clickable-image:hover {
  transform: scale(1.02);
}

/* Lightbox Styles */
.lightbox {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 28, 36, 0.98); /* Deep dark theme */
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.lightbox-content {
  position: relative;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lightbox-content img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.lightbox-caption {
  display: flex;
  justify-content: space-between;
  color: white;
  font-family: var(--font-display);
  font-size: 1.1rem;
  padding: 0 0.5rem;
}

.lightbox-caption .counter {
  color: var(--accent);
  font-family: inherit;
  font-weight: 700;
}

.lightbox-close {
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  z-index: 10001;
}

.lightbox-close .material-icons-outlined {
  font-size: 2.5rem;
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 10000;
}

.lightbox-nav:hover {
  background: var(--accent);
  color: var(--primary);
}

.lightbox-nav.prev {
  left: 2rem;
}
.lightbox-nav.next {
  right: 2rem;
}

.lightbox-nav .material-icons-outlined {
  font-size: 2.5rem;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
