using Dapper;
using Monit.API.Common.Response;
using Monit.API.Data;
using Monit.API.Models.DTOs.Masters;
using Monit.API.Models.Entities.Masters;
using Monit.API.Repositories.Interfaces;

namespace Monit.API.Repositories.Masters;

public class CustomerRepository(DbConnectionFactory db) : ICustomerRepository
{
    public async Task<PagedResult<CustomerListDto>> GetAllAsync(CustomerFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var orderBy = SafeColumn(f.SortBy, "Name") + " " + f.SafeSortOrder;
        var countSql = $"SELECT COUNT(*) FROM masters.Customers c WHERE {where}";
        var dataSql  = $"SELECT c.Id,c.Name,c.OwnerName,c.Phone,c.Email,c.GSTNo,c.CreditLimit,c.CreditDays,c.PaymentTerms,c.LocalityId,l.Name AS Locality,c.IsActive,c.CreatedAt FROM masters.Customers c LEFT JOIN masters.Localities l ON l.Id=c.LocalityId WHERE {where} ORDER BY c.{orderBy} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
        param.Add("Offset", f.Offset); param.Add("PageSize", f.PageSize);
        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(countSql, param);
        var items = (await conn.QueryAsync<CustomerListDto>(dataSql, param)).ToList();
        return new PagedResult<CustomerListDto> { Items = items, Page = f.Page, PageSize = f.PageSize, Total = total };
    }

    public async Task<List<CustomerListDto>> GetAllForExportAsync(CustomerFilterRequest f)
    {
        var (where, param) = BuildWhere(f);
        var sql = $"SELECT c.Id,c.Name,c.OwnerName,c.Phone,c.Email,c.GSTNo,c.CreditLimit,c.CreditDays,c.PaymentTerms,c.LocalityId,l.Name AS Locality,c.IsActive,c.CreatedAt FROM masters.Customers c LEFT JOIN masters.Localities l ON l.Id=c.LocalityId WHERE {where} ORDER BY c.Name ASC";
        using var conn = db.Create();
        return (await conn.QueryAsync<CustomerListDto>(sql, param)).ToList();
    }

    public async Task<CustomerDetailDto?> GetByIdAsync(int id)
    {
        const string custSql     = "SELECT Id,Name,OwnerName,Phone,Email,GSTNo,BillingAddress,CreditLimit,CreditDays,PaymentTerms,LocalityId,IsActive,CreatedAt,UpdatedAt,UpdatedBy FROM masters.Customers WHERE Id=@Id AND IsDeleted=0";
        const string contactsSql = "SELECT Id,Name,Designation,Phone,Email,IsDefault FROM masters.CustomerContacts WHERE CustomerId=@Id AND IsDeleted=0 ORDER BY IsDefault DESC, Name";
        const string locationsSql = "SELECT Id,Label,Address,IsDefault FROM masters.CustomerDeliveryLocations WHERE CustomerId=@Id AND IsDeleted=0 ORDER BY IsDefault DESC, Id";

        using var conn = db.Create();
        var cust = await conn.QueryFirstOrDefaultAsync<CustomerDetailDto>(custSql, new { Id = id });
        if (cust == null) return null;
        cust.Contacts          = (await conn.QueryAsync<CustomerContactDto>(contactsSql, new { Id = id })).ToList();
        cust.DeliveryLocations = (await conn.QueryAsync<CustomerDeliveryLocationDto>(locationsSql, new { Id = id })).ToList();
        return cust;
    }

    public async Task<List<CustomerDropdownDto>> GetDropdownAsync()
    {
        const string sql = "SELECT Id,Name FROM masters.Customers WHERE IsDeleted=0 AND IsActive=1 ORDER BY Name";
        using var conn = db.Create();
        return (await conn.QueryAsync<CustomerDropdownDto>(sql)).ToList();
    }

    public async Task<List<CustomerSODropdownDto>> GetForSOAsync()
    {
        const string custSql = @"
            SELECT Id, Name AS Company, GSTNo, CreditDays, CreditLimit, Phone, Email, BillingAddress, PaymentTerms
            FROM   masters.Customers
            WHERE  IsDeleted=0 AND IsActive=1
            ORDER BY Name";
        const string contactsSql = @"
            SELECT Id, CustomerId, Name, Designation, Phone, Email, IsDefault
            FROM   masters.CustomerContacts
            WHERE  IsDeleted=0
            ORDER BY CustomerId, IsDefault DESC, Name";
        const string locationsSql = @"
            SELECT Id, CustomerId, Label, Address, IsDefault
            FROM   masters.CustomerDeliveryLocations
            WHERE  IsDeleted=0
            ORDER BY CustomerId, IsDefault DESC, Id";
        using var conn = db.Create();
        var customers  = (await conn.QueryAsync<CustomerSODropdownDto>(custSql)).ToList();
        var contacts   = (await conn.QueryAsync<dynamic>(contactsSql)).ToList();
        var locations  = (await conn.QueryAsync<dynamic>(locationsSql)).ToList();

        var contactsByCustomer  = contacts.GroupBy(r => (int)r.CustomerId)
            .ToDictionary(g => g.Key, g => g.Select(r => new CustomerContactSODto
            {
                Id          = (int)r.Id,
                Name        = (string)r.Name,
                Designation = (string?)r.Designation,
                Phone       = (string?)r.Phone,
                Email       = (string?)r.Email,
                IsDefault   = (bool)r.IsDefault,
            }).ToList());
        var locationsByCustomer = locations.GroupBy(r => (int)r.CustomerId)
            .ToDictionary(g => g.Key, g => g.Select(r => new CustomerDeliveryLocationSODto
            {
                Id        = (int)r.Id,
                Label     = (string?)r.Label,
                Address   = (string)r.Address,
                IsDefault = (bool)r.IsDefault,
            }).ToList());

        foreach (var c in customers)
        {
            c.Contacts          = contactsByCustomer.TryGetValue(c.Id, out var ct) ? ct : [];
            c.DeliveryAddresses = locationsByCustomer.TryGetValue(c.Id, out var lc) ? lc : [];
        }
        return customers;
    }

