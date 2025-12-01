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
        : h(
            "div",
            { class: "alert alert-danger" },
            [
              h("div", { class: "fw-semibold mb-1" }, "Something went wrong."),
              h("div", { class: "small text-muted mb-1" }, String(this.err && (this.err.message || this.err))),
              h(
                "pre",
                {
                  class: "small mb-0",
                  style: "white-space: pre-wrap; word-break: break-word;",
                },
                this.err && this.err.stack ? String(this.err.stack) : ""
              ),
            ]
          );
    }
    return this.$slots.default?.();
  },
};
</script>
