"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form";
import { formatElapsed, formatStudyTime, MAX_SESSION_MS } from "@/modules/study/duration";
import { STUDY_NOTE_MAX } from "@/modules/study/schemas";
import {
  decideStudyAction,
  deleteStudyAction,
  startStudyAction,
  stopStudyAction,
} from "@/modules/study/actions";

type Running = { id: string; startedAt: string; expired: boolean } | null;
type Group = { id: string; name: string };

/**
 * Home's study timer: an orange button above "Your week" (an owner-approved exception to the
 * no-orange-buttons rule). It counts from the server's start time, so it survives reloads and
 * other devices; the ticking time isn't announced, only starting and stopping are. Stopping may
 * ask whether to share the session to a group.
 */
export function StudyTimer({ running, groups }: { running: Running; groups: Group[] }) {
  const [message, setMessage] = useState<{ text: string; href?: string } | null>(null);
  const [asking, setAsking] = useState<{ sessionId: string; time: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  const [, start] = useActionState(async (prev: FormState) => {
    const result = await startStudyAction(prev);
    setMessage({ text: "Timer started." });
    return result;
  }, initialFormState);
  const [, stop] = useActionState(async (prev: FormState) => {
    const result = await stopStudyAction(prev);
    setMessage(result.message ? { text: result.message } : null);
    if (result.data?.ask && result.data.sessionId) {
      setAsking({ sessionId: result.data.sessionId, time: result.data.time ?? "" });
    }
    return result;
  }, initialFormState);
  const [, discard] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await deleteStudyAction(prev, data);
    setMessage(result.message ? { text: result.message } : null);
    return result;
  }, initialFormState);

  return (
    <div className="flex flex-col gap-2">
      {running?.expired ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5">
          <p>
            You left the study timer running. It stopped counting at{" "}
            {formatStudyTime(MAX_SESSION_MS)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={stop}>
              <SubmitButton ref={button} variant="study" size="sm" pendingLabel="Saving…">
                Save {formatStudyTime(MAX_SESSION_MS)}
              </SubmitButton>
            </form>
            <form action={discard}>
              <input type="hidden" name="sessionId" value={running.id} />
              <SubmitButton variant="ghost" size="sm" pendingLabel="Deleting…">
                Delete it
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        // One form and one button for both states, so focus stays put when it flips.
        <form action={running ? stop : start} className="flex items-center gap-3">
          <SubmitButton
            ref={button}
            variant="study"
            size="lg"
            className="flex-1"
            pendingLabel={running ? "Stopping…" : "Starting…"}
          >
            {running ? "Stop studying" : "Start studying"}
          </SubmitButton>
          {running ? <Elapsed startedAt={running.startedAt} /> : null}
        </form>
      )}
      <p role="status" className="text-xs text-ink-muted empty:hidden">
        {message ? (
          <>
            {message.text}
            {message.href ? (
              <>
                {" "}
                <Link href={message.href} className="text-ink underline underline-offset-4">
                  View post
                </Link>
              </>
            ) : null}
          </>
        ) : null}
      </p>
      {asking ? (
        <ShareSession
          key={asking.sessionId}
          sessionId={asking.sessionId}
          time={asking.time}
          groups={groups}
          onDone={(text, href) => {
            setAsking(null);
            setMessage({ text, href });
            // The dialog opened on its own, so send focus back to the timer deliberately.
            requestAnimationFrame(() => button.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The running time, "42:05", ticking once a second. Screen readers get the start time instead,
 * which doesn't change, so nothing is announced every second.
 */
function Elapsed({ startedAt }: { startedAt: string }) {
  const start = new Date(startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="text-lg font-semibold tabular">
      <span aria-hidden data-elapsed>
        {formatElapsed(Math.min(now - start.getTime(), MAX_SESSION_MS))}
      </span>
      <span className="sr-only">
        Studying since {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
    </p>
  );
}

/** After a session: share it to a group (with a note), or not, and maybe remember the choice. */
function ShareSession({
  sessionId,
  time,
  groups,
  onDone,
}: {
  sessionId: string;
  time: string;
  groups: Group[];
  onDone: (message: string, href?: string) => void;
}) {
  const [state, action] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await decideStudyAction(prev, data);
    if (result.status === "success") onDone(result.message ?? "Saved.", result.data?.href);
    return result;
  }, initialFormState);
  const errors = state.fieldErrors ?? {};
  const id = `study-${sessionId}`;
  const canShare = groups.length > 0;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onDone("Not shared.");
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>Share this session?</AlertDialogTitle>
        <AlertDialogDescription>
          You studied for {time}.{" "}
          {canShare
            ? "Share it to a group and its members see it as a post of yours, which you can delete later."
            : "Join a group to share your sessions."}
        </AlertDialogDescription>
        <form action={action} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="sessionId" value={sessionId} />
          {canShare ? (
            <>
              <FormField name={`${id}-group`} label="Group" error={errors.groupId}>
                {(props) => (
                  <NativeSelect
                    {...props}
                    name="groupId"
                    defaultValue={state.values?.groupId ?? groups[0]?.id}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField name={`${id}-note`} label="Note (optional)" error={errors.note}>
                {(props) => (
                  <Textarea
                    {...props}
                    name="note"
                    rows={2}
                    maxLength={STUDY_NOTE_MAX}
                    defaultValue={state.values?.note}
                  />
                )}
              </FormField>
              <CheckboxField
                id={`${id}-remember`}
                name="remember"
                label="Remember my decision"
                description="Later sessions follow this choice without asking: always to this group, or never. Change it in Settings → Sharing."
                defaultChecked={state.values?.remember === "on"}
              />
            </>
          ) : null}
          {state.status === "error" && state.message ? <FormAlert state={state} /> : null}
          <AlertDialogFooter>
            <SubmitButton name="intent" value="skip" variant="ghost" pendingLabel="Saving…">
              Don&apos;t share
            </SubmitButton>
            {canShare ? (
              <SubmitButton name="intent" value="share" pendingLabel="Sharing…">
                Share
              </SubmitButton>
            ) : null}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
