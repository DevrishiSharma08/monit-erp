using Monit.API.Models.DTOs.Procurement;
using Monit.API.Services.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Monit.API.Services.Procurement;

public class PurchaseOrderPdfService : IPurchaseOrderPdfService
{
    static PurchaseOrderPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] Generate(PurchaseOrderListDto po, string companyName, string companyAddress)
    {
        var shipMode = po.ShipmentMode ?? (po.BlindShipment ? "Blind" : "Normal");
        var billTo   = shipMode == "Blind"           ? companyName :
                       shipMode == "InvoiceOverride" ? (po.InvoiceParty ?? "—") :
                       po.DirectCustomer ?? "—";

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
                        row.ConstantItem(130).AlignRight().Column(c =>
                        {
                            c.Item().Text("PURCHASE ORDER").FontSize(13).Bold().FontColor(Colors.Blue.Darken3);
                            c.Item().Text(po.PONumber).FontSize(11).Bold().FontColor(Colors.Blue.Darken1);
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

                        InfoCell("Mill",             po.MillName);
                        InfoCell("PO Type",          po.POType);
                        InfoCell("Date",             po.OrderDate);
                        InfoCell("Status",           "Confirmed");
                        InfoCell("Payment Terms",    po.PaymentTerms);
                        InfoCell("Expected Delivery",po.ExpectedDeliveryDate);
                        InfoCell("Bill To",          billTo);
                        InfoCell("Ship To",          po.DirectDeliveryAddress);
                        if (!string.IsNullOrWhiteSpace(po.LinkedSONumber))
                            InfoCell("SO Reference", po.LinkedSONumber);
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
                            c.RelativeColumn(5);     // Description
                            c.RelativeColumn(2);     // GSM
                            c.RelativeColumn(2);     // Size
                            c.RelativeColumn(2.5f);  // Qty
                            c.RelativeColumn(1.5f);  // Unit
                            c.RelativeColumn(2.5f);  // Rate
                            c.RelativeColumn(3);     // Amount
                        });

                        void HeaderCell(string text) =>
                            t.Cell()
                             .Background(Colors.Blue.Darken3)
                             .Padding(5)
                             .Text(text).FontSize(8).Bold().FontColor(Colors.White);

                        HeaderCell("#");
                        HeaderCell("Description");
                        HeaderCell("GSM");
                        HeaderCell("Size");
                        HeaderCell("Qty");
                        HeaderCell("Unit");
                        HeaderCell("Rate (₹)");
                        HeaderCell("Amount (₹)");

                        bool alt = false;
                        for (int i = 0; i < po.Items.Count; i++)
                        {
                            alt = !alt;
                            var bg   = alt ? "#FFFFFF" : "#EEF2FF";
                            var item = po.Items[i];

                            void DataCell(string val, bool right = false)
                        {
                            var cell = t.Cell()
                                        .Background(bg)
                                        .BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                                        .Padding(4);
                            if (right) cell.AlignRight().Text(val).FontSize(8);
                            else       cell.Text(val).FontSize(8);
                        }

                            var baseRate = (item.Discount ?? 0) > 0
                                ? item.Rate / (1 - (item.Discount ?? 0) / 100)
                                : item.Rate;

                            DataCell((i + 1).ToString());
                            DataCell(item.Description ?? "—");
                            DataCell(item.GSM?.ToString() ?? "—");
                            DataCell(item.Size ?? "—");
                            if (item.WeightKg is > 0)
                            {
                                DataCell(item.WeightKg!.Value.ToString("N2"), right: true);
                                DataCell("KG");
                            }
                            else
                            {
                                DataCell(item.Quantity.ToString("N2"), right: true);
                                DataCell(item.Unit ?? "—");
                            }
                            DataCell(baseRate.ToString("N2"), right: true);
                            DataCell(item.Amount.ToString("N2"), right: true);
                        }
                    });

                    // Totals row
                    col.Item().PaddingTop(4).AlignRight()
                       .Text($"Total Value: ₹ {po.TotalValue:N2}")
                       .FontSize(10).Bold().FontColor(Colors.Blue.Darken2);

                    // Special instructions
                    if (!string.IsNullOrWhiteSpace(po.SpecialInstructions))
                    {
                        col.Item().PaddingTop(8).Column(c =>
                        {
                            c.Item().Text("Special Instructions").FontSize(8).SemiBold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text(po.SpecialInstructions).FontSize(8);
                        });
                    }

                    if (!string.IsNullOrWhiteSpace(po.Remarks))
                    {
                        col.Item().PaddingTop(6).Column(c =>
                        {
                            c.Item().Text("Remarks").FontSize(8).SemiBold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text(po.Remarks).FontSize(8);
                        });
                    }

                    // Signature block
                    col.Item().PaddingTop(30).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                            c.Item().PaddingTop(2).Text("Mill Acknowledgement").FontSize(8).FontColor(Colors.Grey.Darken1);
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
