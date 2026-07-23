// generate.js - HTML'i Kindle icin PNG'ye cevirir
// GitHub Actions icinde her gece otomatik calisir

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Takvim PNG olusturuluyor...');

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--font-render-hinting=none',
    ],
  });

  const page = await browser.newPage();

  // Kindle 10. nesil ekran boyutu: 600x800
  await page.setViewport({
    width: 600,
    height: 800,
    deviceScaleFactor: 1,
  });

  // index.html'i oku ve icine enjekte et
  const htmlPath = path.resolve('./index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Sayfayi yukle
  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0',
    timeout: 15000,
  });

  // JS'in tarih/saat hesaplamalarini tamamlamasi icin bekle
  await new Promise(r => setTimeout(r, 1500));

  // Ekran goruntusu al
  await page.screenshot({
    path: './screensaver.png',
    clip: { x: 0, y: 0, width: 600, height: 800 },
    type: 'png',
    omitBackground: false,
  });

  await browser.close();

  const size = fs.statSync('./screensaver.png').size;
  console.log(`Tamamlandi: screensaver.png (${(size/1024).toFixed(1)} KB)`);
})().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
