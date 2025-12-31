"use client";

import { WaitlistForm } from "@/components/WaitlistForm";
import { AudienceSection } from "@/components/AudienceSection";
import { BenefitsSection } from "@/components/BenefitsSection";
import { TrustSection } from "@/components/TrustSection";
import { NextStepsSection } from "@/components/NextStepsSection";
import { Footer } from "@/components/Footer";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen gradient-hero">
      {/* Header */}
      <header className="py-8">
        <div className="container mx-auto px-4">
          <Image 
            src="/toniic-logo.png" 
            alt="toniic" 
            width={120}
            height={48}
            className="h-10 md:h-12 w-auto"
            priority
          />
        </div>
      </header>

      {/* Hero Section */}
      <section className="pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-tight text-foreground lg:text-6xl md:text-6xl">
              Clinical software built for integrative and natural medicine.{" "}
              <span className="text-muted-foreground">Designed by naturopaths.</span>
            </h1>
            
            <p className="mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              One clinical space for herbal knowledge and formulation — without textbooks or scattered resources. More time where it matters: with clients.
            </p>

            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      <AudienceSection />

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      <BenefitsSection />

      <TrustSection />

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-border" />
      </div>

      <NextStepsSection />

      <Footer />
    </div>
  );
}
