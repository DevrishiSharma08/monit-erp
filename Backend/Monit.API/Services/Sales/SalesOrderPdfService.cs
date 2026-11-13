using System.Globalization;
using Monit.API.Common.Helpers;
using Monit.API.Models.DTOs.Sales;
using Monit.API.Services.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Monit.API.Services.Sales;

public class SalesOrderPdfService : ISalesOrderPdfService
{
    static SalesOrderPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] Generate(SalesOrderListDto so, string companyName, string companyAddress, string companyGst)
    {
        return Document.Create(container =>
        {
            container.Page(page => RenderSoPage(page, so, companyName, companyAddress, companyGst));
        }).GeneratePdf();
    }

    // Same layout as Generate() above, rendered as a single stitched JPG
    // instead of a PDF — client-requested so an SO can be shared (e.g. on
    // WhatsApp) as an image that opens instantly, no PDF viewer needed.
    // Reuses RenderSoPage exactly, so image and PDF never drift apart.
    public byte[] GenerateImage(SalesOrderListDto so, string companyName, string companyAddress, string companyGst)
    {
        var pages = Document.Create(container =>
        {
            container.Page(page => RenderSoPage(page, so, companyName, companyAddress, companyGst));
        }).GenerateImages();
        return Common.Helpers.ImageStitcher.StackVerticallyAsJpg(pages);
    }

    // Multi-SO PDF — used by the grid's "Export → PDF" so the file the user
    // gets is the SAME proper document layout (one SO per page) as the single
    // download, NOT a generic table dump.
    public byte[] GenerateBulk(IEnumerable<SalesOrderListDto> sos, string companyName, string companyAddress, string companyGst)
    {
        var list = sos as IList<SalesOrderListDto> ?? sos.ToList();
        return Document.Create(container =>
        {
            foreach (var so in list)
            {
                container.Page(page => RenderSoPage(page, so, companyName, companyAddress, companyGst));
            }
        }).GeneratePdf();
    }

    private static void RenderSoPage(QuestPDF.Fluent.PageDescriptor page, SalesOrderListDto so, string companyName, string companyAddress, string companyGst)
    {
        var totalQty = so.Lines.Sum(LineWeightKg);
        // Layout below is verbatim from the previous inline implementation so
        // single + bulk PDFs are pixel-identical.
        page.Size(new PageSize(297, 210, Unit.Millimetre));
                page.Margin(15, Unit.Millimetre);
                page.DefaultTextStyle(t => t.FontSize(8).FontFamily("Arial"));

                // ── Header ─────────────────────────────────────────────────────
                page.Header().Column(col =>
                {
                    col.Item().AlignCenter().Text(companyName)
                       .FontSize(15).Bold().FontColor(Colors.Blue.Darken3);
                    if (!string.IsNullOrWhiteSpace(companyAddress))
                        col.Item().AlignCenter().Text(companyAddress)
                           .FontSize(8).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(3).AlignCenter().Text("SALES ORDER")
                       .FontSize(11).Bold().FontColor(Colors.Blue.Darken2);
                    col.Item().PaddingTop(4).LineHorizontal(1.5f).LineColor(Colors.Blue.Darken3);
                });

                // ── Content ────────────────────────────────────────────────────
                page.Content().PaddingTop(8).Column(col =>
                {
                    // Order No + Date row
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                        t.Cell().Text($"Sales Order No : {so.SONumber}").Bold().FontSize(9);
                        t.Cell().AlignRight().Text($"Sales Order Date : {FormatDate(so.OrderDate)}").Bold().FontSize(9);
                    });

                    col.Item().PaddingVertical(5);

                    // Party table (Supplier | Billed To | Shipped To)
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn();
                        });

                        void Hdr(string title) =>
                            t.Cell().Background(Colors.Blue.Darken3)
                             .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                             .Padding(5).AlignCenter()
                             .Text(title).FontSize(9).Bold().FontColor(Colors.White);

                        Hdr("Supplier Name"); Hdr("Billed To"); Hdr("Shipped To");

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(companyName).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(companyAddress))
                                c.Item().Text(companyAddress).FontSize(8);
                            c.Item().Text($"GST: {companyGst}").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        // Billed To — always the SO customer. Name + billing
                        // address + GST come from masters.Customers.
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(so.Customer).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(so.CustomerAddress))
                                c.Item().Text(so.CustomerAddress).FontSize(8);
                            c.Item().Text($"GST: {(string.IsNullOrWhiteSpace(so.CustomerGstNo) ? "—" : so.CustomerGstNo)}")
                                    .FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        // Shipped To — falls back to the SO customer when no
                        // separate delivery party is set. Address comes from
                        // the SO's typed DeliveryPartyAddress (which the form
                        // pre-fills from the master); GST flows from the
                        // delivery-party customer when present, else the SO
                        // customer's GST.
                        var shipName = string.IsNullOrWhiteSpace(so.DeliveryParty) ? so.Customer : so.DeliveryParty;
                        var shipAddr = string.IsNullOrWhiteSpace(so.DeliveryPartyAddress) ? so.CustomerAddress : so.DeliveryPartyAddress;
                        var shipGst  = !string.IsNullOrWhiteSpace(so.DeliveryPartyGstNo) ? so.DeliveryPartyGstNo
                                       : so.CustomerGstNo;
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(shipName).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(shipAddr))
                                c.Item().Text(shipAddr).FontSize(8);
                            c.Item().Text($"GST: {(string.IsNullOrWhiteSpace(shipGst) ? "—" : shipGst)}")
                                    .FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    col.Item().PaddingVertical(6);

                    // Items table — 11 columns. Per client UAT (18-Jun-2026):
                    //   • "Particular" replaced with "Brand" — customer wants
                    //     just the brand alias, not the quality+brand mash-up.
                    //   • Mill column moved BEFORE Brand (matches how the
                    //     client thinks about the order: mill first, brand
                    //     second).
                    //   • Every data cell is center-aligned for a clean,
                    //     uniform look in the printed/emailed PDF.
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(20);    // SR No
                            c.RelativeColumn(2.5f);  // Mill (moved before Brand)
                            c.RelativeColumn(2.5f);  // Brand
                            c.RelativeColumn(1.2f);  // GSM
                            c.RelativeColumn(2.0f);  // Size
                            c.RelativeColumn(1.8f);  // Quantity
                            c.RelativeColumn(1.5f);  // Grain
                            c.RelativeColumn(1.8f);  // Rate
                            c.RelativeColumn(1.2f);  // Dis
                            c.RelativeColumn(2.2f);  // Remarks
                        });

                        void HdrCell(string text) =>
                            t.Cell().Background(Colors.Blue.Darken3)
                             .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                             .Padding(4).AlignCenter()
                             .Text(text).FontSize(7.5f).Bold().FontColor(Colors.White);

                        HdrCell("SR No"); HdrCell("Mill"); HdrCell("Brand");
                        HdrCell("GSM"); HdrCell("Size");
                        HdrCell("Quantity"); HdrCell("Grain"); HdrCell("Rate\n(Rs/KGS)");
                        HdrCell("Dis"); HdrCell("Remarks");

                        for (int i = 0; i < so.Lines.Count; i++)
                        {
                            var l  = so.Lines[i];
                            var bg = (i % 2 == 1) ? "#EEF4FF" : "#FFFFFF";
                            // Mill comes from the 1st segment of the stored
                            // item code (auto-composer convention). Brand is
                            // the StockSubGroup alias on the line's quality —
                            // if missing (legacy line / free-text item), fall
                            // back to the 2nd segment so the cell isn't blank.
                            var (qualityFallback, mill) = ParseMaterial(l.MaterialCode);
                            var brand = !string.IsNullOrWhiteSpace(l.BrandName)
                                ? l.BrandName!.ToUpperInvariant()
                                : qualityFallback;
                            var (length, width)    = ParseSize(l.Size);
                            // Grain derived from size — same rule the material
                            // auto-provisioner applies when creating masters.
                            var grain = ComputeGrain(length, width);

                            // Single centered cell helper — replaces the old
                            // left / right alignment mix per client request.
                            void DC(string val, bool bold = false)
                            {
                                var cell = t.Cell()
                                            .Background(bg)
                                            .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                                            .Padding(3).AlignCenter();
                                if (bold) cell.Text(val).FontSize(7.5f).Bold();
                                else      cell.Text(val).FontSize(7.5f);
                            }

                            DC((i + 1).ToString());
                            DC(mill);
                            DC(brand);
                            DC(l.Gsm?.ToString() ?? "—");
                            DC(string.IsNullOrWhiteSpace(l.Size) ? "—" : l.Size);
                            DC(LineWeightKg(l).ToString("N2"));
                            DC(grain);
                            DC(l.Rate.ToString("N2"));
                            DC(l.Discount > 0 ? l.Discount.ToString("N2") : "—");
                            DC(string.IsNullOrWhiteSpace(l.Remarks) ? "" : l.Remarks);
                        }

                        // Total row — spans first 5 cols, qty in col 6, then 4 blanks.
                        t.Cell().ColumnSpan(5)
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3).AlignCenter()
                         .Text("Total").FontSize(8).Bold();
                        t.Cell()
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3).AlignCenter()
                         .Text($"{totalQty:N2} KGS").FontSize(8).Bold();
                        for (var j = 0; j < 4; j++)
                            t.Cell().Background(Colors.Blue.Lighten4)
                             .Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(3).Text("");
                    });

                    col.Item().PaddingVertical(6);

                    // Terms table — 4 columns. "Instruction" cell carries the
                    // SO-level Remarks (whatever the user typed on the SO
                    // header). Per-line remarks still flow through separately
                    // to the items table's Remarks column above; this one is
                    // for the order-wide instruction.
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(); c.RelativeColumn();
                            c.RelativeColumn(); c.RelativeColumn();
                        });

                        void THdr(string title) =>
                            t.Cell().Background(Colors.Blue.Darken3)
                             .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                             .Padding(4).AlignCenter()
                             .Text(title).FontSize(8).Bold().FontColor(Colors.White);

                        void TVal(string? val) =>
                            t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium)
                             .Padding(5).AlignCenter().Text(val ?? "—").FontSize(8);

                        THdr("Payment Terms"); THdr("Delivery Date");
                        THdr("Transit Insurance"); THdr("Instruction");

                        TVal(so.PaymentTerms); TVal(FormatDate(so.RequiredDeliveryDate));
                        TVal(so.InsurancePolicyNo); TVal(so.Remarks);
                    });

                    col.Item().PaddingTop(18);

                    // Signature row
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn();
                        });

                        // Signature row — center-aligned labels per client UAT
                        // so the bottom of the PDF stays visually consistent
                        // with the items table + terms table above.
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().AlignCenter().Text($"For, {companyName}").FontSize(8).SemiBold();
                        });
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().AlignCenter().Text("Prepared By").FontSize(8).SemiBold();
                        });
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().AlignCenter().Text("Verified Signatory").FontSize(8).SemiBold();
                            c.Item().AlignCenter().Text("Authorized Signatory").FontSize(8).SemiBold();
                        });
                    });
                });

                // ── Footer ─────────────────────────────────────────────────────
                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Page ").FontSize(7).FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontSize(7);
                    t.Span(" of ").FontSize(7).FontColor(Colors.Grey.Medium);
                    t.TotalPages().FontSize(7);
                    t.Span($"   |   {companyName}   |   GST: {companyGst}")
                     .FontSize(7).FontColor(Colors.Grey.Medium);
                });
    }

    // OrderedQty is sometimes stored as raw SHEET COUNT (not kg) — see
    // WeightCalculator.LineWeightKg for why. The on-screen grid/preview never
    // shows that bad value because it recomputes independently, so the PDF
    // must do the same instead of trusting OrderedQty at face value.
    private static decimal LineWeightKg(SalesOrderLineDto l)
        => WeightCalculator.LineWeightKg(l.OrderedQty, l.Qty, l.Gsm, l.Size);

    private static (string particular, string mill) ParseMaterial(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return ("—", "—");
        var parts = code.Split('/');
        return (
            parts.Length > 1 ? parts[1].Trim() : parts[0].Trim(),
            parts.Length > 0 ? parts[0].Trim() : "—"
        );
    }

    private static (string length, string width) ParseSize(string? size)
    {
        if (string.IsNullOrWhiteSpace(size)) return ("—", "—");
        var sep = size.IndexOfAny(['x', 'X', '×']);
        if (sep < 0) return (size.Trim(), "—");
        return (size[..sep].Trim(), size[(sep + 1)..].Trim());
    }

    // Same grain rule the material auto-provisioner uses when seeding masters:
    //   width > length ⇒ Long Grain
    //   width < length ⇒ Short Grain
    //   equal / reel (single dim) ⇒ "—"
    // Lets the SO PDF show Grain without needing a JOIN to masters.Materials.
    private static string ComputeGrain(string lengthStr, string widthStr)
    {
        if (lengthStr == "—" || widthStr == "—") return "—";
        if (!decimal.TryParse(lengthStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var l)) return "—";
        if (!decimal.TryParse(widthStr,  NumberStyles.Number, CultureInfo.InvariantCulture, out var w)) return "—";
        if (w > l) return "Long Grain";
        if (w < l) return "Short Grain";
        return "—";
    }

    // Dates come off the DB/DTO as ISO (yyyy-MM-dd) — the printed SO shows
    // dd/MM/yy per client UAT (matches the PO PDF). Falls back to the raw
    // string unchanged if it doesn't parse.
    private static string? FormatDate(string? isoDate)
    {
        if (string.IsNullOrWhiteSpace(isoDate)) return isoDate;
        return DateTime.TryParse(isoDate, out var dt) ? dt.ToString("dd/MM/yy") : isoDate;
    }
}
