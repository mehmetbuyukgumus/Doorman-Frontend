<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import Navbar from "../components/Navbar.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const properties = ref([]);
const isLoading = ref(true);
const backendUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const dynamicOptions = ref({
  neighborhoods: [],
  types: [],
});

const activeListingType = ref(route.query.listing_type || "buy");
const searchFilters = ref({
  location: route.query.location || "",
  rooms: route.query.rooms || "Stüdyo",
  maxPrice: route.query.max_price || "",
});

const openDropdown = ref(null);

const toggleDropdown = (name) => {
  openDropdown.value = openDropdown.value === name ? null : name;
};

const closeDropdown = () => {
  openDropdown.value = null;
};

const locationOptions = computed(() => {
  const options = ["Paris"];
  const parisArrondissements = Array.from({ length: 20 }, (_, i) => `Paris ${i + 1}`);
  
  options.push(...parisArrondissements);
  
  if (dynamicOptions.value.neighborhoods) {
    options.push(...dynamicOptions.value.neighborhoods);
  }
  
  return [...new Set(options)];
});

const filteredLocationOptions = computed(() => {
  if (!searchFilters.value.location) return [];
  const searchTerm = searchFilters.value.location.toLowerCase();
  return locationOptions.value.filter(loc => loc.toLowerCase().includes(searchTerm));
});

const selectLocation = (loc) => {
  searchFilters.value.location = loc;
  closeDropdown();
};


const roomOptions = computed(() => [
  { value: "Stüdyo", label: t("hero.search.studio") },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "3+", label: "3+" },
]);

const getSelectedRoomLabel = computed(() => {
  const opt = roomOptions.value.find(o => o.value === searchFilters.value.rooms);
  return opt ? opt.label : t("hero.search.studio");
});

const fetchFilteredProperties = async () => {
  isLoading.value = true;
  try {
    const params = new URLSearchParams(route.query);
    const res = await fetch(`${backendUrl}/properties?${params.toString()}`);
    properties.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch properties", err);
  } finally {
    isLoading.value = false;
  }
};

const handleSearch = () => {
  const query = {
    listing_type: activeListingType.value,
  };

  if (searchFilters.value.location && searchFilters.value.location.trim() !== "") {
    query.location = searchFilters.value.location.trim();
  }

  if (searchFilters.value.rooms) {
    query.rooms = searchFilters.value.rooms;
  }

  if (searchFilters.value.maxPrice) {
    let priceStr = String(searchFilters.value.maxPrice).toLowerCase();
    let multiplier = 1;
    if (priceStr.includes("bin") || priceStr.includes("k")) multiplier = 1000;
    if (priceStr.includes("milyon") || priceStr.includes("m"))
      multiplier = 1000000;
    const maxVal = parseFloat(priceStr.replace(/[^\d]/g, ""));
    if (!isNaN(maxVal)) query.max_price = maxVal * multiplier;
  }

  router.push({ name: "Properties", query });
};

onMounted(async () => {
  fetchFilteredProperties();
  try {
    const res = await fetch(`${backendUrl}/listings/filters`);
    dynamicOptions.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch filter options", err);
  }
});

// Sync local refs when route changes
watch(
  () => route.query,
  (newQuery) => {
    activeListingType.value = newQuery.listing_type || "buy";
    searchFilters.value.location = newQuery.location || "";
    searchFilters.value.maxPrice = newQuery.max_price || "";
    fetchFilteredProperties();
  },
);
</script>

