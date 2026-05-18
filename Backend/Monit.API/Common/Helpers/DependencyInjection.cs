using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Monit.API.Data;
using Monit.API.Repositories.Auth;
using Monit.API.Repositories.Interfaces;
using Monit.API.Repositories.Masters;
using Monit.API.Repositories.Config;
using Monit.API.Repositories.Procurement;
using Monit.API.Repositories.Sales;
using Monit.API.Services;
using Monit.API.Services.Auth;
using Monit.API.Services.Config;
using Monit.API.Services.Interfaces;
using Monit.API.Services.Masters;
using Monit.API.Services.Procurement;
using Monit.API.Services.Sales;

namespace Monit.API.Common.Helpers;

public static class DependencyInjection
{
    public static IServiceCollection AddAppServices(
        this IServiceCollection services,
        AppConfig config)
    {
        // ── Infrastructure ────────────────────────────────────────────────────
        services.AddSingleton(config);
        services.AddSingleton<DbConnectionFactory>();

        // ── Repositories ──────────────────────────────────────────────────────
        services.AddScoped<IUnitRepository,          UnitRepository>();
        services.AddScoped<IMQGRepository,           MQGRepository>();
        services.AddScoped<IAuthRepository,          AuthRepository>();
        services.AddScoped<IUserRepository,          UserRepository>();
        services.AddScoped<IRoleRepository,          RoleRepository>();
        services.AddScoped<IMillRepository,          MillRepository>();
        services.AddScoped<IStockGroupRepository,    StockGroupRepository>();
        services.AddScoped<IStockCategoryRepository, StockCategoryRepository>();
        services.AddScoped<IItemTypeRepository,      ItemTypeRepository>();
        services.AddScoped<IPaperSizeRepository,     PaperSizeRepository>();
        services.AddScoped<IMaterialRepository,      MaterialRepository>();
        services.AddScoped<ICustomerRepository,      CustomerRepository>();
        services.AddScoped<ISalesmanRepository,      SalesmanRepository>();
        services.AddScoped<IWarehouseRepository,     WarehouseRepository>();
        services.AddScoped<ITransporterRepository,   TransporterRepository>();
        services.AddScoped<IRateRepository,          RateRepository>();
        services.AddScoped<IHsnCodeRepository,       HsnCodeRepository>();
        services.AddScoped<ILocalityRepository,      LocalityRepository>();
        services.AddScoped<IInstructionRepository,   InstructionRepository>();
        services.AddScoped<ICompanyConfigRepository, CompanyConfigRepository>();
        services.AddScoped<ISalesOrderRepository,    SalesOrderRepository>();
        services.AddScoped<IPurchaseOrderRepository, PurchaseOrderRepository>();

        // ── Services ──────────────────────────────────────────────────────────
        services.AddScoped<IUnitService,             UnitService>();
        services.AddScoped<IMQGService,              MQGService>();
        services.AddSingleton<IExportService, ExportService>();
        services.AddScoped<IJwtService,              JwtService>();
        services.AddScoped<IAuthService,             AuthService>();
        services.AddScoped<IUserManagementService,   UserManagementService>();
        services.AddScoped<IRoleService,             RoleService>();
        services.AddScoped<IMillService,             MillService>();
        services.AddScoped<IStockGroupService,       StockGroupService>();
        services.AddScoped<IStockCategoryService,    StockCategoryService>();
        services.AddScoped<IItemTypeService,         ItemTypeService>();
        services.AddScoped<IPaperSizeService,        PaperSizeService>();
        services.AddScoped<IMaterialService,         MaterialService>();
        services.AddScoped<ICustomerService,         CustomerService>();
        services.AddScoped<ISalesmanService,         SalesmanService>();
        services.AddScoped<IWarehouseService,        WarehouseService>();
        services.AddScoped<ITransporterService,      TransporterService>();
        services.AddScoped<IRateService,             RateService>();
        services.AddScoped<IHsnCodeService,          HsnCodeService>();
        services.AddScoped<ILocalityService,         LocalityService>();
        services.AddScoped<IInstructionService,      InstructionService>();
        services.AddScoped<ICompanyConfigService,    CompanyConfigService>();
        services.AddScoped<ISalesOrderService,       SalesOrderService>();
        services.AddScoped<IPurchaseOrderService,   PurchaseOrderService>();

        return services;
    }

    public static IServiceCollection AddJwtAuth(
        this IServiceCollection services,
        AppConfig config)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer           = true,
                    ValidateAudience         = true,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer              = config.JwtIssuer,
                    ValidAudience            = config.JwtAudience,
                    IssuerSigningKey         = new SymmetricSecurityKey(
                                                Encoding.UTF8.GetBytes(config.JwtSecret)),
                    ClockSkew                = TimeSpan.Zero
                };

                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = ctx =>
                    {
                        if (ctx.Exception is SecurityTokenExpiredException)
                            ctx.Response.Headers["Token-Expired"] = "true";
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();
        return services;
    }

    public static IServiceCollection AddCorsPolicy(
        this IServiceCollection services,
        AppConfig config)
    {
        services.AddCors(options =>
        {
            options.AddPolicy("MonitCors", policy =>
            {
                policy.WithOrigins(config.CorsOrigins)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });
        return services;
    }
}
