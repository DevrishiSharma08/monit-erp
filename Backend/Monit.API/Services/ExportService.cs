using ClosedXML.Excel;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Monit.API.Services.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using WpDoc = DocumentFormat.OpenXml.Wordprocessing.Document;

namespace Monit.API.Services;

/// <summary>
/// Generic export service. Converts any tabular data to Excel, PDF, or Word.
/// All masters and reports use this — add no export logic in individual services.
/// </summary>
public class ExportService : IExportService
{
    static ExportService()
    {
        // QuestPDF: community license for non-commercial / small-revenue use
        QuestPDF.Settings.License = LicenseType.Community;
    }

    // ─── Excel (ClosedXML) ────────────────────────────────────────────────────
    public byte[] ToExcel(string sheetName, List<string> headers, List<List<string>> rows,
                          string companyName, string companyAddress)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(sheetName);

        // Company header
        ws.Cell(1, 1).Value = companyName;
        ws.Cell(1, 1).Style.Font.Bold     = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Range(1, 1, 1, headers.Count).Merge();

        ws.Cell(2, 1).Value = companyAddress;
        ws.Cell(2, 1).Style.Font.FontColor = XLColor.Gray;
        ws.Range(2, 1, 2, headers.Count).Merge();

        ws.Cell(3, 1).Value = $"Report: {sheetName}   |   Generated: {DateTime.Now:dd-MM-yyyy HH:mm}";
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontColor = XLColor.Gray;
        ws.Range(3, 1, 3, headers.Count).Merge();

        // Header row
        int headerRow = 5;
        for (int c = 0; c < headers.Count; c++)
        {
            var cell = ws.Cell(headerRow, c + 1);
            cell.Value = headers[c];
            cell.Style.Font.Bold             = true;
            cell.Style.Fill.BackgroundColor  = XLColor.FromHtml("#1e3a5f");
            cell.Style.Font.FontColor        = XLColor.White;
            cell.Style.Alignment.Horizontal  = XLAlignmentHorizontalValues.Center;
            cell.Style.Border.OutsideBorder  = XLBorderStyleValues.Thin;
        }

        // Data rows
        for (int r = 0; r < rows.Count; r++)
        {
            var row = rows[r];
            for (int c = 0; c < row.Count; c++)
            {
                var cell = ws.Cell(headerRow + 1 + r, c + 1);
                cell.Value = row[c];
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Hair;
                if (r % 2 == 0)
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#f5f8ff");
            }
        }

