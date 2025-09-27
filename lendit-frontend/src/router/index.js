import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// Lazy pages
const Home = () => import("../views/Home.vue");
const Login = () => import("../views/auth/Login.vue");
const Register = () => import("../views/auth/Register.vue");
const Search = () => import("../views/Search.vue");
const Item = () => import("../views/Item.vue");
const Dashboard = () => import("../views/Dashboard.vue");
const Messages = () => import("../views/Messages.vue");
const Checkout = () => import("../views/Checkout.vue");
const NotFound = () => import("../views/NotFound.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    {
      path: "/login",
      name: "login",
      component: Login,
      meta: { guestOnly: true },
    },
    {
      path: "/register",
      name: "register",
      component: Register,
      meta: { guestOnly: true },
    },
    { path: "/search", name: "search", component: Search },
    { path: "/item/:id", name: "item", component: Item, props: true },
    {
      path: "/dashboard",
      name: "dashboard",
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: "/messages",
      name: "messages",
      component: Messages,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout",
      name: "checkout",
      component: Checkout,
      meta: { requiresAuth: true },
    },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Auth guards using Pinia store
router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthed) {
    return next({ name: "login", query: { redirect: to.fullPath } });
  }
  if (to.meta.guestOnly && auth.isAuthed) {
    return next({ name: "home" });
  }
  next();
});

export default router;
