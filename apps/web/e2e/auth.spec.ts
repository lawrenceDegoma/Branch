import { prisma } from "@branch/database";
import { createPasswordResetLink } from "@branch/database/password-reset";
import {
  chooseTimezone,
  connectGitHubInDb,
  createGroupInDb,
  expect,
  signUpViaApi,
  test,
} from "./support/fixtures";

test.describe("authentication", () => {
  test("signing up offers Google and GitHub, not a password", async ({ page }) => {
    for (const path of ["/sign-up", "/sign-in"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
    }
  });

  test("a protected page sends you to sign in and back again", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/groups");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fgroups$/);
    await page.getByRole("link", { name: "Sign in with your password" }).click();
    await expect(page).toHaveURL(/\/sign-in\/password\?next=%2Fgroups$/);

    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill(viewer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/groups$/);
  });

  test("a wrong password shows an error and keeps the email", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/sign-in/password");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("don't match");
    await expect(page.getByLabel("Email")).toHaveValue(viewer.email);
  });

  test("sign-in ignores off-site return paths", async ({ page, viewer }) => {
    await page.context().clearCookies();
    await page.goto("/sign-in/password?next=//evil.example/steal");
    await page.getByLabel("Email").fill(viewer.email);
    await page.getByLabel("Password", { exact: true }).fill(viewer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/account\/move$/);
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

  test("a new account chooses a username and timezone, then lands on Home", async ({
    page,
    baseURL,
  }) => {
    const account = await signUpViaApi(page.context().request, baseURL!, undefined, {
      onboard: false,
    });
    await page.goto("/roadmaps");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await page.getByLabel("Username").fill(account.username.toUpperCase());
    await chooseTimezone(page, "Timezone", "Europe/Berlin");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.id },
      include: { profile: true },
    });
    expect(user.profile).toMatchObject({ username: account.username, timezone: "Europe/Berlin" });
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
  test("edits to the profile are saved, and the old profile page leads to them", async ({
    page,
    viewer,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("Name", { exact: true }).fill("Grace Hopper");
    await page.getByLabel("Bio").fill("Debugging since 1947.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Profile saved.");

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/settings#profile$/);
    await expect(page.getByLabel("Bio")).toHaveValue("Debugging since 1947.");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Grace Hopper");
    // The sidebar's account card shows the new name and links back to these settings.
    if ((await page.viewportSize())!.width >= 1024) {
      await expect(page.getByRole("link", { name: /Grace Hopper/ })).toHaveAttribute(
        "href",
        "/settings#profile",
      );
    }
    expect(viewer.username).toBeTruthy();
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

    await device.goto("/sign-in/password");
    await device.getByRole("link", { name: "Forgot password?" }).click();
    await expect(device.getByRole("heading", { level: 1 })).toHaveText("Forgot your password?");

    await device.goto(link!.url);
    await device.getByLabel("New password").fill(newPassword);
    await device.getByRole("button", { name: "Set new password" }).click();
    await expect(device).toHaveURL(/\/sign-in\/password\?reset=done$/);
    await expect(device.getByRole("main").getByRole("status")).toContainText("Password updated");
    await device.getByLabel("Email").fill(viewer.email);
    await device.getByLabel("Password", { exact: true }).fill(newPassword);
    await device.getByRole("button", { name: "Sign in" }).click();
    await expect(device).toHaveURL(/\/account\/move$/);

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
  test("a refused sign-in explains itself", async ({ page }) => {
    // Where Better Auth sends a Google or GitHub sign-in whose email already has a password account.
    await page.goto("/sign-in?error=account_not_linked");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Sign in with your password once more, then connect Google or GitHub.",
    );
  });

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
      if (provider === "google") {
        // Offline access, which the daily photo refresh needs; Google grants it only with consent.
        expect(url.searchParams.get("access_type")).toBe("offline");
        expect(url.searchParams.get("prompt")).toBe("consent");
      }
    });
  }
});

test.describe("moving a password account to Google or GitHub", () => {
  test("a password account is asked to connect one, and keeps everything once it has", async ({
    page,
    baseURL,
  }) => {
    const account = await signUpViaApi(page.context().request, baseURL!, undefined, {
      passwordOnly: true,
    });
    await createGroupInDb(account.id, "Moving crew");
    await page.goto("/home");
    const notice = page.getByRole("region", { name: "Notice" });
    await expect(notice).toContainText("Branch is moving to Google and GitHub sign-in.");
    await notice.getByRole("link", { name: "Connect one to keep your account" }).click();
    await expect(page).toHaveURL(/\/account\/move$/);

    // Connecting hands off to GitHub, which comes back to Branch to link it to this account.
    await page.route("https://github.com/**", (route) => route.fulfill({ body: "provider" }));
    await page.getByRole("button", { name: "Connect GitHub" }).click();
    await page.waitForURL("https://github.com/**");
    expect(new URL(page.url()).searchParams.get("redirect_uri")).toBe(
      `${baseURL}/api/auth/callback/github`,
    );

    // What the callback leaves behind; then the password is switched off.
    await connectGitHubInDb(account.id);
    await page.goto("/account/move");
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "You're all set: you sign in with GitHub now.",
    );
    expect(
      await prisma.account.count({ where: { userId: account.id, providerId: "credential" } }),
    ).toBe(0);
    await page.goto("/home");
    await expect(page.getByRole("region", { name: "Notice" })).toHaveCount(0);
    await page.goto("/groups");
    await expect(page.getByRole("link", { name: "Moving crew" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.locator("#account")).toContainText("You sign in with GitHub.");

    // The old password no longer works.
    const refused = await page.request.post("/api/auth/sign-in/email", {
      data: { email: account.email, password: account.password },
      headers: { Origin: baseURL! },
    });
    expect(refused.ok()).toBe(false);
  });

  test("signing in with a password leads to the move", async ({ page, baseURL }) => {
    const account = await signUpViaApi(page.context().request, baseURL!, undefined, {
      passwordOnly: true,
    });
    await page.goto("/settings");
    await expect(page.locator("#account")).toContainText(
      "You sign in with a password, which Branch is phasing out.",
    );
    await expect(
      page.locator("#account").getByRole("link", { name: "Move to Google or GitHub" }),
    ).toHaveAttribute("href", "/account/move");

    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Sign in with your password" }).click();
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account\/move$/);
    await expect(page.getByRole("button", { name: "Connect Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect GitHub" })).toBeVisible();
  });
});
