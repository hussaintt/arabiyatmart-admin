import { expect, test } from "@playwright/test";

test("invalid admin login stays fail-closed and shows the Arabic error", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "بيانات الدخول غير صحيحة" } }) });
      return;
    }
    await route.continue();
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "مرحبًا بعودتك" })).toBeVisible();
  await page.getByLabel("البريد الإلكتروني").fill("invalid@example.com");
  await page.getByRole("textbox", { name: "كلمة المرور", exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "دخول آمن" }).click();
  await expect(page.getByText("بيانات الدخول غير صحيحة", { exact: true })).toBeVisible();
});

test.describe("protected business route coverage", () => {
  for (const route of [
    "/dashboard", "/listings", "/listings/example", "/market", "/users", "/users/example",
    "/dealers", "/dealers/example", "/operations", "/trust", "/imports", "/jobs", "/settings", "/audit",
  ]) {
    test(`${route} redirects an unauthenticated request to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login\?next=/);
      await expect(page.getByRole("heading", { name: "مرحبًا بعودتك" })).toBeVisible();
    });
  }
});
