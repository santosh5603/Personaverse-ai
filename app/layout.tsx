import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import TopNav from "@/components/TopNav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Render the whole app dynamically. It's inherently dynamic (Clerk auth + DB),
// and this keeps the build from prerendering pages through <ClerkProvider>,
// so a fresh Vercel build never fails when env vars aren't present yet.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PersonaVerse AI",
  description: "Multi-agent audience simulation for video and image content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <TopNav />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
