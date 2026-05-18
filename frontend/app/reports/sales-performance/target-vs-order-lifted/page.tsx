"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";

// Mock monthly targets per salesman (₹)
const TARGETS: Record<string, number> = {
  "Rahul Sharma":  500000,
  "Priya Patel":   450000,
  "Amit Kumar":    400000,
  "Sunita Verma":  350000,
};
const DEFAULT_TARGET = 300000;

interface TargetRow {
  salesman: string;
  target: number;
  actual: number;
  variance: number;
  achievementPct: number;
}

export default function TargetVsOrderLiftedPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const actualMap: Record<string, number> = {};
    mockSalesOrders.forEach((so) => {
      actualMap[so.salesman] = (actualMap[so.salesman] ?? 0) + so.totalValue;
    });

    const allSalesmen = Array.from(new Set([...Object.keys(TARGETS), ...Object.keys(actualMap)]));

    const rows: TargetRow[] = allSalesmen.map((s) => {
      const target = TARGETS[s] ?? DEFAULT_TARGET;
      const actual = actualMap[s] ?? 0;
      return {
        salesman: s,
        target,
        actual,
        variance: actual - target,
        achievementPct: target > 0 ? Math.round((actual / target) * 100) : 0,
      };
    }).sort((a, b) => b.achievementPct - a.achievementPct);

    const onTarget = rows.filter((r) => r.achievementPct >= 100).length;
    const totalTarget = rows.reduce((s, r) => s + r.target, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    const kpis = [
      { label: "On/Above Target", value: `${onTarget} / ${rows.length}`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Below Target", value: String(rows.length - onTarget), icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500" },
      { label: "Overall Achievement", value: `${overallPct}%`, sub: `₹${(totalActual / 100000).toFixed(1)}L lifted`, icon: TrendingUp, iconBg: "bg-blue-50", iconColor: "text-blue-500", valueColor: overallPct >= 100 ? "text-green-600" : overallPct >= 80 ? "text-orange-600" : "text-red-600" },
      { label: "Total Target", value: `₹${(totalTarget / 100000).toFixed(1)}L`, icon: Target, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const chartData = rows.map((r) => ({
      label: r.salesman.length > 14 ? r.salesman.slice(0, 14) + "…" : r.salesman,
      value: r.achievementPct,
      color: r.achievementPct >= 100 ? "#22c55e" : r.achievementPct >= 80 ? "#eab308" : "#ef4444",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Target vs Order Lifted"
      reportDescription="Compare monthly sales targets against actual orders lifted per salesman."
      kpis={kpis}
      chartTitle="Achievement % by Salesman"
      chartData={chartData}
      chartType="bar"
      chartColor="#22c55e"
      chartFormatValue={(v) => `${v}%`}
      tableColumns={["Salesman", "Target", "Actual", "Variance", "Achievement"]}
      exportFilename="target-vs-order-lifted"
      exportData={[
        ["Salesman", "Target (₹)", "Actual (₹)", "Variance (₹)", "Achievement (%)"],
        ...rows.map((r) => [r.salesman, r.target, r.actual, r.variance, r.achievementPct]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Salesman</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Target</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Actual</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Variance</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.salesman} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.salesman}</td>
                  <td className="px-4 py-3 text-right text-gray-600">₹{r.target.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.actual.toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {r.variance >= 0 ? "+" : ""}₹{Math.abs(r.variance).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 rounded-full bg-gray-200 h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${r.achievementPct >= 100 ? "bg-green-500" : r.achievementPct >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, r.achievementPct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${r.achievementPct >= 100 ? "text-green-600" : r.achievementPct >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                        {r.achievementPct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
