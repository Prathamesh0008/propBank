"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./PublicMain.module.css";

const publicPaths = new Set(["/", "/about", "/services", "/contact", "/support", "/blog", "/faq", "/terms", "/privacy", "/buy", "/sell", "/rent", "/search", "/properties"]);

export default function PublicMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicPaths.has(pathname) || pathname.startsWith("/property/");
  return <main className={isPublic ? styles.publicMain : styles.main}>{children}</main>;
}