<template>
  <div class="properties-view">
    <Navbar />

    <div class="filter-bar-wrapper">
      <div class="dropdown-overlay" v-if="openDropdown" @click="closeDropdown"></div>
      <div class="container">
        <div class="compact-filter-bar">
          <div class="filter-group">
            <span class="filter-label">{{ t("hero.search.location") }}</span>
            <div class="filter-select-wrapper custom-dropdown-container">
              <div class="custom-select" style="cursor: text;">
                <input
                  type="text"
                  v-model="searchFilters.location"
                  placeholder="Paris, Paris 20..."
                  @focus="openDropdown = 'location'"
                  @input="openDropdown = 'location'"
                  style="background: transparent; border: none; outline: none; font-size: inherit; font-family: inherit; font-weight: inherit; color: inherit; flex: 1; min-width: 0; padding-right: 1.5rem;"
                />
                <span class="material-icons-outlined" @click="toggleDropdown('location')" style="cursor: pointer; pointer-events: auto;">expand_more</span>
              </div>
              <ul class="custom-dropdown-list" v-if="openDropdown === 'location' && filteredLocationOptions.length > 0">
                <li 
                  v-for="loc in filteredLocationOptions" 
                  :key="loc"
                  @click="selectLocation(loc)"
                >
                  {{ loc }}
                </li>
              </ul>
            </div>
          </div>

          <div class="filter-divider"></div>

          <div class="filter-group">
            <span class="filter-label">{{ t("hero.search.rooms") }}</span>
            <div class="filter-select-wrapper custom-dropdown-container">
              <div class="custom-select" @click="toggleDropdown('rooms')">
                <span class="selected-text">{{ getSelectedRoomLabel }}</span>
                <span class="material-icons-outlined">expand_more</span>
              </div>
              <ul class="custom-dropdown-list" v-if="openDropdown === 'rooms'">
                <li 
                  v-for="opt in roomOptions" 
                  :key="opt.value"
                  :class="{ active: searchFilters.rooms === opt.value }"
                  @click="searchFilters.rooms = opt.value; closeDropdown()"
                >
                  {{ opt.label }}
                </li>
              </ul>
            </div>
          </div>

          <div class="filter-divider"></div>

          <div class="filter-group">
            <span class="filter-label">{{ t("hero.search.maxPrice") }}</span>
            <div class="filter-input-wrapper">
              <input
                type="text"
                v-model="searchFilters.maxPrice"
                placeholder="€ Any"
              />
            </div>
          </div>

          <button class="compact-search-btn" @click="handleSearch">
            <span class="material-icons-outlined">search</span>
          </button>
        </div>
      </div>
    </div>

    <main class="results-container">
      <!-- <header class="results-header">
        <div class="container">
          <div class="header-content">
            <div class="listing-type-badge">
              {{ activeListingType === "buy" ? t("nav.buy") : t("nav.rent") }}
            </div>
            <h1 class="page-title">
              {{
                activeListingType === "buy"
                  ? "Properties for Sale"
                  : "Properties for Rent"
              }}
            </h1>
            <p class="results-count" v-if="!isLoading">
              {{ properties.length }} listings matching your criteria
            </p>
          </div>
        </div>
      </header> -->

      <section class="results-grid-section">
        <div class="container">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
          </div>

          <div v-else-if="properties.length === 0" class="no-results">
            <span class="material-icons-outlined large-icon">search_off</span>
            <h3>No properties found</h3>
            <p>Try adjusting your filters or checking a different area</p>
            <button @click="$router.push('/')" class="back-home-btn">
              Back to Home
            </button>
          </div>

          <div v-else class="property-grid">
            <div
              v-for="prop in properties"
              :key="prop.id"
              class="property-card"
              @click="router.push(`/property/${prop.id}`)"
            >
              <div class="image-wrapper">
                <img
                  :alt="prop.title"
                  :src="
                    prop.media && prop.media.length > 0
                      ? prop.media.find((m) => m.is_thumbnail)?.url ||
                        prop.media[0].url
                      : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
                  "
                />
                <div class="badge-container">
                  <div v-if="prop.status === 'sold'" class="badge sold">
                    {{ t("property.sold") }}
                  </div>
                  <div
                    v-else-if="prop.status === 'rented'"
                    class="badge rented"
                  >
                    {{ t("property.rented") }}
                  </div>
                  <div v-else class="badge type">
                    {{
                      prop.listing_type === "buy"
                        ? t("property.forSale")
                        : t("property.forRent")
                    }}
                  </div>
                </div>
              </div>

              <div class="card-content">
                <div class="card-top">
                  <span
                    class="property-location"
                    v-if="prop.details?.neighborhood"
                  >
                    {{ prop.details.neighborhood }}
                  </span>
                  <h3 class="card-title">{{ prop.title }}</h3>
                </div>

                <div class="card-specs">
                  <div class="spec-item">
                    <span class="material-icons-outlined">square_foot</span>
                    {{ prop.details?.sqft }} m²
                  </div>
                  <div class="spec-item">
                    <span class="material-icons-outlined">bed</span>
                    {{ prop.details?.bedrooms }}
                  </div>
                  <div class="spec-item">
                    <span class="material-icons-outlined">bathtub</span>
                    {{ prop.details?.bathrooms }}
                  </div>
                </div>

                <div class="card-footer">
                  <p class="card-price">
                    € {{ Number(prop.price).toLocaleString("de-DE") }}
                  </p>
                  <span class="view-details">
                    VIEW DETAILS
                    <span class="material-icons-outlined">chevron_right</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer removed -->
  </div>
