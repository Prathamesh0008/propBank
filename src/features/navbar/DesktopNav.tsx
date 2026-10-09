"use client";

import { Link, NavLink, useNavigate } from "@/lib/navigation";
import { LogIn } from "lucide-react";
import { User } from "firebase/auth";
import { Button } from "@/ui/button";
import { UserMenu } from "./UserMenu";

interface DesktopNavProps {
  user: User | null;
  userName?: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  handleLogout: () => Promise<void>;
}

export const DesktopNav = ({ user, userName, userEmail, userPhone, userRole, handleLogout }: DesktopNavProps) => {
  const navigate = useNavigate();

  const handleContactUs = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.location.pathname === "/") {
      const element = document.getElementById("quick-inquiry");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById("quick-inquiry");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 200);
    }
  };

  return (
    <div className="hidden md:flex items-center gap-6">
      <nav className="flex items-center gap-6">
        <NavLink
          to="/manage-property"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors hover:text-blue-600 ${
              isActive ? "text-blue-600" : "text-muted-foreground"
            }`
          }
        >
          Manage Property
        </NavLink>
        <NavLink
          to="/visit-planner"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors hover:text-blue-600 ${
              isActive ? "text-blue-600" : "text-muted-foreground"
            }`
          }
        >
          Visit Planner
        </NavLink>
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `text-sm font-medium transition-colors hover:text-blue-600 ${
              isActive ? "text-blue-600" : "text-muted-foreground"
            }`
          }
        >
          Admin Portal
        </NavLink>
        <a
          href="#quick-inquiry"
          onClick={handleContactUs}
          className="text-sm font-medium transition-colors hover:text-blue-600 text-muted-foreground"
        >
          Contact Us
        </a>
      </nav>

      {user ? (
        <UserMenu
          user={user}
          userName={userName}
          userEmail={userEmail}
          userPhone={userPhone}
          handleLogout={handleLogout}
        />
      ) : (
        <Button asChild variant="default" size="sm" className="shadow-elegant flex items-center gap-2">
          <Link to="/auth">
            <LogIn className="h-4 w-4" />
            <span>Login</span>
          </Link>
        </Button>
      )}
    </div>
  );
};
