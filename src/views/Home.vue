<script setup>
import Navbar from "../components/Navbar.vue";
import Hero from "../components/Hero.vue";
import Portfolio from "../components/Portfolio.vue";
import Expertise from "../components/Expertise.vue";
import Blog from "../components/Blog.vue";
import Footer from "../components/Footer.vue";
</script>

<template>
  <div class="home-view">
    <Navbar />
    <main>
      <Hero />
      <Portfolio />
      <Expertise />
      <Blog />
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
}
</style>
