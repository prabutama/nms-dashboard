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
			<div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
				<div className="w-full max-w-md border border-slate-200 bg-white p-6">
					<p className="text-sm font-semibold text-slate-950">Already signed in</p>
					<p className="mt-1 text-xs text-slate-500">{user?.email}</p>
					<button type="button" onClick={() => router.push("/")} className="mt-4 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Go to dashboard</button>
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
		<div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
			<form onSubmit={onSubmit} className="w-full max-w-md border border-slate-200 bg-white">
				<div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
					<p className="text-sm font-semibold text-slate-950">Sign in</p>
					<p className="mt-1 text-xs text-slate-500">Use your ThingsBoard user credentials.</p>
				</div>
				<div className="space-y-4 px-5 py-5">
					<div>
						<label className="text-xs font-medium text-slate-700">Username</label>
						<input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600" />
					</div>
					<div>
						<label className="text-xs font-medium text-slate-700">Password</label>
						<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600" />
					</div>
					{error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
					<button disabled={pending} className="w-full bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Signing in..." : "Sign in"}</button>
				</div>
			</form>
		</div>
	);
}
