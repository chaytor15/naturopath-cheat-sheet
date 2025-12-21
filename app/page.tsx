// app/page.tsx - Landing page
"use client";

import React from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const features = [
  {
    name: "Formulas in minutes, not hours",
    description:
      "Build complex herbal formulas quickly with dosage ranges, body systems, and safety info all in one workspace.",
  },
  {
    name: "Dosage logic built-in",
    description:
      "Per-herb therapeutic ranges, bottle fill, and weekly dose calculations update live as you create.",
  },
  {
    name: "Safety at the centre",
    description:
      "Warnings, cautions, and herb–body system considerations surfaced while you formulate.",
  },
  {
    name: "Built for real clinics",
    description:
      "Created by practising naturopaths to fit the actual flow of consults, not a spreadsheet.",
  },
  {
    name: "Dual-delivery support",
    description:
      "Support for liquid and capsule style formulations so you can use your own dispensary workflow.",
  },
  {
    name: "Export & share",
    description:
      "Save and export formulas for your notes, handouts, or dispensary team with one click.",
  },
];

const steps = [
  {
    number: "01",
    title: "Start with a patient goal",
    body: "Search by condition, body system, or key herb actions to seed your workspace.",
  },
  {
    number: "02",
    title: "Add herbs with guidance",
    body: "Drag herbs into the bottle and see dosage ranges, actions, and safety in context.",
  },
  {
    number: "03",
    title: "Confirm, export, prescribe",
    body: "Lock in bottle size, check totals, and export your final formula for your records.",
  },
];

