using System.Net;
using System.Text.Json;
using Monit.API.Common.Response;

namespace Monit.API.Common.Middleware;

public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IWebHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(ctx, ex, env.IsDevelopment());
        }
    }

    private static Task HandleExceptionAsync(HttpContext ctx, Exception ex, bool isDev)
    {
        var (statusCode, message) = ex switch
        {
            NotFoundException  _  => (HttpStatusCode.NotFound,            ex.Message),
            ForbiddenException _  => (HttpStatusCode.Forbidden,           ex.Message),
            ConflictException  _  => (HttpStatusCode.Conflict,            ex.Message),
            ValidationException v => (HttpStatusCode.BadRequest,          ex.Message),
            _                     => (HttpStatusCode.InternalServerError,  isDev ? ex.Message : "An unexpected error occurred.")
        };

        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode  = (int)statusCode;

        var response = ApiResponse<object>.Fail(message);
        if (ex is ValidationException ve)
            response.Errors = ve.Errors;

        return ctx.Response.WriteAsync(JsonSerializer.Serialize(response,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}

// ─── Custom exceptions ────────────────────────────────────────────────────────

public class NotFoundException(string message) : Exception(message);

public class ForbiddenException(string message = "Access denied") : Exception(message);

public class ConflictException(string message) : Exception(message);

public class ValidationException : Exception
{
    public List<string> Errors { get; }
    public ValidationException(List<string> errors)
        : base("Validation failed") => Errors = errors;
    public ValidationException(string error)
        : base("Validation failed") => Errors = [error];
}
