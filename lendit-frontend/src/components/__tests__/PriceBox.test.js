import { mount } from "@vue/test-utils";
import PriceBox from "../PriceBox.vue";

describe("PriceBox", () => {
  it("computes totals correctly", async () => {
    const w = mount(PriceBox, { props: { pricePerDay: 20 } });
    const inputs = w.findAll("input");

    // Set date range: 2025-10-01 to 2025-10-04 (3 days)
    await inputs[0].setValue("2025-10-01");
    await inputs[1].setValue("2025-10-04");

    // Check that the component shows the correct calculations
    // 3 days * $20 = $60 subtotal
    // 8% service fee = ~$5
    // Total = ~$65
    expect(w.html()).toContain("$60"); // subtotal
    expect(w.html()).toMatch(/Total.*\$6[0-9]/); // total should be in 60s
  });

  it("handles empty date range", async () => {
    const w = mount(PriceBox, { props: { pricePerDay: 20 } });

    // No dates set, should show $0 total (no days calculation shown)
    expect(w.html()).toContain("$0");
    expect(w.html()).not.toContain("day(s)"); // days calculation is hidden when 0
  });

  it("emits request event on submit", async () => {
    const w = mount(PriceBox, { props: { pricePerDay: 20 } });
    const inputs = w.findAll("input");

    // Set valid date range
    await inputs[0].setValue("2025-10-01");
    await inputs[1].setValue("2025-10-03");

    // Find and click submit button (no type="submit", just click)
    const submitButton = w.find("button");
    await submitButton.trigger("click");

    // Check that request event was emitted
    expect(w.emitted("request")).toBeTruthy();
    expect(w.emitted("request")[0][0]).toHaveProperty(
      "date_from",
      "2025-10-01"
    );
    expect(w.emitted("request")[0][0]).toHaveProperty("date_to", "2025-10-03");
  });

  it("disables submit button for invalid dates", async () => {
    const w = mount(PriceBox, { props: { pricePerDay: 20 } });

    // No dates set, submit button should be disabled
    const submitButton = w.find("button");
    expect(submitButton.attributes("disabled")).toBeDefined();
  });
});
