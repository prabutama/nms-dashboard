"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
	const router = useRouter();
	const { login, isAuthenticated, user } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	if (isAuthenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
				<div className="w-full max-w-md border border-slate-300 bg-white p-6 shadow-sm">
					<p className="text-sm font-semibold text-slate-950">Already signed in</p>
					<p className="mt-1 text-xs text-slate-600">{user?.email}</p>
					<button type="button" onClick={() => router.push("/")} className="mt-4 border border-blue-800 bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">Go to dashboard</button>
				</div>
			</div>
		);
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setPending(true);
		setError("");
		try {
			await login(username, password);
			router.push("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
			<form onSubmit={onSubmit} className="w-full max-w-md border border-slate-300 bg-white shadow-sm">
				<div className="border-b border-slate-300 bg-slate-100 px-5 py-4">
					<p className="text-sm font-semibold text-slate-950">Sign in</p>
					<p className="mt-1 text-xs text-slate-600">Use your ThingsBoard user credentials.</p>
				</div>
				<div className="space-y-4 px-5 py-5">
					<div>
						<label className="text-xs font-semibold text-slate-800">Username</label>
						<input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-700" />
					</div>
					<div>
						<label className="text-xs font-semibold text-slate-800">Password</label>
						<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-slate-400 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-700" />
					</div>
					{error ? <p className="border border-red-200 bg-red-100 px-3 py-2 text-xs text-red-800">{error}</p> : null}
					<button disabled={pending} className="w-full border border-blue-800 bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">{pending ? "Signing in..." : "Sign in"}</button>
				</div>
			</form>
		</div>
	);
}
