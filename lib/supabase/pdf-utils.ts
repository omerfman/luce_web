import { PDFDocument, rgb } from 'pdf-lib';
import { supabase } from './client';

interface ProjectInvoice {
  invoice_number: string;
  invoice_date: string;
  amount: number;
  file_path: string;
  project_name: string;
}

/**
 * Generate a combined PDF with project names added to each invoice
 */
export async function generateProjectInvoicesReport(
  projectInvoices: ProjectInvoice[]
): Promise<Blob | null> {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    for (const invoice of projectInvoices) {
      // Get signed URL for the invoice PDF
      const { data: urlData, error: urlError } = await supabase.storage
        .from('invoices')
        .createSignedUrl(invoice.file_path, 3600);

      if (urlError || !urlData) {
        console.error('Error getting signed URL:', urlError);
        continue;
      }

      // Fetch the PDF
      const response = await fetch(urlData.signedUrl);
      const pdfBytes = await response.arrayBuffer();

      // Load the existing PDF
      const existingPdf = await PDFDocument.load(pdfBytes);

      // Copy all pages from the existing PDF
      const copiedPages = await mergedPdf.copyPages(
        existingPdf,
        existingPdf.getPageIndices()
      );

      // Add each page and overlay project name
      for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { width, height } = page.getSize();

        // Add project name at the top of the first page
        if (i === 0) {
          // Add white background rectangle for better readability
          page.drawRectangle({
            x: 0,
            y: height - 60,
            width: width,
            height: 60,
            color: rgb(1, 1, 1),
            opacity: 0.95,
          });

          // Add border
          page.drawRectangle({
            x: 10,
            y: height - 55,
            width: width - 20,
            height: 50,
            borderColor: rgb(0.2, 0.4, 0.8),
            borderWidth: 2,
          });

          // Add project name text
          page.drawText(`PROJE: ${invoice.project_name}`, {
            x: 20,
            y: height - 30,
            size: 18,
            color: rgb(0.1, 0.2, 0.6),
          });

          // Add invoice info
          page.drawText(
            `Fatura No: ${invoice.invoice_number} | Tarih: ${invoice.invoice_date}`,
            {
              x: 20,
              y: height - 45,
              size: 10,
              color: rgb(0.3, 0.3, 0.3),
            }
          );
        }

        mergedPdf.addPage(page);
      }
    }

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    return null;
  }
}

/**
 * Download the generated PDF
 */
export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
