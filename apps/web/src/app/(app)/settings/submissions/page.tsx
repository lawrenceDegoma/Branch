import { permanentRedirect } from "next/navigation";

/** Your solutions moved into Review. Old links still work. */
export default function MovedToReview() {
  permanentRedirect("/solutions");
}
