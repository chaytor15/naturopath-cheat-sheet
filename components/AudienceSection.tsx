"use client";

import { Check, X } from "lucide-react";

const forItems = [
  "Naturopaths",
  "Medical herbalists",
  "Integrative practitioners",
];

const notForItems = [
  "DIY supplement users",
  "Generic wellness apps",
];

export function AudienceSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container max-w-4xl mx-auto px-4">
        <h2 className="mb-12 text-center text-3xl font-semibold text-foreground md:text-4xl">
          Built for clinical practice
        </h2>
        
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <h3 className="mb-6 text-lg font-medium text-foreground">For</h3>
            <ul className="space-y-4">
              {forItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <h3 className="mb-6 text-lg font-medium text-foreground">Not for</h3>
            <ul className="space-y-4">
              {notForItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-muted-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

