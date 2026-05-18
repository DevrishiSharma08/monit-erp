namespace Monit.API.Services.Interfaces;

public interface IExportService
{
    byte[] ToExcel(string sheetName, List<string> headers, List<List<string>> rows, string companyName, string companyAddress);
    byte[] ToPdf(string title, List<string> headers, List<List<string>> rows, string companyName, string companyAddress);
    byte[] ToWord(string title, List<string> headers, List<List<string>> rows, string companyName, string companyAddress);
}
