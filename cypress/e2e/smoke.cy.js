describe("Smoke", () => {
  it("loads home and navigates to search", () => {
    cy.visit("/");
    cy.contains("Start searching").click();
    cy.url().should("include", "/search");
    cy.contains("Filters");
  });

  it("loads messages page", () => {
    cy.visit("/messages");
    // Messages page should load (might redirect to login if not authenticated)
    cy.url().should("match", /\/(messages|login)/);
  });

  it("loads item page", () => {
    cy.visit("/item/1");
    cy.contains("About this item");
  });

  it("loads dashboard (requires auth)", () => {
    cy.visit("/dashboard");
    // Should redirect to login since not authenticated
    cy.url().should("include", "/login");
  });

  it("loads login page", () => {
    cy.visit("/login");
    cy.contains("Sign in");
    cy.get('input[type="email"]').should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
  });
});
