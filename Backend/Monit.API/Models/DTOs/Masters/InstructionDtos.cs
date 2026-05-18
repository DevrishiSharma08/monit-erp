using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class InstructionListDto
{
    public int          Id           { get; set; }
    public string?      Title        { get; set; }
    public string       ApplicableTo { get; set; } = "All";
    public List<int>    MillIds      { get; set; } = [];
    public List<string> Lines        { get; set; } = [];
    public bool         IsActive     { get; set; }
    public DateTime     CreatedAt    { get; set; }
}

public class InstructionDetailDto : InstructionListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateInstructionDto
{
    public string?      Title        { get; set; }
    public string       ApplicableTo { get; set; } = "All";
    public List<int>    MillIds      { get; set; } = [];
    public List<string> Lines        { get; set; } = [];
}

public class UpdateInstructionDto : CreateInstructionDto
{
    public bool IsActive { get; set; } = true;
}

public class InstructionFilterRequest : FilterRequest { }

public class InstructionDropdownDto
{
    public int          Id           { get; set; }
    public string?      Title        { get; set; }
    public string       ApplicableTo { get; set; } = "All";
    public List<int>    MillIds      { get; set; } = [];
    public List<string> Lines        { get; set; } = [];
}
