"use client";

import { useMemo } from "react";
import { mockInquiries } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { MessageSquare, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function InquiryConversionFunnelPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const total = mockInquiries.length;
    const converted = mockInquiries.filter((i) => i.status === "Converted").length;
    const lost = mockInquiries.filter((i) => i.status === "Lost").length;
    const pending = mockInquiries.filter((i) => i.status !== "Converted" && i.status !== "Lost").length;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    const kpis = [
      { label: "Total Inquiries", value: String(total), icon: MessageSquare, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Converted", value: String(converted), sub: `${conversionRate}% conversion rate`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Lost", value: String(lost), sub: `${total > 0 ? Math.round((lost / total) * 100) : 0}% lost rate`, icon: XCircle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: "text-red-600" },
      { label: "Pending / Quoted", value: String(pending), icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    ];

    const statusCount: Record<string, number> = {};
    mockInquiries.forEach((i) => { statusCount[i.status] = (statusCount[i.status] ?? 0) + 1; });

    const statusColors: Record<string, string> = {
      "Draft": "#a4aab5",
      "Stock Checked": "#7eabf2",
      "Waiting Mill Confirmation": "#dcbd63",
      "Mill Confirmed": "#bf80fa",
      "Customer Confirmed": "#898be9",
      "Converted": "#7eefa7",
      "Lost": "#ff7373",
    };
    const chartData = Object.entries(statusCount).map(([label, value]) => ({ label, value, color: statusColors[label] ?? "#6b7280" }));

    const rows = [...mockInquiries].sort((a, b) => b.inquiryDate.localeCompare(a.inquiryDate));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Inquiry Conversion Funnel"
      reportDescription="Inquiry-to-order conversion rate, lost leads, and pending follow-ups."
      kpis={kpis}
      chartTitle="Inquiries by Status"
      chartData={chartData}
      chartType="bar"
      chartColor="#3b82f6"
      tableColumns={["Inquiry #", "Customer", "Salesman", "Date", "Priority", "Requirements", "Status", "Converted SO"]}
      exportFilename="inquiry-conversion-funnel"
      exportData={[
        ["Inquiry #", "Customer", "Salesman", "Date", "Priority", "Requirements", "Status", "Converted SO"],
        ...rows.map((inq) => [inq.inquiryNumber, inq.customer, inq.salesman, inq.inquiryDate, inq.priority, `${inq.requirements.length} items`, inq.status, inq.convertedToSO ?? ""]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Inquiry #</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Salesman</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Requirements</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Converted SO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((inq) => (
                <tr key={inq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-blue-600">{inq.inquiryNumber}</td>
                  <td className="px-4 py-3 text-gray-900">
                    <div>{inq.customer}</div>
                    <div className="text-xs text-gray-400">{inq.contactPerson}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inq.salesman}</td>
                  <td className="px-4 py-3 text-gray-600">{inq.inquiryDate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      inq.priority === "Urgent" ? "bg-red-100 text-red-700" :
                      inq.priority === "High" ? "bg-orange-100 text-orange-700" :
                      inq.priority === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                    }`}>{inq.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inq.requirements.length} item{inq.requirements.length !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      inq.status === "Converted" ? "bg-green-100 text-green-700" :
                      inq.status === "Lost" ? "bg-red-100 text-red-700" :
                      inq.status === "Waiting Mill Confirmation" ? "bg-yellow-100 text-yellow-700" :
                      inq.status === "Mill Confirmed" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>{inq.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {inq.convertedToSO ? (
                      <span className="font-medium text-green-600">{inq.convertedToSO}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
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
