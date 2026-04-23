<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const isSubmitting = ref(false);

const isChangingPassword = ref(false);
const showResetForm = ref(false);
const newPassword = ref("");
const confirmPassword = ref("");
const successMsg = ref("");

const handleLogin = async () => {
  error.value = "";
  successMsg.value = "";
  isSubmitting.value = true;

  try {
    const formData = new FormData();
    formData.append("username", email.value);
    formData.append("password", password.value);

    const res = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "")}/auth/login`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("admin_token", data.access_token);

      try {
        const payloadBase64 = data.access_token.split(".")[1];
        const payload = JSON.parse(atob(payloadBase64));
        localStorage.setItem("admin_role", payload.role);
        localStorage.setItem("admin_email", payload.sub);
      } catch (e) {
        console.error("Failed to decode role from token");
      }

      if (data.must_change_password) {
        isChangingPassword.value = true;
      } else {
        router.push("/admin");
      }
    } else {
      const data = await res.json();
      error.value =
        data.detail || "Login failed. Please check your credentials.";
    }
  } catch (err) {
    error.value = "Connection error. Please try again later.";
  } finally {
    isSubmitting.value = false;
  }
};

const handleChangePassword = async () => {
  error.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = "Passwords do not match.";
    return;
  }
  isSubmitting.value = true;
  try {
    const res = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "")}/auth/change-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({ new_password: newPassword.value }),
      },
    );
    if (res.ok) {
      router.push("/admin");
    } else {
      error.value = "Failed to change password. Please try again.";
    }
  } catch (err) {
    error.value = "Connection error. Please try again later.";
  } finally {
    isSubmitting.value = false;
  }
};

const handleResetRequest = async () => {
  error.value = "";
  successMsg.value = "";
  if (!email.value) {
    error.value = "Please enter your email address first.";
    return;
  }
  isSubmitting.value = true;
  try {
    const res = await fetch(
      `${(import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "")}/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value }),
      },
    );
    if (res.ok) {
      successMsg.value =
        "Reset request sent to admin. You will be notified when approved.";
      showResetForm.value = false;
    } else {
      error.value = "Failed to submit reset request.";
    }
  } catch (err) {
    error.value = "Connection error. Please try again later.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="login-page">
    <main class="login-main">
      <div class="login-card">
        <div class="card-header">
          <div class="logo-circle">
            <span class="material-icons-outlined">vpn_key</span>
          </div>
          <h1>Admin Access</h1>
          <p>Please enter your credentials to manage properties.</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div v-if="successMsg" class="success-msg">
            <span class="material-icons-outlined">check_circle</span>
            {{ successMsg }}
          </div>

          <!-- Normal Login Form -->
          <template v-if="!isChangingPassword && !showResetForm">
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                v-model="email"
                type="email"
                required
                placeholder="admin@doorman.com"
                :disabled="isSubmitting"
              />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                required
                placeholder="••••••••"
                :disabled="isSubmitting"
              />
            </div>

            <div v-if="error" class="error-msg">
              <span class="material-icons-outlined">error_outline</span>
              {{ error }}
            </div>

            <button type="submit" class="login-btn" :disabled="isSubmitting">
              <span v-if="!isSubmitting">Sign In</span>
              <span v-else class="spinner"></span>
            </button>

            <button
              type="button"
              class="text-btn"
              @click="
                showResetForm = true;
                error = '';
                successMsg = '';
              "
            >
              Forgot Password?
            </button>
          </template>

          <!-- Password Reset Request Form -->
          <template v-if="showResetForm">
            <p class="instruction-text">
              Enter your email to request a password reset from the Superuser.
            </p>
            <div class="form-group">
              <label for="reset-email">Email Address</label>
              <input
                id="reset-email"
                v-model="email"
                type="email"
                required
                placeholder="admin@doorman.com"
                :disabled="isSubmitting"
              />
            </div>

            <div v-if="error" class="error-msg">
              <span class="material-icons-outlined">error_outline</span>
              {{ error }}
            </div>

            <button
              type="button"
              @click="handleResetRequest"
              class="login-btn"
              :disabled="isSubmitting"
            >
              <span v-if="!isSubmitting">Request Reset</span>
              <span v-else class="spinner"></span>
            </button>

            <button
              type="button"
              class="text-btn"
              @click="
                showResetForm = false;
                error = '';
                successMsg = '';
              "
            >
              Back to Login
            </button>
          </template>
        </form>

        <form
          @submit.prevent="handleChangePassword"
          class="login-form mt-4"
          v-if="isChangingPassword"
        >
          <p class="instruction-text">
            This is your first login or your password was reset. You must set a
            new password.
          </p>
          <div class="form-group">
            <label for="new_password">New Password</label>
            <input
              id="new_password"
              v-model="newPassword"
              type="password"
              required
              placeholder="••••••••"
              :disabled="isSubmitting"
            />
          </div>

          <div class="form-group">
            <label for="confirm_password">Confirm New Password</label>
            <input
              id="confirm_password"
              v-model="confirmPassword"
              type="password"
              required
              placeholder="••••••••"
              :disabled="isSubmitting"
            />
          </div>

          <div v-if="error" class="error-msg">
            <span class="material-icons-outlined">error_outline</span>
            {{ error }}
          </div>

          <button type="submit" class="login-btn" :disabled="isSubmitting">
            <span v-if="!isSubmitting">Update Password</span>
            <span v-else class="spinner"></span>
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #002a35 0%, #004152 100%);
  display: flex;
  flex-direction: column;
}

.login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 3rem;
  border-radius: 4px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.card-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.logo-circle {
  width: 4rem;
  height: 4rem;
  border: 2px solid var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.logo-circle .material-icons-outlined {
  color: var(--accent);
  font-size: 2rem;
  transform: rotate(-45deg);
}

h1 {
  font-family: var(--font-display);
  color: white;
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: var(--accent);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.form-group input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 2px;
  color: white;
  outline: none;
  transition: all 0.3s;
}

.form-group input:focus {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.1);
}

.error-msg {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 0.75rem;
  border-radius: 2px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.login-btn {
  background: var(--accent);
  color: var(--primary);
  padding: 1rem;
  border: none;
  border-radius: 2px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-btn:hover:not(:disabled) {
  background: white;
  transform: translateY(-2px);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.text-btn {
  background: none;
  border: none;
  color: var(--accent);
  margin-top: 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  text-decoration: underline;
}

.text-btn:hover {
  color: white;
}

.instruction-text {
  color: var(--accent);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.success-msg {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
  padding: 0.75rem;
  border-radius: 2px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.mt-4 {
  margin-top: 1.5rem;
}
</style>
