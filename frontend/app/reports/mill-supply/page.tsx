"use client";

import Link from "next/link";
import { Factory, Truck, BarChart3, FileText, ArrowRight } from "lucide-react";

const REPORTS = [
  {
    num: 8,
    name: "Mill Performance",
    slug: "mill-performance",
    desc: "On-time delivery %, quality rejection rate, and average delay days per mill.",
    icon: Factory,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    feeds: ["Purchase Orders", "GRN", "Mill Tracker"],
    chain: "PO → Transit → GRN quality",
  },
  {
    num: 9,
    name: "Product Ready vs Transport Delay",
    slug: "product-ready-vs-transport-delay",
    desc: "Days between mill readiness and actual truck dispatch — measures transporter lag.",
    icon: Truck,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    feeds: ["Mill Tracker", "Truck Load Plan", "In-Transit"],
    chain: "Mill ready date → TLP planned date",
  },
  {
    num: 10,
    name: "Product Against Supply",
    slug: "product-against-supply",
    desc: "What was ordered vs what was actually supplied, with shortfall analysis.",
    icon: BarChart3,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    feeds: ["Sales Orders", "Purchase Orders", "GRN"],
    chain: "SO ordered → PO → GRN received",
  },
  {
    num: 11,
    name: "Customer Order by Mill",
    slug: "customer-order-by-mill",
    desc: "Which mill supplies which customer — useful for sourcing optimisation.",
    icon: FileText,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    feeds: ["Purchase Orders", "Sales Orders", "GRN"],
    chain: "PO mill → SO customer mapping",
  },
];

export default function MillSupplyPage() {
  return (
    <div className="space-y-6 pb-24">
      <p className="text-sm text-gray-500">
        Track mill production performance, supply fulfilment, and delivery gaps.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
        {REPORTS.map((r) => (
          <div
            key={r.slug}
            className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${r.iconBg}`}>
                <r.icon className={`h-5 w-5 ${r.iconColor}`} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  #{r.num}
                </span>
                <h3 className="mt-0.5 text-sm font-semibold text-gray-900">{r.name}</h3>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500 leading-relaxed flex-1">{r.desc}</p>

            <div className="mt-3 flex flex-wrap gap-1">
              {r.feeds.map((f) => (
                <span key={f} className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">{r.chain}</p>

            <Link
              href={`/reports/mill-supply/${r.slug}`}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              View Report <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
