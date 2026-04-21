<script setup>
import { useI18n } from "vue-i18n";
import { ref } from "vue";
const { t } = useI18n();
const year = ref(new Date().getFullYear());
</script>

<template>
  <footer class="footer">
    <div class="container">
      <div class="footer-top">
        <div class="brand-section">
          <div class="footer-logo">
            <div class="logo-circle">
              <img src="/logo.svg" alt="Doorman Logo" class="navbar-logo-img" />
            </div>
            <span class="logo-text">Doorman</span>
          </div>
          <p class="brand-desc">
            {{ t("footer.desc") }}
          </p>
          <div class="social-links">
            <a
              href="https://www.instagram.com/doormansas/"
              target="_blank"
              rel="noopener noreferrer"
              class="social-icon"
            >
              <span class="sr-only">Instagram</span>
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
                ></path>
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/doormansas/posts/?feedView=all"
              target="_blank"
              rel="noopener noreferrer"
              class="social-icon"
            >
              <span class="sr-only">LinkedIn</span>
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                ></path>
              </svg>
            </a>
          </div>
        </div>

        <div class="footer-links">
          <h4 class="column-title">{{ t("footer.explore") }}</h4>
          <ul class="link-list">
            <li>
              <a href="#">{{ t("footer.links.sale") }}</a>
            </li>
            <li>
              <a href="#">{{ t("footer.links.rent") }}</a>
            </li>
            <li>
              <a href="#">{{ t("footer.links.developments") }}</a>
            </li>
            <li>
              <a href="#">{{ t("footer.links.past") }}</a>
            </li>
          </ul>
        </div>

        <div class="footer-links">
          <h4 class="column-title">{{ t("footer.services") }}</h4>
          <ul class="link-list">
            <li>
              <router-link
                :to="{ name: 'Properties', query: { listing_type: 'buy' } }"
                >{{ t("nav.buy") }}</router-link
              >
            </li>
            <li>
              <router-link
                :to="{ name: 'Properties', query: { listing_type: 'rent' } }"
                >{{ t("nav.rent") }}</router-link
              >
            </li>
            <li>
              <router-link :to="{ name: 'Home', hash: '#expertise' }">{{
                t("footer.serviceLinks.reno")
              }}</router-link>
            </li>
            <li>
              <router-link :to="{ name: 'Home', hash: '#expertise' }">{{
                t("footer.serviceLinks.concierge")
              }}</router-link>
            </li>
          </ul>
        </div>

        <div class="footer-links">
          <h4 class="column-title">{{ t("footer.contact") }}</h4>
          <ul class="link-list contact-list">
            <li>119 Bd Gabriel Péri 92240 Malakoff</li>
            <li>contact@doorman.fr</li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p class="copyright">© {{ year }} Doorman SAS. Tüm hakları saklıdır.</p>
        <div class="legal-links"></div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  background-color: var(--primary);
  color: white;
  padding: 4rem 0;
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

.footer-top {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
  padding-bottom: 3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

@media (min-width: 768px) {
  .footer-top {
    grid-template-columns: 2fr repeat(3, 1fr);
  }
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.logo-circle {
  width: 2.5rem;
  height: 2.5rem;
  background-color: var(--primary);
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.navbar-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.logo-circle .material-icons-outlined {
  color: var(--accent);
  font-size: 1rem;
  transform: rotate(-45deg);
}

.logo-text {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
}

.brand-desc {
  color: #d1d5db;
  font-size: 0.875rem;
  line-height: 1.625;
  margin-bottom: 1.5rem;
  max-width: 18rem;
  text-align: left;
}

.social-links {
  display: flex;
  gap: 1rem;
}

.social-icon {
  color: #d1d5db;
  transition: color 0.2s;
}

.social-icon:hover {
  color: var(--accent);
}

.social-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.column-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  color: var(--accent);
  margin-bottom: 1.5rem;
  text-align: left;
}

.link-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.link-list a {
  color: #d1d5db;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.link-list a:hover {
  color: white;
}

.contact-list li {
  color: #d1d5db;
  font-size: 0.875rem;
}

.footer-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

@media (min-width: 768px) {
  .footer-bottom {
    flex-direction: row;
  }
}

.copyright {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
}

.legal-links {
  display: flex;
  gap: 1.5rem;
}

.legal-links a {
  font-size: 0.75rem;
  color: #9ca3af;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: color 0.2s;
}

.legal-links a:hover {
  color: white;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
