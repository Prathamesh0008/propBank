"use client";

import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { forwardRef, useCallback, type ComponentProps } from "react";

// Keeps existing feature call sites while all routing is owned by Next App Router.
export function useNavigate() {
  const router = useRouter();
  return useCallback((to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (to === -1) router.back();
      else if (to === 1) router.forward();
      else window.history.go(to);
    } else if (options?.replace) router.replace(to);
    else router.push(to);
  }, [router]);
}

export function useLocation() {
  const pathname = usePathname();
  const params = useNextSearchParams();
  const search = params.toString();
  return { pathname, search: search ? `?${search}` : "" };
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useNextParams<T>();
}

export function useSearchParams() {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setParams = useCallback((next: URLSearchParams, options?: { replace?: boolean }) => {
    const query = next.toString();
    const url = pathname + (query ? `?${query}` : "");
    if (options?.replace) router.replace(url);
    else router.push(url);
  }, [pathname, router]);
  return [params, setParams] as const;
}

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & { to: string };
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...props }, ref) {
  return <NextLink ref={ref} href={to} {...props} />;
});

type NavLinkProps = Omit<LinkProps, "className"> & {
  className?: string | ((state: { isActive: boolean }) => string);
  end?: boolean;
};
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({ to, className, end, ...props }, ref) {
  const pathname = usePathname();
  const isActive = pathname === to || (!end && to !== "/" && pathname.startsWith(to + "/"));
  return <Link ref={ref} to={to} aria-current={isActive ? "page" : undefined}
    className={typeof className === "function" ? className({ isActive }) : className} {...props} />;
});
