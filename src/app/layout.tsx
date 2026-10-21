import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import Providers from "./providers";
import SiteHeader from "@/features/navbar/SiteHeader";
import SiteFooter from "@/features/footer/SiteFooter";
import "@/index.css";
import "@/styles/brand-tokens.css";
import {brandUI,brandEditorial} from "@/styles/brand-fonts";

export const metadata: Metadata = {
  title: "PropBank — Real Estate Platform",
  description: "PropBank: Find, list, and manage — all in one platform",
  authors: [{ name: "PropBank" }],
  manifest: "/manifest.webmanifest",
  icons: {icon:[{url:"/brand/propbank-symbol.svg",type:"image/svg+xml"},{url:"/brand/propbank-32.png",sizes:"32x32",type:"image/png"}],apple:[{url:"/brand/propbank-180.png",sizes:"180x180"}]},
  openGraph: { title: "PropBank — Real Estate PWA", description: "Find, list, and manage — all in one platform", type: "website" },
};
export const viewport: Viewport = { themeColor: "#242B28" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${brandUI.variable} ${brandEditorial.variable}`}><body><Suspense fallback={<p>Loading...</p>}><Providers>
    <div className="flex flex-col min-h-screen"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /></div>
  </Providers></Suspense></body></html>;
}
