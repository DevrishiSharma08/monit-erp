using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Procurement;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Procurement;

[ApiController]
[Route("api/v1/mill-tracker")]
[Authorize]
public class MillTrackerController(IMillTrackerService svc) : ControllerBase
{
    private string CurrentUser => User.FindFirst("name")?.Value
                               ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                               ?? "system";

    /// <summary>GET /api/v1/mill-tracker â€” paginated list with optional filters</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] MillTrackerFilterRequest filter)
    {
        var result = await svc.GetAllAsync(filter);
        if (RoleGuard.ShouldHideCost(User))
            foreach (var t in result.Items)
                MaskCost(t);
        return Ok(ApiResponse<PagedResult<MillTrackerListDto>>.Ok(result));
    }

    /// <summary>GET /api/v1/mill-tracker/{id} â€” single tracker with batches + history</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await svc.GetByIdAsync(id);
        if (RoleGuard.ShouldHideCost(User)) MaskCost(result);
        return Ok(ApiResponse<MillTrackerListDto>.Ok(result));
    }

    /// <summary>GET /api/v1/mill-tracker/by-po/{poId} â€” all trackers for a purchase order</summary>
    [HttpGet("by-po/{poId:int}")]
    public async Task<IActionResult> GetByPo(int poId)
    {
        var result = await svc.GetByPoIdAsync(poId);
        if (RoleGuard.ShouldHideCost(User))
            foreach (var t in result)
                MaskCost(t);
        return Ok(ApiResponse<List<MillTrackerListDto>>.Ok(result));
    }

    /// <summary>PATCH /api/v1/mill-tracker/{id}/status â€” update production status + optional ready qty</summary>
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateMillTrackerStatusDto dto)
        => Ok(ApiResponse<MillTrackerListDto>.Ok(
            await svc.UpdateStatusAsync(id, dto, CurrentUser),
            "Status updated successfully."));

    /// <summary>PATCH /api/v1/mill-tracker/{id}/close — mark tracker as short-delivery finalized</summary>
    [HttpPatch("{id:int}/close")]
    [RequirePerm("mill.write")]
    public async Task<IActionResult> Close(int id, [FromBody] CloseMillTrackerDto dto)
        => Ok(ApiResponse<MillTrackerListDto>.Ok(
            await svc.CloseAsync(id, dto, CurrentUser),
            "Tracker closed."));

    /// <summary>POST /api/v1/mill-tracker/{id}/batches â€” record a dispatch batch</summary>
    [HttpPost("{id:int}/batches")]
    public async Task<IActionResult> AddBatch(int id, [FromBody] AddMillTrackerBatchDto dto)
        => Ok(ApiResponse<MillTrackerBatchDto>.Ok(
            await svc.AddBatchAsync(id, dto, CurrentUser),
            "Dispatch batch recorded successfully."));

    /// <summary>GET /api/v1/mill-tracker/template â€” download CSV template for bulk import</summary>
    [HttpGet("template")]
    public IActionResult DownloadTemplate()
    {
        var csv = new StringBuilder();
        csv.AppendLine("PO Number,Ready Qty,Status,Expected Date,Remarks");
        csv.AppendLine("\"PO-2024-001\",\"9000\",\"In Production\",\"2024-02-15\",\"Mill team update\"");
        csv.AppendLine("\"PO-2024-002\",\"20000\",\"Ready\",\"\",\"Full batch ready\"");
        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        return File(bytes, "text/csv", "mill_tracker_template.csv");
    }

    /// <summary>POST /api/v1/mill-tracker/bulk-import â€” update multiple trackers from parsed CSV rows</summary>
    [HttpPost("bulk-import")]
    public async Task<IActionResult> BulkImport([FromBody] List<BulkImportRowDto> rows)
    {
        var result = await svc.BulkImportAsync(rows, CurrentUser);
        var msg    = $"Bulk import done â€” {result.Updated} updated, {result.Unchanged} unchanged, {result.Skipped} skipped"
                   + (result.Warnings.Count > 0 ? $", {result.Warnings.Count} warning(s)" : "") + ".";
        return Ok(ApiResponse<BulkImportResultDto>.Ok(result, msg));
    }

    // â”€â”€ Bulk edit via Excel â€” primary flow for production teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //
    // Workflow:
    //   1. GET  /api/v1/mill-tracker/export-excel  â†’ user downloads xlsx with
    //      ALL current trackers (after applying the same filter as the grid),
    //      every column visible. The first column is a hidden tracker Id used
    //      to match on re-upload; Ready Qty / Status / Expected Delivery
    //      columns are highlighted as the only ones the user should change.
    //   2. User edits the file in Excel and saves.
    //   3. POST /api/v1/mill-tracker/import-excel (multipart/form-data) â†’
    //      backend parses each row, updates the matching tracker, returns
    //      { Updated, Skipped, Errors[] }.
    //
    // Status values accepted (must match the frontend's productionStatus list):
    //   Order Placed, In Production, Partial Ready, Ready, Dispatched,
    //   Delayed, Cancelled.

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] MillTrackerFilterRequest filter)
    {
        // Pull the full filtered set â€” disable pagination so the user gets
        // every row they expect to see in one file.
        filter.PageSize = int.MaxValue;
        filter.Page     = 1;
        var rows = (await svc.GetAllAsync(filter)).Items;

        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Mill Trackers");

        // Headers (row 1) â€” order + columns match the MOT page grid so the
        // exported workbook is the user's working view, not a slimmed-down
        // form. Editable columns highlighted yellow; everything else is
        // read-only context to help the user identify the row.
        //
        // UAT changes:
        //   â€¢ Mill + Mill Unit merged into one column (unit name when
        //     picked, mill name otherwise) â€” one filter, not two.
        //   â€¢ Item Code split into Brand / GSM / Size â€” clerks filter by
        //     brand directly without parsing the composite code.
        //   â€¢ Remarks reads tracker.Remarks (was history-only earlier).
        string[] headers =
        [
            "Id",                  //  1 hidden anchor for re-upload matching
            "PO Number",           //  2
            "Order Date",          //  3 = PO Date
            "Mill",                //  4 â€” unit name when picked, mill name otherwise
            "Brand",               //  5 â€” the quality's Alias (e.g. "Eco Polar")
            "GSM",                 //  6
            "Size",                //  7
            "Ordered (kg)",        //  8
            "Order ID",            //  9 â€” mill's order id (DB col: MillSONumber)
            "PO Customer",         // 10 â€” PO direct customer (or linked SO customer)
            "SO Customer",         // 11 â€” linked SO's customer
            "Ready (kg)",          // 12 â† editable
            "Dispatched (kg)",     // 13
            "Balance (kg)",        // 14
            "SO Del. Date",        // 15 â€” linked SO required delivery
            "PO Del. Date",        // 16 â† editable (yyyy-MM-dd) = Expected Delivery
            "Status",              // 17 â† editable (dropdown)
            "Remarks",             // 18 â† editable (manual change note; stored on tracker.Remarks)
            "Item Remark",         // 19 - the PO item line's own Remark, appended at the end so
                                   //      ImportExcel fixed-index reads for 12/16/17/18 do not shift
        ];
        for (int i = 0; i < headers.Length; i++)
            ws.Cell(1, i + 1).Value = headers[i];

        ws.Row(1).Style.Font.Bold       = true;
        ws.Row(1).Style.Fill.BackgroundColor = XLColor.LightSteelBlue;
        ws.SheetView.FreezeRows(1);

        // Mark the editable columns with a soft yellow tint so users see what
        // they're meant to touch.
        var editableCols = new[] { 12, 16, 17, 18 };   // Ready, PO Del. Date, Status, Remarks

        // Data rows
        for (int i = 0; i < rows.Count; i++)
        {
            var t = rows[i];
            int r = i + 2;
            // Mill column = unit name when present, fall back to mill name.
            // Single column = single Excel filter for the whole population.
            var millCell = !string.IsNullOrWhiteSpace(t.MillUnitName)
                ? t.MillUnitName!
                : t.Mill;
            ws.Cell(r,  1).Value = t.Id;
            ws.Cell(r,  2).Value = t.PoNumber;
            ws.Cell(r,  3).Value = t.PoDate;
            ws.Cell(r,  4).Value = millCell;
            ws.Cell(r,  5).Value = t.BrandName ?? "";
            ws.Cell(r,  6).Value = t.Gsm ?? 0;
            ws.Cell(r,  7).Value = t.Size ?? "";
            ws.Cell(r,  8).Value = (double)t.OrderedQty;
            ws.Cell(r,  9).Value = t.MillSONumber ?? "";
            ws.Cell(r, 10).Value = t.CustomerName ?? "";
            ws.Cell(r, 11).Value = t.SoCustomerName ?? "";
            ws.Cell(r, 12).Value = (double)t.ReadyQty;
            ws.Cell(r, 13).Value = (double)t.DispatchedQty;
            ws.Cell(r, 14).Value = (double)t.BalanceQty;
            ws.Cell(r, 15).Value = t.SoDeliveryDate ?? "";
            ws.Cell(r, 16).Value = t.ExpectedDelivery ?? "";
            ws.Cell(r, 17).Value = t.ProductionStatus ?? "";
            ws.Cell(r, 18).Value = t.Remarks ?? "";
            ws.Cell(r, 19).Value = t.ItemRemark ?? "";

            foreach (var col in editableCols)
                ws.Cell(r, col).Style.Fill.BackgroundColor = XLColor.LightYellow;
        }

        // Status dropdown validation on the Status column (data range = data rows only).
        // "Dispatched" deliberately excluded — it must only ever be set
        // automatically from a real dispatch entry on the Dispatch page,
        // never via this bulk-edit sheet. MillTrackerRepository.UpdateStatusAsync
        // also rejects it server-side, so a stray typed "Dispatched" value
        // fails the row with a clear error instead of silently double-
        // counting a dispatch (client-reported live-data bug).
        if (rows.Count > 0)
        {
            var statusRange = ws.Range(2, 17, rows.Count + 1, 17);
            var dv = statusRange.CreateDataValidation();
            dv.List("\"Order Placed,In Production,Partial Ready,Ready,Delayed,Cancelled\"");
            dv.ErrorTitle = "Invalid Status";
            dv.ErrorMessage = "Pick one of the allowed status values.";
        }

        ws.Columns().AdjustToContents();
        ws.Column(1).Width = 6;   // Id column kept narrow

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        var fileName = $"mill_tracker_{DateTime.Today:yyyyMMdd}.xlsx";
        return File(stream.ToArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    fileName);
    }

    [HttpPost("import-excel")]
    public async Task<IActionResult> ImportExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse.Fail("No file uploaded."));
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)
         && !file.FileName.EndsWith(".xls",  StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Fail("Please upload an Excel (.xlsx) file."));

        using var stream = file.OpenReadStream();
        using var wb     = new XLWorkbook(stream);
        var ws           = wb.Worksheets.First();

        var rows = new List<BulkImportExcelRowDto>();
        // Skip row 1 (headers). Loop only the rows that actually have data.
        var lastRow = ws.LastRowUsed();
        if (lastRow == null)
            return Ok(ApiResponse<BulkImportResultDto>.Ok(new BulkImportResultDto(), "Empty file â€” nothing to import."));

        for (int r = 2; r <= lastRow.RowNumber(); r++)
        {
            var idCell = ws.Cell(r, 1).Value;
            if (idCell.IsBlank) continue;
            if (!int.TryParse(idCell.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) || id <= 0)
                continue;

            // Column indexes match the new grid-aligned export layout:
            //   12 = Ready (kg)  16 = PO Del. Date  17 = Status  18 = Remarks
            // (kept in sync with the headers/data writers above).

            // Ready Qty â€” accept blank (no change) or numeric.
            // Robust against the OS locale: when the cell is a real number
            // we read it via GetDouble (no string round-trip, locale-safe);
            // when the cell is text (user pasted a value) we trim and parse
            // with InvariantCulture. Earlier this used XLCellValue.ToString
            // which formats numbers with CurrentCulture â€” on machines with
            // a comma decimal separator (de-DE / fr-FR / hi-IN with certain
            // settings) the InvariantCulture parse silently failed,
            // leaving ReadyQty = null and the auto-status-derive a no-op.
            decimal? readyQty = null;
            var readyXLCell = ws.Cell(r, 12);
            if (!readyXLCell.Value.IsBlank)
            {
                if (readyXLCell.DataType == XLDataType.Number)
                {
                    try { readyQty = (decimal)readyXLCell.GetDouble(); }
                    catch { /* fall through to string parse */ }
                }
                if (readyQty is null)
                {
                    var raw = readyXLCell.GetString().Trim().Replace(",", ".");
                    if (!string.IsNullOrEmpty(raw)
                     && decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var readyDec))
                        readyQty = readyDec;
                }
            }

            // Status â€” blank = keep existing.
            var status = ws.Cell(r, 17).GetString().Trim();

            // Expected Delivery â€” accept yyyy-MM-dd OR Excel date.
            string? expected = null;
            var expCell = ws.Cell(r, 16);
            if (!expCell.Value.IsBlank)
            {
                if (expCell.DataType == XLDataType.DateTime)
                    expected = expCell.GetDateTime().ToString("yyyy-MM-dd");
                else
                {
                    var raw = expCell.GetString().Trim();
                    if (!string.IsNullOrEmpty(raw)
                     && DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                        expected = dt.ToString("yyyy-MM-dd");
                    else
                        expected = raw;   // pass through; service will surface a clear error if unparseable.
                }
            }

            var remarks = ws.Cell(r, 18).GetString().Trim();

            rows.Add(new BulkImportExcelRowDto
            {
                Id               = id,
                ReadyQty         = readyQty,
                Status           = string.IsNullOrWhiteSpace(status)  ? null : status,
                ExpectedDelivery = expected,
                Remarks          = string.IsNullOrWhiteSpace(remarks) ? null : remarks,
            });
        }

        var result = await svc.BulkImportExcelAsync(rows, CurrentUser);
        var msg    = $"Bulk import done â€” {result.Updated} updated, {result.Unchanged} unchanged, {result.Skipped} skipped"
                   + (result.Warnings.Count > 0 ? $", {result.Warnings.Count} warning(s)" : "") + ".";
        return Ok(ApiResponse<BulkImportResultDto>.Ok(result, msg));
    }

    /// <summary>DELETE /api/v1/mill-tracker/{id} â€” soft delete (Admin/Manager only)</summary>
    [HttpDelete("{id:int}")]
    [RequirePerm("mill.delete")]
    public async Task<IActionResult> Delete(int id)
    {
        await svc.DeleteAsync(id, CurrentUser);
        return Ok(ApiResponse.Ok("Mill tracker deleted successfully."));
    }

    private static void MaskCost(MillTrackerListDto t)
    {
        t.Rate        = 0;
        t.TotalAmount = 0;
    }
}
