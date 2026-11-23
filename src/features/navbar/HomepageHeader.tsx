"use client";

import type { User } from "firebase/auth";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { Link } from "@/lib/navigation";
import BrandLogo from "@/features/brand/BrandLogo";
import { UserMenu } from "./UserMenu";

const primaryLinks = [
  { to: "/buy", label: "Buy" },
  { to: "/rent", label: "Rent" },
  { to: "/properties?projectCondition=New%20Project", label: "Projects" },
  { to: "/manage-property", label: "Property Management" },
  { to: "/services", label: "Property 360" },
] as const;

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b1d39]";
const navLink = `inline-flex min-h-11 items-center rounded text-[15px] font-medium transition-colors duration-150 hover:text-[#80622d] active:text-[#80622d] motion-reduce:transition-none ${focusRing}`;
const listButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#c89432] bg-[#0b1d39] px-4 text-sm font-semibold text-[#fffdf7] transition-colors duration-150 hover:border-[#9b7a3e] hover:bg-[#263f60] active:bg-[#10213a] motion-reduce:transition-none ${focusRing}`;

interface HomepageHeaderProps {
  user: User | null;
  profileStatus: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  handleLogout: () => Promise<void>;
}

/** Homepage presentation only; identity, profile loading and sign-out stay in SiteHeader. */
export default function HomepageHeader({
  user, profileStatus, userName, userEmail, userPhone, userRole,
  isOpen, onOpenChange, handleLogout,
}: HomepageHeaderProps) {
  const accountLabel = profileStatus === "incomplete" ? "Complete account" : "Login / Sign Up";
  const workspaceLinks = [
    ...(user ? [{ to: "/visit-planner", label: "Visit Planner" }] : []),
    ...(user && userRole === "admin" ? [{ to: "/admin", label: "Admin Portal" }] : []),
    { to: "/contact", label: "Contact Us" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#c4aa73]/40 bg-[#faf7f1] font-[family-name:var(--pb-ui)] text-[#0b1d39]">
      <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:gap-5 sm:px-6 xl:min-h-20 xl:px-8">
        <Link to="/" aria-label="PropBank home" aria-current="page" className={`inline-flex min-h-11 shrink-0 items-center rounded ${focusRing}`}>
          <BrandLogo />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 xl:flex 2xl:gap-7">
          {primaryLinks.map(({ to, label }) => (
            <Link key={to} to={to} className={`${navLink} group relative whitespace-nowrap px-0.5`}>
              {label}
              <span aria-hidden="true" className="absolute inset-x-0.5 bottom-1.5 h-px origin-left scale-x-0 bg-[#c89432] transition-transform duration-150 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link to="/search" aria-label="Search properties" className={`inline-flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-[#e9dfcb]/50 active:bg-[#e9dfcb] motion-reduce:transition-none ${focusRing}`}>
            <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Link to="/select-property-type" className={`${listButton} hidden whitespace-nowrap sm:inline-flex`}>
            <Plus size={16} strokeWidth={1.7} aria-hidden="true" />List Property
          </Link>

          {user ? (
            <div className="hidden items-center gap-2 xl:flex">
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <button type="button" aria-label="Open workspace navigation" className={`${navLink} gap-1 px-1 text-sm`}>
                    Workspace<ChevronDown size={14} aria-hidden="true" />
                  </button>
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content align="end" sideOffset={12} className="z-[60] min-w-52 max-w-[calc(100vw-2rem)] rounded border border-[#c4aa73]/50 bg-[#faf7f1] p-2 font-[family-name:var(--pb-ui)] text-[#0b1d39] shadow-lg">
                    {workspaceLinks.map(({ to, label }) => (
                      <Dropdown.Item asChild key={to}>
                        <Link to={to} className="flex min-h-11 items-center rounded px-3 text-sm outline-none data-[highlighted]:bg-[#e9dfcb]/60 data-[highlighted]:text-[#0b1d39]">{label}</Link>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
              <UserMenu user={user} userName={userName} userEmail={userEmail} userPhone={userPhone} handleLogout={handleLogout} />
            </div>
          ) : (
            <Link to="/auth" className={`hidden min-h-11 items-center justify-center whitespace-nowrap rounded border border-[#c89432]/80 px-4 text-sm font-semibold transition-colors hover:bg-[#e9dfcb]/50 active:bg-[#e9dfcb] motion-reduce:transition-none xl:inline-flex ${focusRing}`}>
              {accountLabel}
            </Link>
          )}

          <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Trigger asChild>
              <button type="button" aria-label="Open navigation menu" className={`inline-flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-[#e9dfcb]/50 motion-reduce:transition-none xl:hidden ${focusRing}`}>
                <Menu size={23} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-[#10213a]/40" />
              <Dialog.Content className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col overflow-y-auto overscroll-contain border-l border-[#c4aa73]/40 bg-[#faf7f1] px-5 py-5 font-[family-name:var(--pb-ui)] text-[#0b1d39] sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <Link to="/" aria-label="PropBank home" onClick={() => onOpenChange(false)} className={`inline-flex min-h-11 items-center rounded ${focusRing}`}><BrandLogo /></Link>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Close navigation" className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-[#e9dfcb]/50 ${focusRing}`}><X size={22} strokeWidth={1.6} aria-hidden="true" /></button>
                  </Dialog.Close>
                </div>
                <Dialog.Title className="mt-7 text-lg font-semibold">Explore PropBank</Dialog.Title>
                <Dialog.Description className="sr-only">Property discovery, management and account navigation.</Dialog.Description>
                <nav aria-label="Mobile navigation" className="mt-4 flex flex-col divide-y divide-[#c4aa73]/25 border-y border-[#c4aa73]/40">
                  {primaryLinks.map(({ to, label }) => <Link key={to} to={to} onClick={() => onOpenChange(false)} className={`${navLink} min-h-14`}>{label}</Link>)}
                </nav>
                <nav aria-label="Workspace navigation" className="mt-4 flex flex-col">
                  {workspaceLinks.map(({ to, label }) => <Link key={to} to={to} onClick={() => onOpenChange(false)} className={`${navLink} text-sm`}>{label}</Link>)}
                </nav>
                <Link to="/select-property-type" onClick={() => onOpenChange(false)} className={`${listButton} mt-6`}><Plus size={17} aria-hidden="true" />List Property</Link>
                <div className="mt-5 border-t border-[#c4aa73]/40 pt-4">
                  {user ? <>
                    <p className="break-words text-sm font-semibold">{userName || user.displayName || "Your account"}</p>
                    <p className="mt-1 break-words text-sm text-[#526078]">{user.email || userEmail}</p>
                    {userPhone ? <p className="mt-1 text-sm text-[#526078]">{userPhone}</p> : null}
                    <Link to="/my-account" onClick={() => onOpenChange(false)} className={`${navLink} mt-2 w-full text-sm`}>My account</Link>
                    <button type="button" onClick={handleLogout} className={`${navLink} w-full gap-2 text-sm`}><LogOut size={17} aria-hidden="true" />Log out</button>
                  </> : <Link to="/auth" onClick={() => onOpenChange(false)} className={`${navLink} w-full justify-center`}>{accountLabel}</Link>}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
