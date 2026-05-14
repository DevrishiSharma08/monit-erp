"use client";

import Link from "next/link";
import { Truck, MapPinned, ArrowRight } from "lucide-react";

const REPORTS = [
  {
    num: 12,
    name: "Transporter Performance",
    slug: "transporter-performance",
    desc: "On-time delivery %, delays, cost efficiency, and service rating per transporter and area.",
    icon: Truck,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    feeds: ["Truck Load Plan", "In-Transit", "Transporter Master"],
    chain: "TLP → In-Transit → Delivery",
  },
  {
    num: 13,
    name: "In-Transit Delay Report",
    slug: "in-transit-delay-report",
    desc: "Shipments delayed beyond ETA — segmented by mill, transporter, and route.",
    icon: MapPinned,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    feeds: ["In-Transit Tracking", "Truck Load Plan"],
    chain: "Dispatch → Expected arrival → Actual",
  },
];

export default function LogisticsTransportPage() {
  return (
    <div className="space-y-6 pb-24">
      <p className="text-sm text-gray-500">
        Measure delivery performance, transit delays, and transporter reliability.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
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
              href={`/reports/logistics-transport/${r.slug}`}
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
