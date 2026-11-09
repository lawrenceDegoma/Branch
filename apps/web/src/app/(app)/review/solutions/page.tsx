import { permanentRedirect } from "next/navigation";

/** Solutions has its own tab now. Old links still work. */
export default function MovedToSolutions() {
  permanentRedirect("/solutions");
}
