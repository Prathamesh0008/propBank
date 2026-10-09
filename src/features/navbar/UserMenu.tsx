"use client";

import { User } from "firebase/auth";
import { LogOut, ChevronDown, Phone, Mail } from "lucide-react";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface UserMenuProps {
  user: User;
  userName?: string;
  userEmail: string;
  userPhone: string;
  handleLogout: () => Promise<void>;
}

export const UserMenu = ({ user, userName, userEmail, userPhone, handleLogout }: UserMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2.5 p-1 pr-3.5 h-auto rounded-full hover:bg-slate-100/60 border border-slate-200/60 shadow-sm transition-all focus-visible:ring-0"
        >
          <div className="relative h-11 w-11 border-2 border-white rounded-full shadow-sm flex-shrink-0 overflow-hidden">
            <img
              src={user.photoURL || "https://ui-avatars.com/api/?name=User"}
              alt="Profile"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground/80 transition-transform duration-200" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64 mt-1.5 p-1.5" align="end" forceMount>
        <DropdownMenuLabel className="font-normal px-2.5 py-2">
          <div className="flex flex-col space-y-2.5">
            <p className="text-sm font-semibold leading-none text-slate-900">
              {user.displayName || userName || "User"}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span className="truncate">{user.email || userEmail}</span>
            </div>
            {userPhone && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <Phone className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                <span>{userPhone}</span>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="my-1.5" />
        
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer rounded-md py-2 px-2.5"
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          <span className="font-medium">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
