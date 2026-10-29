"use client";

import { Link } from "@/lib/navigation";
import { useState, useEffect } from "react";
import { auth, signOutUser } from "@/firebase";
import { API_BASE_URL } from "@/utils/config";
import axios from "axios";
import { firebaseAuthorizationHeaders } from '@/lib/api-client';
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { UserMenu } from "./UserMenu";
import BrandLogo from "@/features/brand/BrandLogo";
import styles from "./SiteHeader.module.css";
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { to: "/manage-property", label: "Manage Property", access: "user" },
  { to: "/visit-planner", label: "Visit Planner", access: "user" },
  { to: "/admin", label: "Admin Portal", access: "admin" },
  { to: "/contact", label: "Contact Us", access: "public" },
] as const;

const SiteHeader = () => {
  const pathname = usePathname();
  const {user,profileStatus}=useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
      if (user) {
        // Avoid showing the previous account’s privileged navigation during user changes.
        setUserRole("");
        setUserName("");
        setUserEmail("");
        setUserPhone("");
        void getUserData(user.uid);
      } else {
        setUserPhone("");
        setUserEmail("");
        setUserName("");
        setUserRole("");
      }
  }, [user]);

  const getUserData = async (uid: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/${uid}`, {
        headers: Object.fromEntries((await firebaseAuthorizationHeaders({
          "Content-Type": "application/json",
        })).entries()),
      });

      if(auth.currentUser?.uid!==uid)return;
      if (response.status === 200) {
        const data = response.data;
        if (data.user) {
          if (data.user.phoneNumber) setUserPhone(data.user.phoneNumber);
          if (data.user.email) setUserEmail(data.user.email);
          if (data.user.name) setUserName(data.user.name);
          if (data.user.role) setUserRole(data.user.role);
        }
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setIsOpen(false);
  };

  const visibleLinks = navigation.filter(({ access }) =>
    access === "public" || (user && (access === "user" || userRole === "admin"))
  );
  const renderLinks = (mobile = false) => visibleLinks.map(({ to, label }) => (
    <Link
      key={to}
      to={to}
      aria-current={pathname === to || pathname?.startsWith(`${to}/`) ? "page" : undefined}
      onClick={mobile ? () => setIsOpen(false) : undefined}
      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-500 aria-[current=page]:text-slate-800 motion-reduce:transition-none"
    >
      {label}
    </Link>
  ));

  return (
    <header className={styles.header} style={{ background: "#fff", borderBottomColor: "#e2e8f0" }}>
      <div className={styles.inner}>
        <Link to="/" className={styles.home} aria-label="PropBank home"><BrandLogo/></Link>

        <div className="flex min-w-0 items-center gap-2 lg:gap-7">
          <nav aria-label="Main navigation" className="hidden items-center gap-4 lg:flex xl:gap-6">
            {renderLinks()}
          </nav>
          {user ? (
            <UserMenu user={user} userName={userName} userEmail={userEmail} userPhone={userPhone} handleLogout={handleLogout} />
          ) : (
            <Link to="/auth" className="hidden min-h-11 shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-500 motion-reduce:transition-none lg:inline-flex">
              <LogIn size={17} aria-hidden="true" />{profileStatus==='incomplete'?'Complete account':'Login'}
            </Link>
          )}
          <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Trigger asChild>
              <button type="button" aria-label="Open navigation menu" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 lg:hidden">
                <Menu size={22} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/30" />
              <Dialog.Content className="fixed inset-y-0 right-0 z-[60] w-full max-w-sm overflow-y-auto bg-white p-5 font-[family-name:var(--pb-ui)] text-slate-800 shadow-xl sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/" aria-label="PropBank home" onClick={() => setIsOpen(false)} className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"><BrandLogo /></Link>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Close navigation" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"><X size={22} aria-hidden="true" /></button>
                  </Dialog.Close>
                </div>
                <Dialog.Title className="mb-2 mt-8 text-lg font-semibold">Navigation</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">Your property workspace and account.</Dialog.Description>
                <nav aria-label="Mobile navigation" className="mt-5 flex flex-col gap-2">{renderLinks(true)}</nav>
                <div className="mt-6 border-t border-slate-200 pt-5">
                  {user ? <>
                    <p className="break-words text-sm font-semibold">{user.displayName || userName || "User"}</p>
                    <p className="mt-1 break-words text-xs leading-6 text-slate-500">{user.email || userEmail}</p>
                    {userPhone && <p className="break-words text-xs leading-6 text-slate-500">{userPhone}</p>}
                    <button type="button" onClick={handleLogout} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"><LogOut size={17} aria-hidden="true" />Log out</button>
                  </> : (
                    <Link to="/auth" onClick={() => setIsOpen(false)} className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"><LogIn size={17} aria-hidden="true" />{profileStatus==='incomplete'?'Complete account':'Login'}</Link>
                  )}
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
