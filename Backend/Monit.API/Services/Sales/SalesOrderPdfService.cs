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

    public byte[] Generate(SalesOrderListDto so, string companyName, string companyAddress)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily("Arial"));

                // ── Header ────────────────────────────────────────────────────
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(companyName).FontSize(16).Bold().FontColor(Colors.Blue.Darken3);
                            c.Item().Text(companyAddress).FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                        row.ConstantItem(120).AlignRight().Column(c =>
                        {
                            c.Item().Text("SALES ORDER").FontSize(13).Bold().FontColor(Colors.Blue.Darken3);
                            c.Item().Text(so.SONumber).FontSize(11).Bold().FontColor(Colors.Blue.Darken1);
                        });
                    });
                    col.Item().PaddingTop(6).LineHorizontal(1.5f).LineColor(Colors.Blue.Darken3);
                });

                // ── Content ───────────────────────────────────────────────────
                page.Content().PaddingTop(8).Column(col =>
                {
                    // Info grid
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });
                        void InfoCell(string label, string? value)
                        {
                            t.Cell().Column(c =>
                            {
                                c.Item().Text(label).FontSize(7).FontColor(Colors.Grey.Darken1);
                                c.Item().Text(value ?? "—").FontSize(9).SemiBold();
                            });
                        }
                        InfoCell("Customer",      so.Customer);
                        InfoCell("Contact",       so.ContactPerson);
                        InfoCell("Date",          so.OrderDate);
                        InfoCell("Status",        "Confirmed");
                        InfoCell("Salesman",      so.Salesman);
                        InfoCell("Payment Terms", so.PaymentTerms);
                        InfoCell("Delivery Mode", so.DeliveryMode);
                        InfoCell("Delivery By",   so.RequiredDeliveryDate);
                    });

                    col.Item().PaddingVertical(8).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);

                    // Items heading
                    col.Item().PaddingBottom(4).Text("Items").FontSize(10).Bold().FontColor(Colors.Blue.Darken2);

                    // Items table
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(22);   // #
                            c.RelativeColumn(5);     // Material
                            c.RelativeColumn(2);     // GSM
                            c.RelativeColumn(2);     // Size
                            c.RelativeColumn(2);     // Qty
                            c.RelativeColumn(2);     // Unit
                            c.RelativeColumn(2.5f);  // Rate
                            c.RelativeColumn(3);     // Amount
                        });

                        void HeaderCell(string text) =>
                            t.Cell()
                             .Background(Colors.Blue.Darken3)
                             .Padding(5)
                             .Text(text).FontSize(8).Bold().FontColor(Colors.White);

                        HeaderCell("#");
                        HeaderCell("Material");
                        HeaderCell("GSM");
                        HeaderCell("Size");
                        HeaderCell("Qty");
                        HeaderCell("Unit");
                        HeaderCell("Rate (₹)");
                        HeaderCell("Amount (₹)");

                        bool alt = false;
                        for (int i = 0; i < so.Lines.Count; i++)
                        {
                            alt = !alt;
                            var bg = alt ? "#FFFFFF" : "#EEF2FF";
                            var l  = so.Lines[i];

                            void DataCell(string val, bool right = false)
                        {
                            var cell = t.Cell()
                                        .Background(bg)
                                        .BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                                        .Padding(4);
                            if (right) cell.AlignRight().Text(val).FontSize(8);
                            else       cell.Text(val).FontSize(8);
                        }

                            DataCell((i + 1).ToString());
                            DataCell(l.MaterialCode ?? "—");
                            DataCell(l.Gsm?.ToString() ?? "—");
                            DataCell(l.Size ?? "—");
                            DataCell(l.OrderedQty.ToString("N2"), right: true);
                            DataCell(l.Unit ?? "—");
                            DataCell(l.Rate.ToString("N2"), right: true);
                            DataCell(l.Amount.ToString("N2"), right: true);
                        }
                    });

                    // Totals row
                    col.Item().PaddingTop(4).AlignRight()
                       .Text($"Total Value: ₹ {so.TotalValue:N2}")
                       .FontSize(10).Bold().FontColor(Colors.Blue.Darken2);

                    // Remarks
                    if (!string.IsNullOrWhiteSpace(so.Remarks))
                    {
                        col.Item().PaddingTop(8).Column(c =>
                        {
                            c.Item().Text("Remarks").FontSize(8).SemiBold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text(so.Remarks).FontSize(8);
                        });
                    }

                    // Signature block
                    col.Item().PaddingTop(30).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                            c.Item().PaddingTop(2).Text("Customer Acknowledgement").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                        row.ConstantItem(20);
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                            c.Item().PaddingTop(2).Text($"For {companyName}").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });
                });

                // ── Footer ────────────────────────────────────────────────────
                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Page ").FontSize(8).FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontSize(8);
                    t.Span(" of ").FontSize(8).FontColor(Colors.Grey.Medium);
                    t.TotalPages().FontSize(8);
                    t.Span($"   |   {companyName}").FontSize(8).FontColor(Colors.Grey.Medium);
                });
            });
        }).GeneratePdf();
    }
}
