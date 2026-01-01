// app/waitlist/page.tsx - Lead capture waitlist page
"use client";

import React, { useState } from "react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [practiceType, setPracticeType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          practice_type: practiceType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setIsSuccess(true);
      setEmail("");
      setName("");
      setPracticeType("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join waitlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#dda1ff] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Logo Section */}
      <div className="w-full max-w-md mb-12 flex items-center justify-center">
        <img 
          src="/toniic-logo.png" 
          alt="toniic" 
          className="max-w-full h-auto w-auto"
        />
      </div>

      {/* Form Section */}
      <div className="w-full max-w-md">
        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#e2ff7c] text-[#dda1ff] text-2xl mb-4 font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              You're on the list!
            </h2>
            <p className="text-[13px] text-white/80 mb-6">
              We'll send you an email when early access is available.
            </p>
          </div>
        ) : (
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-[13px] font-medium text-white mb-2"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm px-4 py-3 text-[13px] text-white placeholder-white/50 focus:border-[#e2ff7c] focus:outline-none focus:ring-2 focus:ring-[#e2ff7c]/20 transition"
                  placeholder=""
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-medium text-white mb-2"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm px-4 py-3 text-[13px] text-white placeholder-white/50 focus:border-[#e2ff7c] focus:outline-none focus:ring-2 focus:ring-[#e2ff7c]/20 transition"
                  placeholder=""
                />
              </div>

              <div>
                <label
                  htmlFor="practiceType"
                  className="block text-[13px] font-medium text-white mb-2"
                >
                  Practice Type
                </label>
                <select
                  id="practiceType"
                  value={practiceType}
                  onChange={(e) => setPracticeType(e.target.value)}
                  required
                  className="w-full rounded-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm px-4 py-3 text-[13px] text-white focus:border-[#e2ff7c] focus:outline-none focus:ring-2 focus:ring-[#e2ff7c]/20 transition"
                >
                  <option value="" className="text-slate-900">Select your practice type</option>
                  <option value="solo" className="text-slate-900">Solo Practitioner</option>
                  <option value="clinic" className="text-slate-900">Clinic Team</option>
                  <option value="student" className="text-slate-900">Student</option>
                  <option value="other" className="text-slate-900">Other</option>
                </select>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/20 border-2 border-red-400/50 backdrop-blur-sm p-3">
                  <p className="text-[13px] text-white">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center rounded-full bg-[#e2ff7c] px-8 py-3 text-[13px] font-semibold text-[#dda1ff] shadow-sm transition hover:bg-[#d4f56a] hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] text-white/70">
              By joining, you agree to receive updates. You can unsubscribe at any time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



