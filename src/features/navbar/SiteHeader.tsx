"use client";

import { Link } from "@/lib/navigation";
import { useState, useEffect } from "react";
import { auth, signOutUser } from "@/firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "@/utils/config";
import axios from "axios";
import { firebaseAuthorizationHeaders } from '@/lib/api-client';
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import BrandLogo from "@/features/brand/BrandLogo";
import styles from "./SiteHeader.module.css";

const SiteHeader = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Avoid showing the previous account’s privileged navigation during user changes.
        setUserRole("");
        setUserName("");
        setUserEmail("");
        setUserPhone("");
        getUserData(firebaseUser.uid);
      } else {
        setUserPhone("");
        setUserEmail("");
        setUserName("");
        setUserRole("");
      }
    });
    return () => unsubscribe();
  }, []);

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

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.home} aria-label="PropBank home"><BrandLogo/></Link>

        {/* Desktop & Tablet Navigation */}
        <DesktopNav
          user={user}
          userName={userName}
          userEmail={userEmail}
          userPhone={userPhone}
          userRole={userRole}
          handleLogout={handleLogout}
        />

        {/* Mobile Navigation */}
        <MobileNav
          user={user}
          userName={userName}
          userEmail={userEmail}
          userPhone={userPhone}
          userRole={userRole}
          handleLogout={handleLogout}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      </div>
    </header>
  );
};

export default SiteHeader;
