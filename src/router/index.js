import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Admin from "../views/Admin.vue";
import Login from "../views/Login.vue";
import PropertyDetail from "../views/PropertyDetail.vue";
import Properties from "../views/Properties.vue";
import BlogView from "../views/Blog.vue";
import BlogDetail from "../views/BlogDetail.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/blog",
    name: "Blog",
    component: BlogView,
  },
  {
    path: "/blog/:slug",
    name: "BlogDetail",
    component: BlogDetail,
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/admin",
    name: "Admin",
    component: Admin,
    meta: { requiresAuth: true },
  },
  {
    path: "/property/:id",
    name: "PropertyDetail",
    component: PropertyDetail,
  },
  {
    path: "/properties",
    name: "Properties",
    component: Properties,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem("admin_token");

  if (to.meta.requiresAuth && !isAuthenticated) {
    next("/login");
  } else if (to.name === "Login" && isAuthenticated) {
    next("/admin");
  } else {
    next();
  }
});

export default router;
