import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './client';

interface ProjectInvoice {
  invoice_number: string;
  invoice_date: string;
  amount: number;
  file_path: string;
  project_names: string; // Changed to single string with comma-separated names
  description?: string;
  company_name: string;
  payments?: Array<{payment_type: string, amount: number}>;
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
    
    // Embed Helvetica font (supports more characters than default)
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);

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

      // Add each page and overlay project name at the bottom
      for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { width } = page.getSize();

        // Replace Turkish characters to avoid encoding issues
        const sanitizeText = (text: string) => {
          return text
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'I')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'U')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 'S')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'O')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'C');
        };

        // Prepare project text with company note format
        const projectText = sanitizeText(`${invoice.company_name} notu: ${invoice.project_names}`);
        
        // Calculate payment status
        const totalPaid = invoice.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const remaining = Number(invoice.amount) - totalPaid;
        let paymentStatus = '';
        let paymentDetails = '';
        
        if (totalPaid === 0) {
          paymentStatus = 'Odeme Durumu: Odenmedi';
        } else if (remaining <= 0.01) {
          paymentStatus = 'Odeme Durumu: Odendi';
          if (invoice.payments && invoice.payments.length > 0) {
            paymentDetails = 'Odeme: ' + invoice.payments.map(p => `${sanitizeText(p.payment_type)}`).join(', ');
          }
        } else {
          paymentStatus = `Odeme Durumu: Kismi (Odenen: ${totalPaid.toFixed(2)} TL, Kalan: ${remaining.toFixed(2)} TL)`;
          if (invoice.payments && invoice.payments.length > 0) {
            paymentDetails = 'Odeme: ' + invoice.payments.map(p => `${sanitizeText(p.payment_type)}`).join(', ');
          }
        }
        
        // Prepare description text and calculate height needed
        let descriptionLines: string[] = [];
        let boxHeight = 25;
        
        if (invoice.description && i === 0) {
          const descPrefix = 'Aciklama: ';
          const descContent = sanitizeText(invoice.description);
          const fullDescText = descPrefix + descContent;
          
          // Calculate max characters per line (roughly)
          const maxCharsPerLine = Math.floor((width - 30) / 3.5); // Approximate chars for font size 7
          
          // Split text into lines
          const words = fullDescText.split(' ');
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) descriptionLines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) descriptionLines.push(currentLine);
          
          // Limit to 2 lines max
          if (descriptionLines.length > 2) {
            descriptionLines = descriptionLines.slice(0, 2);
            descriptionLines[1] = descriptionLines[1].substring(0, maxCharsPerLine - 3) + '...';
          }
          
          // Adjust box height based on number of lines
          boxHeight = 25 + (descriptionLines.length * 10);
        }
        
        // Add payment status and details to lines if on first page
        if (i === 0 && paymentStatus) {
          descriptionLines.push(paymentStatus);
          if (paymentDetails) {
            descriptionLines.push(paymentDetails);
          }
          boxHeight = 25 + (descriptionLines.length * 10);
        }

        // Add project info at the bottom of each page
        // Add white background rectangle for better readability (reduced opacity)
        page.drawRectangle({
          x: 0,
          y: 0,
          width: width,
          height: boxHeight + 10,
          color: rgb(1, 1, 1),
          opacity: 0.7, // Reduced from 0.95 to 0.7
        });

        // Add border
        page.drawRectangle({
          x: 10,
          y: 5,
          width: width - 20,
          height: boxHeight,
          borderColor: rgb(0.2, 0.4, 0.8),
          borderWidth: 1,
        });

        // Add project name text (smaller font, no "PROJE:" prefix)
        page.drawText(projectText, {
          x: 15,
          y: boxHeight - 5,
          size: 9,
          font: font,
          color: rgb(0.1, 0.2, 0.6),
        });

        // Add description lines if available
        if (descriptionLines.length > 0) {
          descriptionLines.forEach((line, lineIndex) => {
            page.drawText(line, {
              x: 15,
              y: boxHeight - 15 - (lineIndex * 10),
              size: 7,
              font: font,
              color: rgb(0.3, 0.3, 0.3),
            });
          });
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
