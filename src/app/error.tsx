"use client";
import { Button } from "@/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <div className="container py-12 text-center"><h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
    <p className="text-muted-foreground mb-4">Please try again.</p><Button onClick={reset}>Try again</Button></div>;
}
