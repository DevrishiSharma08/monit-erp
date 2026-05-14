"use client";

import { useMemo } from "react";
import { mockInTransitTrackings } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { MapPinned, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface DelayRow {
  trackingNumber: string;
  origin: string;
  destination: string;
  driverName: string;
  truckNumber: string;
  dispatchedDate: string;
  expectedArrival: string;
  status: string;
  delayDays: number;
  deliveryMode: string;
}

export default function InTransitDelayReportPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const today = new Date();

    const rows: DelayRow[] = mockInTransitTrackings.map((t) => {
      const expected = new Date(t.expectedArrival);
      const isDelivered = t.status === "Delivered";
      const delayDays = isDelivered
        ? (t.deliveredDate ? Math.max(0, Math.ceil((new Date(t.deliveredDate).getTime() - expected.getTime()) / (1000 * 60 * 60 * 24))) : 0)
        : Math.max(0, Math.ceil((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        trackingNumber: t.trackingNumber,
        origin: t.origin,
        destination: t.destination,
        driverName: t.driverName,
        truckNumber: t.truckNumber,
        dispatchedDate: t.dispatchedDate,
        expectedArrival: t.expectedArrival,
        status: t.status,
        delayDays,
        deliveryMode: t.deliveryMode,
      };
    }).sort((a, b) => b.delayDays - a.delayDays);

    const delayed = rows.filter((r) => r.delayDays > 0).length;
    const onTime = rows.filter((r) => r.delayDays === 0).length;
    const inTransit = rows.filter((r) => r.status === "In Transit" || r.status === "Dispatched").length;
    const avgDelay = delayed > 0 ? Math.round(rows.filter((r) => r.delayDays > 0).reduce((s, r) => s + r.delayDays, 0) / delayed) : 0;

    const kpis = [
      { label: "Total Shipments", value: String(rows.length), icon: MapPinned, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "In Transit", value: String(inTransit), icon: Clock, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
      { label: "Delayed", value: String(delayed), sub: `Avg ${avgDelay} days late`, icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: delayed > 0 ? "text-red-600" : "text-gray-900" },
      { label: "On Time", value: String(onTime), icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
    ];

    const routeDelay: Record<string, number[]> = {};
    rows.forEach((r) => {
      const route = `${r.origin.split(" ")[0]} → ${r.destination.split(" ")[0]}`;
      (routeDelay[route] = routeDelay[route] ?? []).push(r.delayDays);
    });
    const chartData = Object.entries(routeDelay)
      .map(([label, delays]) => ({ label, value: Math.round(delays.reduce((s, d) => s + d, 0) / delays.length), color: "#f97316" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Logistics & Transport"
      categoryHref="/reports/logistics-transport"
      reportName="In-Transit Delay Report"
      reportDescription="Shipments delayed beyond ETA — segmented by mill, transporter, and route."
      kpis={kpis}
      chartTitle="Avg Delay by Route (days)"
      chartData={chartData}
      chartType="bar"
      chartColor="#f97316"
      chartFormatValue={(v) => `${v} day${v !== 1 ? "s" : ""}`}
      tableColumns={["Tracking #", "Route", "Truck / Driver", "Dispatched", "Expected Arrival", "Delay Days", "Status"]}
      exportFilename="in-transit-delay-report"
      exportData={[
        ["Tracking #", "Origin", "Destination", "Truck", "Driver", "Dispatched", "Expected Arrival", "Delay Days", "Status"],
        ...rows.map((r) => [r.trackingNumber, r.origin, r.destination, r.truckNumber, r.driverName, r.dispatchedDate, r.expectedArrival, r.delayDays, r.status]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Tracking #</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Route</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Truck / Driver</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Dispatched</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Expected Arrival</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Delay Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.trackingNumber} className={`hover:bg-gray-50 transition-colors ${r.delayDays > 0 ? "bg-red-50/10" : ""}`}>
                  <td className="px-4 py-3 font-medium text-blue-600">{r.trackingNumber}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{r.origin}</div>
                    <div className="text-xs text-gray-500">→ {r.destination}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-700">{r.truckNumber}</div>
                    <div className="text-xs text-gray-500">{r.driverName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.dispatchedDate}</td>
                  <td className="px-4 py-3 text-gray-600">{r.expectedArrival}</td>
                  <td className="px-4 py-3 text-right">
                    {r.delayDays > 0 ? (
                      <span className={`font-bold ${r.delayDays > 3 ? "text-red-600" : "text-orange-600"}`}>{r.delayDays}d</span>
                    ) : (
                      <span className="text-green-500 font-medium">On time</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.status === "Delivered" ? "bg-green-100 text-green-700" :
                      r.status === "In Transit" ? "bg-blue-100 text-blue-700" :
                      r.status === "Dispatched" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
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
