"use client";

import { Clock, ShieldCheck, Layout } from "lucide-react";
import { BenefitCard } from "./BenefitCard";

const benefits = [
  {
    title: "Faster formulation",
    description: "Build clinical herbal formulas in minutes, not hours.",
    icon: <Clock className="h-6 w-6" />,
  },
  {
    title: "Safer prescribing",
    description: "Clear dose ranges, safety context, and structured herbal data.",
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    title: "Cleaner consult flow",
    description: "One calm workspace instead of textbooks, PDFs, and spreadsheets.",
    icon: <Layout className="h-6 w-6" />,
  },
];

export function BenefitsSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div 
              key={benefit.title}
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <BenefitCard {...benefit} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

