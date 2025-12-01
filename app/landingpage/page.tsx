// app/page.tsx
"use client";

import React from "react";

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
    a: "Yes. We’ll launch with a time-limited free trial so you can test tonic. in real consults before you commit.",
  },
  {
    q: "Is my data private?",
    a: "Your formulas are yours. We don’t sell or share your data. tonic. is being built with practitioner confidentiality in mind.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-willow text-ebony font-semibold shadow-sm shadow-slate-200">
              t.
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-base font-semibold tracking-tight text-ebony">
                tonic.
              </span>
              <span className="text-xs text-slate-500">
                Herbal formulation workspace
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a
              href="https://tonicworkspace.com/#features"
              className="hover:text-slate-900"
            >
              Features
            </a>
            <a
              href="https://tonicworkspace.com/#how-it-works"
              className="hover:text-slate-900"
            >
              How it works
            </a>
            <a
              href="https://tonicworkspace.com/#pricing"
              className="hover:text-slate-900"
            >
              Pricing
            </a>
            <a
              href="https://tonicworkspace.com/#faq"
              className="hover:text-slate-900"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://tonicworkspace.com/login"
              className="hidden text-sm text-slate-600 hover:text-slate-900 md:inline-block"
            >
              Sign in
            </a>
            <a
              href="https://tonicworkspace.com/early-access"
              className="inline-flex items-center justify-center rounded-full bg-ebony px-4 py-2 text-sm font-medium text-vanilla shadow-sm shadow-slate-300 transition hover:bg-ebony/90 hover:shadow-md"
            >
              Join early access
            </a>
          </div>
        </div>
      </header>

      <main>
        
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:px-8">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-flex items-center rounded-full bg-olive/15 px-3 py-1 text-xs font-medium text-ebony ring-1 ring-willow/40">
                Built by practising naturopaths
              </span>

<h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-olive sm:text-5xl">
                Smarter herbal formulas
                <span className="block text-ebony/80">in minutes, not hours.</span>
              </h1>

              <p className="mt-4 max-w-xl text-base text-slate-700">
                tonic. is a herbal formulation workspace that helps naturopaths build
                safe, effective herbal blends faster, with dosage ranges, herb actions,
                and body systems all in one calm, focused screen.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="https://tonicworkspace.com/early-access"
                  className="inline-flex items-center justify-center rounded-full bg-willow px-6 py-3 text-sm font-semibold text-ebony shadow-sm shadow-slate-300 transition hover:bg-willow/90 hover:shadow-md hover:-translate-y-0.5"
                >
                  Request early access
                </a>
                <a
                  href="https://tonicworkspace.com/#demo"
                  className="inline-flex items-center justify-center text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  View live demo
                  <span className="ml-1.5 text-lg" aria-hidden>
                    ↗
                  </span>
                </a>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Early access is limited to practising naturopaths and medical herbalists.
              </p>
            </div>

            {/* Hero mockup with halo + depth */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-willow/25 via-celadon/15 to-transparent blur-2xl" />
              <div className="relative mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/80">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-willow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-vanilla" />
                    <span className="h-2.5 w-2.5 rounded-full bg-copper" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Workspace: Iron &amp; energy support
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Bottle overview
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-ebony">
                        200 mL
                        <span className="ml-2 align-middle text-xs font-normal text-slate-600">
                          2x daily · 5 mL
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Total weekly dose:{" "}
                        <span className="font-semibold">140 mL</span>
                      </p>
                    </div>
                    {/* Simple bottle visual */}
                    <div className="flex h-24 w-14 flex-col justify-end rounded-full border border-slate-200 bg-vanilla/80 p-1">
                      <div className="h-1 w-6 self-center rounded-sm bg-ebony" />
                      <div className="mt-1 flex-1 rounded-full bg-white/70">
                        <div className="h-3/5 rounded-full bg-willow/80" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Herb</span>
                      <span>Dose / wk</span>
                      <span className="text-right">Range</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs">
                      <MockHerbRow
                        name="Withania somnifera"
                        common="Ashwagandha"
                        dose="40 mL"
                        range="35–45 mL"
                        status="within"
                      />
                      <MockHerbRow
                        name="Angelica sinensis"
                        common="Dong quai"
                        dose="25 mL"
                        range="20–30 mL"
                        status="within"
                      />
                      <MockHerbRow
                        name="Urtica dioica"
                        common="Nettle"
                        dose="30 mL"
                        range="20–40 mL"
                        status="within"
                      />
                      <MockHerbRow
                        name="Matricaria chamomilla"
                        common="Chamomile"
                        dose="15 mL"
                        range="10–20 mL"
                        status="within"
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-slate-500">
                  Example data only. tonic. does not replace your own clinical judgement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t border-slate-200 bg-white py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="font-heading text-2xl font-semibold text-ebony sm:text-3xl">
                Designed around the way naturopaths actually work.
              </h2>
              <p className="mt-3 text-sm text-slate-700">
                tonic. keeps your focus on the patient, not the admin. Every part of the
                workflow supports the rhythm of a real consultation.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-xs font-semibold tracking-[0.2em] text-slate-500">
                    {step.number}
                  </span>
                  <h3 className="mt-3 font-heading text-lg font-semibold text-ebony">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-ebony sm:text-3xl">
                  All your herbal thinking,
                  <span className="block text-ebony/80">in one quiet workspace.</span>
                </h2>
                <p className="mt-3 max-w-xl text-sm text-slate-700">
                  No more flicking between textbooks, PDFs, and spreadsheets while your
                  patient watches. tonic. brings your key references together so you can
                  stay present in the consult.
                </p>
              </div>
              <a
                href="https://tonicworkspace.com/early-access"
                className="inline-flex items-center justify-center rounded-full bg-ebony px-5 py-2.5 text-sm font-medium text-vanilla shadow-sm shadow-slate-300 transition hover:bg-ebony/90 hover:shadow-md hover:-translate-y-0.5"
              >
                Get on the early access list
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="font-heading text-base font-semibold text-ebony">
                    {feature.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial + callout */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="inline-flex rounded-full bg-willow/15 px-3 py-1 text-xs font-medium text-ebony ring-1 ring-willow/40">
              “I just want one place to think through my formulas.”
            </div>
            <h2 className="mt-6 font-heading text-2xl font-semibold text-ebony sm:text-3xl">
              Built by practitioners who sit in front of patients every week.
            </h2>
            <p className="mt-3 text-sm text-slate-700">
              tonic. started as a frustration with the tools we had to use in our own
              clinics. The goal is simple: a calm, reliable workspace that respects both
              herbal medicine and clinical reality.
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-heading text-2xl font-semibold text-ebony sm:text-3xl">
                Pricing made for small clinics and solo practitioners.
              </h2>
              <p className="mt-3 text-sm text-slate-700">
                Final pricing will launch with the public beta. Early access practitioners
                will receive a founding member rate.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {/* Solo */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
                <h3 className="font-heading text-base font-semibold text-ebony">
                  Solo practitioner
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For individual naturopaths and herbalists.
                </p>
                <p className="mt-6 text-3xl font-semibold text-ebony">
                  TBD
                  <span className="text-sm font-normal text-slate-600">
                    {" "}
                    / month
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  <li>1 practitioner seat</li>
                  <li>Unlimited formulas</li>
                  <li>Secure cloud storage</li>
                  <li>Email support</li>
                </ul>
                <a
                  href="https://tonicworkspace.com/early-access"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-willow px-4 py-2.5 text-sm font-semibold text-ebony hover:bg-willow/90 hover:shadow-md hover:-translate-y-0.5"
                >
                  Join early access
                </a>
              </div>

              {/* Clinic */}
              <div className="relative flex flex-col rounded-3xl border border-willow/60 bg-gradient-to-b from-white to-willow/10 p-6 shadow-md shadow-willow/30">
                <span className="absolute -top-3 left-6 rounded-full bg-copper px-3 py-1 text-xs font-semibold uppercase tracking-wide text-vanilla shadow-sm">
                  Most popular
                </span>
                <h3 className="mt-1 font-heading text-base font-semibold text-ebony">
                  Clinic team
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For clinics with multiple practitioners and a shared dispensary.
                </p>
                <p className="mt-6 text-3xl font-semibold text-ebony">
                  TBD
                  <span className="text-sm font-normal text-slate-600">
                    {" "}
                    / month
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  <li>Up to 5 seats</li>
                  <li>Shared formula library</li>
                  <li>Role-based permissions</li>
                  <li>Priority support</li>
                </ul>
                <a
                  href="https://tonicworkspace.com/early-access"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-ebony px-4 py-2.5 text-sm font-semibold text-vanilla hover:bg-ebony/90 hover:shadow-md hover:-translate-y-0.5"
                >
                  Apply for clinic access
                </a>
              </div>

              {/* Student */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
                <h3 className="font-heading text-base font-semibold text-ebony">
                  Student
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For students in accredited naturopathic or herbal medicine programs.
                </p>
                <p className="mt-6 text-3xl font-semibold text-ebony">
                  TBD
                  <span className="text-sm font-normal text-slate-600">
                    {" "}
                    / month
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  <li>1 seat</li>
                  <li>Personal formula library</li>
                  <li>Non-commercial use</li>
                  <li>Community Q&amp;A</li>
                </ul>
                <a
                  href="https://tonicworkspace.com/early-access"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-willow/80 px-4 py-2.5 text-sm font-semibold text-ebony hover:bg-willow hover:shadow-md hover:-translate-y-0.5"
                >
                  Register interest
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl font-semibold text-ebony sm:text-3xl">
              Questions practitioners are already asking.
            </h2>
            <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {faqs.map((item) => (
                <details
                  key={item.q}
                  className="group"
                  open={item.q === faqs[0].q}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
                    <span className="text-sm font-medium text-slate-800">
                      {item.q}
                    </span>
                    <span className="ml-4 text-xl text-slate-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-slate-700">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ebony py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl font-semibold text-vanilla sm:text-3xl">
              Help shape the herbal formulation workspace you always wanted.
            </h2>
            <p className="mt-3 text-sm text-vanilla/80">
              Early access practitioners will influence feature prioritisation, dosing
              data, and workflows. This is where tonic. gets tuned for real clinics.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="https://tonicworkspace.com/early-access"
                className="inline-flex items-center justify-center rounded-full bg-willow px-6 py-3 text-sm font-semibold text-ebony hover:bg-willow/90 hover:shadow-md hover:-translate-y-0.5"
              >
                Join the early access list
              </a>
              <a
                href="https://tonicworkspace.com/#features"
                className="inline-flex items-center justify-center text-sm font-medium text-vanilla/80 hover:text-vanilla"
              >
                Explore features
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-ebony/20 bg-ebony text-vanilla/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-willow text-ebony text-sm font-semibold">
              t.
            </div>
            <span>© {new Date().getFullYear()} tonic. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://tonicworkspace.com/terms"
              className="hover:text-vanilla"
            >
              Terms
            </a>
            <a
              href="https://tonicworkspace.com/privacy"
              className="hover:text-vanilla"
            >
              Privacy
            </a>
            <a
              href="https://tonicworkspace.com/contact"
              className="hover:text-vanilla"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type MockHerbRowProps = {
  name: string;
  common: string;
  dose: string;
  range: string;
  status: "within" | "low" | "high";
};

function MockHerbRow({ name, common, dose, range, status }: MockHerbRowProps) {
  const statusColor =
    status === "within"
      ? "bg-willow/20 text-ebony"
      : status === "low"
      ? "bg-vanilla/40 text-ebony/80"
      : "bg-red-100 text-red-800";

  const statusLabel =
    status === "within" ? "Within range" : status === "low" ? "Below" : "Above";

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="min-w-0 pr-2">
        <p className="truncate text-[11px] font-medium text-ebony">{name}</p>
        <p className="truncate text-[10px] text-slate-600">{common}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-[11px] text-slate-700">
          <div>{dose}</div>
          <div className="text-[10px] text-slate-500">{range}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
