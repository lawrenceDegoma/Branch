import { describe, expect, it } from "vitest";
import { shownPhoto, sniffPhotoType } from "./photo";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("sniffPhotoType", () => {
  it("recognizes JPEG, PNG, and WebP by their first bytes", () => {
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffPhotoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(sniffPhotoType(webp)).toBe("image/webp");
  });

  it("refuses everything else, SVG and lookalikes included", () => {
    expect(sniffPhotoType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffPhotoType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVE"))).toBeNull();
    expect(sniffPhotoType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffPhotoType(bytes())).toBeNull();
  });
});

describe("shownPhoto", () => {
  const google = "https://lh3.googleusercontent.com/a/photo";
  it("shows the upload, then the provider's photo, unless the person chose none", () => {
    const upload = "https://x.public.blob.vercel-storage.com/photos/a.webp";
    expect(shownPhoto({ image: google, profile: { photo: "UPLOAD", photoUrl: upload } })).toBe(
      upload,
    );
    expect(shownPhoto({ image: google, profile: { photo: "PROVIDER", photoUrl: null } })).toBe(
      google,
    );
    expect(shownPhoto({ image: google, profile: null })).toBe(google);
    expect(shownPhoto({ image: google, profile: { photo: "NONE", photoUrl: null } })).toBeNull();
  });

  it("never shows a provider photo that isn't https", () => {
    for (const image of ["http://example.com/a.png", "javascript:alert(1)", "data:image/png,x"]) {
      expect(shownPhoto({ image, profile: null })).toBeNull();
    }
    expect(shownPhoto({ image: null, profile: null })).toBeNull();
  });
});
