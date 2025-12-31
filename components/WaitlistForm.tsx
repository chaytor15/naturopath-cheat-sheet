"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const practiceTypes = [
  "Naturopath",
  "Medical Herbalist",
  "Integrative Practitioner",
  "Functional Medicine",
  "Nutritional Therapist",
  "Other",
];

export function WaitlistForm() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [practiceType, setPracticeType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !email.trim() || !practiceType) {
      setError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: firstName,
          email,
          practice_type: practiceType.toLowerCase().replace(/\s+/g, "-"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setIsSuccess(true);
      setFirstName("");
      setEmail("");
      setPracticeType("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl mb-4 font-bold">
          ✓
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          You're on the list!
        </h2>
        <p className="text-sm text-muted-foreground">
          We'll send you an email when early access is available.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="h-12 rounded-lg border-border bg-card px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
          required
        />
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-lg border-border bg-card px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
          required
        />
      </div>
      
      <Select value={practiceType} onValueChange={setPracticeType} required>
        <SelectTrigger className="h-12 w-full rounded-lg border-border bg-card px-4 text-foreground focus:ring-2 focus:ring-primary">
          <SelectValue placeholder="Practice type" />
        </SelectTrigger>
        <SelectContent className="rounded-lg border-border bg-card">
          {practiceTypes.map((type) => (
            <SelectItem 
              key={type} 
              value={type}
              className="cursor-pointer focus:bg-accent"
            >
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-lg bg-primary text-primary-foreground font-medium transition-all hover:bg-lime-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
      >
        {isSubmitting ? "Joining..." : "Join the waitlist"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Early access only. No spam.
      </p>
    </form>
  );
}

