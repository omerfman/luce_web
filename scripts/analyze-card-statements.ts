/**
 * Kredi Kartı Ekstrelerini Analiz Et
 * 
 * Bu script ekstreler klasöründeki Excel dosyalarını okuyup
 * yapılarını analiz eder ve sonucu gösterir
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface ColumnInfo {
  col: number;
  header: string;
  sampleValues: string[];
}

interface FileAnalysis {
  fileName: string;
  sheetCount: number;
  sheets: {
    name: string;
    rowCount: number;
    columnCount: number;
    firstDataRow: number;
    columns: ColumnInfo[];
  }[];
}

async function analyzeExcelFile(filePath: string): Promise<FileAnalysis> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const analysis: FileAnalysis = {
    fileName: path.basename(filePath),
    sheetCount: workbook.worksheets.length,
    sheets: []
  };
  
  for (const worksheet of workbook.worksheets) {
    // İlk data satırını bul (boş olmayan satırları tarıyoruz)
    let firstDataRow = 1;
    let headerRow: ExcelJS.Row | null = null;
    
    // İlk 20 satırı tara ve header satırını bul
    for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const values = row.values as any[];
      
      // Values array'i parse et - her değeri string'e çevir
      const stringValues: string[] = [];
      for (let i = 1; i < values.length; i++) {
        const val = values[i];
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && 'richText' in val) {
            stringValues.push((val as any).richText.map((rt: any) => rt.text).join(''));
          } else if (typeof val === 'object' && 'text' in val) {
            stringValues.push((val as any).text);
          } else {
            stringValues.push(String(val));
          }
        } else {
          stringValues.push('');
        }
      }
      
      // Bu satırda "İşlem" kelimesi geçiyor mu? (Header satırı olabilir)
      const hasIslem = stringValues.some(v => v.toLowerCase().includes('işlem'));
      const hasTutar = stringValues.some(v => v.toLowerCase().includes('tutar'));
      
      if (hasIslem || hasTutar) {
        headerRow = row;
        firstDataRow = rowNum;
        break;
      }
    }
    
    const columns: ColumnInfo[] = [];
    
    if (headerRow) {
      const headerValues = headerRow.values as any[];
      
      // Header satırındaki sütunları analiz et
      headerValues.forEach((headerValue, colIndex) => {
        if (colIndex === 0) return; // Excel'de 0. index boş oluyor
        
        if (headerValue && String(headerValue).trim() !== '') {
          const sampleValues: string[] = [];
          
          // Bu sütundan 5 örnek değer al
          for (let i = firstDataRow + 1; i <= Math.min(firstDataRow + 6, worksheet.rowCount); i++) {
            const row = worksheet.getRow(i);
            const cellValue = row.getCell(colIndex).value;
            if (cellValue !== null && cellValue !== undefined) {
              // Eğer Rich Text ise text property'sini al
              if (typeof cellValue === 'object' && 'richText' in cellValue) {
                const richText = (cellValue as any).richText;
                sampleValues.push(richText.map((rt: any) => rt.text).join(''));
              } else if (typeof cellValue === 'object' && 'text' in cellValue) {
                sampleValues.push((cellValue as any).text);
              } else {
                sampleValues.push(String(cellValue));
              }
            }
          }
          
          // Header value'yu da düzgün parse et
          let headerText = '';
          if (typeof headerValue === 'object' && 'richText' in headerValue) {
            const richText = (headerValue as any).richText;
            headerText = richText.map((rt: any) => rt.text).join('');
          } else if (typeof headerValue === 'object' && 'text' in headerValue) {
            headerText = (headerValue as any).text;
          } else {
            headerText = String(headerValue);
          }
          
          columns.push({
            col: colIndex,
            header: headerText.trim(),
            sampleValues
          });
        }
      });
    }
    
    analysis.sheets.push({
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      firstDataRow,
      columns
    });
  }
  
  return analysis;
}

async function main() {
  const ekstrelerPath = path.join(__dirname, '..', 'ekstreler');
  
  console.log('📊 Kredi Kartı Ekstreleri Analizi\n');
  console.log('=' .repeat(80));
  console.log();
  
  const files = fs.readdirSync(ekstrelerPath)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  console.log(`Toplam ${files.length} Excel dosyası bulundu.\n`);
  
  // Farklı bankalardan örnekler seç
  const denizbankFile = files.find(f => f.includes('DENİZBANK') || f.includes('DENIZBANK'));
  const garantiFile = files.find(f => f.includes('GARANTİ') || f.includes('GARANTI'));
  const ykbFile = files.find(f => f.includes('YKB'));
  const msFile = files.find(f => f.includes('M&S') || f.includes('PLATINUM'));
  
  const filesToAnalyze = [denizbankFile, garantiFile, ykbFile, msFile].filter(Boolean) as string[];
  
  for (const file of filesToAnalyze) {
    const filePath = path.join(ekstrelerPath, file);
    console.log(`\n📄 Dosya: ${file}`);
    console.log('-'.repeat(80));
    
    try {
      const analysis = await analyzeExcelFile(filePath);
      
      console.log(`   Sayfa Sayısı: ${analysis.sheetCount}`);
      
      for (const sheet of analysis.sheets) {
        console.log(`\n   📊 Sayfa: ${sheet.name}`);
        console.log(`      Satır Sayısı: ${sheet.rowCount}`);
        console.log(`      İlk Veri Satırı: ${sheet.firstDataRow}`);
        console.log(`      Sütunlar:`);
        
        for (const col of sheet.columns) {
          console.log(`         [${col.col}] ${col.header}`);
          if (col.sampleValues.length > 0) {
            console.log(`             Örnek: ${col.sampleValues[0]}`);
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Hata: ${error}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Analiz tamamlandı!');
}

main().catch(console.error);
