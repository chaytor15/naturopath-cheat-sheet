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
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#72b01d] text-[#fff] font-semibold shadow-sm shadow-slate-200">
              t.
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading text-base font-semibold tracking-tight text-[#4B543B]">
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
              className="inline-flex items-center justify-center rounded-full bg-[#72b01d] px-4 py-2 text-sm font-medium text-[#fff] shadow-sm shadow-slate-300 transition hover:bg-[#3a4231] hover:shadow-md"
            >
              Join today
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-white py-20 px-4 sm:px-6 lg:px-8">
  {/* Animated gradient halo */}
  <div
    className="pointer-events-none absolute inset-0 -z-10 hero-gradient"
    aria-hidden="true"
  />

  {/* Soft top fade so the gradient doesn’t clash with nav */}
  <div className="pointer-events-none absolute inset-x-0 top-0 h-32 -z-10 bg-gradient-to-b from-white via-white/70 to-transparent" />

  <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
    <span className="inline-flex items-center rounded-full border border-[#4B543B33] bg-white/80 px-4 py-1 text-xs font-medium text-[#4B543B] shadow-sm backdrop-blur-sm">
      Built by practising naturopaths
    </span>

    <h1 className="mt-6 font-sans text-4xl font-bold italic text-[#72b01d] sm:text-5xl md:text-6xl">
      smarter
      <span className="text-[#72b01d]"> herbal formulas</span>
      <span className="mt-2 block text-[#142200]">
        in minutes, not hours.
      </span>
    </h1>

    <p className="mt-6 max-w-2xl text-base text-slate-700 font-sans">
      tonic. is a herbal formulation workspace that helps naturopaths build
      safe, effective herbal blends faster, with dosage ranges, herb actions,
      and body systems all in one calm, focused screen.
    </p>

    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <a
        href="https://tonicworkspace.com/early-access"
        className="inline-flex items-center justify-center rounded-full bg-[#142200] px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-[#8ED08155] transition hover:bg-[#6aa318] hover:shadow-md hover:-translate-y-0.5"
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

    <p className="mt-6 text-xs text-slate-500 font-sans">
      Early access is limited to practising naturopaths and medical herbalists.
    </p>
  </div>
</section>



        {/* How it works */}
      

        {/* Features */}
        <section id="features" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-[#4B543B] sm:text-3xl">
                  All your herbal thinking,
                  <span className="block text-[#4B543B]/80">
                    in one quiet workspace.
                  </span>
                </h2>
                <p className="mt-3 max-w-xl text-sm text-slate-700">
                  No more flicking between textbooks, PDFs, and spreadsheets while your
                  patient watches. tonic. brings your key references together so you can
                  stay present in the consult.
                </p>
              </div>
              <a
                href="https://tonicworkspace.com/early-access"
                className="inline-flex items-center justify-center rounded-full bg-[#4B543B] px-5 py-2.5 text-sm font-medium text-[#DCE2AA] shadow-sm shadow-slate-300 transition hover:bg-[#3a4231] hover:shadow-md hover:-translate-y-0.5"
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
                  <h3 className="font-heading text-base font-semibold text-[#4B543B]">
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
            <div className="inline-flex rounded-full bg-[#8ED08133] px-3 py-1 text-xs font-medium text-[#4B543B] ring-1 ring-[#8ED08155]">
              “I just want one place to think through my formulas.”
            </div>
            <h2 className="mt-6 font-heading text-2xl font-semibold text-[#4B543B] sm:text-3xl">
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
              <h2 className="font-heading text-2xl font-semibold text-[#4B543B] sm:text-3xl">
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
                <h3 className="font-heading text-base font-semibold text-[#4B543B]">
                  Solo practitioner
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For individual naturopaths and herbalists.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
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
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#8ED081] px-4 py-2.5 text-sm font-semibold text-[#4B543B] hover:bg-[#7ecd6f] hover:shadow-md hover:-translate-y-0.5"
                >
                  Join early access
                </a>
              </div>

              {/* Clinic */}
              <div className="relative flex flex-col rounded-3xl border border-[#8ED08199] bg-gradient-to-b from-white to-[#8ED0811A] p-6 shadow-md shadow-[#8ED0814d]">
                <span className="absolute -top-3 left-6 rounded-full bg-[#B57F50] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#DCE2AA] shadow-sm">
                  Most popular
                </span>
                <h3 className="mt-1 font-heading text-base font-semibold text-[#4B543B]">
                  Clinic team
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For clinics with multiple practitioners and a shared dispensary.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
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
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#4B543B] px-4 py-2.5 text-sm font-semibold text-[#DCE2AA] hover:bg-[#3a4231] hover:shadow-md hover:-translate-y-0.5"
                >
                  Apply for clinic access
                </a>
              </div>

              {/* Student */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
                <h3 className="font-heading text-base font-semibold text-[#4B543B]">
                  Student
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  For students in accredited naturopathic or herbal medicine programs.
                </p>
                <p className="mt-6 text-3xl font-semibold text-[#4B543B]">
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
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#8ED081cc] px-4 py-2.5 text-sm font-semibold text-[#4B543B] hover:bg-[#8ED081] hover:shadow-md hover:-translate-y-0.5"
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
            <h2 className="font-heading text-2xl font-semibold text-[#4B543B] sm:text-3xl">
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
        <section className="bg-[#4B543B] py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl font-semibold text-[#DCE2AA] sm:text-3xl">
              Help shape the herbal formulation workspace you always wanted.
            </h2>
            <p className="mt-3 text-sm text-[#DCE2AA]/80">
              Early access practitioners will influence feature prioritisation, dosing
              data, and workflows. This is where tonic. gets tuned for real clinics.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="https://tonicworkspace.com/early-access"
                className="inline-flex items-center justify-center rounded-full bg-[#8ED081] px-6 py-3 text-sm font-semibold text-[#4B543B] hover:bg-[#7ecd6f] hover:shadow-md hover:-translate-y-0.5"
              >
                Join the early access list
              </a>
              <a
                href="https://tonicworkspace.com/#features"
                className="inline-flex items-center justify-center text-sm font-medium text-[#DCE2AA]/80 hover:text-[#DCE2AA]"
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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8ED081] text-[#4B543B] text-sm font-semibold">
              t.
            </div>
            <span>© {new Date().getFullYear()} tonic. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://tonicworkspace.com/terms"
              className="hover:text-[#DCE2AA]"
            >
              Terms
            </a>
            <a
              href="https://tonicworkspace.com/privacy"
              className="hover:text-[#DCE2AA]"
            >
              Privacy
            </a>
            <a
              href="https://tonicworkspace.com/contact"
              className="hover:text-[#DCE2AA]"
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
      ? "bg-[#8ED08133] text-[#4B543B]"
      : status === "low"
      ? "bg-[#DCE2AA66] text-[#4B543B]"
      : "bg-red-100 text-red-800";

  const statusLabel =
    status === "within" ? "Within range" : status === "low" ? "Below" : "Above";

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="min-w-0 pr-2">
        <p className="truncate text-[11px] font-medium text-[#4B543B]">
          {name}
        </p>
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
