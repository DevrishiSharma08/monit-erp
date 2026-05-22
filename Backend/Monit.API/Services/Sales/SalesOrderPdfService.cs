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
        var totalQty = so.Lines.Sum(l => l.OrderedQty);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
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
                        t.Cell().AlignRight().Text($"Sales Order Date : {so.OrderDate}").Bold().FontSize(9);
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

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(so.Customer).SemiBold().FontSize(9);
                            c.Item().Text("GST: —").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(so.DeliveryParty ?? so.Customer).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(so.DeliveryPartyAddress))
                                c.Item().Text(so.DeliveryPartyAddress).FontSize(8);
                            c.Item().Text("GST: —").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    col.Item().PaddingVertical(6);

                    // Items table (12 columns)
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(20);    // SR No
                            c.RelativeColumn(3.5f);  // Particular
                            c.RelativeColumn(2.5f);  // Mill
                            c.RelativeColumn(1.2f);  // GSM
                            c.RelativeColumn(1.5f);  // Length
                            c.RelativeColumn(1.5f);  // Width
                            c.RelativeColumn(1.8f);  // Quantity
                            c.RelativeColumn(1.2f);  // Grain
                            c.RelativeColumn(1.8f);  // Rate
                            c.RelativeColumn(1.2f);  // Dis
                            c.RelativeColumn(1.8f);  // Packing
                            c.RelativeColumn(2f);    // Remarks
                        });

                        void HdrCell(string text) =>
                            t.Cell().Background(Colors.Blue.Darken3)
                             .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                             .Padding(4).AlignCenter()
                             .Text(text).FontSize(7.5f).Bold().FontColor(Colors.White);

                        HdrCell("SR No"); HdrCell("Particular"); HdrCell("Mill");
                        HdrCell("GSM"); HdrCell("Length"); HdrCell("Width");
                        HdrCell("Quantity"); HdrCell("Grain"); HdrCell("Rate\n(Rs/KGS)");
                        HdrCell("Dis"); HdrCell("Packing\nType"); HdrCell("Remarks");

                        for (int i = 0; i < so.Lines.Count; i++)
                        {
                            var l  = so.Lines[i];
                            var bg = (i % 2 == 1) ? "#EEF4FF" : "#FFFFFF";
                            var (particular, mill) = ParseMaterial(l.MaterialCode);
                            var (length, width)    = ParseSize(l.Size);

                            void DC(string val, bool right = false, bool bold = false)
                            {
                                var cell = t.Cell()
                                            .Background(bg)
                                            .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                                            .Padding(3);
                                if (bold && right) cell.AlignRight().Text(val).FontSize(7.5f).Bold();
                                else if (bold)     cell.Text(val).FontSize(7.5f).Bold();
                                else if (right)    cell.AlignRight().Text(val).FontSize(7.5f);
                                else               cell.Text(val).FontSize(7.5f);
                            }

                            DC((i + 1).ToString(), right: true);
                            DC(particular);
                            DC(mill);
                            DC(l.Gsm?.ToString() ?? "—");
                            DC(length);
                            DC(width);
                            DC(l.OrderedQty.ToString("N2"), right: true);
                            DC("—");  // Grain (not in DTO)
                            DC(l.Rate.ToString("N2"), right: true);
                            DC(l.Discount > 0 ? l.Discount.ToString("N2") : "—", right: true);
                            DC("—");  // Packing Type (not in DTO)
                            DC("");   // Remarks (empty per line)
                        }

                        // Total row — spans first 6 cols, qty in col 7, rest empty
                        t.Cell().ColumnSpan(6)
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3).AlignRight()
                         .Text("Total").FontSize(8).Bold();
                        t.Cell()
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3).AlignRight()
                         .Text($"{totalQty:N2} KGS").FontSize(8).Bold();
                        for (var j = 0; j < 5; j++)
                            t.Cell().Background(Colors.Blue.Lighten4)
                             .Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(3).Text("");
                    });

                    col.Item().PaddingVertical(6);

                    // Terms table
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
                             .Padding(5).Text(val ?? "—").FontSize(8);

                        THdr("Payment Terms"); THdr("Delivery Date");
                        THdr("Transit Insurance"); THdr("Instruction");

                        TVal(so.PaymentTerms); TVal(so.RequiredDeliveryDate);
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

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().Text($"For, {companyName}").FontSize(8).SemiBold();
                        });
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().Text("Prepared By").FontSize(8).SemiBold();
                        });
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Height(28).Text("");
                            c.Item().Text("Verified Signatory").FontSize(8).SemiBold();
                            c.Item().Text("Authorized Signatory").FontSize(8).SemiBold();
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
            });
        }).GeneratePdf();
    }

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
}
