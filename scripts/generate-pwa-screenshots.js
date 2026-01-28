const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '../public/screenshots');

// Desktop screenshot (1920x1080)
const svgDesktop = `
<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <text x="960" y="400" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle">Luce Mimarlık</text>
  <text x="960" y="520" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle">İş Akışı Yönetim Sistemi</text>
  <text x="960" y="640" font-family="Arial, sans-serif" font-size="40" fill="rgba(255,255,255,0.8)" text-anchor="middle">Proje ve Fatura Yönetimi</text>
</svg>`;

// Mobile screenshot (750x1334)
const svgMobile = `
<svg width="750" height="1334" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="750" height="1334" fill="url(#bg)"/>
  <rect x="75" y="200" width="600" height="934" rx="20" fill="white" opacity="0.95"/>
  <text x="375" y="600" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#1e40af" text-anchor="middle">Luce</text>
  <text x="375" y="680" font-family="Arial, sans-serif" font-size="32" fill="#475569" text-anchor="middle">İş Akışı Sistemi</text>
  <text x="375" y="760" font-family="Arial, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Proje Yönetimi</text>
  <text x="375" y="820" font-family="Arial, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Fatura Takibi</text>
  <text x="375" y="880" font-family="Arial, sans-serif" font-size="24" fill="#64748b" text-anchor="middle">Tedarikçi Yönetimi</text>
</svg>`;

async function generateScreenshots() {
  console.log('PWA screenshot\'ları oluşturuluyor...');
  
  // Screenshots dizinini oluştur
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  // Desktop screenshot (wide)
  await sharp(Buffer.from(svgDesktop))
    .resize(1920, 1080)
    .png()
    .toFile(path.join(screenshotsDir, 'desktop-1920x1080.png'));
  console.log('✓ Desktop screenshot (1920x1080) oluşturuldu');
  
  // Mobile screenshot (narrow)
  await sharp(Buffer.from(svgMobile))
    .resize(750, 1334)
    .png()
    .toFile(path.join(screenshotsDir, 'mobile-750x1334.png'));
  console.log('✓ Mobile screenshot (750x1334) oluşturuldu');
  
  console.log('\n✅ Tüm PWA screenshot\'ları başarıyla oluşturuldu!');
}

generateScreenshots().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
