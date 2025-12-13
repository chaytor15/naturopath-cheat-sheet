import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4 rounded-2xl border bg-white/80 p-6">
        <h1 className="text-2xl font-semibold">tonic.</h1>
        <p className="text-sm opacity-80">
          Smarter herbal formulas in minutes, not hours.
        </p>

        <div className="flex gap-3">
          <Link className="rounded-xl bg-black px-4 py-2 text-white" href="/login">
            Login / Register
          </Link>

          <Link className="rounded-xl border px-4 py-2" href="/app">
            Open app
          </Link>
        </div>
      </div>
    </main>
  );
}
