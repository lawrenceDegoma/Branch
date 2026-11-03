import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Branch", template: "%s · Branch" },
  description: "Grow together. Solve better. Track coding-interview practice with friends.",
  applicationName: "Branch",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
