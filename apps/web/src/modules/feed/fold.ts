// Long posts fold in feeds behind "Show more" (owner decision, 2026-11-17), so one post can't take
// over the screen. This picks the candidates on the server; the browser then checks whether the
// post really is taller than the fold and drops it when it fits.

const LINES = 12;
const CHARACTERS = 900;

/** Whether a post's Markdown might be taller than the fold. */
export function mightBeLong(body: string): boolean {
  return body.length > CHARACTERS || body.split("\n").length > LINES;
}
