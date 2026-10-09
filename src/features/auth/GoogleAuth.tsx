"use client";

import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect } from "react";
import { useNavigate } from "@/lib/navigation";
import { signInWithGoogle, signOutUser, auth } from "@/firebase";
import { User, onAuthStateChanged, updateProfile } from "firebase/auth";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { API_BASE_URL } from "@/utils/config";
import { AlertTriangle } from "lucide-react";

interface GoogleAuthProps { }

const GoogleAuth: React.FC<GoogleAuthProps> = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userLoggedIn, setUserLoggedIn] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const verifyAccount = async (firebaseUser: User) => {
    setIsCheckingUser(true);
    setProfileError(null);
    setShowPhoneInput(false);
    setUserLoggedIn(false);
    try {
      const hasCompleteProfile = await checkUserPhoneNumber(firebaseUser.uid);
      setShowPhoneInput(!hasCompleteProfile);
      setUserLoggedIn(hasCompleteProfile);
      if (hasCompleteProfile) void syncUserData(firebaseUser);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to verify your account. Please try again.");
    } finally {
      setIsCheckingUser(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        // User signed out — reset everything
        setUserLoggedIn(false);
        setShowPhoneInput(false);
        setProfileError(null);
        return;
      }

      await verifyAccount(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Function to sync basic user data (email, name, photo) without requiring phone/role
  const syncUserData = async (firebaseUser: User) => {
    try {
      const email = firebaseUser.email || firebaseUser.providerData[0]?.email || "";
      const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User";

      // Store in cookies
      document.cookie = `userEmail=${email}; path=/; max-age=86400; SameSite=Strict`;
      document.cookie = `userName=${name}; path=/; max-age=86400; SameSite=Strict`;

      const updateData = {
        email: email,
        name: name,
        photoURL: firebaseUser.photoURL,
      };

      const token = localStorage.getItem('authToken');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await apiFetch(`${API_BASE_URL}/users/${firebaseUser.uid}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(updateData)
      });
    } catch (error) {
      console.error("Error syncing user data:", error);
    }
  };

  // Block navigation when registration is incomplete
  useEffect(() => {
    if (showPhoneInput && user) {
      // Block browser back/forward navigation
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        alert("Please complete your registration before navigating away.");
      };

      // Block page unload/refresh
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "You have not completed your registration. Are you sure you want to leave?";
        return e.returnValue;
      };

      // Block keyboard shortcuts for navigation
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
          e.preventDefault();
        }
      };

      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [showPhoneInput, user]);

  // Check if user has a complete registration (phone AND role both set in backend)
  const checkUserPhoneNumber = async (uid: string): Promise<boolean> => {
    try {
      // First attempt a login to get a token (works only if user exists)
      let token = localStorage.getItem('authToken');

      if (!token) {
        try {
          const loginRes = await apiFetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid })
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            if (loginData.success && loginData.token) {
              token = loginData.token;
              localStorage.setItem('authToken', loginData.token);
            }
          }
        } catch (e) {
          // User likely doesn't exist yet — that's fine
        }
      }

      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await apiFetch(`${API_BASE_URL}/users/${uid}`, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) return false;
      if (!response.ok) {
        throw new Error("Unable to verify your account. Please try again.");
      }
      if (response.ok) {
        const data = await response.json();
        const hasCompleteData =
          data.user &&
          data.user.phoneNumber &&
          data.user.phoneNumber.trim() !== "" &&
          data.user.role &&
          data.user.role.trim() !== "";

        if (hasCompleteData) {
          // Pre-fill local state so it shows in the logged-in view
          document.cookie = `userPhone=${data.user.phoneNumber}; path=/; max-age=86400; SameSite=Strict`;
          setPhoneNumber(data.user.phoneNumber);
          setUserRole(data.user.role);
        }

        return !!hasCompleteData;
      }
      return false;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error("Unable to connect to the server. Please check your connection and try again.");
      }
      throw error;
    }
  };

  // Save a new user to the backend (only called for first-time registrations)
  const saveUserToBackend = async (firebaseUser: User, phone: string, role: string, name: string) => {
    try {
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || firebaseUser.providerData[0]?.email || "",
        name: name,
        photoURL: firebaseUser.photoURL,
        phoneNumber: phone,
        role: role,
      };

      const response = await apiFetch(`${API_BASE_URL}/auth/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success || response.ok) {
        // Login to get the JWT token
        try {
          const loginRes = await apiFetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: firebaseUser.uid })
          });
          const loginData = await loginRes.json();
          if (loginData.success && loginData.token) {
            localStorage.setItem('authToken', loginData.token);
          }
        } catch (e) {
          console.error("Auto-login failed after registration", e);
        }

        return { success: true, user: data.user || userData };
      } else {
        console.error("Failed to save user:", data);
        return { success: false, message: data.message || "Failed to save user data. Please try again." };
      }
    } catch (error) {
      console.error("Error saving user:", error);
      return { success: false, message: "Error connecting to server. Please check your connection." };
    }
  };

  const handlePhoneSubmit = async () => {
    if (isSubmitting) return;

    setHasAttemptedSubmit(true);

    if (!phoneNumber.trim() || !/^\d{10}$/.test(phoneNumber.trim()) || !userRole || userRole.trim() === "" || !fullName || fullName.trim() === "") {
      return;
    }

    if (user) {
      setIsSubmitting(true);
      try {
        setRegistrationError(null);
        const result = await saveUserToBackend(user, phoneNumber, userRole, fullName.trim());

        if (result && result.success) {
          try {
            await updateProfile(user, { displayName: fullName.trim() });
          } catch (e) {
            console.error("Failed to update profile", e);
          }
          // Re-verify that data was actually saved
          const isRegistrationComplete = await checkUserPhoneNumber(user.uid);

          if (isRegistrationComplete) {
            document.cookie = `userPhone=${phoneNumber}; path=/; max-age=86400; SameSite=Strict`;
            setShowPhoneInput(false);
            setUserLoggedIn(true);
          } else {
            setRegistrationError("Registration verification failed. Your data may not have been saved properly. Please try again.");
          }
        } else {
          setRegistrationError(result?.message || "Failed to save your registration data. Please try again.");
        }
      } catch (error) {
        setRegistrationError("An unexpected error occurred during registration. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
      setUserLoggedIn(false);
      setPhoneNumber("");
      setUserRole("");
      setShowPhoneInput(false);
      localStorage.removeItem('authToken');
      document.cookie = `userPhone=; path=/; max-age=0; SameSite=Strict`;
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // ─── LOADING STATE (checking backend after Google sign-in) ───────────────────
  if (isCheckingUser) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">Verifying your account...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileError && user) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 space-y-4">
          <p role="alert" className="text-sm text-red-600">{profileError}</p>
          <Button onClick={() => void verifyAccount(user)} className="w-full">Try again</Button>
          <Button variant="outline" onClick={handleSignOut} className="w-full">Sign out</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {!userLoggedIn ? (
        showPhoneInput && user ? (
          /* ─── REGISTRATION FORM (new users only) ─────────────────────────── */
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Prevent any clicks from passing through */}
            <div
              className="absolute inset-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
            <Card className="w-full max-w-md mx-auto relative z-10 shadow-2xl border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-semibold text-gray-800 mb-2">
                  Welcome, {user?.displayName}!
                </CardTitle>
                <p className="text-gray-600 mt-2">{user?.email}</p>
                {hasAttemptedSubmit && (!phoneNumber || !userRole || !fullName.trim() || phoneNumber.length !== 10) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <p className="text-sm text-amber-800 font-semibold">
                        Complete Registration Required
                      </p>
                    </div>
                    <p className="text-xs text-amber-700">
                      You must complete your registration to access PropBank. All fields are mandatory and cannot be skipped.
                    </p>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                    Select Your Role <span className="text-red-500">*</span>
                  </Label>
                  <Select onValueChange={(val) => {
                    setUserRole(val);
                    setRegistrationError(null);
                  }} value={userRole}>
                    <SelectTrigger className={`w-full mt-1 ${hasAttemptedSubmit && !userRole ? 'border-red-300 border-2' : userRole ? 'border-green-300' : ''}`}>
                      <SelectValue placeholder="Choose your role" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="individual">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-medium">Individual</span>
                          <span className="text-xs text-gray-500">Property owner, buyer, or tenant</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="agent">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-medium">Real Estate Agent</span>
                          <span className="text-xs text-gray-500">Professional property agent or broker</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {hasAttemptedSubmit && !userRole && (
                    <p className="text-xs text-red-500 mt-1">Please select your role</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setRegistrationError(null);
                    }}
                    className={`mt-1 ${fullName.trim().length > 0 ? 'border-green-300' : hasAttemptedSubmit ? 'border-red-300 border-2' : ''}`}
                  />
                  {hasAttemptedSubmit && !fullName.trim() && (
                    <p className="text-xs text-red-500 mt-1">Full name is required</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+9193 XXXXXX"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value.replace(/\D/g, ''));
                      setRegistrationError(null);
                    }}
                    className={`mt-1 ${phoneNumber.length === 10 ? 'border-green-300' : hasAttemptedSubmit && phoneNumber.length !== 10 ? 'border-red-300 border-2' : ''}`}
                    maxLength={10}
                  />
                  {hasAttemptedSubmit && phoneNumber.length > 0 && phoneNumber.length !== 10 && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid 10-digit phone number</p>
                  )}
                  {hasAttemptedSubmit && !phoneNumber && (
                    <p className="text-xs text-red-500 mt-1">Phone number is required</p>
                  )}
                </div>

                {/* Validation summary */}
                {hasAttemptedSubmit && (!phoneNumber || !userRole || !fullName.trim() || phoneNumber.length !== 10 || registrationError) && (
                  <div className={`p-3 rounded-lg bg-red-50 border border-red-200`}>
                    {registrationError ? (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <p className="text-xs font-semibold text-red-700">
                          {registrationError}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-red-700">
                        ⚠️ Please complete all required fields to continue
                      </p>
                    )}
                  </div>
                )}


                <Button
                  onClick={handlePhoneSubmit}
                  className="w-full mt-6"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Completing Registration...
                    </div>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>

                <p className="text-xs text-center text-gray-500 mt-2">
                  You cannot proceed without completing registration
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ─── SIGN-IN VIEW (Google button only) ─────────────────────────── */
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-3 text-gray-900">
                  Sign in or Create an Account
                </h1>
                <p className="text-gray-600 text-sm">
                  Join Propbank to manage your properties and connect with tenants, buyers, and agents.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSignIn}
                  className="w-full bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-3 py-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign In with Google
                </Button>
                <p className="text-xs text-center text-gray-500 mt-3">
                  New users will be asked to complete registration after sign in
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        /* ─── LOGGED-IN VIEW ─────────────────────────────────────────────── */
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Welcome back, {user?.displayName}!
              </h2>
              <p className="text-gray-600 text-sm">{user?.email}</p>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                ✓ Account Verified
              </div>
            </div>

            <div className="space-y-4">
              {/* Display Pre-filled User Details */}
              <div className="text-left">
                <Label className="text-sm font-medium text-gray-700">Your Role</Label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md mt-1 capitalize text-gray-800 font-medium">
                  {userRole === 'agent' ? 'Real Estate Agent' : 'Individual'}
                </div>
              </div>

              <div className="text-left">
                <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md mt-1 text-gray-800 font-medium">
                  {phoneNumber}
                </div>
              </div>

              <p className="text-gray-700 mt-4">
                Ready to start your property management journey! 🏠
              </p>
              <Button
                onClick={() => navigate("/")}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 transition-colors py-3"
              >
                Go to Home Page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleAuth;
