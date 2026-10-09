import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import Providers from "./providers";
import SiteHeader from "@/features/navbar/SiteHeader";
import SiteFooter from "@/features/footer/SiteFooter";
import "@/index.css";

export const metadata: Metadata = {
  title: "Propbank — Real Estate Platform",
  description: "Propbank: Find, list, and manage — all in one platform",
  authors: [{ name: "Propbank" }],
  manifest: "/manifest.webmanifest",
  openGraph: { title: "Propbank — Real Estate PWA", description: "Find, list, and manage — all in one platform", type: "website" },
};
export const viewport: Viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><Suspense fallback={<p>Loading...</p>}><Providers>
    <div className="flex flex-col min-h-screen"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /></div>
  </Providers></Suspense></body></html>;
}
