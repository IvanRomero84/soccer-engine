/**
 * @file batch.js
 * Script para scrapear múltiples clubes de una vez.
 */

import { scrapeClub } from './main.js';
import { log, sleep } from './utils.js';
import fs from 'fs/promises';
import path from 'path';

const CLUBS = [
  { id: 86, url: 'https://www.transfermarkt.es/real-madrid/startseite/verein/418' },
  { id: 81, url: 'https://www.transfermarkt.es/fc-barcelona/startseite/verein/131' },
  { id: 78, url: 'https://www.transfermarkt.es/atletico-de-madrid/startseite/verein/13' },
  { id: 65, url: 'https://www.transfermarkt.es/manchester-city/startseite/verein/281' },
  { id: 57, url: 'https://www.transfermarkt.es/fc-arsenal/startseite/verein/11' },
  { id: 64, url: 'https://www.transfermarkt.es/fc-liverpool/startseite/verein/31' },
  { id: 5, url: 'https://www.transfermarkt.es/fc-bayern-munchen/startseite/verein/27' },
  { id: 524, url: 'https://www.transfermarkt.es/paris-saint-germain/startseite/verein/583' },
  { id: 108, url: 'https://www.transfermarkt.es/inter-de-milan/startseite/verein/46' },
  { id: 109, url: 'https://www.transfermarkt.es/juventus-de-turin/startseite/verein/506' },
  { id: 98, url: 'https://www.transfermarkt.es/ac-milan/startseite/verein/5' },
];

async function runBatch() {
  log(`Iniciando lote de scraping para ${CLUBS.length} clubes...`, 'info');
  
  const publicDir = path.join(process.cwd(), 'public', 'data', 'clubs');
  await fs.mkdir(publicDir, { recursive: true });

  for (const club of CLUBS) {
    try {
      log(`Procesando Club ID ${club.id}...`);
      await scrapeClub(club.url, club.id);
      
      // Mover el archivo generado a la carpeta public si no se guardó allí directamente
      // (En nuestro main.js actual se guarda en scraper/data, vamos a moverlo)
      const source = path.join(process.cwd(), 'scraper', 'data', `${club.id}.json`);
      const dest = path.join(publicDir, `${club.id}.json`);
      
      await fs.rename(source, dest);
      log(`Club ${club.id} completado y movido a public/data/clubs/`, 'success');
      
      // Esperar un poco entre clubes para ser amigables con el servidor
      await sleep(3000, 6000);
    } catch (e) {
      log(`Error procesando club ${club.id}: ${e.message}`, 'error');
    }
  }
  
  log('Lote de scraping finalizado.', 'success');
}

runBatch();
