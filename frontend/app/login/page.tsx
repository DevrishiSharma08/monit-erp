"use client";

import { useState, FormEvent } from "react";
import {
  Eye, EyeOff, Loader2, Package,
  ShoppingCart, BarChart3, Truck, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function LoginPage() {
  const { login } = useAuth();
  const { error: toastError } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) toastError(result.message ?? "Login failed");
  };

  return (
    <>
      <style>{`
        @keyframes float-a {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          40%      { transform: translateY(-18px) rotate(6deg); }
          70%      { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes float-b {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-26px) rotate(-7deg); }
        }
        @keyframes blob-drift {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(30px,-20px) scale(1.05); }
          66%      { transform: translate(-20px,15px) scale(0.95); }
        }
        @keyframes slide-in-right {
          from { opacity:0; transform:translateX(40px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position:-200% center; }
          100% { background-position: 200% center; }
        }
        .fa { animation: float-a 7s ease-in-out infinite; }
        .fb { animation: float-b 9s ease-in-out infinite; }
        .fa2{ animation: float-a 11s ease-in-out infinite; animation-delay:-3s; }
        .fb2{ animation: float-b 8s ease-in-out infinite; animation-delay:-5s; }
        .blob { animation: blob-drift 14s ease-in-out infinite; }
        .blob2{ animation: blob-drift 18s ease-in-out infinite; animation-delay:-6s; }
        .anim-panel { animation: slide-in-right 0.65s cubic-bezier(.22,.68,0,1.2) both; }
        .fu1 { animation: fade-up 0.5s ease-out 0.15s both; }
        .fu2 { animation: fade-up 0.5s ease-out 0.25s both; }
        .fu3 { animation: fade-up 0.5s ease-out 0.35s both; }
        .fu4 { animation: fade-up 0.5s ease-out 0.45s both; }
        .shimmer-txt {
          background: linear-gradient(90deg, #93c5fd 0%, #fff 40%, #a5b4fc 65%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
      `}</style>

      <div className="flex min-h-screen">

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        <div className="relative hidden lg:flex lg:w-[56%] flex-col justify-between overflow-hidden p-12"
          style={{ background: "linear-gradient(140deg, #0f172a 0%, #1a2e5a 45%, #1e1b4b 100%)" }}>

          {/* Grid overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }} />

          {/* Glow blobs */}
          <div className="blob pointer-events-none absolute -top-16 left-20 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="blob2 pointer-events-none absolute bottom-10 right-10 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-sky-600/10 blur-3xl" />

          {/* Floating icon cards */}
          <div className="fa  pointer-events-none absolute top-16  right-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/10 backdrop-blur-sm shadow-lg">
              <ShoppingCart className="h-6 w-6 text-blue-300/80" />
            </div>
          </div>
          <div className="fb  pointer-events-none absolute top-44  right-52">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 backdrop-blur-sm shadow-md">
              <BarChart3 className="h-5 w-5 text-indigo-300/80" />
            </div>
          </div>
          <div className="fa2 pointer-events-none absolute bottom-44 right-14">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 backdrop-blur-sm shadow-lg" style={{ width: 52, height: 52 }}>
              <Truck className="h-6 w-6 text-sky-300/80" />
            </div>
          </div>
          <div className="fb2 pointer-events-none absolute bottom-64 right-56">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 backdrop-blur-sm">
              <TrendingUp className="h-4 w-4 text-violet-300/80" />
            </div>
          </div>

          {/* ── Top content ── */}
          <div className="relative z-10">
            {/* Brand */}
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-600/30">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-extrabold leading-tight text-white">Monit Paper Agency</p>
                <p className="text-xs text-blue-400/70">Indore, Madhya Pradesh</p>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-black leading-[1.1] tracking-tight">
              <span className="text-white">Complete ERP</span><br />
              <span className="shimmer-txt">for Paper Trading</span>
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">
              Manage procurement, inventory, sales, dispatch &amp; invoicing — all in one place.
            </p>

            {/* Feature bullets */}
            <div className="mt-9 space-y-3.5">
              {[
                { icon: ShoppingCart, cls:"fu1", label: "Sales & Customer Orders",  desc: "Inquiries → orders → invoices" },
                { icon: Package,      cls:"fu2", label: "Procurement & Inventory",  desc: "PO, GRN, stock lots & FIFO picking" },
                { icon: Truck,        cls:"fu3", label: "Dispatch & Logistics",     desc: "Load planning, challans & tracking" },
                { icon: BarChart3,    cls:"fu4", label: "Reports & Analytics",      desc: "Real-time dashboards & insights" },
              ].map(({ icon: Icon, cls, label, desc }) => (
                <div key={label} className={`flex items-center gap-3.5 ${cls}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <Icon className="h-3.5 w-3.5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">{label}</p>
                    <p className="text-[11px] text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom ── */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] text-slate-600 font-medium">Monit ERP · v1.0 · Phase 1</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-center bg-gray-50/80 p-6 lg:p-14">
          <div className="anim-panel w-full max-w-[400px]">

            {/* Mobile brand */}
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Monit Paper Agency</p>
                <p className="text-[10px] text-gray-500">ERP System</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-[28px] font-black tracking-tight text-gray-900">Welcome back</h2>
              <p className="mt-1 text-sm text-gray-500">Sign in to your workspace</p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                    Username
                  </label>
                  <input
                    type="text" autoComplete="username" value={username}
                    onChange={(e) => setUsername(e.target.value)} required
                    placeholder="Enter your username"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"} autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)} required
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                    : "Sign in →"}
                </button>
              </form>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
