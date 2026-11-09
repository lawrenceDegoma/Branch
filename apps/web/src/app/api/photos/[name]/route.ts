import { photoStorage, readLocalPhoto } from "@/modules/profile/photo-storage";

/**
 * Serves photos from the local storage (development and tests). With Vercel Blob configured,
 * photos load from Blob instead and this route finds nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  if (photoStorage()?.kind !== "local") return new Response(null, { status: 404 });
  const photo = await readLocalPhoto((await params).name);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
