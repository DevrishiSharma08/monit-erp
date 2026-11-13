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

    public byte[] Generate(PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst)
    {
        return Document.Create(container =>
        {
            container.Page(page => RenderPoPage(page, po, companyName, companyAddress, companyGst));
        }).GeneratePdf();
    }

    // Same layout as Generate() above, rendered as a single stitched JPG
    // instead of a PDF — client-requested so a PO can be shared (e.g. on
    // WhatsApp) as an image that opens instantly, no PDF viewer needed.
    // Reuses RenderPoPage exactly, so image and PDF never drift apart.
    public byte[] GenerateImage(PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst)
    {
        var pages = Document.Create(container =>
        {
            container.Page(page => RenderPoPage(page, po, companyName, companyAddress, companyGst));
        }).GenerateImages();
        return Common.Helpers.ImageStitcher.StackVerticallyAsJpg(pages);
    }

    // Multi-PO PDF — used by the grid Export → PDF so the file matches the
    // single PDF layout (one PO per page) rather than a generic table.
    public byte[] GenerateBulk(IEnumerable<PurchaseOrderListDto> pos, string companyName, string companyAddress, string companyGst)
    {
        var list = pos as IList<PurchaseOrderListDto> ?? pos.ToList();
        return Document.Create(container =>
        {
            foreach (var po in list)
            {
                container.Page(page => RenderPoPage(page, po, companyName, companyAddress, companyGst));
            }
        }).GeneratePdf();
    }

    private static void RenderPoPage(QuestPDF.Fluent.PageDescriptor page, PurchaseOrderListDto po, string companyName, string companyAddress, string companyGst)
    {
        // A4 portrait per client UAT (was landscape) — fits the typical
        // PO printout / file scan flow without rotation. 9-col items
        // table is still readable thanks to RelativeColumn sizing.
        page.Size(PageSizes.A4);
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
                    col.Item().PaddingTop(3).AlignCenter().Text("PURCHASE ORDER")
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
                        t.Cell().Text($"Order No : {po.PONumber}").Bold().FontSize(9);
                        t.Cell().AlignRight().Text($"Purchase Order Date : {FormatDate(po.OrderDate)}").Bold().FontSize(9);
                    });

                    col.Item().PaddingVertical(5);

                    // Party table (Order To | Billed To | Shipped To)
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

                        Hdr("Order To"); Hdr("Billed To"); Hdr("Shipped To");

                        // Order To = Mill. Show the unit name + its address
                        // when one was picked, plus the unit / mill GST.
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(po.MillName).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(po.MillUnitName))
                                c.Item().Text(po.MillUnitName).FontSize(8).FontColor(Colors.Blue.Darken2);
                            if (!string.IsNullOrWhiteSpace(po.MillUnitAddress))
                                c.Item().Text(po.MillUnitAddress).FontSize(8);
                            c.Item().Text($"GST: {(string.IsNullOrWhiteSpace(po.MillGstNo) ? "—" : po.MillGstNo)}")
                                    .FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        // Billed To = ALWAYS Monit company
                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(companyName).SemiBold().FontSize(9);
                            if (!string.IsNullOrWhiteSpace(companyAddress))
                                c.Item().Text(companyAddress).FontSize(8);
                            c.Item().Text($"GST: {companyGst}").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        // Shipped To — must respect ShipmentMode so the mill never
                        // sees the real end-customer's name when the order is
                        // marked Blind or InvoiceOverride. Resolve once here and
                        // re-use for both the name and the address lines.
                        var shipmentMode = string.IsNullOrWhiteSpace(po.ShipmentMode)
                            ? (po.BlindShipment ? "Blind" : "Normal")
                            : po.ShipmentMode;
                        string  shippedToName;
                        string? shippedToAddress;
                        string? shippedToGst;
                        switch (shipmentMode)
                        {
                            case "Blind":
                                // Mill should believe goods are being shipped to the
                                // agency itself — no end-customer details leak.
                                shippedToName    = companyName;
                                shippedToAddress = string.IsNullOrWhiteSpace(companyAddress) ? null : companyAddress;
                                shippedToGst     = companyGst;
                                break;
                            case "InvoiceOverride":
                                // Mill bills/ships under the override entity. Its
                                // master data (address + GST) is pulled when the
                                // user picked an existing customer for the override;
                                // for free-text overrides (no InvoicePartyId) we
                                // fall back to the typed delivery address and a
                                // blank GST. Either way the override name is what
                                // the mill prints on its invoice.
                                shippedToName    = string.IsNullOrWhiteSpace(po.InvoiceParty) ? "—" : po.InvoiceParty;
                                shippedToAddress = !string.IsNullOrWhiteSpace(po.InvoicePartyAddress) ? po.InvoicePartyAddress
                                                 : !string.IsNullOrWhiteSpace(po.DirectDeliveryAddress) ? po.DirectDeliveryAddress
                                                 : null;
                                shippedToGst     = po.InvoicePartyGstNo;
                                break;
                            default: // Normal — end-customer name + GST +
                                     // billing address. Chain of fallbacks
                                     // because a PO raised Against SO often
                                     // didn't capture DirectCustomer fields
                                     // directly (the SO already had them).
                                     // Name : [if ShowDeliveryParty] linked SO's DELIVERY PARTY → DirectCustomer → linked SO's customer
                                     // Addr : delivery/direct-customer address → PO's typed delivery
                                     // GST  : delivery/direct-customer GST
                                     //
                                     // ShowDeliveryParty is a per-PO, user-controlled
                                     // toggle (default false — client-requested).
                                     // OFF (default): behaves exactly as before —
                                     // DirectCustomer → linked SO's customer → Monit.
                                     // Nothing about the SO's separate delivery party
                                     // (Customer A ordered, ships to Customer B) is
                                     // ever revealed unless the user explicitly opts
                                     // in per PO. ON: the delivery party jumps to the
                                     // TOP of the chain (above DirectCustomer, which
                                     // is usually just a copy of the SO's own customer
                                     // anyway). Customer A itself still prints
                                     // separately in the PO Details block below so the
                                     // mill can see whose order this is, regardless of
                                     // the toggle.
                                     // A "For Stock" PO has neither (no SO,
                                     // no customer) — those goods ship to
                                     // Monit's own godown, so fall back to
                                     // the agency's own details (same as
                                     // Blind) instead of a blank "—" row
                                     // with no address/GST (client-reported:
                                     // mill received a PDF with an empty
                                     // Shipped To section on a stock PO).
                                if (po.ShowDeliveryParty && !string.IsNullOrWhiteSpace(po.LinkedSODeliveryPartyName))
                                {
                                    shippedToName    = po.LinkedSODeliveryPartyName;
                                    shippedToAddress = !string.IsNullOrWhiteSpace(po.LinkedSODeliveryPartyAddress) ? po.LinkedSODeliveryPartyAddress
                                                     : !string.IsNullOrWhiteSpace(po.DirectDeliveryAddress) ? po.DirectDeliveryAddress
                                                     : null;
                                    shippedToGst     = po.LinkedSODeliveryPartyGstNo;
                                }
                                else if (!string.IsNullOrWhiteSpace(po.DirectCustomer))
                                {
                                    shippedToName    = po.DirectCustomer;
                                    shippedToAddress = !string.IsNullOrWhiteSpace(po.DirectCustomerAddress) ? po.DirectCustomerAddress
                                                     : !string.IsNullOrWhiteSpace(po.DirectDeliveryAddress) ? po.DirectDeliveryAddress
                                                     : null;
                                    shippedToGst     = po.DirectCustomerGstNo;
                                }
                                else if (!string.IsNullOrWhiteSpace(po.LinkedSOCustomerName))
                                {
                                    shippedToName    = po.LinkedSOCustomerName;
                                    shippedToAddress = !string.IsNullOrWhiteSpace(po.LinkedSOCustomerAddress) ? po.LinkedSOCustomerAddress
                                                     : !string.IsNullOrWhiteSpace(po.DirectDeliveryAddress) ? po.DirectDeliveryAddress
                                                     : null;
                                    shippedToGst     = po.LinkedSOCustomerGstNo;
                                }
                                else
                                {
                                    shippedToName    = companyName;
                                    shippedToAddress = string.IsNullOrWhiteSpace(companyAddress) ? null : companyAddress;
                                    shippedToGst     = companyGst;
                                }
                                break;
                        }

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(6).Column(c =>
                        {
                            c.Item().Text(shippedToName).SemiBold().FontSize(9);
                            if (shippedToAddress is not null)
                                c.Item().Text(shippedToAddress).FontSize(8);
                            c.Item().Text($"GST: {(string.IsNullOrWhiteSpace(shippedToGst) ? "—" : shippedToGst)}")
                                    .FontSize(8).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    col.Item().PaddingTop(5)
                       .Text("Note: Please deliver the following material subject to Terms, Condition & Instruction specified in the order.")
                       .FontSize(7.5f).Italic().FontColor(Colors.Grey.Darken2);

                    col.Item().PaddingVertical(4);

                    // Items table — per client UAT the Item Code (Particular)
                    // column is gone. Material identification is now broken
                    // out into Brand Name + GSM + Size + Quantity. Grain and
                    // Packing columns were also removed (covered by "show only
                    // these fields"). Financial columns kept.
                    // 9 columns: SR No | Brand | GSM | Size | Quantity |
                    //            Rate | Discount | Amount | Remarks
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(22);    // SR No
                            c.RelativeColumn(3.0f);  // Brand Name
                            c.RelativeColumn(1.2f);  // GSM
                            c.RelativeColumn(2.0f);  // Size
                            c.RelativeColumn(2.0f);  // Quantity
                            c.RelativeColumn(1.8f);  // Rate
                            c.RelativeColumn(1.6f);  // Discount
                            c.RelativeColumn(2.0f);  // Amount
                            c.RelativeColumn(2.4f);  // Remarks
                        });

                        void HdrCell(string text) =>
                            t.Cell().Background(Colors.Blue.Darken3)
                             .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                             .Padding(4).AlignCenter()
                             .Text(text).FontSize(7.5f).Bold().FontColor(Colors.White);

                        HdrCell("SR No"); HdrCell("Brand Name"); HdrCell("GSM");
                        HdrCell("Size"); HdrCell("Quantity"); HdrCell("Rate\n(Rs/KGS)");
                        HdrCell("Discount\n(₹/KG)"); HdrCell("Amount"); HdrCell("Remarks");

                        for (int i = 0; i < po.Items.Count; i++)
                        {
                            var item = po.Items[i];
                            var bg   = (i % 2 == 1) ? "#EEF4FF" : "#FFFFFF";

                            // PO stores `Rate` = post-discount finalPrice
                            // (what mill bills at) and `Discount` = flat
                            // ₹/KG knock-off. PDF "Rate" column shows the
                            // LIST/master rate (Rate Master value) — i.e.
                            // what the user typed when creating the PO,
                            // not what gets billed. Reconstruct as
                            // Rate + Discount. Amount on the row is
                            // qty × finalPrice (already baked-in on save),
                            // so the math still ties out.
                            var disc     = item.Discount ?? 0m;
                            var listRate = item.Rate + disc;
                            var qty = item.WeightKg is > 0
                                ? $"{item.WeightKg!.Value:N2} KG"
                                : $"{item.Quantity:N2} {item.Unit ?? ""}".Trim();

                            // Brand falls back to the parsed first-segment of
                            // the Item Code so older items without a master
                            // still show something readable.
                            var brand = !string.IsNullOrWhiteSpace(item.BrandName)
                                ? item.BrandName
                                : ParseMaterial(item.Description).particular;

                            // Every data cell is center-aligned per client
                            // UAT (matches the SO PDF treatment) — clean,
                            // uniform look regardless of column type.
                            void DC(string val)
                                => t.Cell()
                                    .Background(bg)
                                    .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                                    .Padding(3).AlignCenter()
                                    .Text(val).FontSize(7.5f);

                            DC((i + 1).ToString());
                            DC(brand);
                            DC(item.GSM?.ToString() ?? "—");
                            DC(string.IsNullOrWhiteSpace(item.Size) ? "—" : item.Size);
                            DC(qty);
                            DC(listRate.ToString("N2"));
                            DC(disc > 0 ? $"₹{disc:N2}" : "—");
                            DC($"₹{item.Amount:N2}");
                            DC(item.Remark ?? "");
                        }

                        // Total row — "Order Id" spans cols 1-4, "Total:" col 5, qty col 6, rest empty.
                        // Order Id only prints when the mill's own SO/order
                        // number was actually captured — an empty cell reads
                        // cleaner than "Order Id : —" on every single PO.
                        t.Cell().ColumnSpan(4)
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3)
                         .Column(cc =>
                         {
                             if (!string.IsNullOrWhiteSpace(po.MillSONumber))
                                 cc.Item().Text($"Order Id : {po.MillSONumber}").FontSize(8).Bold();
                             // Customer reference — a per-PO, user-controlled toggle
                             // (default off). Client-reported 2026-09-11: this line
                             // used to print unconditionally whenever the PO was
                             // linked to an SO, which leaked the real customer's
                             // identity on Blind-shipment POs — defeating the whole
                             // point of Blind. Now it only prints when the user
                             // explicitly opts in via ShowCustomerName, and that gate
                             // applies the same way regardless of ShipmentMode
                             // (Normal/Blind/InvoiceOverride) — Billed To/Shipped To
                             // above are completely unaffected by this toggle.
                             if (po.ShowCustomerName && !string.IsNullOrWhiteSpace(po.LinkedSOCustomerName))
                                 cc.Item().Text($"Customer : {po.LinkedSOCustomerName}").FontSize(8).Bold();
                         });
                        t.Cell()
                         .Background(Colors.Blue.Lighten4)
                         .Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(3).AlignCenter()
                         .Text($"{po.TotalQuantity:N2} KGS").FontSize(8).Bold();
                        // Remaining 4 columns (Rate / Discount / Amount / Remarks) blank.
                        for (var j = 0; j < 4; j++)
                            t.Cell().Background(Colors.Blue.Lighten4)
                             .Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(3).Text("");
                    });

                    col.Item().PaddingVertical(5);

                    // Terms top row — 4 short fields kept compact in a single
                    // row (the old layout had Instructions as the 5th column
                    // which made every other column grow tall whenever the
                    // instructions list was long; client UAT). Instruction
                    // moved to its own full-width row below where it can
                    // expand freely without affecting the 4 fields above.
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

                        THdr("Payment Terms"); THdr("Remarks");
                        THdr("Delivery Date"); THdr("Transit Insurance");

                        TVal(po.PaymentTerms);
                        TVal(po.Remarks);
                        TVal(FormatDate(po.ExpectedDeliveryDate));
                        TVal(po.InsurancePolicyNo);
                    });

                    // Instructions — separate full-width table. Header row
                    // matches the style of the row above; body is a
                    // numbered list (1, 2, 3 ...) split on newline or
                    // semicolon. Grows downward as instructions are added
                    // without stretching any sibling cell.
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c => c.RelativeColumn());

                        t.Cell().Background(Colors.Blue.Darken3)
                         .Border(0.5f).BorderColor(Colors.Blue.Darken3)
                         .Padding(4).AlignCenter()
                         .Text("Instruction").FontSize(8).Bold().FontColor(Colors.White);

                        t.Cell().Border(0.5f).BorderColor(Colors.Grey.Medium)
                         .Padding(5).Column(c =>
                        {
                            var raw = po.SpecialInstructions ?? "";
                            var lines = raw
                                .Split(new[] { '\n', ';' }, StringSplitOptions.RemoveEmptyEntries)
                                .Select(s => s.Trim())
                                .Where(s => s.Length > 0)
                                .ToList();
                            if (lines.Count == 0)
                                c.Item().AlignCenter().Text("—").FontSize(8);
                            else if (lines.Count == 1)
                                c.Item().AlignLeft().Text(lines[0]).FontSize(8);
                            else
                                for (var i = 0; i < lines.Count; i++)
                                    c.Item().AlignLeft().Text($"{i + 1}. {lines[i]}").FontSize(8);
                        });
                    });

                    col.Item().PaddingTop(14);

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

                    // NB footnote about Core ID / Reel OD removed per client UAT.
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

    // Dates come off the DB/DTO as ISO (yyyy-MM-dd) — the printed PO shows
    // dd/MM/yy per client UAT. Falls back to the raw string unchanged if it
    // doesn't parse (defensive — never hide a date the user typed).
    private static string? FormatDate(string? isoDate)
    {
        if (string.IsNullOrWhiteSpace(isoDate)) return isoDate;
        return DateTime.TryParse(isoDate, out var dt) ? dt.ToString("dd/MM/yy") : isoDate;
    }
}
