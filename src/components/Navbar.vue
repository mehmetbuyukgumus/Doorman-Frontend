<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useContact } from "../services/contactService";

const { locale, t } = useI18n();
const { openContact } = useContact();
const isMobileMenuOpen = ref(false);

const handleContactClick = (e) => {
  e.preventDefault();
  isMobileMenuOpen.value = false;
  openContact();
};

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const changeLanguage = (lang) => {
  locale.value = lang;
  localStorage.setItem("locale", lang);
};
</script>

<template>
  <nav class="navbar">
    <div class="container">
      <div class="nav-content">
        <div class="logo-section">
          <router-link to="/" class="logo-link">
            <div class="logo-icon-wrapper">
              <div class="logo-circle">
                <img
                  src="/logo.svg"
                  alt="Doorman Logo"
                  class="navbar-logo-img"
                />
              </div>
            </div>
            <span class="logo-text">Doorman</span>
          </router-link>
        </div>

        <div class="desktop-links">
          <router-link
            :to="{ name: 'Properties', query: { listing_type: 'buy' } }"
            class="nav-link"
            >{{ t("nav.buy") }}</router-link
          >
          <router-link
            :to="{ name: 'Properties', query: { listing_type: 'rent' } }"
            class="nav-link"
            >{{ t("nav.rent") }}</router-link
          >
          <router-link to="/" class="nav-link">{{
            t("nav.services")
          }}</router-link>
          <router-link :to="{ name: 'Blog' }" class="nav-link">{{
            t("nav.blog")
          }}</router-link>

          <div class="lang-switcher">
            <button
              @click="changeLanguage('en')"
              :class="{ active: locale === 'en' }"
            >
              EN
            </button>
            <span class="divider">|</span>
            <button
              @click="changeLanguage('fr')"
              :class="{ active: locale === 'fr' }"
            >
              FR
            </button>
            <span class="divider">|</span>
            <button
              @click="changeLanguage('tr')"
              :class="{ active: locale === 'tr' }"
            >
              TR
            </button>
          </div>

          <a href="#" @click="handleContactClick" class="contact-btn">{{
            t("nav.contact")
          }}</a>
        </div>

        <div class="mobile-toggle">
          <button @click="toggleMobileMenu" class="toggle-btn">
            <span class="material-icons-outlined">menu</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="isMobileMenuOpen" class="mobile-menu">
      <router-link
        :to="{ name: 'Properties', query: { listing_type: 'buy' } }"
        @click="isMobileMenuOpen = false"
        class="mobile-link"
        >{{ t("nav.buy") }}</router-link
      >
      <router-link
        :to="{ name: 'Properties', query: { listing_type: 'rent' } }"
        @click="isMobileMenuOpen = false"
        class="mobile-link"
        >{{ t("nav.rent") }}</router-link
      >
      <router-link
        to="/"
        @click="isMobileMenuOpen = false"
        class="mobile-link"
        >{{ t("nav.services") }}</router-link
      >
      <router-link
        :to="{ name: 'Blog' }"
        @click="isMobileMenuOpen = false"
        class="mobile-link"
        >{{ t("nav.blog") }}</router-link
      >

      <div class="mobile-lang-switcher">
        <button
          @click="changeLanguage('en')"
          :class="{ active: locale === 'en' }"
        >
          EN
        </button>
        <button
          @click="changeLanguage('fr')"
          :class="{ active: locale === 'fr' }"
        >
          FR
        </button>
        <button
          @click="changeLanguage('tr')"
          :class="{ active: locale === 'tr' }"
        >
          TR
        </button>
      </div>

      <a href="#" @click="handleContactClick" class="mobile-contact-btn">{{
        t("nav.contact")
      }}</a>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  width: 100%;
  z-index: 50;
  background-color: #002a35;
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--primary-hover);
  transition: background-color 0.3s;
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

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 6rem;
}

.logo-section .logo-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
}

.logo-circle {
  width: 3rem;
  height: 3rem;
  background-color: var(--primary);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--accent); /* Secondary color for the icon */
}

.navbar-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Changed to cover to fill more of the space if needed */
  display: block;
}

.logo-text {
  font-family: var(--font-display);
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: white;
  margin-left: 0.5rem;
}

.desktop-links {
  display: none;
  gap: 2rem;
  align-items: center;
}

@media (min-width: 1024px) {
  .desktop-links {
    display: flex;
    gap: 3rem;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .desktop-links {
    display: flex;
    gap: 1.5rem;
  }
}

.nav-link {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-link:hover {
  color: var(--accent);
}

.lang-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-weight: 700;
}

.lang-switcher button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.lang-switcher button.active {
  color: var(--accent);
}

.divider {
  font-size: 0.65rem;
}

.contact-btn {
  padding: 0.5rem 1.5rem;
  background-color: var(--accent);
  color: var(--primary);
  font-weight: 700;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: background-color 0.2s;
}

.contact-btn:hover {
  background-color: white;
}

.mobile-toggle {
  display: block;
}

@media (min-width: 768px) {
  .mobile-toggle {
    display: none;
  }
}

.toggle-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
}

.toggle-btn:hover {
  color: var(--accent);
}

.toggle-btn .material-icons-outlined {
  font-size: 1.875rem;
}

.mobile-menu {
  display: flex;
  flex-direction: column;
  background-color: var(--primary);
  border-bottom: 1px solid var(--primary-hover);
  padding: 0.5rem 1rem 1.5rem;
  gap: 1rem;
}

@media (min-width: 768px) {
  .mobile-menu {
    display: none;
  }
}

.mobile-link {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
}

.mobile-lang-switcher {
  display: flex;
  gap: 1.5rem;
  margin: 0.5rem 0;
}

.mobile-lang-switcher button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
}

.mobile-lang-switcher button.active {
  color: var(--accent);
}

.mobile-contact-btn {
  padding: 0.5rem 1.5rem;
  background-color: var(--accent);
  color: var(--primary);
  font-weight: 700;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
  text-decoration: none;
}
</style>
