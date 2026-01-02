/**
 * Sözleşmeli Ödeme için PDF Makbuz/Tutanak Oluşturucu
 * Türkiye standart resmi evrak formatında
 * 
 * pdfMake kullanılarak Türkçe karakter desteği ile oluşturulur
 */

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { numberToWords, formatCurrency } from '@/lib/utils/number-to-words';

// pdfMake fontlarını ayarla
(pdfMake as any).vfs = pdfFonts;

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
  projectDetails?: Array<{projectName: string, amount: number}>; // Çoklu proje desteği
}

/**
 * İş Teslim Tutanağı ve Ödeme Makbuzu PDF'i oluşturur
 * Format: ELDEN ÖDEME TESLİM VE TAHSİL BELGESİ
 * 
 * @returns Promise<Blob> - PDF blob'u
 */
export async function generateContractPaymentPDF(data: ContractPaymentData): Promise<Blob> {
  const amountStr = formatCurrency(data.amount);
  const amountWords = numberToWords(data.amount);

  // Proje bilgilerini hazırla
  let projectText: any[];
  if (data.projectDetails && data.projectDetails.length > 0) {
    // Çoklu proje varsa her birini listele
    projectText = [];
    data.projectDetails.forEach((project, index) => {
      if (index > 0) {
        projectText.push('\n');
      }
      projectText.push({ text: `${index + 1}. ${project.projectName}: ${formatCurrency(project.amount)}`, bold: true });
    });
    projectText.push('\n\n');
    projectText.push('kapsamında gerçekleştirilen\n\n');
  } else {
    // Tek proje
    projectText = [
      { text: `"${data.projectName}"`, bold: true },
      ' kapsamında gerçekleştirilen\n\n'
    ];
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [60, 60, 60, 60],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      lineHeight: 1.3
    },
    content: [
      // TARİH (SAĞ ÜST)
      {
        text: `Tarih: ${data.date}`,
        alignment: 'right',
        fontSize: 11,
        margin: [0, 0, 0, 20]
      },

      // BAŞLIK (ORTALANMIŞ, BÜYÜK PUNTODA)
      {
        text: 'ELDEN ÖDEME TESLİM VE TAHSİL BELGESİ',
        style: 'header',
        alignment: 'center',
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 20]
      },

      // ANA METİN (PARAGRAF FORMATINDA)
      {
        text: [
          ...projectText,
          { text: `"${data.jobDescription}"`, bold: true },
          '\n\nişlerine istinaden;\n\n',
          { text: `"${data.recipientName}"`, bold: true },
          ' tarafından yapılan çalışmalar karşılığında,\n\n',
          { text: `"${data.date}"`, bold: true },
          ' tarihinde,\n\n'
        ],
        margin: [0, 0, 0, 15]
      },

      // TUTAR BİLGİSİ (VURGULU)
      {
        text: amountStr,
        fontSize: 14,
        bold: true,
        decoration: 'underline',
        margin: [0, 0, 0, 8]
      },

      // YAZYLA TUTAR
      {
        text: [
          '(yazıyla: ',
          { text: `${amountWords} Türk Lirası`, bold: true },
          ')'
        ],
        margin: [0, 0, 0, 15]
      },

      // DEVAM METNİ
      {
        text: [
          'tutarındaki ödemenin\n\n',
          { text: `"${data.paymentMethod}"`, bold: true },
          ' yoluyla eksiksiz teslim edilmiştir.\n\n'
        ],
        margin: [0, 0, 0, 15]
      },

      // BEYAN METNİ
      {
        text: 'İşi yapan kişi, yukarıda belirtilen bedeli tamamen aldığını kabul ve beyan eder.',
        italics: true,
        margin: [0, 0, 0, 30]
      },

      // İMZA ALANLARI
      {
        columns: [
          // Sol: Parayı Veren
          {
            width: '45%',
            stack: [
              { text: 'Parayı Veren', bold: true, margin: [0, 0, 0, 10] },
              { text: `"${data.companyName}"`, margin: [0, 0, 0, 10] },
              { text: 'İmza:', margin: [0, 0, 0, 5] },
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 40,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 0.5
                  }
                ]
              }
            ]
          },
          // Boşluk
          { width: '10%', text: '' },
          // Sağ: Parayı Alan
          {
            width: '45%',
            stack: [
              { text: 'Parayı Alan', bold: true, margin: [0, 0, 0, 10] },
              { text: `"${data.recipientName}"`, margin: [0, 0, 0, 10] },
              { text: 'İmza:', margin: [0, 0, 0, 5] },
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 40,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 0.5
                  }
                ]
              }
            ]
          }
        ],
        margin: [0, 20, 0, 0]
      }
    ]
  };

  // PDF oluştur ve blob olarak döndür
  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = (pdfMake as any).createPdf(docDefinition);
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * PDF'i indirir
 */
export async function downloadContractPDF(pdfBlob: Blob, filename: string) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * PDF'i yeni sekmede açar (önizleme)
 */
export async function previewContractPDF(pdfBlob: Blob) {
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

/**
 * PDF'i base64 string olarak döndürür (veritabanına kaydetmek için)
 */
export async function getContractPDFBase64(pdfBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(pdfBlob);
  });
}
