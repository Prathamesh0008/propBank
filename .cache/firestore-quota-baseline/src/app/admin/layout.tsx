import type { ReactNode } from "react";
import RouteGuard from "@/components/RouteGuard";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RouteGuard admin>{children}</RouteGuard>;
}
