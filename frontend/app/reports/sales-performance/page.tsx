"use client";

import Link from "next/link";
import { TrendingUp, Users, Package, BarChart3, UserCheck, Target, MessageSquare, ArrowRight } from "lucide-react";

const REPORTS = [
  {
    num: 1,
    name: "Sales Summary",
    slug: "sales-summary",
    desc: "Complete sales order summary with value, volume, and status breakdown by date range.",
    icon: TrendingUp,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    feeds: ["Sales Orders"],
    chain: "SO → Invoice",
  },
  {
    num: 2,
    name: "Customer Wise Volume",
    slug: "customer-wise-volume",
    desc: "Total quantity and value ordered per customer with trend analysis.",
    icon: Users,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    feeds: ["Sales Orders", "Customers"],
    chain: "SO → Customer mapping",
  },
  {
    num: 3,
    name: "Product Wise Sales",
    slug: "product-wise-sales",
    desc: "Quantity and revenue broken down by paper type, GSM, and size.",
    icon: Package,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    feeds: ["Sales Orders"],
    chain: "SO lines → Product grouping",
  },
  {
    num: 4,
    name: "Quality Wise Sales Trend",
    slug: "quality-wise-sales-trend",
    desc: "Sales trend segmented by paper quality grade and GSM over time.",
    icon: BarChart3,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
    feeds: ["Sales Orders"],
    chain: "SO lines → GSM/Grade grouping",
  },
  {
    num: 5,
    name: "Salesman Performance",
    slug: "salesman-performance",
    desc: "Orders, revenue, and customer count per salesman with ranking.",
    icon: UserCheck,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    feeds: ["Sales Orders", "Salesmen"],
    chain: "SO → Salesman mapping",
  },
  {
    num: 6,
    name: "Target vs Order Lifted",
    slug: "target-vs-order-lifted",
    desc: "Compare monthly sales targets against actual orders lifted per salesman.",
    icon: Target,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    feeds: ["Sales Orders"],
    chain: "Target → SO actual",
  },
  {
    num: 7,
    name: "Inquiry Conversion Funnel",
    slug: "inquiry-conversion-funnel",
    desc: "Inquiry-to-order conversion rate, lost leads, and pending follow-ups.",
    icon: MessageSquare,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-500",
    feeds: ["Inquiries", "Sales Orders"],
    chain: "Inquiry → SO conversion",
  },
];

export default function SalesPerformancePage() {
  return (
    <div className="space-y-6 pb-24">
      <p className="text-sm text-gray-500">
        Analyse order volumes, customer activity, product mix, and salesman productivity.
      </p>

      {/* Report Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <div
            key={r.slug}
            className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Card header */}
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${r.iconBg}`}>
                <r.icon className={`h-5 w-5 ${r.iconColor}`} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    #{r.num}
                  </span>
                </div>
                <h3 className="mt-0.5 text-sm font-semibold text-gray-900">{r.name}</h3>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500 leading-relaxed flex-1">{r.desc}</p>

            {/* Data from tags */}
            <div className="mt-3 flex flex-wrap gap-1">
              {r.feeds.map((f) => (
                <span key={f} className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">
                  {f}
                </span>
              ))}
            </div>

            <p className="mt-1.5 text-[10px] text-gray-400">{r.chain}</p>

            {/* View button */}
            <Link
              href={`/reports/sales-performance/${r.slug}`}
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
