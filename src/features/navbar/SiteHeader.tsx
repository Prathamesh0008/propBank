"use client";

import { useState, useEffect } from "react";
import { auth } from "@/firebase";
import { API_BASE_URL } from "@/utils/config";
import axios from "axios";
import { firebaseAuthorizationHeaders } from '@/lib/api-client';
import { usePathname } from "next/navigation";
import { useAuth } from '@/contexts/AuthContext';
import HomepageHeader from './HomepageHeader';

const SiteHeader = () => {
  const pathname = usePathname();
  const {user,profileStatus,signOut}=useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  const uid=user?.uid;
  useEffect(() => {
      const controller=new AbortController();
      if (uid) {
        // Avoid showing the previous account’s privileged navigation during user changes.
        setUserRole("");
        setUserName("");
        setUserEmail("");
        setUserPhone("");
        void getUserData(uid,controller.signal);
      } else {
        setUserPhone("");
        setUserEmail("");
        setUserName("");
        setUserRole("");
      }
      return ()=>controller.abort();
  }, [uid]);

  const getUserData = async (uid: string,signal:AbortSignal) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/${uid}?summary=true`, {
        signal,
        headers: Object.fromEntries((await firebaseAuthorizationHeaders({
          "Content-Type": "application/json",
        })).entries()),
      });

      if(signal.aborted||auth.currentUser?.uid!==uid)return;
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
    try{await signOut();setIsOpen(false);}catch{/* AuthContext exposes the recovery state. */}
  };

  return <HomepageHeader
    pathname={pathname || "/"}
    user={user} profileStatus={profileStatus} userName={userName} userEmail={userEmail}
    userPhone={userPhone} userRole={userRole} isOpen={isOpen}
    onOpenChange={setIsOpen} handleLogout={handleLogout}
  />;
};

export default SiteHeader;
