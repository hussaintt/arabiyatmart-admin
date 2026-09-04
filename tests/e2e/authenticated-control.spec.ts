import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("e2e-admin@yallamotors.test");
  await page.getByRole("textbox", { name: "كلمة المرور", exact: true }).fill("E2e-Admin-Password-123!");
  await page.getByRole("button", { name: "دخول آمن" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "لوحة التحكم", level: 1 })).toBeVisible();
}

test.describe.serial("authenticated production controls", () => {
  test("loads every primary admin module with a backend-issued session and no server errors", async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/backend/") && response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
    });
    await login(page);
    for (const route of ["/listings", "/market", "/users", "/dealers", "/operations", "/trust", "/imports", "/jobs", "/settings", "/audit"]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
      await expect(page.locator("main").last()).toBeVisible();
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("sorts the listing preview through the server", async ({ page }) => {
    await login(page);
    await page.goto("/listings");
    const sort = page.getByLabel("ترتيب الإعلانات");
    await expect(sort).toHaveValue("created-desc");
    const sortedResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/backend/v1/admin/listings"
        && url.searchParams.get("sort") === "priceCents"
        && url.searchParams.get("direction") === "asc";
    });
    await sort.selectOption("price-asc");
    const response = await sortedResponse;
    expect(response.status()).toBe(200);
    const body = await response.json() as { data: Array<{ priceCents: number }> };
    const prices = body.data.map((listing) => listing.priceCents);
    expect(prices).toEqual([...prices].sort((left, right) => left - right));
  });

  test("edits a real seeded listing through the complete control form", async ({ page }) => {
    const imageFailures: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "image") {
        imageFailures.push(`${request.failure()?.errorText ?? "unknown error"} ${request.url()}`);
      }
    });
    await login(page);
    await page.goto("/listings/seed_listing_04");
    await expect(page.getByRole("heading", { name: /Toyota|تويوتا/i })).toBeVisible();
    const listingImages = page.locator("main img");
    await expect(listingImages).toHaveCount(1);
    await expect(listingImages.first()).toHaveAttribute("src", /^http:\/\/127\.0\.0\.1:3020\/uploads\//);
    await page.waitForTimeout(250);
    expect(imageFailures, imageFailures.join("\n")).toEqual([]);
    await expect.poll(async () => listingImages.evaluateAll((images) => images.every((image) => {
      const element = image as HTMLImageElement;
      return element.complete && element.naturalWidth > 0;
    }))).toBe(true);
    await page.getByRole("button", { name: "تعديل كامل" }).click();
    const mileage = page.getByLabel("الكيلومترات");
    await mileage.fill("45123");
    const saveCompleted = page.waitForResponse((response) =>
      response.url().includes("/api/backend/v1/admin/listings/seed_listing_04") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "حفظ كل التغييرات" }).click();
    const saveResponse = await saveCompleted;
    expect(
      saveResponse.status(),
      `${await saveResponse.text()}\n${saveResponse.request().postData() ?? "no request body"}`,
    ).toBe(200);
    await expect(page.getByText("٤٥٬١٢٣ كم")).toBeVisible();
  });

  test("uploads and saves a dealer logo, then exposes all marketplace profile fields", async ({ page }) => {
    await login(page);
    await page.goto("/dealers");
    await page.getByRole("link", { name: /توب كارز مصر/ }).click();
    await page.getByRole("button", { name: "تعديل كامل" }).click();
    const uploadCompleted = page.waitForResponse((response) =>
      response.url().includes("/api/backend/v1/admin/files/upload") && response.status() === 201,
    );
    await page.locator("#dealer-logo").setInputFiles({
      name: "client-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    await uploadCompleted;
    await expect(page.getByText("جارٍ الرفع…")).toHaveCount(0, { timeout: 15_000 });
    await page.getByLabel("عنوان النشاط").fill("90th Street, New Cairo");
    await page.getByRole("button", { name: "حفظ كل التغييرات" }).click();
    await expect(page.getByText("90th Street, New Cairo")).toBeVisible();
  });
});
