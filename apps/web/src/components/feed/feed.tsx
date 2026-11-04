import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { ComposerGroup, FeedPage } from "@/modules/feed/service";
import { Composer } from "./composer";
import { PostCard } from "./post-card";

/**
 * A feed: composer, posts newest first, and a link to older posts. Used on Home (every group,
 * filterable) and on a group page (that group only).
 */
export function Feed({
  page,
  composerGroups,
  basePath,
  query,
  showGroup,
  timeZone,
  filter,
  isOlderPage,
}: {
  page: FeedPage;
  composerGroups: ComposerGroup[];
  /** Path the "Older posts" link stays on, with `query` kept alongside the cursor. */
  basePath: string;
  query?: Record<string, string>;
  showGroup: boolean;
  timeZone: string;
  filter?: React.ReactNode;
  isOlderPage: boolean;
}) {
  const now = new Date();
  const older = page.nextCursor
    ? `${basePath}?${new URLSearchParams({ ...query, before: page.nextCursor })}`
    : null;
  const newest = `${basePath}${query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
      <h2 id="activity-heading" className="text-base font-medium">
        Activity
      </h2>
      {filter}
      {isOlderPage ? (
        <Link
          href={newest}
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          Back to newest
        </Link>
      ) : composerGroups.length > 0 ? (
        <Composer groups={composerGroups} />
      ) : null}
      {page.items.length > 0 ? (
        <ol aria-label="Posts" className="flex flex-col gap-3">
          {page.items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} now={now} timeZone={timeZone} showGroup={showGroup} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={isOlderPage ? "No older posts" : "No posts yet"}
          description={
            isOlderPage
              ? "You've reached the beginning."
              : "Ask for help, share a tip, or say how this week is going. Only members of the group see it."
          }
        />
      )}
      {older ? (
        <Link
          href={older}
          className={buttonVariants({ variant: "outline", className: "self-center" })}
        >
          Older posts
        </Link>
      ) : null}
    </section>
  );
}

/** Group filter for Home: links, so the choice is in the URL and works without JavaScript. */
export function GroupFilter({
  groups,
  selected,
}: {
  groups: { id: string; name: string }[];
  selected?: string;
}) {
  if (groups.length < 2) return null;
  const options = [{ id: undefined, name: "All groups" }, ...groups];
  return (
    <nav aria-label="Filter by group">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const current = option.id === selected;
          return (
            <li key={option.id ?? "all"}>
              <Link
                href={option.id ? `/home?group=${option.id}` : "/home"}
                aria-current={current ? "page" : undefined}
                className={buttonVariants({ variant: current ? "secondary" : "ghost", size: "sm" })}
              >
                {option.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
