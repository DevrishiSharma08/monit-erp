using Dapper;
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

app.Run();
