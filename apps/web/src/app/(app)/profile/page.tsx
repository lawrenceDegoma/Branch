import { permanentRedirect } from "next/navigation";

/** Profile details live in Settings. Old links still work. */
export default function ProfileMovedToSettings() {
  permanentRedirect("/settings#profile");
}
