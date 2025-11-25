<script>
import { h } from 'vue';

export default {
  name: "ErrorBoundary",
  data() {
    return { err: null };
  },
  errorCaptured(err, instance, info) {
    console.error('ErrorBoundary caught an error:', err);
    console.error('Error info:', info);
    console.error('Component instance:', instance);
    this.err = err;
    // prevent from bubbling to app
    return false;
  },
  methods: {
    reset() {
      this.err = null;
    },
  },
  render() {
    if (this.err) {
      return this.$slots.fallback
        ? this.$slots.fallback({ error: this.err, reset: this.reset })
        : h("div", { class: "alert alert-danger" }, "Something went wrong.");
    }
    return this.$slots.default?.();
  },
};
</script>
