"use client";

import { useLocation } from "@/lib/navigation";

const NotFound = () => {
  const location = useLocation();

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="underline underline-offset-4 text-primary">Return to Home</a>
      </div>
    </main>
  );
};

export default NotFound;
