import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 bg-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-950">Public Demo</p>
          <p className="mt-1 text-xs text-slate-600">Authentication is disabled for this portfolio dashboard.</p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-700">Everyone can browse the dashboard in read-only mode. Write actions, settings, and raw debug data are not available publicly.</p>
          <Link href="/" className="inline-flex border border-blue-800 bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">Open dashboard</Link>
        </div>
      </div>
    </main>
  );
}
