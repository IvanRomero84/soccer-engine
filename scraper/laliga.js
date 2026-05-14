/**
 * @file laliga.js
 * Script para scrapear todos los equipos de La Liga española.
 */

import { scrapeClub } from './main.js';
import { log, sleep } from './utils.js';
import fs from 'fs/promises';
import path from 'path';

const CLUBS = [
  { "id": "81", "name": "Barça", "url": "https://www.transfermarkt.es/fc-barcelona/startseite/verein/131" },
  { "id": "86", "name": "Real Madrid", "url": "https://www.transfermarkt.es/real-madrid/startseite/verein/418" },
  { "id": "94", "name": "Villarreal", "url": "https://www.transfermarkt.es/fc-villarreal/startseite/verein/1050" },
  { "id": "78", "name": "Atleti", "url": "https://www.transfermarkt.es/atletico-madrid/startseite/verein/13" },
  { "id": "90", "name": "Real Betis", "url": "https://www.transfermarkt.es/real-betis-sevilla/startseite/verein/150" },
  { "id": "558", "name": "Celta", "url": "https://www.transfermarkt.es/celta-vigo/startseite/verein/940" },
  { "id": "82", "name": "Getafe", "url": "https://www.transfermarkt.es/fc-getafe/startseite/verein/3709" },
  { "id": "92", "name": "Real Sociedad", "url": "https://www.transfermarkt.es/real-sociedad-san-sebastian/startseite/verein/681" },
  { "id": "77", "name": "Athletic", "url": "https://www.transfermarkt.es/athletic-bilbao/startseite/verein/621" },
  { "id": "87", "name": "Rayo Vallecano", "url": "https://www.transfermarkt.es/rayo-vallecano/startseite/verein/367" },
  { "id": "559", "name": "Sevilla FC", "url": "https://www.transfermarkt.es/fc-sevilla/startseite/verein/368" },
  { "id": "79", "name": "Osasuna", "url": "https://www.transfermarkt.es/ca-osasuna/startseite/verein/331" },
  { "id": "95", "name": "Valencia", "url": "https://www.transfermarkt.es/fc-valencia/startseite/verein/1049" },
  { "id": "80", "name": "Espanyol", "url": "https://www.transfermarkt.es/espanyol-barcelona/startseite/verein/714" },
  { "id": "263", "name": "Alavés", "url": "https://www.transfermarkt.es/deportivo-alaves/startseite/verein/1108" },
  { "id": "285", "name": "Elche", "url": "https://www.transfermarkt.es/fc-elche/startseite/verein/1531" },
  { "id": "89", "name": "Mallorca", "url": "https://www.transfermarkt.es/rcd-mallorca/startseite/verein/237" },
  { "id": "88", "name": "Levante", "url": "https://www.transfermarkt.es/ud-levante/startseite/verein/3368" },
  { "id": "298", "name": "Girona", "url": "https://www.transfermarkt.es/fc-girona/startseite/verein/12321" },
  { "id": "1048", "name": "Real Oviedo", "url": "https://www.transfermarkt.es/real-oviedo/startseite/verein/2497" }
];

async function runBatch() {
  log(`Iniciando lote de scraping para La Liga (${CLUBS.length} clubes)...`, 'info');
  
  const publicDir = path.join(process.cwd(), 'public', 'data', 'clubs');
  await fs.mkdir(publicDir, { recursive: true });

  for (const club of CLUBS) {
    try {
      log(`Procesando ${club.name} (ID ${club.id})...`);
      await scrapeClub(club.url, club.id);
      
      const source = path.join(process.cwd(), 'scraper', 'data', `${club.id}.json`);
      const dest = path.join(publicDir, `${club.id}.json`);
      
      if (await fs.access(source).then(() => true).catch(() => false)) {
        await fs.rename(source, dest);
        log(`Club ${club.name} (ID ${club.id}) completado.`, 'success');
      }
      
      await sleep(3000, 6000);
    } catch (e) {
      log(`Error procesando ${club.name}: ${e.message}`, 'error');
    }
  }
  
  log('Lote de La Liga finalizado.', 'success');
}

runBatch();