    public async Task<int> CreateAsync(Customer c, IEnumerable<CustomerContact> contacts, IEnumerable<CustomerDeliveryLocation> locations, string createdBy)
    {
        const string sql = @"
            INSERT INTO masters.Customers (Name,OwnerName,Phone,Email,GSTNo,BillingAddress,CreditLimit,CreditDays,PaymentTerms,LocalityId,IsActive,CreatedAt,CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Name,@OwnerName,@Phone,@Email,@GSTNo,@BillingAddress,@CreditLimit,@CreditDays,@PaymentTerms,@LocalityId,@IsActive,@CreatedAt,@CreatedBy)";
        using var conn = db.Create();
        var custId = await conn.ExecuteScalarAsync<int>(sql, c);
        await InsertContacts(conn, custId, contacts, createdBy);
        await InsertLocations(conn, custId, locations, createdBy);
        return custId;
    }

    public async Task UpdateAsync(Customer c, IEnumerable<CustomerContact> contacts, IEnumerable<CustomerDeliveryLocation> locations, string updatedBy)
    {
        const string sql = @"
            UPDATE masters.Customers SET
                Name=@Name,OwnerName=@OwnerName,Phone=@Phone,Email=@Email,GSTNo=@GSTNo,
                BillingAddress=@BillingAddress,CreditLimit=@CreditLimit,CreditDays=@CreditDays,
                PaymentTerms=@PaymentTerms,LocalityId=@LocalityId,
                IsActive=@IsActive,UpdatedAt=@UpdatedAt,UpdatedBy=@UpdatedBy
            WHERE Id=@Id AND IsDeleted=0";
        using var conn = db.Create();
        await conn.ExecuteAsync(sql, c);
        await conn.ExecuteAsync("UPDATE masters.CustomerContacts SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE CustomerId=@Id AND IsDeleted=0", new { Id = c.Id, By = updatedBy });
        await conn.ExecuteAsync("UPDATE masters.CustomerDeliveryLocations SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE CustomerId=@Id AND IsDeleted=0", new { Id = c.Id, By = updatedBy });
        await InsertContacts(conn, c.Id, contacts, updatedBy);
        await InsertLocations(conn, c.Id, locations, updatedBy);
    }

    public async Task SoftDeleteAsync(int id, string deletedBy)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync("UPDATE masters.Customers SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE Id=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
        await conn.ExecuteAsync("UPDATE masters.CustomerContacts SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE CustomerId=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
        await conn.ExecuteAsync("UPDATE masters.CustomerDeliveryLocations SET IsDeleted=1,DeletedAt=GETUTCDATE(),DeletedBy=@By WHERE CustomerId=@Id AND IsDeleted=0", new { Id = id, By = deletedBy });
    }

    private static async Task InsertContacts(System.Data.IDbConnection conn, int customerId, IEnumerable<CustomerContact> contacts, string createdBy)
    {
        const string sql = "INSERT INTO masters.CustomerContacts (CustomerId,Name,Designation,Phone,Email,IsDefault,CreatedAt,CreatedBy) VALUES (@CustomerId,@Name,@Designation,@Phone,@Email,@IsDefault,GETUTCDATE(),@CreatedBy)";
        foreach (var c in contacts)
            await conn.ExecuteAsync(sql, new { CustomerId = customerId, c.Name, c.Designation, c.Phone, c.Email, c.IsDefault, CreatedBy = createdBy });
    }

    private static async Task InsertLocations(System.Data.IDbConnection conn, int customerId, IEnumerable<CustomerDeliveryLocation> locations, string createdBy)
    {
        const string sql = "INSERT INTO masters.CustomerDeliveryLocations (CustomerId,Label,Address,IsDefault,CreatedAt,CreatedBy) VALUES (@CustomerId,@Label,@Address,@IsDefault,GETUTCDATE(),@CreatedBy)";
        foreach (var l in locations)
            await conn.ExecuteAsync(sql, new { CustomerId = customerId, l.Label, l.Address, l.IsDefault, CreatedBy = createdBy });
    }

    private static (string, DynamicParameters) BuildWhere(CustomerFilterRequest f)
    {
        var parts = new List<string> { "c.IsDeleted = 0" };
        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(f.Search)) { parts.Add("(c.Name LIKE @Search OR c.Phone LIKE @Search OR c.GSTNo LIKE @Search)"); p.Add("Search", $"%{f.Search.Trim()}%"); }
        if (f.IsActive.HasValue) { parts.Add("c.IsActive=@IsActive"); p.Add("IsActive", f.IsActive.Value); }
        return (string.Join(" AND ", parts), p);
    }

    private static readonly HashSet<string> AllowedSort = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "Name", "Phone", "IsActive", "CreatedAt" };
    private static string SafeColumn(string? col, string def) => AllowedSort.Contains(col ?? "") ? col! : def;
}
