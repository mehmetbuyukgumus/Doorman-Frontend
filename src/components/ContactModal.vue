<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useContact } from "../services/contactService";

const { t } = useI18n();
const { isOpen, propertyContext, closeContact } = useContact();

const formData = ref({
  name: "",
  email: "",
  phone: "",
  message: "",
});

const isSubmitting = ref(false);
const showSuccess = ref(false);
const error = ref("");

const title = computed(() => {
  if (propertyContext.value) {
    return t("contact.inquiryTitle", { title: propertyContext.value.title });
  }
  return t("contact.generalTitle");
});

const handleSubmit = async () => {
  isSubmitting.value = true;
  error.value = "";

  const payload = {
    ...formData.value,
    property_id: propertyContext.value?.id,
    property_title: propertyContext.value?.title,
  };

  try {
    const res = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "")}/contact/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok) {
      showSuccess.value = true;
      formData.value = { name: "", email: "", phone: "", message: "" };
      setTimeout(() => {
        handleClose();
      }, 3000);
    } else {
      error.value = t("contact.errorMsg");
    }
  } catch (err) {
    error.value = t("contact.connectionError");
  } finally {
    isSubmitting.value = false;
  }
};

const handleClose = () => {
  showSuccess.value = false;
  error.value = "";
  closeContact();
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content glass" style="z-index: 1001">
      <button class="close-btn" @click="handleClose">
        <span class="material-icons-outlined">close</span>
      </button>

      <div v-if="!showSuccess" class="form-container">
        <h2 class="modal-title">{{ title }}</h2>
        <p class="modal-subtitle">{{ t("contact.subtitle") }}</p>

        <form @submit.prevent="handleSubmit" class="contact-form">
          <div class="form-group">
            <label>{{ t("contact.name") }}</label>
            <input
              v-model="formData.name"
              type="text"
              required
              placeholder="John Doe"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ t("contact.email") }}</label>
              <input
                v-model="formData.email"
                type="email"
                required
                placeholder="john@example.com"
              />
            </div>
            <div class="form-group">
              <label>{{ t("contact.phone") }}</label>
              <input
                v-model="formData.phone"
                type="tel"
                placeholder="+33 X XX XX XX XX"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t("contact.message") }}</label>
            <textarea
              v-model="formData.message"
              rows="4"
              required
              :placeholder="
                propertyContext
                  ? t('contact.propPlaceholder')
                  : t('contact.generalPlaceholder')
              "
            ></textarea>
          </div>

          <div v-if="error" class="error-msg">{{ error }}</div>

          <button type="submit" class="submit-btn" :disabled="isSubmitting">
            <span v-if="!isSubmitting">{{ t("contact.sendBtn") }}</span>
            <span v-else class="loader"></span>
          </button>
        </form>
      </div>

      <div v-else class="success-container">
        <div class="success-icon">
          <span class="material-icons-outlined">check_circle</span>
        </div>
        <h2>{{ t("contact.successTitle") }}</h2>
        <p>{{ t("contact.successMsg") }}</p>
        <button @click="handleClose" class="close-success-btn">
          {{ t("contact.close") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 28, 36, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 3rem;
  position: relative;
  box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.5);
  color: white;
}

.glass {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.3s;
}

.close-btn:hover {
  color: var(--accent);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: white;
}

.modal-subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin-bottom: 2.5rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
  color: var(--accent);
}

.form-group input,
.form-group textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 2px;
  color: white;
  transition: all 0.3s;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.1);
}

.submit-btn {
  background: var(--accent);
  color: var(--primary);
  padding: 1.25rem;
  border: none;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 1rem;
}

.submit-btn:hover:not(:disabled) {
  background: white;
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success-container {
  text-align: center;
  padding: 2rem 0;
}

.success-icon {
  color: #10b981;
  margin-bottom: 1.5rem;
}

.success-icon .material-icons-outlined {
  font-size: 5rem;
}

.success-container h2 {
  font-family: var(--font-display);
  font-size: 2.25rem;
  margin-bottom: 1rem;
}

.success-container p {
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 2.5rem;
}

.close-success-btn {
  background: white;
  color: var(--primary);
  padding: 1rem 2rem;
  border: none;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}

.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  text-align: center;
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
