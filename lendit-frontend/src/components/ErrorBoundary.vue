<script>
export default {
  name: "ErrorBoundary",
  data() {
    return { err: null };
  },
  errorCaptured(err) {
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
        : this.$createElement("div", { class: "alert alert-danger" }, "Something went wrong.");
    }
    return this.$slots.default?.();
  },
};
</script>