        // Auto-fit columns
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─── PDF (QuestPDF) ───────────────────────────────────────────────────────
    public byte[] ToPdf(string title, List<string> headers, List<List<string>> rows,
                        string companyName, string companyAddress)
    {
        var doc = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(headers.Count > 8 ? PageSizes.A4.Landscape() : PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item().Text(companyName).FontSize(14).Bold().FontColor(Colors.Blue.Darken2);
                    col.Item().Text(companyAddress).FontSize(9).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(2).Text($"{title}   |   Generated: {DateTime.Now:dd-MM-yyyy HH:mm}")
                       .FontSize(8).Italic().FontColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Blue.Darken2);
                });

                page.Content().PaddingTop(8).Table(table =>
                {
                    var colCount = headers.Count;
                    table.ColumnsDefinition(c =>
                    {
                        for (int i = 0; i < colCount; i++)
                            c.RelativeColumn();
                    });

                    // Header cells
                    foreach (var h in headers)
                    {
                        table.Cell()
                             .Background(Colors.Blue.Darken2)
                             .Padding(4)
                             .DefaultTextStyle(t => t.FontColor(Colors.White).Bold().FontSize(8))
                             .Text(h);
                    }

                    // Data rows
                    bool alt = false;
                    foreach (var row in rows)
                    {
                        alt = !alt;
                        var bg = alt ? "#FFFFFF" : "#EEF2FF";
                        foreach (var cell in row)
                        {
                            table.Cell()
                                 .Background(bg)
                                 .BorderBottom(0.5f)
                                 .BorderColor(Colors.Grey.Lighten2)
                                 .Padding(3)
                                 .DefaultTextStyle(t => t.FontSize(8))
                                 .Text(cell);
                        }
                    }
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Page ").FontSize(8).FontColor(Colors.Grey.Medium);
                    t.CurrentPageNumber().FontSize(8);
                    t.Span(" of ").FontSize(8).FontColor(Colors.Grey.Medium);
                    t.TotalPages().FontSize(8);
                });
            });
        });

        return doc.GeneratePdf();
    }

    // ─── Word (DocumentFormat.OpenXml) ────────────────────────────────────────
    public byte[] ToWord(string title, List<string> headers, List<List<string>> rows,
                         string companyName, string companyAddress)
    {
        // A4 in twips (1 inch = 1440 twips): portrait 11906×16838, landscape 16838×11906
        bool landscape   = headers.Count > 8;
        uint pgWidth     = landscape ? 16838u : 11906u;
        uint pgHeight    = landscape ? 11906u : 16838u;
        // Body width = page width - left margin (851) - right margin (851)
        int  bodyWidthDxa = (int)pgWidth - 1702;

        using var ms = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new WpDoc();
            var body = mainPart.Document.AppendChild(new Body());

            // Company name
            body.AppendChild(MakeParagraph(companyName, "28", bold: true, color: "1E3A5F"));
            body.AppendChild(MakeParagraph(companyAddress, "18", color: "888888"));
            body.AppendChild(MakeParagraph(
                $"{title}   |   Generated: {DateTime.Now:dd-MM-yyyy HH:mm}", "16",
                italic: true, color: "999999"));
            body.AppendChild(new Paragraph());

            // Table — width = full body width
            var table = new Table();
            table.AppendChild(new TableProperties(
                new TableBorders(
                    new TopBorder    { Val = BorderValues.Single, Size = 4 },
                    new BottomBorder { Val = BorderValues.Single, Size = 4 },
                    new LeftBorder   { Val = BorderValues.Single, Size = 4 },
                    new RightBorder  { Val = BorderValues.Single, Size = 4 },
                    new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                    new InsideVerticalBorder   { Val = BorderValues.Single, Size = 4 }
                ),
                new TableWidth { Width = bodyWidthDxa.ToString(), Type = TableWidthUnitValues.Dxa }
            ));

            // Header row
            var headerRow = new TableRow();
            foreach (var h in headers)
                headerRow.AppendChild(MakeTableCell(h, bold: true, bgColor: "1E3A5F", fontColor: "FFFFFF"));
            table.AppendChild(headerRow);

            // Data rows
            bool alt = false;
            foreach (var row in rows)
            {
                alt = !alt;
                var tr = new TableRow();
                foreach (var cell in row)
                    tr.AppendChild(MakeTableCell(cell, bgColor: alt ? "FFFFFF" : "EEF2FF"));
                table.AppendChild(tr);
            }

            body.AppendChild(table);

            // A4 page size — must be the last child of body (Word section properties)
            var sectPr = new SectionProperties();
            var pgSz   = new DocumentFormat.OpenXml.Wordprocessing.PageSize { Width = pgWidth, Height = pgHeight };
            if (landscape) pgSz.Orient = PageOrientationValues.Landscape;
            sectPr.Append(pgSz);
            sectPr.Append(new PageMargin { Top = 851, Right = 851, Bottom = 1134, Left = 851 });
            body.AppendChild(sectPr);
        }

        return ms.ToArray();
    }

    // ─── Word helpers ─────────────────────────────────────────────────────────
    private static Paragraph MakeParagraph(string text, string fontSize = "20",
        bool bold = false, bool italic = false, string? color = null)
    {
        var run = new Run();
        var rp  = new RunProperties();
        if (bold)   rp.AppendChild(new Bold());
        if (italic) rp.AppendChild(new Italic());
        rp.AppendChild(new FontSize { Val = fontSize });
        if (color != null) rp.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Color { Val = color });
        run.AppendChild(rp);
        run.AppendChild(new Text(text));
        return new Paragraph(run);
    }

    private static TableCell MakeTableCell(string text, bool bold = false,
        string bgColor = "FFFFFF", string fontColor = "000000")
    {
        var run = new Run();
        var rp  = new RunProperties();
        if (bold) rp.AppendChild(new Bold());
        rp.AppendChild(new FontSize { Val = "16" });
        rp.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Color { Val = fontColor });
        run.AppendChild(rp);
        run.AppendChild(new Text(text));

        var para = new Paragraph(run);
        var cell = new TableCell(para);
        cell.AppendChild(new TableCellProperties(
            new Shading { Fill = bgColor, Val = ShadingPatternValues.Clear },
            new TableCellMargin(
                new TopMargin    { Width = "60",  Type = TableWidthUnitValues.Dxa },
                new BottomMargin { Width = "60",  Type = TableWidthUnitValues.Dxa },
                new LeftMargin   { Width = "100", Type = TableWidthUnitValues.Dxa },
                new RightMargin  { Width = "100", Type = TableWidthUnitValues.Dxa }
            )
        ));
        return cell;
    }
}
