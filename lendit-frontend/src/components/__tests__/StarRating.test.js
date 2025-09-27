import { mount } from "@vue/test-utils";
import StarRating from "../StarRating.vue";

describe("StarRating", () => {
  it("renders 5 stars", () => {
    const w = mount(StarRating, { props: { modelValue: 3, readonly: true } });
    expect(w.findAll("i").length).toBe(5);
  });

  it("emits update on click (interactive)", async () => {
    const w = mount(StarRating, { props: { modelValue: 0 } });
    await w.findAll("i")[3].trigger("click");
    expect(w.emitted()["update:modelValue"][0][0]).toBe(4);
  });

  it("shows filled stars based on modelValue", () => {
    const w = mount(StarRating, { props: { modelValue: 3, readonly: true } });
    const stars = w.findAll("i");
    expect(stars[0].classes()).toContain("bi-star-fill");
    expect(stars[1].classes()).toContain("bi-star-fill");
    expect(stars[2].classes()).toContain("bi-star-fill");
    expect(stars[3].classes()).not.toContain("bi-star-fill");
    expect(stars[4].classes()).not.toContain("bi-star-fill");
  });

  it("does not emit when readonly", async () => {
    const w = mount(StarRating, { props: { modelValue: 0, readonly: true } });
    await w.findAll("i")[2].trigger("click");
    expect(w.emitted()["update:modelValue"]).toBeFalsy();
  });
});