const faqs = [
  {
    q: "Who is tonic. for?",
    a: "Naturopaths and medical herbalists who actively formulate in clinic and are tired of juggling textbooks, PDFs, and spreadsheets.",
  },
  {
    q: "Do I need to change my dispensary?",
    a: "No. tonic. is a formulation workspace, not a dispensary replacement. You can keep using your existing suppliers and systems.",
  },
  {
    q: "Will there be a free trial?",
    a: "Yes. We'll launch with a time-limited free trial so you can test tonic. in real consults before you commit.",
  },
  {
    q: "Is my data private?",
    a: "Your formulas are yours. We don't sell or share your data. tonic. is being built with practitioner confidentiality in mind.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F8F3] text-slate-900">
      <AppHeader />

      <main className="pt-[84px]">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-[#F7F8F3] py-20 px-4 sm:px-6 lg:px-8">
          {/* Animated gradient halo */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 hero-gradient"
            aria-hidden="true"
          />

          {/* Soft top fade so the gradient doesn't clash with nav */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 -z-10 bg-gradient-to-b from-[#F7F8F3] via-[#F7F8F3]/70 to-transparent" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="inline-flex items-center rounded-full border border-white/50 bg-white/80 backdrop-blur-lg px-4 py-1 text-[11px] font-medium text-[#4B543B] shadow-sm">
              Built by practising naturopaths
            </span>

            <h1 className="mt-6 text-4xl font-bold italic text-[#72b01d] sm:text-5xl md:text-6xl">
              smarter
              <span className="text-[#72b01d]"> herbal formulas</span>
              <span className="mt-2 block text-[#142200]">in minutes, not hours.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-[13px] text-slate-700">
              tonic. is a herbal formulation workspace that helps naturopaths build
              safe, effective herbal blends faster, with dosage ranges, herb actions,
              and body systems all in one calm, focused screen.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#142200] px-8 py-3 text-[13px] font-semibold text-white shadow-sm shadow-[#8ED08155] transition hover:bg-[#6aa318] hover:shadow-md hover:-translate-y-0.5"
              >
                Get started
              </Link>

              <Link
                href="/app"
                className="inline-flex items-center justify-center text-[13px] font-medium text-slate-700 hover:text-slate-900"
              >
                View workspace
                <span className="ml-1.5 text-lg" aria-hidden>
                  ↗
                </span>
              </Link>
            </div>

            <p className="mt-6 text-[11px] text-slate-500">
              Early access is limited to practising naturopaths and medical herbalists.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="bg-[#F7F8F3] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-semibold text-[#4B543B]">
                  A simple flow that matches a consult.
                </h2>
                <p className="mt-3 max-w-xl text-[13px] text-slate-700">
                  Start with intent, add herbs with context, and export a clean outcome
                  without breaking your rhythm.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#4B543B] px-5 py-2.5 text-[13px] font-medium text-[#DCE2AA] shadow-sm shadow-slate-300 transition hover:bg-[#3a4231] hover:shadow-md hover:-translate-y-0.5"
              >
                Get started
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div
                  key={s.number}
                  className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 shadow-lg shadow-black/5"
                >
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                      {s.number}
                    </span>
                    <h3 className="text-[13px] font-semibold text-[#4B543B]">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-[13px] text-slate-700">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-[#F7F8F3] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-semibold text-[#4B543B]">
                  All your herbal thinking,
                  <span className="block text-[#4B543B]/80">
                    in one quiet workspace.
                  </span>
                </h2>
                <p className="mt-3 max-w-xl text-[13px] text-slate-700">
                  No more flicking between textbooks, PDFs, and spreadsheets while your
                  patient watches. tonic. brings your key references together so you can
                  stay present in the consult.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#4B543B] px-5 py-2.5 text-[13px] font-medium text-[#DCE2AA] shadow-sm shadow-slate-300 transition hover:bg-[#3a4231] hover:shadow-md hover:-translate-y-0.5"
              >
                Get started
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="flex flex-col rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="text-[13px] font-semibold text-[#4B543B]">
                    {feature.name}
                  </h3>
                  <p className="mt-2 text-[13px] text-slate-700">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial + callout */}
        <section className="bg-[#F7F8F3] py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex rounded-full border border-white/50 bg-white/80 backdrop-blur-lg px-3 py-1 text-[11px] font-medium text-[#4B543B] shadow-sm">
              "I just want one place to think through my formulas."
            </div>
            <h2 className="mt-6 text-3xl font-semibold text-[#4B543B]">
              Built by practitioners who sit in front of patients every week.
            </h2>
            <p className="mt-3 text-[13px] text-slate-700">
              tonic. started as a frustration with the tools we had to use in our own
              clinics. The goal is simple: a calm, reliable workspace that respects both
              herbal medicine and clinical reality.
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-white/50 bg-[#F7F8F3] py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-[#4B543B]">
                Pricing made for small clinics and solo practitioners.
              </h2>
              <p className="mt-3 text-[13px] text-slate-700">
                Final pricing will launch with the public beta. Early access practitioners
                will receive a founding member rate.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {/* Solo */}
              <div className="flex flex-col rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 shadow-lg shadow-black/5">
                <h3 className="text-[13px] font-semibold text-[#4B543B]">
                  Solo practitioner
                </h3>
                <p className="mt-2 text-[13px] text-slate-700">
                  For individual naturopaths and herbalists.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
                  TBD
                  <span className="text-[13px] font-normal text-slate-600"> / month</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-[13px] text-slate-700">
                  <li>1 practitioner seat</li>
                  <li>Unlimited formulas</li>
                  <li>Secure cloud storage</li>
                  <li>Email support</li>
                </ul>
                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#8ED081] px-4 py-2.5 text-[13px] font-semibold text-[#4B543B] hover:bg-[#7ecd6f] hover:shadow-md hover:-translate-y-0.5"
                >
                  Get started
                </Link>
              </div>

              {/* Clinic */}
              <div className="relative flex flex-col rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 shadow-lg shadow-black/5">
                <span className="absolute -top-3 left-6 rounded-full border border-white/50 bg-white/80 backdrop-blur-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#4B543B] shadow-sm">
                  Most popular
                </span>
                <h3 className="mt-1 text-[13px] font-semibold text-[#4B543B]">
                  Clinic team
                </h3>
                <p className="mt-2 text-[13px] text-slate-700">
                  For clinics with multiple practitioners and a shared dispensary.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
                  TBD
                  <span className="text-[13px] font-normal text-slate-600"> / month</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-[13px] text-slate-700">
                  <li>Up to 5 seats</li>
                  <li>Shared formula library</li>
                  <li>Role-based permissions</li>
                  <li>Priority support</li>
                </ul>
                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#4B543B] px-4 py-2.5 text-[13px] font-semibold text-[#DCE2AA] hover:bg-[#3a4231] hover:shadow-md hover:-translate-y-0.5"
                >
                  Get started
                </Link>
              </div>

              {/* Student */}
              <div className="flex flex-col rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 shadow-lg shadow-black/5">
                <h3 className="text-[13px] font-semibold text-[#4B543B]">Student</h3>
                <p className="mt-2 text-[13px] text-slate-700">
                  For students in accredited naturopathic or herbal medicine programs.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
                  TBD
                  <span className="text-[13px] font-normal text-slate-600"> / month</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-[13px] text-slate-700">
                  <li>1 seat</li>
                  <li>Personal formula library</li>
                  <li>Non-commercial use</li>
                  <li>Community Q&amp;A</li>
                </ul>
                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#8ED081cc] px-4 py-2.5 text-[13px] font-semibold text-[#4B543B] hover:bg-[#8ED081] hover:shadow-md hover:-translate-y-0.5"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-[#F7F8F3] py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold text-[#4B543B]">
              Questions practitioners are already asking.
            </h2>

            <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg shadow-lg shadow-black/5">
              {faqs.map((item) => (
                <details key={item.q} className="group" open={item.q === faqs[0].q}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                    <span className="text-[13px] font-medium text-slate-800">{item.q}</span>
                    <span className="ml-4 text-xl text-slate-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-4 pb-3 text-[13px] text-slate-700">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#4B543B] py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold text-[#DCE2AA]">
              Help shape the herbal formulation workspace you always wanted.
            </h2>
            <p className="mt-3 text-[13px] text-[#DCE2AA]/80">
              Early access practitioners will influence feature prioritisation, dosing
              data, and workflows. This is where tonic. gets tuned for real clinics.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#8ED081] px-6 py-3 text-[13px] font-semibold text-[#4B543B] hover:bg-[#7ecd6f] hover:shadow-md hover:-translate-y-0.5"
              >
                Get started
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center text-[13px] font-medium text-[#DCE2AA]/80 hover:text-[#DCE2AA]"
              >
                Explore features
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#4B543B33] bg-[#4B543B] text-[#DCE2AA]/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8ED081] text-[#4B543B] text-[13px] font-semibold">
              t.
            </div>
            <span>© {new Date().getFullYear()} tonic. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="hover:text-[#DCE2AA]">
              Terms
            </a>
            <a href="#" className="hover:text-[#DCE2AA]">
              Privacy
            </a>
            <a href="#" className="hover:text-[#DCE2AA]">
              Contact
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
