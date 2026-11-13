namespace Monit.API.Common.Helpers;

// Converts a rupee amount into the Indian-numbering-system words used on GST
// documents (e.g. 38421.00 -> "Thirty Eight Thousand Four Hundred Twenty One
// Only"). Used by DeliveryChallanPdfService for "Amount Chargeable (in
// words)" / "Tax Amount (in words)" — no equivalent existed anywhere in the
// codebase before the Delivery Challan print (client-requested, 2026-09-30).
public static class NumberToWordsHelper
{
    private static readonly string[] Ones =
    [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen",
    ];

    private static readonly string[] Tens =
    [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    // Whole-rupee amount, Indian grouping (lakh/crore), suffixed " Only".
    public static string ToRupeesInWords(decimal amount)
    {
        var rupees = (long)Math.Round(Math.Abs(amount), MidpointRounding.AwayFromZero);
        var words  = rupees == 0 ? "Zero" : ConvertIndian(rupees);
        return $"{words} Only";
    }

    private static string ConvertIndian(long n)
    {
        if (n == 0) return "Zero";

        var crore    = n / 10000000; n %= 10000000;
        var lakh     = n / 100000;   n %= 100000;
        var thousand = n / 1000;     n %= 1000;
        var hundred  = n / 100;      n %= 100;
        var rest     = n;

        var parts = new List<string>();
        if (crore    > 0) parts.Add($"{ConvertTwoDigit(crore)} Crore");
        if (lakh     > 0) parts.Add($"{ConvertTwoDigit(lakh)} Lakh");
        if (thousand > 0) parts.Add($"{ConvertTwoDigit(thousand)} Thousand");
        if (hundred  > 0) parts.Add($"{Ones[hundred]} Hundred");
        if (rest     > 0) parts.Add(ConvertTwoDigit(rest));

        return string.Join(" ", parts);
    }

    // n is always < 100 here (crore/lakh/thousand groups are each 2-digit max
    // in the Indian system once split out above).
    private static string ConvertTwoDigit(long n)
    {
        if (n < 20) return Ones[n];
        var tens = n / 10;
        var ones = n % 10;
        return ones == 0 ? Tens[tens] : $"{Tens[tens]} {Ones[ones]}";
    }
}
