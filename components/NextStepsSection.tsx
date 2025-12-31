"use client";

const steps = [
  { number: "1", text: "Join the waitlist" },
  { number: "2", text: "Receive an early access invite" },
  { number: "3", text: "Founding users help shape the product" },
];

export function NextStepsSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container max-w-3xl mx-auto px-4">
        <h2 className="mb-12 text-center text-3xl font-semibold text-foreground md:text-4xl">
          What happens next?
        </h2>
        
        <div className="flex flex-col items-center space-y-6 md:flex-row md:justify-center md:space-x-12 md:space-y-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center gap-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                {step.number}
              </span>
              <span className="text-lg text-foreground">{step.text}</span>
              {index < steps.length - 1 && (
                <span className="hidden text-muted-foreground md:inline">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

