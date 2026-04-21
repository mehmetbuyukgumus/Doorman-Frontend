<script setup>
import { useI18n } from "vue-i18n";
import { useContact } from "../services/contactService";

const { t } = useI18n();
const { openContact } = useContact();

const handleContactTeam = (e) => {
  e.preventDefault();
  openContact();
};
</script>

<template>
  <section class="expertise" id="expertise">
    <div class="container">
      <div class="expertise-grid">
        <div class="content-side order-mobile-2">
          <span class="sub-label">{{ t("expertise.label") }}</span>
          <h2 class="section-title">
            <span v-html="t('expertise.title', { br: '<br />' })"></span>
          </h2>
          <p class="section-desc">
            {{ t("expertise.desc") }}
          </p>

          <div class="features">
            <div class="feature-item">
              <div class="feature-text">
                <h4 class="feature-title">
                  <span class="material-icons-outlined feature-icon"
                    >real_estate_agent</span
                  >
                  {{ t("expertise.sales.title") }}
                </h4>
                <p class="feature-desc">{{ t("expertise.sales.desc") }}</p>
              </div>
            </div>

            <div class="feature-item">
              <div class="feature-text">
                <h4 class="feature-title">
                  <span class="material-icons-outlined feature-icon"
                    >architecture</span
                  >
                  {{ t("expertise.renovation.title") }}
                </h4>
                <p class="feature-desc">{{ t("expertise.renovation.desc") }}</p>
              </div>
            </div>
          </div>

          <a href="#" @click="handleContactTeam" class="contact-team-btn">{{
            t("expertise.contact")
          }}</a>
        </div>

        <div class="image-side order-mobile-1">
          <img
            alt="Kitchen detail"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI6Iese4vvn9id19E5u-Drpy6BO_-rsGopO8qnVqxe7_Oo7IWA-pCnp7ThGTCIKkWgqylLlHTYzsW6Klh8Yeoptb2_DkRSGXT1KLLZh5NDPcFjN3l60YwslkKU8sdHSNdhL-I0m_UijGQ9tUYy4Gb645cEq9bFrT1-jEQecPbuZdsLh71i2zIslZfJkjukimWZWBj56yQqKAyPRRc4c5bc8RfIm5lNZEjTqJhRuLpVtvpOwFX6paSSBS62cG-ptSTBOnd-WYVFKzop"
            class="img-small"
          />
          <img
            alt="Living room detail"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvLQr7Kb-UX35tolh7ihiKi8XDGQRsrsjeR2q4yZcDp05KdjVViLzplNTD5k4avAxQYUJ8VwBC46RBAyodnJ-WyV9XA44e9kT_tq1OGdjOS4se-TA00zbcKOgu_zs786FTV-K0TvekDY-23KzP30FBz-Chbhe9HHDsiJYM5E_0hQu8QdtkUen1zTUyDdljhUUAEa7EXhgVgntCFv7dy42mpGPyrX7aD2a6B9FPTF4Tdc_3LgrRg3l14_WvKKuWOl-UD-qP4UcQRmjq"
            class="img-large"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.expertise {
  padding: 6rem 0;
  background-color: white;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
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

.expertise-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4rem;
  align-items: center;
}

@media (min-width: 1024px) {
  .expertise-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.sub-label {
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 700;
  display: block;
  margin-bottom: 1rem;
  text-align: left;
}

.section-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  color: var(--primary);
  margin-bottom: 1.5rem;
  line-height: 1.2;
  text-align: left;
}

@media (min-width: 1024px) {
  .section-title {
    font-size: 3rem;
  }
}

.section-desc {
  color: #4b5563;
  font-size: 1.125rem;
  font-weight: 300;
  line-height: 1.625;
  margin-bottom: 2rem;
  text-align: left;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.feature-item {
  text-align: left;
}

.feature-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.feature-icon {
  font-size: 1.5rem;
  color: var(--accent);
}

.feature-text {
  flex: 1;
}

.feature-desc {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.contact-team-btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  background-color: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.contact-team-btn:hover {
  background-color: var(--primary);
  color: var(--accent);
}

.image-side {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.img-small {
  width: 100%;
  height: 16rem;
  object-fit: cover;
  margin-top: 3rem;
  border-bottom: 4px solid var(--accent);
}

.img-large {
  width: 100%;
  height: 20rem;
  object-fit: cover;
  border-top: 4px solid var(--primary);
}

.order-mobile-1 {
  order: 1;
}
.order-mobile-2 {
  order: 2;
}

@media (min-width: 1024px) {
  .order-mobile-1 {
    order: 2;
  }
  .order-mobile-2 {
    order: 1;
  }
}
</style>
