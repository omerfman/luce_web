/**
 * Sözleşmeli Ödeme için PDF Makbuz/Tutanak Oluşturucu
 * Türkiye standart resmi evrak formatında
 */

import jsPDF from 'jspdf';
import { numberToWords, formatCurrency } from '@/lib/utils/number-to-words';

export interface ContractPaymentData {
  receiptNumber: string;
  date: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  recipientName: string;
  recipientId?: string; // TC Kimlik No veya VKN
  jobDescription: string;
  projectName: string;
  amount: number;
  paymentMethod: string;
  createdBy?: string;
}

/**
 * İş Teslim Tutanağı ve Ödeme Makbuzu PDF'i oluşturur
 * Format: ELDEN ÖDEME TESLİM VE TAHSİL BELGESİ
 */
export function generateContractPaymentPDF(data: ContractPaymentData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const contentWidth = pageWidth - (margin * 2);

  // Helvetica fontunu kullan
  doc.setFont('helvetica', 'normal');

  let yPos = margin;

  // ===================================
  // TARİH (SAĞ ÜST)
  // ===================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const dateText = `Tarih: ${data.date}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, pageWidth - margin - dateWidth, yPos);
  
  yPos += 15;

  // ===================================
  // BAŞLIK (ORTALANMIŞ, BÜYÜK PUNTODA)
  // ===================================
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title = 'ELDEN ODEME TESLIM VE TAHSIL BELGESI';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  
  yPos += 15;

  // ===================================
  // ANA METİN (PARAGRAF FORMATINDA)
  // ===================================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Satır yüksekliği
  const lineHeight = 7;
  
  // Giriş metni
  doc.text('Bu belge,', margin, yPos);
  yPos += lineHeight;
  
  // Proje adı (tırnak içinde, kalın)
  doc.setFont('helvetica', 'bold');
  const projectLine = `"${data.projectName}"`;
  doc.text(projectLine, margin, yPos);
  doc.setFont('helvetica', 'normal');
  const projectLineWidth = doc.getTextWidth(projectLine);
  doc.text(' kapsaminda gerceklestirilen', margin + projectLineWidth, yPos);
  yPos += lineHeight;
  
  // İş açıklaması (tırnak içinde, kalın)
  doc.setFont('helvetica', 'bold');
  const jobLine = `"${data.jobDescription}"`;
  const jobLines = doc.splitTextToSize(jobLine, contentWidth - 5);
  doc.text(jobLines, margin, yPos);
  yPos += jobLines.length * lineHeight;
  
  doc.setFont('helvetica', 'normal');
  doc.text('islerine istinaden;', margin, yPos);
  yPos += lineHeight + 3;
  
  // İşi yapan kişi (tırnak içinde, kalın)
  doc.setFont('helvetica', 'bold');
  const recipientLine = `"${data.recipientName}"`;
  doc.text(recipientLine, margin, yPos);
  doc.setFont('helvetica', 'normal');
  const recipientLineWidth = doc.getTextWidth(recipientLine);
  doc.text(' tarafindan yapilan', margin + recipientLineWidth, yPos);
  yPos += lineHeight;
  
  doc.text('calismalar karsiliginda,', margin, yPos);
  yPos += lineHeight;
  
  // Tarih (tırnak içinde, kalın)
  doc.setFont('helvetica', 'bold');
  const dateInText = `"${data.date}"`;
  doc.text(dateInText, margin, yPos);
  doc.setFont('helvetica', 'normal');
  const dateInTextWidth = doc.getTextWidth(dateInText);
  doc.text(' tarihinde,', margin + dateInTextWidth, yPos);
  yPos += lineHeight + 5;
  
  // ===================================
  // TUTAR BİLGİSİ (ALT ÇIZGILI)
  // ===================================
  const amountStr = formatCurrency(data.amount);
  const amountWords = numberToWords(data.amount);
  
  // Tutar satırı
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const amountLine = `${amountStr}`;
  doc.text(amountLine, margin, yPos);
  const amountLineWidth = doc.getTextWidth(amountLine);
  
  // Alt çizgi
  doc.setLineWidth(0.3);
  doc.line(margin, yPos + 1, margin + amountLineWidth + 10, yPos + 1);
  
  yPos += lineHeight;
  
  // Yazıyla
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('(yaziyla: ', margin, yPos);
  doc.setFont('helvetica', 'bold');
  const yaziyla = `${amountWords} Turk Lirasi`;
  const yazilyaWidth = doc.getTextWidth('(yaziyla: ');
  doc.text(yaziyla, margin + yazilyaWidth, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(')', margin + yazilyaWidth + doc.getTextWidth(yaziyla), yPos);
  
  yPos += lineHeight + 3;
  
  // Devam metni
  doc.text('tutarindaki odemenin', margin, yPos);
  yPos += lineHeight;
  
  // Ödeme tipi (tırnak içinde, kalın)
  doc.setFont('helvetica', 'bold');
  const paymentMethodLine = `"${data.paymentMethod}"`;
  doc.text(paymentMethodLine, margin, yPos);
  doc.setFont('helvetica', 'normal');
  const paymentMethodLineWidth = doc.getTextWidth(paymentMethodLine);
  doc.text(' yoluyla eksiksiz teslim alindigini gosterir.', margin + paymentMethodLineWidth, yPos);
  yPos += lineHeight + 8;
  
  // Beyan metni
  doc.setFont('helvetica', 'italic');
  doc.text('Isi yapan kisi, yukarida belirtilen bedeli tamamen aldigini kabul ve beyan eder.', margin, yPos);
  doc.setFont('helvetica', 'normal');
  
  yPos += lineHeight + 15;

  // ===================================
  // İMZA ALANLARI (YAN YANA)
  // ===================================
  const signatureY = yPos;
  const signatureBoxWidth = (contentWidth - 15) / 2;

  // Sol: Parayı Veren
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Parayi Veren', margin, signatureY);
  yPos = signatureY + 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`"${data.companyName}"`, margin, yPos);
  yPos += 6;
  
  doc.text('Imza:', margin, yPos);
  yPos += 3;
  
  // İmza çizgisi
  doc.setLineWidth(0.2);
  doc.line(margin + 15, yPos, margin + signatureBoxWidth - 5, yPos);

  // Sağ: Parayı Alan
  const rightSignX = pageWidth - margin - signatureBoxWidth;
  yPos = signatureY;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Parayi Alan', rightSignX, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`"${data.recipientName}"`, rightSignX, yPos);
  yPos += 6;
  
  doc.text('Imza:', rightSignX, yPos);
  yPos += 3;
  
  // İmza çizgisi
  doc.line(rightSignX + 15, yPos, pageWidth - margin - 5, yPos);

  return doc;
}

/**
 * PDF'i indirir
 */
export function downloadContractPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

/**
 * PDF'i yeni sekmede açar (önizleme)
 */
export function previewContractPDF(doc: jsPDF) {
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

/**
 * PDF'i base64 string olarak döndürür (veritabanına kaydetmek için)
 */
export function getContractPDFBase64(doc: jsPDF): string {
  return doc.output('dataurlstring');
}
