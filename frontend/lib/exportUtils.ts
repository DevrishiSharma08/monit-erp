import * as XLSX from "xlsx";

export interface ExportData {
  headers: string[];
  rows:    string[][];
  title?:  string;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCsv({ headers, rows, title = "export" }: ExportData, filename: string): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function exportExcel({ headers, rows, title = "Sheet1" }: ExportData, filename: string): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Bold header row styling
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: "1E3A5F" } } };
  }

  // Auto column widths
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => (r[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── DOCX (HTML-as-Word) ───────────────────────────────────────────────────────

export function exportDocx({ headers, rows, title = "" }: ExportData, filename: string): void {
  const th = headers
    .map((h) => `<th style="background:#1e3a5f;color:#fff;padding:6px 10px;font-size:11px;border:1px solid #ccc;">${h}</th>`)
    .join("");

  const trs = rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#eef4ff"};">${row
          .map((c) => `<td style="padding:5px 10px;font-size:10px;border:1px solid #ddd;">${c}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8">
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  </head>
  <body style="font-family:Arial,sans-serif;">
    ${title ? `<h2 style="font-size:14px;margin-bottom:10px;">${title}</h2>` : ""}
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead><tr>${th}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/msword" });
  triggerDownload(blob, `${filename}.doc`);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function exportPdf({ headers, rows, title = "" }: ExportData, filename: string): Promise<void> {
  // Dynamic import keeps jspdf out of the initial bundle
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: rows[0]?.length > 8 ? "landscape" : "portrait" });

  if (title) {
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(title, 14, 16);
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 22 : 14,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [238, 244, 255] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

// ── Helper ────────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
