using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.OpenApi.Models;
using Monit.API.Common.Helpers;
using Monit.API.Common.Middleware;
using Monit.API.Data;
using Serilog;

// ─── Dapper type handlers ─────────────────────────────────────────────────────
SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());

// ─── Build configuration ──────────────────────────────────────────────────────
var builder = WebApplication.CreateBuilder(args);

// ─── Serilog ─────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration));

// ─── AppConfig (single config access point) ───────────────────────────────────
// Reads from appsettings + environment variable overrides.
// Throws on startup if required config is missing — no silent fallback.
var appConfig = new AppConfig(builder.Configuration);

// ─── Services ─────────────────────────────────────────────────────────────────
builder.Services
    .AddAppServices(appConfig)
    .AddJwtAuth(appConfig)
    .AddCorsPolicy(appConfig);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ─── Swagger with JWT support ─────────────────────────────────────────────────
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Monit Paper Agency ERP API",
        Version = "v1"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Enter: Bearer {your token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                    { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ─── Build ────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ─── Middleware pipeline ──────────────────────────────────────────────────────
app.UseMiddleware<ExceptionMiddleware>();    // global error handler — always first
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Monit ERP v1"));
}

app.UseHttpsRedirection();
app.UseCors("MonitCors");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ─── Ensure notification schema exists in all company DBs ────────────────────
await EnsureNotificationSchemaAsync(appConfig);

app.Run();

static async Task EnsureNotificationSchemaAsync(AppConfig config)
{
    const string sql = @"
        IF NOT EXISTS (
            SELECT 1 FROM sys.objects
            WHERE object_id = OBJECT_ID(N'system.NotificationState') AND type = 'U'
        )
        BEGIN
            CREATE TABLE system.NotificationState (
                Id          INT IDENTITY(1,1) PRIMARY KEY,
                UserId      INT          NOT NULL,
                NotifKey    NVARCHAR(50) NOT NULL,
                IsRead      BIT          NOT NULL DEFAULT 0,
                IsDismissed BIT          NOT NULL DEFAULT 0,
                UpdatedAt   DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
                CONSTRAINT UQ_NotifState UNIQUE (UserId, NotifKey)
            );
        END";

    foreach (var connStr in new[] { config.Company1ConnectionString, config.Company2ConnectionString })
    {
        try
        {
            await using var conn = new SqlConnection(connStr);
            await conn.OpenAsync();
            await conn.ExecuteAsync(sql);
        }
        catch (Exception ex)
        {
            Log.Warning("Could not ensure NotificationState schema on one company DB: {Message}", ex.Message);
        }
    }
}
