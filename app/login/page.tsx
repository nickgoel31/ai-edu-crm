"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

function SignupSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("signup_success") !== "true") return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-400">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>Account created. Sign in with your new credentials to continue.</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0c] text-white flex items-center justify-center overflow-hidden px-4 select-none">
      {/* Background Circuit/Node Lines & Edge Chips */}
      <div className="absolute inset-0 pointer-events-none">
        {/* SVG Circuit Lines connecting corners to center */}
        <svg
          className="w-full h-full text-zinc-800/80"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          {/* Top-Left Trace */}
          <path
            d="M 150 135 L 440 135 L 500 230 L 500 380"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
          {/* Top-Right Trace */}
          <path
            d="M 1290 135 L 1000 135 L 940 230 L 940 380"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
          {/* Bottom-Left Trace */}
          <path
            d="M 150 765 L 440 765 L 500 670 L 500 520"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
          {/* Bottom-Right Trace */}
          <path
            d="M 1290 765 L 1000 765 L 940 670 L 940 520"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
        </svg>

        {/* Top-Left Chip Node */}
        <div className="hidden md:flex items-center absolute top-12 left-10 space-x-2">
          <div className="flex items-center bg-[#131418] border border-zinc-800/80 rounded-lg px-4 py-3 shadow-2xl relative">
            <div className="flex flex-col space-y-1">
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
              </div>
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              </div>
            </div>
            {/* Left wire pins */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-zinc-800/60"></div>
        </div>

        {/* Top-Right Chip Node */}
        <div className="hidden md:flex items-center absolute top-12 right-10 space-x-2 flex-row-reverse">
          <div className="flex items-center bg-[#131418] border border-zinc-800/80 rounded-lg px-4 py-3 shadow-2xl relative">
            <div className="flex flex-col space-y-1">
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
              </div>
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              </div>
            </div>
            {/* Right wire pins */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-zinc-800/60 mr-2"></div>
        </div>

        {/* Bottom-Left Chip Node */}
        <div className="hidden md:flex items-center absolute bottom-12 left-10 space-x-2">
          <div className="flex items-center bg-[#131418] border border-zinc-800/80 rounded-lg px-4 py-3 shadow-2xl relative">
            <div className="flex flex-col space-y-1">
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
              </div>
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              </div>
            </div>
            {/* Left wire pins */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-zinc-800/60"></div>
        </div>

        {/* Bottom-Right Chip Node */}
        <div className="hidden md:flex items-center absolute bottom-12 right-10 space-x-2 flex-row-reverse">
          <div className="flex items-center bg-[#131418] border border-zinc-800/80 rounded-lg px-4 py-3 shadow-2xl relative">
            <div className="flex flex-col space-y-1">
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
              </div>
              <div className="flex space-x-1">
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              </div>
            </div>
            {/* Right wire pins */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
              <span className="w-2 h-[1px] bg-zinc-700"></span>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-zinc-800/60 mr-2"></div>
        </div>
      </div>

      {/* Main Glass/Dark Login Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-[#131418]/90 border border-zinc-800/80 p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Glowing Central Header Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative flex items-center justify-center w-full my-2">
            {/* Dot grid decoration behind logo */}
            <div className="flex items-center space-x-1.5 opacity-25">
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-zinc-500"></span>
                ))}
              </div>
            </div>

            {/* Glowing Logo Icon */}
            <div className="mx-4 flex items-center justify-center w-12 h-12 rounded-2xl bg-[#191b22] border border-zinc-700/60 shadow-inner">
              <div className="w-6 h-6 rounded-full border-[2.5px] border-t-cyan-400 border-r-blue-500 border-b-cyan-300 border-l-transparent animate-[spin_10s_linear_infinite]" />
            </div>

            <div className="flex items-center space-x-1.5 opacity-25">
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-zinc-500"></span>
                ))}
              </div>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-white mt-3">
            Welcome Back
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Don't have an account yet?{" "}
            <Link
              href="/register"
              className="text-white hover:text-cyan-400 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        <Suspense fallback={null}>
          <SignupSuccessBanner />
        </Suspense>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email address"
              className="w-full h-11 rounded-lg bg-[#0e0f12] border border-zinc-800/90 pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-11 rounded-lg bg-[#0e0f12] border border-zinc-800/90 pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 mt-2 rounded-lg bg-[#007aff] hover:bg-[#0069dc] active:bg-[#005bbd] text-white text-xs font-semibold tracking-wide flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,122,255,0.35)] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* OR Divider */}
        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/80"></div>
          </div>
          <span className="relative bg-[#131418] px-2 text-[10px] uppercase tracking-wider text-zinc-500">
            OR
          </span>
        </div>

        {/* Social Login Buttons (Apple, Google, X) */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            className="h-10 rounded-lg bg-[#181a20] border border-zinc-800/80 hover:bg-zinc-800/60 hover:border-zinc-700 flex items-center justify-center text-zinc-300 transition-all"
            title="Sign in with Apple"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.7-0.93 2.71 1.01.08 2.03-.51 2.63-1.21z" />
            </svg>
          </button>

          <button
            type="button"
            className="h-10 rounded-lg bg-[#181a20] border border-zinc-800/80 hover:bg-zinc-800/60 hover:border-zinc-700 flex items-center justify-center text-zinc-300 transition-all"
            title="Sign in with Google"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </button>

          <button
            type="button"
            className="h-10 rounded-lg bg-[#181a20] border border-zinc-800/80 hover:bg-zinc-800/60 hover:border-zinc-700 flex items-center justify-center text-zinc-300 transition-all"
            title="Sign in with X"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

