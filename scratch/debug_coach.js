import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  try {
    await page.goto('https://www.transfermarkt.es/real-madrid/mitarbeiter/verein/418', { waitUntil: 'networkidle' });
    const coachRow = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => r.innerText.includes('Entrenador') || r.innerText.includes('Director técnico'));
      if (!row) return 'NOT FOUND';
      const link = row.querySelector('a[href*="/profil/trainer/"]');
      const img = row.querySelector('img');
      return {
        name: link ? link.innerText.trim() : 'NO LINK',
        photo: img ? img.src : 'NO IMG'
      };
    });
    console.log('RESULT:' + JSON.stringify(coachRow));
  } catch (e) {
    console.log('ERROR:' + e.message);
  }
  await browser.close();
})();
