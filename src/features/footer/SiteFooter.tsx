"use client";

import { usePathname } from "next/navigation";
import HomepageFooter from "./HomepageFooter";

/** One site footer; the homepage retains its existing supporting trust strip. */
export default function SiteFooter() {
  const pathname = usePathname();
  return <HomepageFooter showTrust={pathname === "/"} />;
}
