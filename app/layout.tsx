import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flashback.app";

const TITLE = "Flashback – Disposable Camera for Your Event";
const DESCRIPTION =
  "Guests snap photos, nobody sees them until the end. Then the film develops — all at once. No app download needed.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: "Flashback",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flashback – Disposable Camera App",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Guests snap photos, nobody sees them until the end. Then the film develops — all at once.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
