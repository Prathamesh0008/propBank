"use client";

import { Link, NavLink } from "@/lib/navigation";
import { Menu, LogOut, LogIn, Shield, Mail } from "lucide-react";
import { User } from "firebase/auth";
import { Button } from "@/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet";

interface MobileNavProps {
  user: User | null;
  userName?: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  handleLogout: () => Promise<void>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const MobileNav = ({
  user,
  userName,
  userEmail,
  userPhone,
  userRole,
  handleLogout,
  isOpen,
  setIsOpen,
}: MobileNavProps) => {
  return (
    <div className="flex md:hidden items-center gap-2">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
          <div className="flex flex-col gap-6 pt-6 pb-6 min-h-full">
            {user && (
              <div className="flex items-start gap-4 p-4 bg-accent/30 rounded-xl border border-accent/50">
                <img
                  src={user.photoURL || "https://ui-avatars.com/api/?name=User"}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {user.displayName || userName || "No Name"}
                  </div>
                  <div className="text-[10px] text-muted-foreground break-all leading-tight">
                    {user.email || userEmail}
                  </div>
                  {userPhone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <span className="text-green-600">📞</span>
                      <span className="font-medium">{userPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <nav className="flex flex-col gap-2">
              {/* Manage Property */}
              <NavLink
                to="/manage-property"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-3 rounded-md transition-colors text-left flex items-center gap-3 ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Manage Property
              </NavLink>

              {/* Visit Planner */}
              <NavLink
                to="/visit-planner"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-3 rounded-md transition-colors text-left flex items-center gap-3 ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Visit Planner
              </NavLink>

              {/* Admin Portal */}
              <NavLink
                to="/admin"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-3 rounded-md transition-colors text-left flex items-center gap-3 ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Shield className="w-5 h-5" />
                Admin Portal
              </NavLink>

              {/* Contact Us */}
              <NavLink
                to="/contact"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-3 rounded-md transition-colors text-left flex items-center gap-3 ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <Mail className="w-5 h-5" />
                Contact Us
              </NavLink>

              <div className="border-t pt-4 mt-4">
                {user ? (
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full justify-start gap-3 px-3 py-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" /> Logout
                  </Button>
                ) : (
                  <Button variant="ghost" asChild className="w-full justify-start gap-3 px-3 py-3">
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <LogIn className="h-5 w-5" /> Login
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
