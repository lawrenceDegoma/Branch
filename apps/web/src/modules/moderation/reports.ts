import "server-only";
import { prisma, type Prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import { requireVisibleComment } from "@/modules/feed/comments";
import { requireVisiblePost } from "@/modules/feed/service";
import { requireAdmin } from "@/modules/groups/access";
import type { ReportInput, ReportReasonValue } from "./schemas";

// Reports go to the group's admin (owner decision, 2026-11-09), who removes the content (the
// existing audited delete, which takes its reports with it) or dismisses the reports. That
// includes reports about the admin's own content. The reporter is stored but shown to no one.

export const REPORTS_PER_DAY = 10;
const OPEN_SHOWN = 100;
const EXCERPT = 300;

/** Posts a member chose to write or share can be reported; automatic ones are hidden instead. */
const REPORTABLE_KINDS = new Set(["TEXT", "STUDY"]);

/**
 * Reports someone else's post or comment in one of the reporter's groups. Reporting the same
 * thing again does nothing (`created` is false); a report the admin dismissed can't be refiled.
 */
export async function reportContent(userId: string, input: ReportInput, now = new Date()) {
  let groupId: string;
  let authorId: string;
  let isAdmin: boolean;
  if (input.postId) {
    const { post, membership } = await requireVisiblePost(userId, input.postId);
    if (!REPORTABLE_KINDS.has(post.kind)) {
      throw new DomainError("NOT_REPORTABLE", "Automatic posts can't be reported.");
    }
    ({ groupId, authorId } = post);
    isAdmin = membership.role === "ADMIN";
  } else {
    const { comment, post, membership } = await requireVisibleComment(userId, input.commentId!);
    groupId = post.groupId;
    authorId = comment.authorId;
    isAdmin = membership.role === "ADMIN";
  }
  if (authorId === userId) throw new DomainError("OWN", "You can't report your own writing.");
  if (isAdmin) {
    throw new DomainError(
      "ADMIN",
      "You're this group's admin: remove it yourself if it needs to go.",
    );
  }
  const today = await prisma.report.count({
    where: { reporterId: userId, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  if (today >= REPORTS_PER_DAY) {
    throw new DomainError("RATE_LIMITED", "That's a lot of reports today. Try again tomorrow.");
  }
  const { count } = await prisma.report.createMany({
    data: [
      {
        reporterId: userId,
        groupId,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        reason: input.reason,
        note: input.note,
        createdAt: now,
      },
    ],
    skipDuplicates: true,
  });
  return { created: count > 0 };
}

const reportSelect = {
  reason: true,
  note: true,
  createdAt: true,
  post: {
    select: {
      id: true,
      kind: true,
      body: true,
      authorId: true,
      author: { select: { name: true } },
    },
  },
  comment: {
    select: {
      id: true,
      postId: true,
      body: true,
      authorId: true,
      author: { select: { name: true } },
    },
  },
} satisfies Prisma.ReportSelect;

export type ReportedItem = {
  kind: "post" | "comment";
  id: string;
  /** Where to see it in context. */
  postId: string;
  authorName: string;
  /** The start of what was written (plain text; React escapes it). */
  excerpt: string;
  reports: number;
  reasons: { reason: ReportReasonValue; count: number }[];
  notes: string[];
  firstReportedAt: Date;
};

/** The group's open reports, one item per reported post or comment, oldest first. Admin only. */
export async function listOpenReports(adminId: string, groupId: string): Promise<ReportedItem[]> {
  await requireAdmin(adminId, groupId);
  const rows = await prisma.report.findMany({
    where: { groupId, status: "OPEN" },
    orderBy: { id: "asc" },
    take: OPEN_SHOWN,
    select: reportSelect,
  });
  const items = new Map<string, ReportedItem & { reasonCounts: Map<ReportReasonValue, number> }>();
  for (const row of rows) {
    const target = row.post
      ? {
          kind: "post" as const,
          id: row.post.id,
          postId: row.post.id,
          authorName: row.post.author.name,
          body: row.post.body ?? "",
        }
      : {
          kind: "comment" as const,
          id: row.comment!.id,
          postId: row.comment!.postId,
          authorName: row.comment!.author.name,
          body: row.comment!.body,
        };
    const key = `${target.kind}:${target.id}`;
    let item = items.get(key);
    if (!item) {
      item = {
        kind: target.kind,
        id: target.id,
        postId: target.postId,
        authorName: target.authorName,
        excerpt:
          target.body.length > EXCERPT
            ? `${target.body.slice(0, EXCERPT).trimEnd()}…`
            : target.body,
        reports: 0,
        reasons: [],
        notes: [],
        firstReportedAt: row.createdAt,
        reasonCounts: new Map(),
      };
      items.set(key, item);
    }
    item.reports += 1;
    item.reasonCounts.set(row.reason, (item.reasonCounts.get(row.reason) ?? 0) + 1);
    if (row.note) item.notes.push(row.note);
  }
  return [...items.values()].map(({ reasonCounts, ...item }) => ({
    ...item,
    reasons: [...reasonCounts].map(([reason, count]) => ({ reason, count })),
  }));
}

/** How many posts and comments in the group have open reports, for the admin's group page. */
export async function countOpenReports(groupId: string): Promise<number> {
  const rows = await prisma.report.groupBy({
    by: ["postId", "commentId"],
    where: { groupId, status: "OPEN" },
  });
  return rows.length;
}

/** The admin leaves a reported post or comment up: its open reports are dismissed (audited). */
export async function dismissReports(
  adminId: string,
  groupId: string,
  target: { postId: string } | { commentId: string },
  now = new Date(),
) {
  await requireAdmin(adminId, groupId);
  const where = { groupId, status: "OPEN" as const, ...target };
  const open = await prisma.report.findFirst({
    where,
    select: { post: { select: { authorId: true } }, comment: { select: { authorId: true } } },
  });
  if (!open) throw new NotFoundError("Those reports are already dealt with.");
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.report.updateMany({
      where,
      data: { status: "DISMISSED", resolvedAt: now, resolvedById: adminId },
    });
    await tx.groupAuditEvent.create({
      data: {
        groupId,
        action: "REPORT_DISMISSED",
        actorId: adminId,
        subjectUserId: open.post?.authorId ?? open.comment?.authorId ?? null,
        metadata: { ...target, reports: count },
      },
    });
  });
}
