using Monit.API.Common.Helpers;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Services.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Monit.API.Services.Inventory;

// Tally-style "Delivery Note" — client supplied an exact reference format
// (2026-09-30) that this replicates: Consignee/Buyer split, HSN-wise GST
// summary, amount-in-words, signatures. Unlike the SO/PO PDFs, several of
// these fields don't live on inventory.DeliveryChallans itself — GST number,
// billing address and payment terms are borrowed from the linked Sales
// Order / Customer master (joined server-side onto DeliveryChallanDto, see
// DeliveryChallanRepository). CGST/SGST vs IGST is a NEW computation not
// used anywhere else in this codebase (SO/PO PDFs never break out GST
// amounts) — it's derived from comparing the first two digits (state code)
// of the company's and customer's GSTIN, defaulting to intra-state
// (CGST+SGST) if either GST number is missing.
public class DeliveryChallanPdfService : IDeliveryChallanPdfService
{
    static DeliveryChallanPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] Generate(DeliveryChallanDto dc, string companyName, string companyAddress, string companyGst, string? companyPan)
    {
        return Document.Create(container =>
        {
            container.Page(page => RenderDcPage(page, dc, companyName, companyAddress, companyGst, companyPan));
        }).GeneratePdf();
    }

    public byte[] GenerateImage(DeliveryChallanDto dc, string companyName, string companyAddress, string companyGst, string? companyPan)
    {
        var pages = Document.Create(container =>
        {
            container.Page(page => RenderDcPage(page, dc, companyName, companyAddress, companyGst, companyPan));
        }).GenerateImages();
        return ImageStitcher.StackVerticallyAsJpg(pages);
    }

    // ── GST line-item math ───────────────────────────────────────────────────

    private record TaxLine(string Hsn, decimal TaxableValue, decimal GstPercent, decimal CgstAmt, decimal SgstAmt, decimal IgstAmt);

    private static bool IsIntraState(string? companyGst, string? customerGst)
    {
        if (string.IsNullOrWhiteSpace(companyGst) || string.IsNullOrWhiteSpace(customerGst)) return true;
        if (companyGst.Length < 2 || customerGst.Length < 2) return true;
        return string.Equals(companyGst[..2], customerGst[..2], StringComparison.OrdinalIgnoreCase);
    }

    private static void RenderDcPage(QuestPDF.Fluent.PageDescriptor page, DeliveryChallanDto dc, string companyName, string companyAddress, string companyGst, string? companyPan)
    {
        var intraState = IsIntraState(companyGst, dc.CustomerGstNo);

        // Per-item taxable value + tax split, grouped by HSN for the summary
        // table below the items grid.
        var lines = dc.Items.Select(i =>
        {
            var taxable = (i.Rate ?? 0) * i.QuantityKg;
            var gstPct  = i.GstPercent ?? 0;
            var cgst    = intraState ? taxable * (gstPct / 2) / 100 : 0;
            var sgst    = intraState ? taxable * (gstPct / 2) / 100 : 0;
            var igst    = intraState ? 0 : taxable * gstPct / 100;
            return new TaxLine(string.IsNullOrWhiteSpace(i.HsnCode) ? "—" : i.HsnCode!, taxable, gstPct, cgst, sgst, igst);
        }).ToList();

        var hsnSummary = lines
            .GroupBy(l => (l.Hsn, l.GstPercent))
            .Select(g => new TaxLine(g.Key.Hsn, g.Sum(x => x.TaxableValue), g.Key.GstPercent, g.Sum(x => x.CgstAmt), g.Sum(x => x.SgstAmt), g.Sum(x => x.IgstAmt)))
            .OrderBy(g => g.Hsn)
            .ToList();

        var itemsTotal   = lines.Sum(l => l.TaxableValue);
        var freight      = dc.FreightAmount ?? 0;
        var totalCgst    = lines.Sum(l => l.CgstAmt);
        var totalSgst    = lines.Sum(l => l.SgstAmt);
        var totalIgst    = lines.Sum(l => l.IgstAmt);
        var beforeRound  = itemsTotal + freight + totalCgst + totalSgst + totalIgst;
        var grandTotal   = Math.Round(beforeRound, 0, MidpointRounding.AwayFromZero);
        var roundOff     = grandTotal - beforeRound;
        var taxTotal     = totalCgst + totalSgst + totalIgst;

        // Consignee (ship to) uses this specific challan's delivery address;
        // Buyer (bill to) uses the customer's registered billing address.
        // Both show the same customer identity — DC has no separate
        // delivery-party concept the way SO does.
        var consigneeName    = dc.CustomerName ?? "—";
        var consigneeAddress = string.IsNullOrWhiteSpace(dc.DeliveryAddress) ? dc.CustomerAddress : dc.DeliveryAddress;
        var buyerAddress     = dc.CustomerAddress;

        page.Size(new PageSize(210, 297, Unit.Millimetre));
        page.Margin(15, Unit.Millimetre);
        page.DefaultTextStyle(t => t.FontSize(8).FontFamily("Arial"));

        // ── Header ───────────────────────────────────────────────────────────
        page.Header().Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem();
                row.ConstantItem(160).AlignRight().Text($"Printed on {DateTime.Now:dd-MMM-yy 'at' HH:mm}")
                   .FontSize(7).FontColor(Colors.Grey.Darken1);
            });
            col.Item().AlignCenter().Text("Delivery Note").FontSize(10).Italic().FontColor(Colors.Grey.Darken2);
            col.Item().AlignCenter().Text(companyName).FontSize(15).Bold().FontColor(Colors.Blue.Darken3);
            if (!string.IsNullOrWhiteSpace(companyAddress))
                col.Item().AlignCenter().Text(companyAddress).FontSize(8).FontColor(Colors.Grey.Darken1);
            if (!string.IsNullOrWhiteSpace(companyGst))
                col.Item().AlignCenter().Text($"GSTIN/UIN: {companyGst}").FontSize(8).FontColor(Colors.Grey.Darken1);
            col.Item().PaddingTop(3).AlignCenter().Text("DELIVERY CHALLAN")
               .FontSize(11).Bold().FontColor(Colors.Blue.Darken2);
            col.Item().PaddingTop(4).LineHorizontal(1.5f).LineColor(Colors.Blue.Darken3);
        });

        // ── Content ──────────────────────────────────────────────────────────
        page.Content().PaddingTop(8).Column(col =>
        {
            // Challan No / Date + reference info
            col.Item().Table(t =>
            {
                t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                t.Cell().Text($"Delivery Note No : {dc.ChallanNumber}").Bold().FontSize(9);
                t.Cell().AlignRight().Text($"Dated : {FormatDate(dc.ChallanDate)}").Bold().FontSize(9);

                if (!string.IsNullOrWhiteSpace(dc.SoNumber))
                {
                    t.Cell().Text($"Buyer's Order No : {dc.SoNumber}").FontSize(8);
                    t.Cell().AlignRight().Text($"Dated : {FormatDate(dc.SoOrderDate)}").FontSize(8);
                }
                if (!string.IsNullOrWhiteSpace(dc.PaymentTerms))
                {
                    t.Cell().ColumnSpan(2).Text($"Mode/Terms of Payment : {dc.PaymentTerms}").FontSize(8);
                }
                if (!string.IsNullOrWhiteSpace(dc.TransporterName) || !string.IsNullOrWhiteSpace(dc.VehicleNumber))
                {
                    t.Cell().Text($"Dispatched through : {(string.IsNullOrWhiteSpace(dc.TransporterName) ? "—" : dc.TransporterName)}").FontSize(8);
                    t.Cell().AlignRight().Text($"Vehicle No : {(string.IsNullOrWhiteSpace(dc.VehicleNumber) ? "—" : dc.VehicleNumber)}").FontSize(8);
                }
                if (!string.IsNullOrWhiteSpace(dc.LRNumber) || !string.IsNullOrWhiteSpace(dc.EWayBillNumber))
                {
                    t.Cell().Text($"LR No : {(string.IsNullOrWhiteSpace(dc.LRNumber) ? "—" : dc.LRNumber)}").FontSize(8);
                    t.Cell().AlignRight().Text($"E-Way Bill No : {(string.IsNullOrWhiteSpace(dc.EWayBillNumber) ? "—" : dc.EWayBillNumber)}").FontSize(8);
                }
            });

            col.Item().PaddingVertical(5);

            // Consignee (Ship To) / Buyer (Bill To)
            col.Item().Table(t =>
            {
                t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });

                void Hdr(string title) =>
                    t.Cell().Background(Colors.Blue.Darken3)
                     .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                     .Padding(5).AlignCenter()
                     .Text(title).FontSize(9).Bold().FontColor(Colors.White);

                Hdr("Consignee (Ship to)"); Hdr("Buyer (Bill to)");

                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                {
                    c.Item().Text(consigneeName).SemiBold().FontSize(9);
                    if (!string.IsNullOrWhiteSpace(consigneeAddress))
                        c.Item().Text(consigneeAddress).FontSize(8);
                    c.Item().Text($"GSTIN/UIN: {(string.IsNullOrWhiteSpace(dc.CustomerGstNo) ? "—" : dc.CustomerGstNo)}")
                            .FontSize(8).FontColor(Colors.Grey.Darken1);
                });
                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                {
                    c.Item().Text(consigneeName).SemiBold().FontSize(9);
                    if (!string.IsNullOrWhiteSpace(buyerAddress))
                        c.Item().Text(buyerAddress).FontSize(8);
                    c.Item().Text($"GSTIN/UIN: {(string.IsNullOrWhiteSpace(dc.CustomerGstNo) ? "—" : dc.CustomerGstNo)}")
                            .FontSize(8).FontColor(Colors.Grey.Darken1);
                });
            });

            col.Item().PaddingVertical(6);

            // Items table
            col.Item().Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.ConstantColumn(20);    // SR No
                    c.RelativeColumn(4.0f);  // Description of Goods
                    c.RelativeColumn(1.4f);  // HSN/SAC
                    c.RelativeColumn(1.8f);  // Quantity
                    c.RelativeColumn(1.5f);  // Rate
                    c.RelativeColumn(1.0f);  // per
                    c.RelativeColumn(1.8f);  // Amount
                });

                void HdrCell(string text) =>
                    t.Cell().Background(Colors.Blue.Darken3)
                     .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                     .Padding(4).AlignCenter()
                     .Text(text).FontSize(7.5f).Bold().FontColor(Colors.White);

                HdrCell("SR No"); HdrCell("Description of Goods"); HdrCell("HSN/SAC");
                HdrCell("Quantity"); HdrCell("Rate"); HdrCell("per"); HdrCell("Amount");

                for (int i = 0; i < dc.Items.Count; i++)
                {
                    var it = dc.Items[i];
                    var bg = (i % 2 == 1) ? "#EEF4FF" : "#FFFFFF";
                    var amount = (it.Rate ?? 0) * it.QuantityKg;

                    void DC(string val, bool bold = false)
                    {
                        var cell = t.Cell().Background(bg)
                            .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                            .Padding(3).AlignCenter();
                        if (bold) cell.Text(val).FontSize(7.5f).Bold();
                        else      cell.Text(val).FontSize(7.5f);
                    }

                    DC((i + 1).ToString());
                    DC(string.IsNullOrWhiteSpace(it.Paper) ? "—" : it.Paper!);
                    DC(string.IsNullOrWhiteSpace(it.HsnCode) ? "—" : it.HsnCode!);
                    DC($"{it.QuantityKg:N2} KG");
                    DC((it.Rate ?? 0).ToString("N2"));
                    DC("KGS");
                    DC($"{amount:N2}");
                }

                // Freight / GST / round-off lines, spanning the Description
                // column, mirroring the reference's stacked amount lines.
                t.Cell().ColumnSpan(6).Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(4).Column(c =>
                {
                    if (freight > 0) c.Item().AlignRight().Text("Local Cartage").FontSize(8);
                    if (intraState)
                    {
                        if (totalCgst > 0) c.Item().AlignRight().Text("Output CGST").FontSize(8);
                        if (totalSgst > 0) c.Item().AlignRight().Text("Output SGST").FontSize(8);
                    }
                    else if (totalIgst > 0)
                    {
                        c.Item().AlignRight().Text("Output IGST").FontSize(8);
                    }
                    if (roundOff != 0) c.Item().AlignRight().Text("Round Off").FontSize(8);
                    c.Item().AlignRight().Text("Total").FontSize(8).Bold();
                });
                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(4).Column(c =>
                {
                    if (freight > 0) c.Item().AlignRight().Text($"{freight:N2}").FontSize(8);
                    if (intraState)
                    {
                        if (totalCgst > 0) c.Item().AlignRight().Text($"{totalCgst:N2}").FontSize(8);
                        if (totalSgst > 0) c.Item().AlignRight().Text($"{totalSgst:N2}").FontSize(8);
                    }
                    else if (totalIgst > 0)
                    {
                        c.Item().AlignRight().Text($"{totalIgst:N2}").FontSize(8);
                    }
                    if (roundOff != 0) c.Item().AlignRight().Text($"{roundOff:N2}").FontSize(8);
                    c.Item().AlignRight().Text($"{grandTotal:N2}").FontSize(8).Bold();
                });
            });

            col.Item().PaddingVertical(4);
            col.Item().Text(t =>
            {
                t.Span("Amount Chargeable (in words): ").FontSize(8).SemiBold();
                t.Span($"INR {NumberToWordsHelper.ToRupeesInWords(grandTotal)}").FontSize(8).Italic();
            });

            col.Item().PaddingVertical(6);

            // HSN-wise GST summary table
            if (hsnSummary.Count > 0 && taxTotal > 0)
            {
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(1.5f);  // HSN/SAC
                        c.RelativeColumn(2.0f);  // Taxable Value
                        c.RelativeColumn(1.2f);  // Rate
                        c.RelativeColumn(1.8f);  // Amount (CGST or IGST)
                        c.RelativeColumn(1.2f);  // Rate
                        c.RelativeColumn(1.8f);  // Amount (SGST, blank if inter-state)
                        c.RelativeColumn(1.8f);  // Total Tax
                    });

                    void GHdr(string text) =>
                        t.Cell().Background(Colors.Blue.Darken3)
                         .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                         .Padding(3).AlignCenter().Text(text).FontSize(7).Bold().FontColor(Colors.White);

                    GHdr("HSN/SAC"); GHdr("Taxable Value");
                    GHdr(intraState ? "CGST Rate" : "IGST Rate"); GHdr(intraState ? "CGST Amt" : "IGST Amt");
                    GHdr(intraState ? "SGST Rate" : ""); GHdr(intraState ? "SGST Amt" : "");
                    GHdr("Total Tax Amount");

                    void GC(string val, bool bold = false)
                    {
                        var cell = t.Cell().Border(0.5f).BorderColor(Colors.Grey.Lighten1).Padding(3).AlignCenter();
                        if (bold) cell.Text(val).FontSize(7.5f).Bold(); else cell.Text(val).FontSize(7.5f);
                    }

                    foreach (var g in hsnSummary)
                    {
                        var halfRate = g.GstPercent / 2;
                        GC(g.Hsn);
                        GC(g.TaxableValue.ToString("N2"));
                        GC(intraState ? $"{halfRate:N1}%" : $"{g.GstPercent:N1}%");
                        GC(intraState ? g.CgstAmt.ToString("N2") : g.IgstAmt.ToString("N2"));
                        GC(intraState ? $"{halfRate:N1}%" : "");
                        GC(intraState ? g.SgstAmt.ToString("N2") : "");
                        GC((g.CgstAmt + g.SgstAmt + g.IgstAmt).ToString("N2"));
                    }

                    GC("Total", true); GC(hsnSummary.Sum(g => g.TaxableValue).ToString("N2"), true);
                    GC(""); GC(intraState ? totalCgst.ToString("N2") : totalIgst.ToString("N2"), true);
                    GC(""); GC(intraState ? totalSgst.ToString("N2") : "", true);
                    GC(taxTotal.ToString("N2"), true);
                });

                col.Item().PaddingVertical(4);
                col.Item().Text(t =>
                {
                    t.Span("Tax Amount (in words): ").FontSize(8).SemiBold();
                    t.Span($"INR {NumberToWordsHelper.ToRupeesInWords(taxTotal)}").FontSize(8).Italic();
                });
                col.Item().PaddingVertical(4);
            }

            if (!string.IsNullOrWhiteSpace(companyPan))
                col.Item().Text($"Company's PAN: {companyPan}").FontSize(8).SemiBold();

            col.Item().PaddingTop(4).Text("Received the above goods in good condition.").FontSize(8);

            col.Item().PaddingTop(14);

            // Signature row
            col.Item().Table(t =>
            {
                t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });

                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                {
                    c.Item().Height(28).Text("");
                    c.Item().AlignCenter().Text($"for {companyName}").FontSize(8).SemiBold();
                });
                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                {
                    c.Item().Height(28).Text("");
                    c.Item().AlignCenter().Text("Prepared by").FontSize(8).SemiBold();
                });
                t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                {
                    c.Item().Height(28).Text("");
                    c.Item().AlignCenter().Text("Verified by").FontSize(8).SemiBold();
                    c.Item().AlignCenter().Text("Authorised Signatory").FontSize(8).SemiBold();
                });
            });
        });

        // ── Footer ───────────────────────────────────────────────────────────
        page.Footer().AlignCenter().Text(t =>
        {
            t.Span("Page ").FontSize(7).FontColor(Colors.Grey.Medium);
            t.CurrentPageNumber().FontSize(7);
            t.Span(" of ").FontSize(7).FontColor(Colors.Grey.Medium);
            t.TotalPages().FontSize(7);
            t.Span($"   |   {companyName}   |   This is a Computer Generated Document")
             .FontSize(7).FontColor(Colors.Grey.Medium);
        });
    }

    // Dates come off the DB/DTO as ISO (yyyy-MM-dd) — printed as dd/MM/yy,
    // matching the SO/PO PDF convention.
    private static string? FormatDate(string? isoDate)
    {
        if (string.IsNullOrWhiteSpace(isoDate)) return isoDate;
        return DateTime.TryParse(isoDate, out var dt) ? dt.ToString("dd/MM/yy") : isoDate;
    }
}
