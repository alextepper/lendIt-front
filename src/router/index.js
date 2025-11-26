import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// Lazy pages
const Home = () => import("../views/Home.vue");
const Login = () => import("../views/auth/Login.vue");
const Register = () => import("../views/auth/Register.vue");
const OAuthCallback = () => import("../views/auth/OAuthCallback.vue");
const Search = () => import("../views/Search.vue");
const Item = () => import("../views/Item.vue");
const Dashboard = () => import("../views/Dashboard.vue");
const MyBookings = () => import("../views/MyBookings.vue");
const Messages = () => import("../views/Messages.vue");
const Settings = () => import("../views/Settings.vue");
const Checkout = () => import("../views/Checkout.vue");
const OrderCheckout = () => import("../views/OrderCheckout.vue");
const BookingCheckout = () => import("../views/BookingCheckout.vue");
const CheckoutSuccess = () => import("../views/CheckoutSuccess.vue");
const CheckoutFailure = () => import("../views/CheckoutFailure.vue");
const UserProfile = () => import("../views/UserProfile.vue");
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
    {
      path: "/auth/callback",
      name: "oauth-callback",
      component: OAuthCallback,
      meta: { guestOnly: true },
    },
    { path: "/search", name: "search", component: Search },
    { path: "/item/:id", name: "item", component: Item, props: true },
    {
      path: "/users/:id",
      name: "user-profile",
      component: UserProfile,
      props: true,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: "/my/bookings",
      name: "my-bookings",
      component: MyBookings,
      meta: { requiresAuth: true },
    },
    {
      path: "/messages",
      name: "messages",
      component: Messages,
      meta: { requiresAuth: true },
    },
    {
      path: "/settings",
      name: "settings",
      component: Settings,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout",
      name: "checkout",
      component: OrderCheckout,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout-old",
      name: "checkout-old",
      component: Checkout,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout/:bookingId",
      name: "booking-checkout",
      component: BookingCheckout,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout/success",
      name: "checkout-success",
      component: CheckoutSuccess,
      meta: { requiresAuth: true },
    },
    {
      path: "/checkout/failure",
      name: "checkout-failure",
      component: CheckoutFailure,
      meta: { requiresAuth: true },
    },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Auth guards using Pinia store
router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  // Wait for auth initialization if not yet done
  if (!auth.initialized) {
    await auth.initialize();
  }

  if (to.meta.requiresAuth && !auth.isAuthed) {
    return next({ name: "login", query: { redirect: to.fullPath } });
  }
  if (to.meta.guestOnly && auth.isAuthed) {
    return next({ name: "home" });
  }
  next();
});

export default router;
