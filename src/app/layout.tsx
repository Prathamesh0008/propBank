import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import Providers from "./providers";
import ApplicationShell from '@/components/ApplicationShell';
import "@/index.css";
import "@/styles/brand-tokens.css";
import {brandUI,brandEditorial} from "@/styles/brand-fonts";

export const metadata: Metadata = {
  title: "PropBank — Real Estate Platform",
  description: "Manage your property portfolio, tenants, rent and agreements. Explore properties to buy or rent.",
  authors: [{ name: "PropBank" }],
  manifest: "/manifest.webmanifest",
  icons: {icon:[{url:"/brand/propbank-symbol.svg",type:"image/svg+xml"},{url:"/brand/propbank-32.png",sizes:"32x32",type:"image/png"}],apple:[{url:"/brand/propbank-180.png",sizes:"180x180"}]},
  openGraph: { title: "PropBank — Property Management & Real Estate", description: "Property portfolio management and real estate services.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#242B28" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${brandUI.variable} ${brandEditorial.variable}`}><body><Suspense fallback={<p>Loading...</p>}><Providers>
    <ApplicationShell>{children}</ApplicationShell>
  </Providers></Suspense></body></html>;
}
