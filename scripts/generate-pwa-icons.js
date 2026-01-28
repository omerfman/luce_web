const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');

// Basit bir SVG logo oluştur (Luce için mavi gradient)
const svgLogo = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#grad)"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="180" font-weight="bold" fill="white" text-anchor="middle">L</text>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('PWA ikonları oluşturuluyor...');
  
  // Icons dizinini temizle
  if (fs.existsSync(iconsDir)) {
    fs.readdirSync(iconsDir).forEach(file => {
      fs.unlinkSync(path.join(iconsDir, file));
    });
  } else {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // Her boyut için ikon oluştur
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svgLogo))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ ${size}x${size} ikon oluşturuldu`);
  }
  
  // Maskable ikonlar (safe area ile)
  const svgMaskable = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#grad)"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="white" text-anchor="middle">L</text>
</svg>`;
  
  await sharp(Buffer.from(svgMaskable))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192x192.png'));
  console.log('✓ 192x192 maskable ikon oluşturuldu');
  
  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512x512.png'));
  console.log('✓ 512x512 maskable ikon oluşturuldu');
  
  console.log('\n✅ Tüm PWA ikonları başarıyla oluşturuldu!');
}

generateIcons().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