</template>

<style scoped>
.properties-view {
  background: white;
  min-height: 100vh;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 4rem;
}

/* New Compact Filter Bar */
.filter-bar-wrapper {
  position: fixed;
  top: 6rem; /* Under Navbar */
  left: 0;
  width: 100%;
  z-index: 40;
  background: white;
  border-bottom: 1px solid #f3f4f6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  padding: 0.75rem 0;
}

.compact-filter-bar {
  display: flex;
  align-items: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  max-width: fit-content;
  margin: 0 auto;
  padding: 0.25rem 0.5rem 0.25rem 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  padding: 0.25rem 1rem;
}

.filter-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #9ca3af;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 0.1rem;
}

.filter-select-wrapper,
.filter-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-input-wrapper input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  padding-right: 0;
  cursor: text;
  width: 120px;
}

/* Custom Dropdown Overlays & Styles */
.dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.custom-dropdown-container {
  position: relative;
  z-index: 50; 
  width: auto;
}

.custom-select {
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto;
  min-width: 120px;
}

.selected-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1.5rem;
  text-align: left;
}

.custom-dropdown-container .material-icons-outlined {
  position: absolute;
  right: 0;
  font-size: 1rem;
  pointer-events: none;
  color: #6b7280;
}

.custom-dropdown-list {
  position: absolute;
  top: calc(100% + 15px);
  left: -1rem; /* align correctly with dropdown wrapper ignoring parent padding */
  width: max-content;
  min-width: 200px;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  max-height: 250px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  z-index: 60;
}

.custom-dropdown-list li {
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  font-weight: 500;
}

.custom-dropdown-list li:last-child {
  border-bottom: none;
}

.custom-dropdown-list li:hover {
  background-color: #f9fafb;
  color: var(--primary);
}

.custom-dropdown-list li.active {
  background-color: var(--primary);
  color: var(--accent);
  font-weight: 700;
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: #e5e7eb;
  margin: 0 0.5rem;
}

.compact-search-btn {
  background: var(--primary);
  color: var(--accent);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 0.5rem;
}

.compact-search-btn:hover {
  background: var(--primary-hover);
  transform: scale(1.05);
}

.results-container {
  padding-top: 14rem;
}

.results-header {
  padding: 2rem 0;
  text-align: center;
}

.listing-type-badge {
  display: inline-block;
  background: var(--accent);
  color: var(--primary);
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 1rem;
}

.page-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.results-count {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 400;
}

.results-grid-section {
  padding-bottom: 6rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 5rem 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 42, 53, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.no-results {
  text-align: center;
  padding: 5rem 0;
  color: #6b7280;
}

.large-icon {
  font-size: 3.5rem !important;
  margin-bottom: 1rem;
  opacity: 0.2;
}

.property-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 2rem;
}

@media (min-width: 768px) {
  .property-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .property-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Card Styling (kept consistent) */
.property-card {
  background: white;
  border: 1px solid #f3f4f6;
  transition: all 0.3s ease;
  cursor: pointer;
}

.property-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.05);
}

.image-wrapper {
  position: relative;
  aspect-ratio: 16/10;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-container {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.badge {
  padding: 0.2rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge.type {
  background: #002a35;
  color: var(--accent);
}
.badge.sold {
  background: #ef4444;
  color: white;
}
.badge.rented {
  background: #0ea5e9;
  color: white;
}

.card-content {
  padding: 1.25rem;
}

.property-location {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: block;
}

.card-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--primary);
  margin-bottom: 1rem;
}

.card-specs {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid #f3f4f6;
}

.spec-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.spec-item .material-icons-outlined {
  font-size: 1.1rem;
  color: var(--accent);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-price {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--primary);
}

.view-details {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  color: var(--primary);
  opacity: 0.5;
}

@media (max-width: 640px) {
  .compact-filter-bar {
    flex-direction: column;
    border-radius: 8px;
    padding: 1rem;
    max-width: 100%;
    width: 100%;
  }
  .filter-divider {
    display: none;
  }
  .filter-group {
    width: 100%;
    border-bottom: 1px solid #eee;
  }
  .compact-search-btn {
    width: 100%;
    border-radius: 4px;
    margin-top: 1rem;
    height: 44px;
  }
  .results-container {
    padding-top: 25rem;
  }
}
</style>
