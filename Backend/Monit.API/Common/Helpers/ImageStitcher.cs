using SkiaSharp;

namespace Monit.API.Common.Helpers;

/// <summary>
/// Stacks multiple page images (as produced by QuestPDF's
/// IDocument.GenerateImages(), one PNG per physical page) vertically into a
/// single JPG — so a multi-page SO/PO still shares as ONE image a user can
/// open with a single tap (client-requested: share to WhatsApp without a
/// PDF viewer, instead of a separate file per page).
/// </summary>
public static class ImageStitcher
{
    public static byte[] StackVerticallyAsJpg(IEnumerable<byte[]> pngPages, int quality = 92)
    {
        var bitmaps = pngPages.Select(SKBitmap.Decode).ToList();
        if (bitmaps.Count == 0)
            throw new InvalidOperationException("No pages to stitch into an image.");

        try
        {
            var width  = bitmaps.Max(b => b.Width);
            var height = bitmaps.Sum(b => b.Height);

            using var combined = new SKBitmap(width, height);
            using (var canvas = new SKCanvas(combined))
            {
                canvas.Clear(SKColors.White);
                var y = 0;
                foreach (var bmp in bitmaps)
                {
                    canvas.DrawBitmap(bmp, 0, y);
                    y += bmp.Height;
                }
            }

            using var image = SKImage.FromBitmap(combined);
            using var data  = image.Encode(SKEncodedImageFormat.Jpeg, quality);
            return data.ToArray();
        }
        finally
        {
            foreach (var bmp in bitmaps) bmp.Dispose();
        }
    }
}
