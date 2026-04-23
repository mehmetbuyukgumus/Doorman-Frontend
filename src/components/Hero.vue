<script setup>
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();

const dynamicOptions = ref({
  neighborhoods: [],
  types: [],
});

const activeListingType = ref("buy"); // buy or rent
const searchFilters = ref({
  location: "",
  rooms: "Stüdyo",
  maxPrice: "",
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

onMounted(async () => {
  try {
    const res = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "")}/listings/filters`,
    );
    dynamicOptions.value = await res.json();
  } catch (err) {
    console.error("Failed to fetch filter options", err);
  }
});

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
</script>

<template>
  <div class="hero">
    <div class="hero-image-overlay">
      <img
        alt="Luxury Parisian Apartment Interior"
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOfSyrVXSKnyMXufgDfEGCRG6Jgxq7IDwZokUBGSGRzaB0OJSyDke1Btscu0r-UCeTvxg20uALzp8Ifcc24jholPdnRoagUvZhbtSt5x_VL-BKGQgtexk1gL7hAtPlIABaeMh0nb3LrbXR7ZS30FuFG_YafqLyy2Lhx68C9LIYvR8uNSJdTvaKwuLT5IpaJFVvQL78xzZ7QFg9kgRELgn1Ud0JUOSAe-E2AEacMGuJKAWEXL8p13574kKdDBHySKITVD4RAoLFNKZ0"
        class="hero-bg-img"
      />
    </div>

    <div class="hero-content-wrapper fade-in-up">
      <h1 class="hero-title">
        <span
          v-html="
            t('hero.title', {
              br: '<br />',
              special: `<i class='special-text'>${t('hero.special')}</i>`,
            })
          "
        ></span>
      </h1>
      <p class="hero-subtitle">
        {{ t("hero.subtitle") }}
      </p>

      <div class="search-box">
      <!-- Overlay to catch outside clicks -->
      <div class="dropdown-overlay" v-if="openDropdown" @click="closeDropdown"></div>
      
      <div class="search-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeListingType === 'buy' }"
            @click="activeListingType = 'buy'"
          >
            {{ t("hero.search.buy") }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeListingType === 'rent' }"
            @click="activeListingType = 'rent'"
          >
            {{ t("hero.search.rent") }}
          </button>
        </div>

        <div class="search-grid">
          <div class="search-field">
            <label class="field-label">{{ t("hero.search.location") }}</label>
            <div class="select-wrapper custom-dropdown-container">
              <div class="custom-select" style="cursor: text;">
                <input
                  type="text"
                  v-model="searchFilters.location"
                  placeholder="Paris, Paris 20..."
                  @focus="openDropdown = 'location'"
                  @input="openDropdown = 'location'"
                  style="background: transparent; border: none; outline: none; font-size: inherit; font-family: inherit; font-weight: inherit; color: inherit; flex: 1; min-width: 0;"
                />
                <span class="material-icons-outlined" @click="toggleDropdown('location')" style="cursor: pointer;">expand_more</span>
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

          <div class="search-field">
            <label class="field-label">{{ t("hero.search.rooms") }}</label>
            <div class="select-wrapper custom-dropdown-container">
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

          <div class="search-field">
            <label class="field-label">{{ t("hero.search.maxPrice") }}</label>
            <div class="select-wrapper">
              <input
                type="text"
                class="custom-select"
                v-model="searchFilters.maxPrice"
                placeholder="e.g. 1000000"
              />
              <span class="material-icons-outlined">euro</span>
            </div>
          </div>

          <div class="search-action">
            <button class="search-btn" @click="handleSearch">
              {{ t("hero.search.btn") }}
              <span class="material-icons-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  height: 100vh;
  min-height: 800px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-image-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.6);
}

.hero-content-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 80rem;
  padding: 0 1rem;
  text-align: center;
}

@media (min-width: 640px) {
  .hero-content-wrapper {
    padding: 0 1.5rem;
  }
}
@media (min-width: 1024px) {
  .hero-content-wrapper {
    padding: 0 2rem;
  }
}

.hero-title {
  font-family: var(--font-display);
  font-size: 3rem;
  color: white;
  margin-bottom: 1.5rem;
  line-height: 1.1;
}

@media (min-width: 768px) {
  .hero-title {
    font-size: 4.5rem;
  }
}

@media (min-width: 1280px) {
  .hero-title {
    font-size: 5rem;
  }
}

:deep(.special-text) {
  font-family: serif;
  font-style: italic;
  color: var(--accent);
}

.hero-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.125rem;
  font-weight: 300;
  margin-bottom: 3rem;
  letter-spacing: 0.025em;
  max-width: 42rem;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 768px) {
  .hero-subtitle {
    font-size: 1.25rem;
  }
}

.search-box {
  background-color: white;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 72rem;
  margin: 0 auto;
  border-radius: 0.125rem;
  border-top: 4px solid var(--accent);
}

.search-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 1.5rem;
}

@media (min-width: 1024px) {
  .search-tabs {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-light);
  }
}

.tab-btn {
  padding: 0.75rem 1.75rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  position: relative;
}

.tab-btn.active {
  color: var(--primary);
}

.tab-btn.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--primary);
}

.search-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .search-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .search-grid {
    grid-template-columns: repeat(4, 1fr);
    align-items: flex-end;
  }
}

.search-field {
  position: relative;
}

.field-label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
  text-align: left;
  font-weight: 600;
}

.select-wrapper {
  position: relative;
}

.custom-select:focus {
  border-color: var(--primary);
}

.select-wrapper > .material-icons-outlined {
  position: absolute;
  right: 0;
  bottom: 0.5rem;
  color: #9ca3af;
  pointer-events: none;
  font-size: 1.25rem;
}

.search-action {
  display: flex;
  align-items: flex-end;
}

/* Custom Dropdown Styles */
.dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.custom-dropdown-container {
  position: relative;
  z-index: 50; 
}

.custom-select {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-light);
  padding: 0.25rem 0 0.5rem;
  outline: none;
  color: var(--text-light);
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-select:focus, .custom-select:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.selected-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1.5rem;
  text-align: left;
}

.custom-dropdown-list {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 100%;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 4px;
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
  font-weight: 600;
}

@media (min-width: 1280px) {
  .search-action {
    grid-column: span 1;
  }
}

.search-btn {
  width: 100%;
  padding: 0.875rem 1rem;
  background-color: var(--primary);
  color: var(--accent);
  border: none;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.search-btn:hover {
  background-color: var(--primary-hover);
  color: white;
}

@media (max-width: 767px) {
  .search-box {
    padding: 1.5rem;
  }
}
</style>
