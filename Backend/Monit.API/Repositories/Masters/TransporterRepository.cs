using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class TransporterRepository(DbConnectionFactory db) : ITransporterRepository
{
    public async Task<PagedResult<TransporterListDto>> GetAllAsync(TransporterFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Transporters WHERE {where}";
        var dataSql  = $@"
            SELECT t.Id, t.Name, t.Phone, t.Email, t.GstNo,
                   (SELECT COUNT(*) FROM masters.TransporterVehicles v WHERE v.TransporterId=t.Id AND v.IsDeleted=0) AS VehicleCount,
                   t.IsActive, t.CreatedAt
            FROM masters.Transporters t WHERE {where} ORDER BY {orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<TransporterListDto>(dataSql, param)).ToList();
        return new PagedResult<TransporterListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<TransporterListDto>> GetAllForExportAsync(TransporterFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $@"
            SELECT t.Id, t.Name, t.Phone, t.Email, t.GstNo,
                   (SELECT COUNT(*) FROM masters.TransporterVehicles v WHERE v.TransporterId=t.Id AND v.IsDeleted=0) AS VehicleCount,
                   t.IsActive, t.CreatedAt
            FROM masters.Transporters t WHERE {where} ORDER BY t.Name ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<TransporterListDto>(sql, param)).ToList();
    }

    public async Task<TransporterDetailDto?> GetByIdAsync(int id)
    {
        const string tSql = "SELECT Id,Name,Phone,Email,Address,GstNo,PanNo,TdsPercent,IsActive,CreatedAt,UpdatedAt,UpdatedBy FROM masters.Transporters WHERE Id=@Id AND IsDeleted=0";
        const string vSql = "SELECT Id,VehicleType,Capacity,CapacityUnit,FreightRate,IsActive FROM masters.TransporterVehicles WHERE TransporterId=@Id AND IsDeleted=0 ORDER BY Id";
        using var conn = db.Create();
        var t = await conn.QueryFirstOrDefaultAsync<TransporterDetailDto>(tSql, new { Id = id });
        if (t == null) return null;
        t.Vehicles = (await conn.QueryAsync<TransporterVehicleDto>(vSql, new { Id = id })).ToList();
        t.VehicleCount = t.Vehicles.Count;
        return t;
    }

    public async Task<List<TransporterDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id,Name FROM masters.Transporters WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<TransporterDropdownDto>(sql)).ToList();
    }

    public async Task<int> CreateAsync(Transporter t, IEnumerable<TransporterVehicle> vehicles, string createdBy)
    {
        const string sql = "INSERT INTO masters.Transporters (Name,Phone,Email,Address,GstNo,PanNo,TdsPercent,IsActive,CreatedAt,CreatedBy) OUTPUT INSERTED.Id VALUES (@Name,@Phone,@Email,@Address,@GstNo,@PanNo,@TdsPercent,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        var tid = await conn.ExecuteScalarAsync<int>(sql, t);
        foreach (var v in vehicles) await InsertVehicle(conn, tid, v, createdBy);
        return tid;
    }

    public async Task UpdateAsync(Transporter t, IEnumerable<TransporterVehicle> vehicles, string updatedBy)
    {
        const string sql = "UPDATE masters.Transporters SET Name=@Name,Phone=@Phone,Email=@Email,Address=@Address,GstNo=@GstNo,PanNo=@PanNo,TdsPercent=@TdsPercent,IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, t);
        await conn.ExecuteAsync("UPDATE masters.TransporterVehicles SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE TransporterId=@Id AND IsDeleted=0", new { Id = t.Id, By = updatedBy });
        foreach (var v in vehicles) await InsertVehicle(conn, t.Id, v, updatedBy);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync("UPDATE masters.Transporters SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE Id=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
        await conn.ExecuteAsync("UPDATE masters.TransporterVehicles SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE TransporterId=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
    }

    private static async Task InsertVehicle(System.Data.IDbConnection conn, int transporterId, TransporterVehicle v, string createdBy)
    {
        const string sql = "INSERT INTO masters.TransporterVehicles (TransporterId,VehicleType,Capacity,CapacityUnit,FreightRate,IsActive,CreatedAt,CreatedBy) VALUES (@TransporterId,@VehicleType,@Capacity,@CapacityUnit,@FreightRate,@IsActive,GETUTCDATE(),@CreatedBy)";
        await conn.ExecuteAsync(sql, new { TransporterId = transporterId, v.VehicleType, v.Capacity, v.CapacityUnit, v.FreightRate, v.IsActive, CreatedBy = createdBy });
    }

    private static (string, DynamicParameters) BuildWhere(TransporterFilterRequest f)
    {
        var parts = new List<string> { "IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(Name LIKE @Search OR Phone LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase) { "Id", "Name", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
