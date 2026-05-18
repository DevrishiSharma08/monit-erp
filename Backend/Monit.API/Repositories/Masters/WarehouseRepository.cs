using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class WarehouseRepository(DbConnectionFactory db) : IWarehouseRepository
{
    public async Task<PagedResult<WarehouseListDto>> GetAllAsync(WarehouseFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Warehouses WHERE {where}";
        var dataSql  = $@"
            SELECT w.Id, w.Unit, w.Name,
                   (SELECT COUNT(*) FROM masters.WarehouseBins b WHERE b.WarehouseId=w.Id AND b.IsDeleted=0) AS BinCount,
                   (SELECT COUNT(*) FROM masters.WarehouseRacks r JOIN masters.WarehouseBins b ON b.Id=r.BinId WHERE b.WarehouseId=w.Id AND b.IsDeleted=0 AND r.IsDeleted=0) AS RackCount,
                   w.IsActive, w.CreatedAt
            FROM masters.Warehouses w WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<WarehouseListDto>(dataSql, param)).ToList();
        return new PagedResult<WarehouseListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<WarehouseListDto>> GetAllForExportAsync(WarehouseFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $@"
            SELECT w.Id, w.Unit, w.Name,
                   (SELECT COUNT(*) FROM masters.WarehouseBins b WHERE b.WarehouseId=w.Id AND b.IsDeleted=0) AS BinCount,
                   (SELECT COUNT(*) FROM masters.WarehouseRacks r JOIN masters.WarehouseBins b ON b.Id=r.BinId WHERE b.WarehouseId=w.Id AND b.IsDeleted=0 AND r.IsDeleted=0) AS RackCount,
                   w.IsActive, w.CreatedAt
            FROM masters.Warehouses w WHERE {where} ORDER BY w.Name ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<WarehouseListDto>(sql, param)).ToList();
    }

    public async Task<WarehouseDetailDto?> GetByIdAsync(int id)
    {
        const string whSql    = "SELECT Id,Unit,Name,IsActive,CreatedAt,UpdatedAt,UpdatedBy FROM masters.Warehouses WHERE Id=@Id AND IsDeleted=0";
        const string binsSql  = "SELECT Id,Name,IsActive FROM masters.WarehouseBins WHERE WarehouseId=@Id AND IsDeleted=0 ORDER BY Name";
        const string racksSql = "SELECT r.Id,r.BinId,r.Name,r.StackCount,r.IsActive FROM masters.WarehouseRacks r JOIN masters.WarehouseBins b ON b.Id=r.BinId WHERE b.WarehouseId=@Id AND b.IsDeleted=0 AND r.IsDeleted=0 ORDER BY b.Name, r.Name";

        using var conn = db.Create();
        var wh = await conn.QueryFirstOrDefaultAsync<WarehouseDetailDto>(whSql, new { Id = id });
        if (wh == null) return null;

        var bins  = (await conn.QueryAsync<WarehouseBinDetailDto>(binsSql, new { Id = id })).ToList();
        var racks = (await conn.QueryAsync<RackRow>(racksSql, new { Id = id })).ToList();

        foreach (var bin in bins)
            bin.Racks = racks.Where(r => r.BinId == bin.Id)
                             .Select(r => new WarehouseRackDto { Id = r.Id, Name = r.Name, StackCount = r.StackCount, IsActive = r.IsActive })
                             .ToList();

        wh.Bins      = bins;
        wh.BinCount  = bins.Count;
        wh.RackCount = racks.Count;
        return wh;
    }

    public async Task<List<WarehouseDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id,Unit,Name FROM masters.Warehouses WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<WarehouseDropdownDto>(sql)).ToList();
    }

    public async Task<int> CreateAsync(Warehouse w, IEnumerable<(WarehouseBin bin, IEnumerable<WarehouseRack> racks)> bins, string createdBy)
    {
        const string sql = "INSERT INTO masters.Warehouses (Unit,Name,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@Unit,@Name,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        var whId = await conn.ExecuteScalarAsync<int>(sql, w);
        foreach (var (bin, racks) in bins)
        {
            var binId = await InsertBin(conn, whId, bin, createdBy);
            foreach (var rack in racks) await InsertRack(conn, binId, rack, createdBy);
        }
        return whId;
    }

    public async Task UpdateAsync(Warehouse w, IEnumerable<(WarehouseBin bin, IEnumerable<WarehouseRack> racks)> bins, string updatedBy)
    {
        const string sql = "UPDATE masters.Warehouses SET Unit=@Unit,Name=@Name,IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, w);
        // Cascade: soft-delete racks first (via bin join), then bins
        await conn.ExecuteAsync(@"
            UPDATE r SET r.IsDeleted=1,r.DeletedAt=GETUTCDATE(),r.DeletedBy=@By
            FROM masters.WarehouseRacks r
            JOIN masters.WarehouseBins b ON b.Id=r.BinId
            WHERE b.WarehouseId=@Id AND b.IsDeleted=0 AND r.IsDeleted=0", new { Id = w.Id, By = updatedBy });
        await conn.ExecuteAsync("UPDATE masters.WarehouseBins SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE WarehouseId=@Id AND IsDeleted=0", new { Id = w.Id, By = updatedBy });
        foreach (var (bin, racks) in bins)
        {
            var binId = await InsertBin(conn, w.Id, bin, updatedBy);
            foreach (var rack in racks) await InsertRack(conn, binId, rack, updatedBy);
        }
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync(@"
            UPDATE r SET r.IsDeleted=1,r.DeletedAt=GETUTCDATE(),r.DeletedBy=@By
            FROM masters.WarehouseRacks r
            JOIN masters.WarehouseBins b ON b.Id=r.BinId
            WHERE b.WarehouseId=@Id AND b.IsDeleted=0 AND r.IsDeleted=0", new { Id = id, By = deletedBy });
        await conn.ExecuteAsync("UPDATE masters.WarehouseBins SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE WarehouseId=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
        await conn.ExecuteAsync("UPDATE masters.Warehouses SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE Id=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
    }

    private static async Task<int> InsertBin(System.Data.IDbConnection conn, int warehouseId, WarehouseBin b, string createdBy)
    {
        const string sql = "INSERT INTO masters.WarehouseBins (WarehouseId,Name,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@WarehouseId,@Name,@IsActive,GETUTCDATE(),@CreatedBy)";
        return await conn.ExecuteScalarAsync<int>(sql, new { WarehouseId = warehouseId, b.Name, b.IsActive, CreatedBy = createdBy });
    }

    private static async Task InsertRack(System.Data.IDbConnection conn, int binId, WarehouseRack r, string createdBy)
    {
        const string sql = "INSERT INTO masters.WarehouseRacks (BinId,Name,StackCount,IsActive,CreatedAt,CreatedBy) VALUES (@BinId,@Name,@StackCount,@IsActive,GETUTCDATE(),@CreatedBy)";
        await conn.ExecuteAsync(sql, new { BinId = binId, r.Name, r.StackCount, r.IsActive, CreatedBy = createdBy });
    }

    private static (string, DynamicParameters) BuildWhere(WarehouseFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(Name LIKE @Search OR Unit LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase) { "Id", "Unit", "Name", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;

    private sealed class RackRow
    {
        public int    Id         { get; set; }
        public int    BinId      { get; set; }
        public string Name       { get; set; } = string.Empty;
        public int    StackCount { get; set; }
        public bool   IsActive   { get; set; }
    }
}
