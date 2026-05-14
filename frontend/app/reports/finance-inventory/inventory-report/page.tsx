"use client";

import { useMemo } from "react";
import { mockStockLots } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Package, Layers, CheckCircle2, AlertTriangle } from "lucide-react";

interface StockRow {
  paper: string;
  gsm: number;
  size: string;
  mill: string;
  warehouse: string;
  lots: number;
  totalQty: number;
  availableQty: number;
  allocatedQty: number;
  status: string;
}

export default function InventoryReportPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, StockRow> = {};
    mockStockLots.forEach((lot) => {
      const key = `${lot.paper}|${lot.gsm}|${lot.size}|${lot.warehouse}`;
      if (!map[key]) {
        map[key] = {
          paper: lot.paper,
          gsm: lot.gsm,
          size: lot.size,
          mill: lot.mill,
          warehouse: lot.warehouse,
          lots: 0,
          totalQty: 0,
          availableQty: 0,
          allocatedQty: 0,
          status: "Available",
        };
      }
      map[key].lots += 1;
      map[key].totalQty += lot.currentQty;
      map[key].availableQty += lot.availableQty;
      map[key].allocatedQty += lot.allocatedQty;
    });

    const rows = Object.values(map)
      .map((r) => ({
        ...r,
        status: r.availableQty === 0 ? "Out of Stock" : r.availableQty < r.totalQty * 0.2 ? "Low Stock" : "Available",
      }))
      .sort((a, b) => b.availableQty - a.availableQty);

    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    const totalAvailable = rows.reduce((s, r) => s + r.availableQty, 0);
    const totalAllocated = rows.reduce((s, r) => s + r.allocatedQty, 0);
    const lowStock = rows.filter((r) => r.status === "Low Stock" || r.status === "Out of Stock").length;

    const kpis = [
      { label: "Total SKUs", value: String(rows.length), icon: Layers, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Total Stock", value: `${(totalQty / 1000).toFixed(0)}K sht`, icon: Package, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
      { label: "Available", value: `${(totalAvailable / 1000).toFixed(0)}K sht`, sub: `${totalQty > 0 ? Math.round((totalAvailable / totalQty) * 100) : 0}% free`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Low / Out of Stock", value: String(lowStock), sub: "SKUs needing reorder", icon: AlertTriangle, iconBg: "bg-orange-50", iconColor: "text-orange-500", valueColor: lowStock > 0 ? "text-orange-600" : "text-gray-900" },
    ];

    const paperTotals: Record<string, number> = {};
    rows.forEach((r) => { paperTotals[r.paper] = (paperTotals[r.paper] ?? 0) + r.availableQty; });
    const chartData = Object.entries(paperTotals).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label,
      value,
      color: "#22c55e",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Finance & Inventory"
      categoryHref="/reports/finance-inventory"
      reportName="Inventory Report"
      reportDescription="Current stock position by paper, GSM, size, and warehouse with lot-level details."
      kpis={kpis}
      chartTitle="Available Stock by Paper Type"
      chartData={chartData}
      chartType="bar"
      chartColor="#22c55e"
      chartFormatValue={(v) => `${v.toLocaleString("en-IN")} sht`}
      tableColumns={["Paper", "GSM", "Size", "Mill", "Warehouse", "Lots", "Total Qty", "Available", "Allocated", "Status"]}
      exportFilename="inventory-report"
      exportData={[
        ["Paper", "GSM", "Size", "Mill", "Warehouse", "Lots", "Total Qty", "Available", "Allocated", "Status"],
        ...rows.map((r) => [r.paper, r.gsm, r.size, r.mill, r.warehouse, r.lots, r.totalQty, r.availableQty, r.allocatedQty, r.status]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Paper</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">GSM</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Size</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Mill</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Warehouse</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Lots</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Available</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Allocated</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.paper}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.gsm}</td>
                  <td className="px-4 py-3 text-gray-600">{r.size}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.mill}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.warehouse}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.lots}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{r.availableQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{r.allocatedQty > 0 ? r.allocatedQty.toLocaleString("en-IN") : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.status === "Available" ? "bg-green-100 text-green-700" :
                      r.status === "Low Stock" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                    }`}>{r.status}</span>
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
