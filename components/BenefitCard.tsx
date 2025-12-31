"use client";

interface BenefitCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function BenefitCard({ title, description, icon }: BenefitCardProps) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:shadow-soft hover:-translate-y-1">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

