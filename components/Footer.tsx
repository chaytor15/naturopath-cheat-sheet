"use client";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} toniic. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

