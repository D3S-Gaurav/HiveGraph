import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ),
  title: "HiveGraph — Agent Swarm Orchestrator",
  description:
    "Watch a swarm of AI agents self-organize to solve what one agent can't: plan, delegate, validate, and synthesize — live.",
  icons: {
    icon: "/brand/hivegraph-mark.svg",
    shortcut: "/brand/hivegraph-mark.svg",
    apple: "/brand/hivegraph-mark.svg",
  },
  openGraph: {
    title: "HiveGraph — Live agent swarm orchestration",
    description: "Turn one complex goal into a live, durable, validated agent swarm.",
    images: [{ url: "/brand/hivegraph-social-preview.png", width: 1280, height: 640 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HiveGraph — Live agent swarm orchestration",
    description: "Turn one complex goal into a live, durable, validated agent swarm.",
    images: ["/brand/hivegraph-social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
