"use client";

import { useRef, useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/user/avatar";
import { initialFormState, type FormState } from "@/lib/form";
import { choosePhotoAction, uploadPhotoAction } from "@/modules/profile/actions";
import { PHOTO_SIZE } from "@/modules/profile/photo";

/** Crops the middle square of an image and scales it to PHOTO_SIZE, as WebP (JPEG if need be). */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Browsers that can't write WebP hand back a PNG instead; JPEG is smaller then.
  const webp = await encode("image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", 0.9);
  if (!blob) throw new Error("Couldn't encode");
  return blob;
}

/**
 * The photo people see next to your name: Google's or GitHub's by default, one you upload, or
 * your initials. Uploads are cropped and shrunk here, then checked again on the server.
 */
export function PhotoForm({
  userId,
  name,
  photo,
  choice,
  providerPhotoLabel,
  uploadsEnabled,
}: {
  userId: string;
  name: string;
  /** What people see now (null: initials). */
  photo: string | null;
  choice: "PROVIDER" | "UPLOAD" | "NONE";
  /** For example "Use my GitHub photo"; null when Google or GitHub gave no photo. */
  providerPhotoLabel: string | null;
  uploadsEnabled: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The buttons change with the choice; the upload button (or, without uploads, this panel)
  // stays, so focus returns there.
  const refocus = () => (uploadButton.current ?? panel.current)?.focus();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(initialFormState);

  function run(action: (prev: FormState, data: FormData) => Promise<FormState>, data: FormData) {
    if (pending) return;
    startTransition(async () => {
      const result = await action(initialFormState, data);
      const fieldError = result.fieldErrors?.photo;
      setState(fieldError ? { status: "error", message: fieldError } : result);
      refocus();
    });
  }

  async function upload(file: File) {
    let blob: Blob;
    try {
      blob = await resize(file);
    } catch {
      setState({
        status: "error",
        message: "Branch couldn't read that image. Choose a JPEG, PNG, or WebP photo.",
      });
      refocus();
      return;
    }
    const data = new FormData();
    data.set("photo", new File([blob], "photo", { type: blob.type }));
    run(uploadPhotoAction, data);
  }

  function choose(value: "PROVIDER" | "NONE") {
    const data = new FormData();
    data.set("photo", value);
    run(choosePhotoAction, data);
  }

  const current =
    choice === "UPLOAD"
      ? "Your uploaded photo."
      : photo
        ? "Your photo from Google or GitHub."
        : "Your initials, for now.";

  return (
    <div ref={panel} tabIndex={-1} className="flex flex-col gap-4 border-b border-line pb-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar userId={userId} name={name} photo={photo} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-ink-muted">{current}</p>
          <div className="flex flex-wrap gap-2">
            {uploadsEnabled ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Photo to upload"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void upload(file);
                  }}
                />
                <Button
                  ref={uploadButton}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-disabled={pending}
                  onClick={() => {
                    if (!pending) fileInput.current?.click();
                  }}
                >
                  {pending
                    ? "Saving…"
                    : choice === "UPLOAD"
                      ? "Upload a new photo"
                      : "Upload a photo"}
                </Button>
              </>
            ) : null}
            {providerPhotoLabel && choice !== "PROVIDER" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-disabled={pending}
                onClick={() => choose("PROVIDER")}
              >
                {providerPhotoLabel}
              </Button>
            ) : null}
            {photo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-disabled={pending}
                onClick={() => choose("NONE")}
              >
                Use my initials
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <FormAlert state={state} />
    </div>
  );
}
