import { prisma } from "@branch/database";
import { createPasswordResetLink } from "@branch/database/password-reset";
import { chooseTimezone, expect, newAccountDetails, signUpViaApi, test } from "./support/fixtures";

test.describe("authentication", () => {
  test("a new user signs up, chooses a username, and lands on Home", async ({ page }) => {
    const account = newAccountDetails("signup");
    await page.goto("/");
    await page.getByRole("link", { name: "Create account" }).click();

    await page.getByLabel("Name", { exact: true }).fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await page.getByLabel("Username").fill(account.username.toUpperCase());
    await chooseTimezone(page, "Timezone", "Europe/Berlin");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: account.email },
      include: { profile: true },
    });
    expect(user.profile).toMatchObject({ username: account.username, timezone: "Europe/Berlin" });
  });

  test("sign-up shows field errors and keeps what was typed", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name", { exact: true }).fill("Ada");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ada");
  });

  test("an existing email cannot sign up again", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("Name", { exact: true }).fill("Someone Else");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill("another-long-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("already exists");
  });

  test("a protected page sends you to sign in and back again", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/groups");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fgroups$/);

    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill(viewer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/groups$/);
  });

  test("a wrong password shows an error and keeps the email", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("don't match");
    await expect(page.getByLabel("Email")).toHaveValue(viewer.email);
  });

  test("sign-in ignores off-site return paths", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/sign-in?next=//evil.example/steal");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill(viewer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/home$/);
  });

  test("signed-in visitors skip the sign-in and landing pages", async ({
    page,
    viewer: _viewer,
  }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/home$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);
  });

  test("an account without a profile is sent to onboarding", async ({ page, baseURL }) => {
    await signUpViaApi(page.context().request, baseURL!, undefined, { onboard: false });
    await page.goto("/roadmaps");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("onboarding rejects a username that is taken", async ({ page, baseURL, viewer }) => {
    await page.context().clearCookies();
    await signUpViaApi(page.context().request, baseURL!, undefined, { onboard: false });
    await page.goto("/onboarding");
    await page.getByLabel("Username").fill(viewer.username);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("That username is taken. Try another.")).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAttribute("aria-invalid", "true");
  });

  test("signing out ends the session", async ({ page, viewer: _viewer }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("profile", () => {
  test("edits to the profile appear on the profile page", async ({ page, viewer }) => {
    await page.goto("/settings");
    await page.getByLabel("Name", { exact: true }).fill("Grace Hopper");
    await page.getByLabel("Bio").fill("Debugging since 1947.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Profile saved.");

    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Grace Hopper" })).toBeVisible();
    await expect(page.getByText("Debugging since 1947.")).toBeVisible();
    await expect(page.getByRole("main").getByText(`@${viewer.username}`)).toBeVisible();
  });

  test("a password change takes effect", async ({ page, viewer }) => {
    const newPassword = "an-even-better-password";
    await page.goto("/settings");
    await page.getByLabel("Current password").fill(viewer.password);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Password updated.");

    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});

test.describe("password reset", () => {
  test("an owner-issued link sets a new password once and signs out other devices", async ({
    page,
    viewer,
    baseURL,
  }) => {
    // The viewer is signed in here; the reset link is opened on another device.
    const link = await createPasswordResetLink(prisma, viewer.email, baseURL!);
    const newPassword = "a-freshly-reset-password";
    const other = await page.context().browser()!.newContext({ baseURL });
    const device = await other.newPage();

    await device.goto("/sign-in");
    await device.getByRole("link", { name: "Forgot password?" }).click();
    await expect(device.getByRole("heading", { level: 1 })).toHaveText("Forgot your password?");

    await device.goto(link!.url);
    await device.getByLabel("New password").fill(newPassword);
    await device.getByRole("button", { name: "Set new password" }).click();
    await expect(device).toHaveURL(/\/sign-in\?reset=done$/);
    await expect(device.getByRole("main").getByRole("status")).toContainText("Password updated");
    await device.getByLabel("Email").fill(viewer.email);
    await device.getByLabel("Password", { exact: true }).fill(newPassword);
    await device.getByRole("button", { name: "Sign in" }).click();
    await expect(device).toHaveURL(/\/home$/);

    // The old session is gone, and the link can't be used twice.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto(link!.url);
    await page.getByLabel("New password").fill("yet-another-password");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "expired or was already used",
    );
    await other.close();
  });
});

test.describe("social sign-in", () => {
  for (const [label, host, provider] of [
    ["Google", "accounts.google.com", "google"],
    ["GitHub", "github.com", "github"],
  ] as const) {
    test(`Continue with ${label} hands off to ${label} with Branch's callback`, async ({
      page,
      baseURL,
    }) => {
      // Stop at the provider: answer its authorize page locally instead of leaving the test.
      await page.route(`https://${host}/**`, (route) => route.fulfill({ body: "provider" }));
      for (const path of ["/sign-in", "/sign-up"]) {
        await page.goto(path);
        await expect(page.getByRole("button", { name: `Continue with ${label}` })).toBeVisible();
      }
      await page.getByRole("button", { name: `Continue with ${label}` }).click();
      await page.waitForURL(`https://${host}/**`);
      const url = new URL(page.url());
      expect(url.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/auth/callback/${provider}`);
      expect(url.searchParams.get("client_id")).toBe(`e2e-${provider}-client`);
    });
  }
});
