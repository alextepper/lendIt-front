import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

// Lazy pages
const Home = () => import("../views/Home.vue");
const Login = () => import("../views/auth/Login.vue");
const Register = () => import("../views/auth/Register.vue");
const OAuthCallback = () => import("../views/auth/OAuthCallback.vue");
const OAuthPopupCallback = () => import("../views/auth/OAuthPopupCallback.vue");
const RequestPasswordReset = () => import("../views/auth/RequestPasswordReset.vue");
const ResetPassword = () => import("../views/auth/ResetPassword.vue");
const Search = () => import("../views/Search.vue");
const Item = () => import("../views/Item.vue");
const Dashboard = () => import("../views/Dashboard.vue");
const MyBookings = () => import("../views/MyBookings.vue");
const Messages = () => import("../views/Messages.vue");
const Settings = () => import("../views/Settings.vue");
const Notifications = () => import("../views/Notifications.vue");
const Checkout = () => import("../views/Checkout.vue");
const OrderCheckout = () => import("../views/OrderCheckout.vue");
const BookingCheckout = () => import("../views/BookingCheckout.vue");
const BookingDetails = () => import("../views/BookingDetails.vue");
const CheckoutSuccess = () => import("../views/CheckoutSuccess.vue");
const CheckoutFailure = () => import("../views/CheckoutFailure.vue");
const UserProfile = () => import("../views/UserProfile.vue");
const NotFound = () => import("../views/NotFound.vue");
const Terms = () => import("../views/Terms.vue");
const Privacy = () => import("../views/Privacy.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Search },
    {
      path: "/login",
      name: "login",
      component: Login,
      meta: { guestOnly: true, showModal: true },
    },
    {
      path: "/register",
      name: "register",
      component: Register,
      meta: { guestOnly: true, showModal: true },
    },
    {
      path: "/auth/callback",
      name: "oauth-callback",
      component: OAuthCallback,
      meta: { guestOnly: true },
    },
    {
      path: "/auth/popup/callback",
      name: "oauth-popup-callback",
      component: OAuthPopupCallback,
      meta: { guestOnly: true },
    },
    {
      path: "/auth/reset-password-request",
      name: "request-password-reset",
      component: RequestPasswordReset,
      meta: { guestOnly: true },
    },
    {
      path: "/auth/reset-password",
      name: "reset-password",
      component: ResetPassword,
      meta: { guestOnly: true },
    },
    { path: "/home", name: "home-old", component: Home },
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
      path: "/notifications",
      name: "notifications",
      component: Notifications,
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
      path: "/bookings/:bookingId",
      name: "booking-details",
      component: BookingDetails,
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
    {
      path: "/terms",
      name: "terms",
      component: Terms,
    },
    {
      path: "/privacy",
      name: "privacy",
      component: Privacy,
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

  // Only initialize auth if:
  // 1. Route requires authentication, OR
  // 2. We have a refresh token (user might be logged in), OR
  // 3. We're already initialized
  const hasRefreshToken = localStorage.getItem("refresh_token");
  const shouldInitialize = to.meta.requiresAuth || hasRefreshToken || auth.initialized;

  if (!auth.initialized) {
    if (shouldInitialize) {
      await auth.initialize();
    } else {
      // For public routes without refresh token, mark as initialized (no user)
      // This prevents infinite loading states
      // Use the store's state directly to mark as initialized
      auth.$patch({
        initialized: true,
        status: "idle"
      });
    }
  }

  // Special handling for OAuth callbacks - allow them to complete even if user becomes authenticated
  if (to.name === 'oauth-callback' || to.name === 'oauth-popup-callback') {
    // Allow navigation to OAuth callback regardless of auth state
    // The callback component will handle its own redirect
    return next();
  }
  
  if (to.meta.requiresAuth && !auth.isAuthed) {
    // Show login modal instead of navigating to login page
    return next({ path: to.path, query: { ...to.query, modal: 'login', redirect: to.fullPath } });
  }
  // Don't redirect from guest-only routes if user is authenticated (except OAuth callback which is handled above)
  if (to.meta.guestOnly && auth.isAuthed) {
    return next({ name: "home" });
  }
  
  // If navigating to login/register routes, show modal instead
  if (to.name === 'login' || to.name === 'register') {
    const modalType = to.name === 'login' ? 'login' : 'register';
    return next({ 
      path: to.path === '/login' || to.path === '/register' ? '/' : to.path,
      query: { ...to.query, modal: modalType, redirect: to.query.redirect || to.fullPath }
    });
  }
  
  next();
});

export default router;
