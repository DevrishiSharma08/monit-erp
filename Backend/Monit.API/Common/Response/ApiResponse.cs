namespace Monit.API.Common.Response;

/// <summary>
/// Standard envelope for every API response.
/// Frontend always reads: success, data, message, errors.
/// </summary>
public class ApiResponse<T>
{
    public bool    Success  { get; set; }
    public T?      Data     { get; set; }
    public string  Message  { get; set; } = string.Empty;
    public List<string> Errors { get; set; } = [];

    public static ApiResponse<T> Ok(T data, string message = "Success")
        => new() { Success = true, Data = data, Message = message };

    public static ApiResponse<T> Fail(string message, List<string>? errors = null)
        => new() { Success = false, Message = message, Errors = errors ?? [] };

    public static ApiResponse<T> Fail(List<string> errors)
        => new() { Success = false, Message = "Validation failed", Errors = errors };
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse<object> Ok(string message = "Success")
        => new() { Success = true, Message = message };
}
