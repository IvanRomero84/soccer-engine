/**
 * @file main.js
 * Orquestador del scraper de fútbol.
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { extractSquad, extractTrophies, extractClubInfo, extractPerformance, extractStadiumDetailed } from './extractors.js';
import { getRandomUA, sleep, log } from './utils.js';

async function scrapeClub(clubUrl, customFileName = null) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: getRandomUA(),
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    log(`Iniciando extracción para: ${clubUrl}`);
    
    // 1. Página principal: Plantilla e Info básica
    await page.goto(clubUrl, { waitUntil: 'networkidle' });
    
    // Cookies
    try {
      const cookieBtn = page.locator('button:has-text("Aceptar"), button:has-text("Accept")').first();
      if (await cookieBtn.isVisible()) await cookieBtn.click();
    } catch (e) { /* ignore */ }

    const mainHtml = await page.content();
    const clubInfo = extractClubInfo(mainHtml);
    const squad = extractSquad(mainHtml);
    
    // 2. Entrenador Detallado (Página de personal)
    const mitarbeiterUrl = clubUrl.replace('startseite', 'mitarbeiter');
    log(`Navegando a personal: ${mitarbeiterUrl}`);
    await page.goto(mitarbeiterUrl, { waitUntil: 'networkidle' });
    
    const browserCoach = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => 
        r.innerText.includes('Entrenador') || r.innerText.includes('Director técnico')
      );
      if (!row) return null;
      const link = row.querySelector('a[href*="/profil/trainer/"]');
      const img = row.querySelector('img');
      const ageTd = Array.from(row.querySelectorAll('td')).find(td => /\d+/.test(td.innerText) && td.innerText.length < 4);
      
      return {
        name: link ? link.innerText.trim() : '',
        photo: img ? (img.src || img.dataset.src) : '',
        age: ageTd ? ageTd.innerText.trim() : ''
      };
    });

    if (browserCoach) {
      clubInfo.coach = { ...clubInfo.coach, ...browserCoach };
      if (clubInfo.coach.photo) {
        clubInfo.coach.photo = clubInfo.coach.photo.replace('/small/', '/big/').replace('/medium/', '/big/').replace('/header/', '/big/');
      }
    }

    log(`Extraídos ${squad.length} jugadores de ${clubInfo.name}`, 'success');

    // 3. Estadio Detallado
    const stadiumUrl = clubUrl.replace('startseite', 'stadion');
    log(`Navegando a estadio: ${stadiumUrl}`);
    await page.goto(stadiumUrl, { waitUntil: 'networkidle' });
    
    const browserStadium = await page.evaluate(() => {
      const img = document.querySelector('.stadion-galerie img, .reveal img');
      const getVal = (label) => {
        const th = Array.from(document.querySelectorAll('th')).find(t => t.innerText.includes(label));
        return th ? th.parentElement.querySelector('td').innerText.trim() : '';
      };
      return {
        image: img ? img.src : '',
        yearBuilt: getVal('Año de construcción:'),
        pitchSize: getVal('Medidas del terreno de juego:'),
        surface: getVal('Superficie:'),
        address: getVal('Dirección:')
      };
    });

    clubInfo.venue = { ...clubInfo.venue, ...browserStadium };

    // 3. Página de rendimiento: Goles, asistencias, etc.
    const performanceUrl = clubUrl.replace('startseite', 'leistungsdaten') + '/plus/1';
    log(`Navegando a rendimiento: ${performanceUrl}`);
    await page.goto(performanceUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500, 2500);
    const perfHtml = await page.content();
    const perfStats = extractPerformance(perfHtml);

    // 3. Página de éxitos: Trofeos
    const trophiesUrl = clubUrl.replace('startseite', 'erfolge');
    log(`Navegando a palmarés: ${trophiesUrl}`);
    await page.goto(trophiesUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500, 2500);
    const trophiesHtml = await page.content();
    const trophies = extractTrophies(trophiesHtml);
    
    log(`Extraídos ${trophies.length} tipos de trofeos`, 'success');

    // 4. Merge data: Añadir estadísticas a los jugadores
    const squadWithStats = squad.map(player => ({
      ...player,
      stats: perfStats[player.id] || { goals: 0, assists: 0, yellowCards: 0, secondYellows: 0, redCards: 0, minutes: 0 }
    }));

    // 5. Estructurar resultado
    const result = {
      ...clubInfo,
      lastUpdated: new Date().toISOString(),
      source: clubUrl,
      squad: squadWithStats,
      trophies
    };

    // Guardar en archivo
    const fileName = customFileName ? `${customFileName}.json` : `${clubInfo.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.json`;
    const dirPath = path.join(process.cwd(), 'scraper', 'data');
    
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(path.join(dirPath, fileName), JSON.stringify(result, null, 2));
    
    log(`Datos guardados en scraper/data/${fileName}`, 'success');
    return result;

  } catch (error) {
    log(`Error scraping club: ${error.message}`, 'error');
  } finally {
    await browser.close();
  }
}

// Ejecución desde CLI
const clubUrl = process.argv[2];
if (clubUrl) {
  scrapeClub(clubUrl, process.argv[3]);
} else {
  log('Uso: node scraper/main.js <URL_CLUB_TRANSFERMARKT>', 'warn');
  log('Ejemplo: node scraper/main.js https://www.transfermarkt.es/real-madrid/startseite/verein/418');
}

export { scrapeClub };
