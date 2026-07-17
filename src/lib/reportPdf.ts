/**
 * Renders a DOM element to a multi-page A4 PDF with proper margins.
 * Shared by every report (and reusable anywhere else a "download PDF"
 * button is needed) so the export logic only lives in one place.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // Scale factor from canvas pixels -> PDF mm, so we can slice the tall
  // canvas into page-sized chunks instead of squashing everything onto one page.
  const pxPerMm = canvas.width / usableWidth;
  const pageHeightPx = Math.floor(usableHeight * pxPerMm);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  let renderedPx = 0;
  let pageIndex = 0;

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
    }

    const imgData = pageCanvas.toDataURL('image/png');
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, sliceHeightMm);

    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`${pageIndex + 1} / ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });

    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(`${filename}.pdf`);
}
