import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { cspNonce } from "@/lib/request";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: { default: "Branch", template: "%s · Branch" },
  description: "Grow together. Solve better. Track coding-interview practice with friends.",
  applicationName: "Branch",
  openGraph: {
    siteName: "Branch",
    title: "Branch",
    description: "Grow together. Solve better.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#17191d" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await cspNonce()) ?? undefined;
  return (
    // next-themes sets the theme class before hydration, so the server markup differs by design.
    <html lang="en" suppressHydrationWarning className={geistSans.variable}>
      <body>
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
