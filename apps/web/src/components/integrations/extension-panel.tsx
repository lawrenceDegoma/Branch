import { EXTENSION_DISCLOSURE } from "@branch/shared/extension";
import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import { disconnectExtensionAction } from "@/modules/integrations/actions";
import type { listConnections } from "@/modules/integrations/connections";
import { CONNECT_BUTTON_ID, ConnectForm } from "./connect-form";

/** Settings: the browsers connected to this account, connecting another, and synced submissions. */
export function ExtensionPanel({
  connections,
  now,
  timeZone,
}: {
  connections: Awaited<ReturnType<typeof listConnections>>;
  now: Date;
  timeZone: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {connections.length > 0 ? (
        <ul aria-label="Connected browsers" className="flex flex-col gap-3">
          {connections.map((connection, index) => (
            <li key={connection.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                <p className="font-medium">Browser {index + 1}</p>
                <p className="text-xs text-ink-muted">
                  Connected{" "}
                  <time
                    dateTime={connection.createdAt.toISOString()}
                    title={formatDateTime(connection.createdAt, timeZone)}
                  >
                    {formatRelative(connection.createdAt, now, timeZone)}
                  </time>
                  {" · "}
                  {connection.lastUsedAt ? (
                    <>
                      last used{" "}
                      <time
                        dateTime={connection.lastUsedAt.toISOString()}
                        title={formatDateTime(connection.lastUsedAt, timeZone)}
                      >
                        {formatRelative(connection.lastUsedAt, now, timeZone)}
                      </time>
                    </>
                  ) : (
                    "not used yet"
                  )}
                </p>
              </div>
              <ConfirmAction
                action={disconnectExtensionAction}
                fields={{ connectionId: connection.id }}
                focusAfterRemoval={CONNECT_BUTTON_ID}
                trigger="Disconnect"
                title="Disconnect this browser?"
                description="Its extension stops syncing at once. Submissions already synced stay."
                confirmLabel="Disconnect"
                pendingLabel="Disconnecting…"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">No browser is connected.</p>
      )}
      <p className="text-ink-muted">
        {EXTENSION_DISCLOSURE} Connecting means you agree to this.{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-4">
          Privacy policy
        </Link>
      </p>
      <ConnectForm />
      <div className="border-t border-line pt-4">
        <Link
          href="/settings/submissions"
          className={buttonVariants({ variant: "ghost", className: "-ml-3" })}
        >
          Synced submissions
        </Link>
      </div>
    </div>
  );
}
