// Next.js 13+ instrumentation hook — Next calls register() exactly once
// per server worker at startup, before any route handlers run. This is
// the canonical place to wire dd-trace's bootstrap so its monkey-patches
// of http / fetch / undici land before user code holds references.
//
// dd-trace reads DD_API_KEY / DD_SITE / DD_SERVICE / DD_ENV / DD_VERSION
// from process.env automatically. Without DD_API_KEY the SDK initialises
// but ships nothing — safe no-op for offline dev / tests.
//
// Pre-wired by the dark POC factory's Phase H. The factory seeds
// DD_API_KEY / DD_APP_KEY / DD_SITE as repo Actions secrets at scaffold
// time so production deploy paths get observability without per-developer
// setup; locally fill backend/.env to see traces from your dev runs.

export async function register(): Promise<void> {
  // Skip in the Edge runtime — dd-trace targets the Node.js runtime only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Cheap exit when the Datadog credentials are unset — saves the cost
  // of importing the tracer in offline / test environments.
  if (!process.env.DD_API_KEY) return;

  // Dynamic import keeps dd-trace out of the Edge / build-time bundle.
  const tracer = (await import("dd-trace")).default;
  tracer.init({
    service: process.env.DD_SERVICE ?? "darkpoc-frontend",
    env: process.env.DD_ENV ?? "dev",
    version: process.env.DD_VERSION ?? "0.1.0",
    logInjection: true,
  });
}
