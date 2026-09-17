import { expect, test } from "@playwright/test";

test("guest can ask a question and check availability", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Asteria Grand Hotel" })).toBeVisible();
  await page.getByTestId("talk-button").click();

  await expect(page.getByText(/I'm Leela at the Asteria desk/)).toBeVisible();

  await page.getByRole("button", { name: "What time is check-in?" }).click();

  await expect(page.getByTestId("assistant-message").filter({ hasText: "3:00 PM" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId("chat-input").fill("Do you have rooms available?");
  await expect(page.getByTestId("send-button")).toBeEnabled();
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("availability-form")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("calendar-day-2026-09-20").click();
  await page.getByTestId("calendar-day-2026-09-22").click();
  await page.getByTestId("guests").fill("3");
  await page.getByTestId("check-availability").click();

  await expect(page.getByTestId("room-results")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("room-card").filter({ hasText: "Family Room" })).toBeVisible();
});

test("staff can sign in to the operations desk", async ({ page }) => {
  await page.goto("/staff/login");
  await page.getByLabel("Password").fill("asteria-desk");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Front desk" })).toBeVisible();
  await page.getByRole("button", { name: "Operations" }).click();
  await expect(page.getByRole("heading", { name: "Room operations" })).toBeVisible();
  await expect(page.getByText("Family Room")).toBeVisible();
});
