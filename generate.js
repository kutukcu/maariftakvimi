// generate.js — Puppeteer ile günlük dashboard PNG üretir
// Reston, VA — UTC-4 (EDT yaz) / UTC-5 (EST kış)

const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');

// ── Timezone offset hesapla ─────────────────────────────────
function getTzOffset() {
  const now = new Date();
  // ABD Eastern — yaz/kış otomatik
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return stdOffset === 300 ? -5 : -4; // EST veya EDT
}

// ── Hava durumu: wttr.in JSON ───────────────────────────────
function fetchWeather() {
  return new Promise((resolve) => {
    const url = 'https://wttr.in/Reston,VA?format=j1';
    https.get(url, { headers: { 'User-Agent': 'curl/7.68.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// wttr hava kodu → emoji
const WI = {
  113:'☀️',116:'⛅',119:'☁️',122:'☁️',143:'🌫️',
  176:'🌦️',179:'🌨️',200:'⛈️',227:'❄️',230:'❄️',
  248:'🌫️',260:'🌫️',263:'🌦️',266:'🌦️',281:'🌧️',
  293:'🌦️',296:'🌦️',299:'🌧️',302:'🌧️',305:'🌧️',
  308:'🌧️',311:'🌧️',317:'🌨️',320:'🌨️',323:'🌨️',
  326:'❄️',338:'❄️',350:'🌧️',353:'🌦️',356:'🌧️',
  359:'🌧️',362:'🌨️',365:'🌨️',368:'🌨️',371:'❄️',
  386:'⛈️',389:'⛈️',392:'⛈️',395:'❄️'
};

const GUN_KISA = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

function wiIcon(code) {
  return WI[parseInt(code)] || '🌡️';
}

(async () => {
  console.log('Dashboard PNG üretiliyor...');
  const tz = getTzOffset();
  console.log(`Timezone: UTC${tz}`);

  // Hava durumu çek
  console.log('Hava durumu alınıyor...');
  const weather = await fetchWeather();
  
  let curIcon = '🌡️', curTemp = '--', curDesc = 'N/A';
  let forecast = [];

  if (weather) {
    try {
      const cur = weather.current_condition[0];
      curTemp = Math.round(parseInt(cur.temp_C)) + '°';
      curIcon = wiIcon(cur.weatherCode);
      curDesc = cur.weatherDesc[0].value;

      // 5 günlük tahmin (yarından itibaren)
      for (let i = 1; i < weather.weather.length && i <= 5; i++) {
        const day = weather.weather[i];
        const date = new Date(day.date);
        const dow = GUN_KISA[date.getDay()];
        const maxC = Math.round(parseInt(day.maxtempC));
        const code = parseInt(day.hourly[4].weatherCode); // öğleden sonra
        forecast.push({ day: dow, icon: wiIcon(code), temp: maxC + '°' });
      }
      console.log(`Hava: ${curIcon} ${curTemp}, ${forecast.length} günlük tahmin`);
    } catch(e) {
      console.log('Hava parse hatası:', e.message);
    }
  } else {
    console.log('Hava durumu alınamadı');
  }

  // Puppeteer başlat
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800, deviceScaleFactor: 1 });

  // HTML yükle
  const html = fs.readFileSync('./index.html', 'utf8');
  
  // CONFIG'e timezone enjekte et
  const htmlWithTz = html.replace(
    'tz: -4,',
    `tz: ${tz},`
  );
  
  await page.setContent(htmlWithTz, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  // Hava durumunu DOM'a yaz
  await page.evaluate((data) => {
    // Anlık hava
    document.getElementById('cur-icon').textContent = data.curIcon;
    document.getElementById('cur-temp').textContent = data.curTemp;
    document.getElementById('cur-desc').textContent = data.curDesc;

    // Tahmin
    const wIds = ['w0','w1','w2','w3','w4'];
    data.forecast.forEach((f, i) => {
      if (i >= wIds.length) return;
      const el = document.getElementById(wIds[i]);
      if (el) {
        el.querySelector('.weather-day').textContent = f.day;
        el.querySelector('.weather-wi').textContent = f.icon;
        el.querySelector('.weather-wtemp').textContent = f.temp;
      }
    });
  }, { curIcon, curTemp, curDesc, forecast });

  // Screenshot
  await page.screenshot({ path: './screensaver.png', type: 'png' });
  await browser.close();

  const size = fs.statSync('./screensaver.png').size;
  console.log(`✓ screensaver.png (${(size/1024).toFixed(1)} KB)`);
})().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
