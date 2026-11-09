import { prisma } from "@branch/database";
import { anotherUser, createGroupInDb, expect, solveInDb, test } from "./support/fixtures";

test("milestones show in Settings, and in the group for people who share their solves", async ({
  page,
  viewer,
  browser,
  baseURL,
}) => {
  const friend = await anotherUser(browser, baseURL!);
  const group = await createGroupInDb(viewer.id, "Badge crew", [friend.account.id]);
  await solveInDb(viewer.id, ["two-sum"]);
  await solveInDb(friend.account.id, ["two-sum"]);
  await prisma.profile.update({
    where: { userId: friend.account.id },
    data: { shareSolves: true },
  });

  await page.goto("/settings");
  const badges = page.getByRole("list", { name: "Badges" });
  await expect(badges.getByRole("listitem").filter({ hasText: "First solve" })).toContainText(
    "Earned",
  );
  await expect(badges.getByRole("listitem").filter({ hasText: "10 solved" })).toContainText(
    "Solve 10 problems.",
  );

  // In the group: the friend shares their solves, so their badge shows; the viewer doesn't.
  await page.goto(`/groups/${group.id}`);
  const members = page.getByRole("region", { name: /Members/ });
  await expect(
    members.getByRole("listitem").filter({ hasText: friend.account.name }),
  ).toContainText("First solve");
  await expect(members.getByRole("listitem").filter({ hasText: viewer.name })).not.toContainText(
    "First solve",
  );
  await friend.context.close();
});
