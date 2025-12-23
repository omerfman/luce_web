/**
 * Sayıyı Türkçe yazıya çevirme utility
 * Örnek: 1234.56 → "Bin İki Yüz Otuz Dört Türk Lirası Elli Altı Kuruş"
 */

const birler = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const onlar = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
const yuzler = ['', 'Yüz', 'İki Yüz', 'Üç Yüz', 'Dört Yüz', 'Beş Yüz', 'Altı Yüz', 'Yedi Yüz', 'Sekiz Yüz', 'Dokuz Yüz'];

/**
 * 0-999 arası sayıyı yazıya çevirir
 */
function ucBasamak(sayi: number): string {
  if (sayi === 0) return '';
  
  const yuz = Math.floor(sayi / 100);
  const on = Math.floor((sayi % 100) / 10);
  const bir = sayi % 10;
  
  let sonuc = yuzler[yuz];
  if (sonuc) sonuc += ' ';
  
  sonuc += onlar[on];
  if (onlar[on]) sonuc += ' ';
  
  sonuc += birler[bir];
  
  return sonuc.trim();
}

/**
 * Tam sayı kısmını yazıya çevirir
 */
function tamSayiYazisi(sayi: number): string {
  if (sayi === 0) return 'Sıfır';
  
  const katrilyon = Math.floor(sayi / 1000000000000);
  const milyar = Math.floor((sayi % 1000000000000) / 1000000000);
  const milyon = Math.floor((sayi % 1000000000) / 1000000);
  const bin = Math.floor((sayi % 1000000) / 1000);
  const birler = sayi % 1000;
  
  let sonuc = '';
  
  if (katrilyon > 0) {
    const katrilyonStr = ucBasamak(katrilyon);
    sonuc += (katrilyonStr === 'Bir' ? '' : katrilyonStr + ' ') + 'Katrilyon ';
  }
  
  if (milyar > 0) {
    const milyarStr = ucBasamak(milyar);
    sonuc += (milyarStr === 'Bir' ? '' : milyarStr + ' ') + 'Milyar ';
  }
  
  if (milyon > 0) {
    const milyonStr = ucBasamak(milyon);
    sonuc += (milyonStr === 'Bir' ? '' : milyonStr + ' ') + 'Milyon ';
  }
  
  if (bin > 0) {
    const binStr = ucBasamak(bin);
    sonuc += (binStr === 'Bir' ? '' : binStr + ' ') + 'Bin ';
  }
  
  if (birler > 0) {
    sonuc += ucBasamak(birler);
  }
  
  return sonuc.trim();
}

/**
 * Para değerini Türkçe yazıya çevirir
 * @param tutar - Para miktarı (örn: 1234.56)
 * @param paraBirimi - Para birimi (varsayılan: "TL")
 * @returns Yazıyla tutar (örn: "Bin İki Yüz Otuz Dört Türk Lirası Elli Altı Kuruş")
 */
export function numberToWords(tutar: number, paraBirimi: string = 'TL'): string {
  if (tutar === 0) return 'Sıfır Türk Lirası';
  if (isNaN(tutar) || tutar < 0) return '';
  
  // Tam ve ondalık kısmı ayır
  const tamKisim = Math.floor(tutar);
  const ondalikKisim = Math.round((tutar - tamKisim) * 100);
  
  let sonuc = tamSayiYazisi(tamKisim);
  
  // Para birimi ekle
  if (paraBirimi === 'TL' || paraBirimi === '₺') {
    sonuc += ' Türk Lirası';
    
    // Kuruş varsa ekle
    if (ondalikKisim > 0) {
      sonuc += ' ' + tamSayiYazisi(ondalikKisim) + ' Kuruş';
    }
  } else if (paraBirimi === 'USD' || paraBirimi === '$') {
    sonuc += ' Dolar';
    if (ondalikKisim > 0) {
      sonuc += ' ' + tamSayiYazisi(ondalikKisim) + ' Sent';
    }
  } else if (paraBirimi === 'EUR' || paraBirimi === '€') {
    sonuc += ' Euro';
    if (ondalikKisim > 0) {
      sonuc += ' ' + tamSayiYazisi(ondalikKisim) + ' Sent';
    }
  } else {
    sonuc += ' ' + paraBirimi;
  }
  
  return sonuc;
}

/**
 * Para formatında gösterir
 * @param tutar - Para miktarı
 * @param paraBirimi - Para birimi sembolü
 * @returns Formatlanmış string (örn: "1.234,56 ₺")
 */
export function formatCurrency(tutar: number, paraBirimi: string = '₺'): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(tutar) + ' ' + paraBirimi;
}
