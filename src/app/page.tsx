export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium uppercase tracking-[0.08em] text-teal-700">LumenBazaar</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-slate-950">
        Stellar x402 resource discovery and settlement visibility
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
        This frontend will expose seller onboarding, buyer discovery, payment testing, receipts,
        operator health, and conformance evidence for the LumenBazaar stack.
      </p>
    </main>
  );
}
