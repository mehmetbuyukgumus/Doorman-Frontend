<script setup>
import ContactModal from "./components/ContactModal.vue";
</script>

<template>
  <div class="app-container">
    <router-view />
    <ContactModal />
  </div>
</template>

<style>
@import "./style.css";

.app-container {
  min-height: 100vh;
  transition:
    background-color 0.3s,
    color 0.3s;
}
</style>
