// Prints a PDF blob using the SAME bytes as "Download PDF" / email attachment —
// a hidden iframe loads the blob and triggers the browser's native PDF-viewer
// print dialog. Used so the 3-dot "Print" action and the View modal's Print
// button always match the downloaded PDF exactly (single page, same layout),
// instead of drifting from a separately-maintained HTML/CSS print view
// (client-reported: printed PO/SO looked different from the downloaded PDF).
export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right  = "0";
  iframe.style.bottom = "0";
  iframe.style.width  = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Some browsers block programmatic print on the embedded viewer —
      // fall back to opening the PDF so the user can print from there.
      window.open(url, "_blank");
    }
    // Keep the iframe alive long enough for the print dialog to read the
    // content before the blob URL is revoked; browsers vary on timing.
    setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(iframe);
}
