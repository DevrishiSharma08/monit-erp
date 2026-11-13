namespace Monit.API.Models.DTOs;

// Generic bulk-ids payload reused by the grid "Export → PDF" endpoints on
// Sales Order, Purchase Order, etc. Keeps the shape uniform across modules.
public class BulkIdsRequestDto
{
    public int[] Ids { get; set; } = [];
}
