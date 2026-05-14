import { Context, Config } from '@netlify/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const config: Config = {
  path: "/api/*"
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://www.google.com/'
};

const COMPETITIONS = {
  'PD': { name: 'La Liga', url: 'https://www.transfermarkt.es/laliga/startseite/wettbewerb/ES1' },
  'PL': { name: 'Premier League', url: 'https://www.transfermarkt.es/premier-league/startseite/wettbewerb/GB1' },
  'WC': { name: 'Copa del Mundo', url: 'https://www.transfermarkt.es/weltmeisterschaft-2022/startseite/pokalwettbewerb/WM22' }
};

async function fetchWithRetry(url: string, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, { headers: HEADERS, timeout: 10000 });
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1500 * (i + 1)));
    }
  }
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  let type = url.searchParams.get('type');
  let id = url.searchParams.get('id');

  // Si no hay type/id en query params, intentar extraerlos del path (especialmente para redirects de Netlify)
  // El path vendrá como /.netlify/functions/scraper/football/competitions/PD/standings si usamos path forwarding
  // O el type tendrá el valor del splat: football/competitions/PD/standings
  
  if (type && type.includes('/')) {
    const parts = type.split('/');
    // Manejar formato football-data.org: football/competitions/{id}/standings
    if (parts.includes('competitions')) {
      const compIdx = parts.indexOf('competitions');
      id = parts[compIdx + 1];
      type = 'competition';
    } else if (parts.includes('teams')) {
       const teamIdx = parts.indexOf('teams');
       id = parts[teamIdx + 1];
       type = 'club';
    }
  }

  // Fallback: buscar en el path directo si no vino como param
  if (!id) {
    const parts = url.pathname.split('/');
    if (parts.includes('competitions')) {
      const idx = parts.indexOf('competitions');
      id = parts[idx + 1];
      type = 'competition';
    } else if (parts.includes('teams')) {
      const idx = parts.indexOf('teams');
      id = parts[idx + 1];
      type = 'club';
    }
  }

  if (!type || !id) {
    return new Response(JSON.stringify({ 
      error: 'Missing type or id',
      debug: { type, id, pathname: url.pathname, search: url.search }
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    if (type === 'club' || type === 'team') {
      return await handleClubScrape(id);
    } else if (type === 'competition' || type === 'league') {
      // Si la URL termina en /matches, el store espera fixtures. El scraper aún no tiene scraping de matches.
      if (url.pathname.endsWith('/matches') || (url.searchParams.get('type') || '').includes('/matches')) {
        return new Response(JSON.stringify({ matches: [] }), { 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return await handleCompetitionScrape(id);
    }
    
    // Si es /matches global
    if (type === 'matches' || (url.searchParams.get('type') || '').includes('/matches')) {
      return new Response(JSON.stringify({ matches: [] }), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: `Endpoint not fully implemented in scraper: ${type}` }), { 
      status: 200, // Devolvemos 200 con error para evitar crashes si el store no maneja bien errores
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

async function handleClubScrape(id: string) {
  const baseUrl = `https://www.transfermarkt.es/real-madrid/startseite/verein/${id}`;
  const mitarbeiterUrl = baseUrl.replace('startseite', 'mitarbeiter');
  const stadionUrl = baseUrl.replace('startseite', 'stadion');

  // Intentar obtener datos básicos primero. Si falla, fallamos todo.
  const homeRes = await fetchWithRetry(baseUrl);
  const $ = cheerio.load(homeRes?.data);

  // Intentar obtener staff y estadio en paralelo (menos críticos)
  let staffData = '';
  let stadiumData = '';
  try {
    const [sRes, stRes] = await Promise.allSettled([
      fetchWithRetry(mitarbeiterUrl),
      fetchWithRetry(stadionUrl)
    ]);
    if (sRes.status === 'fulfilled') staffData = sRes.value?.data;
    if (stRes.status === 'fulfilled') stadiumData = stRes.value?.data;
  } catch (e) {
    console.warn('Optional pages failed');
  }

  const $staff = cheerio.load(staffData);
  const $stadium = cheerio.load(stadiumData);

  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ');
  const logo = $('header.data-header img.data-header__profile-image').attr('src');

  // Coach
  const $coachRow = $staff('tr:has(td:contains("Entrenador"))').first();
  const coach = $coachRow.length > 0 ? {
    name: $coachRow.find('a[href*="/profil/trainer/"]').first().text().trim(),
    photo: $coachRow.find('img').first().attr('src')?.replace('/small/', '/big/'),
    age: $staff($coachRow.find('td').get(2)).text().trim() || ''
  } : { name: 'No disponible', photo: '', age: '' };

  // Stadium
  const venue = {
    name: $stadium('.stadion-profil-head-grafik img').attr('alt') || '',
    image: $stadium('.stadion-galerie img, .reveal img').first().attr('src'),
    capacity: $stadium('.profil-header-datentabelle th:contains("Aforo:")').next('td').text().trim().replace(/[^0-9.]/g, ''),
    yearBuilt: $stadium('table tr:has(th:contains("Año de construcción:")) td').first().text().trim()
  };

  // Squad
  const squad: any[] = [];
  $('.items > tbody > tr').each((i, tr) => {
    const $tds = $(tr).find('td');
    if ($tds.length < 5) return;
    const $nameLink = $(tr).find('.hauptlink a').first();
    squad.push({
      id: parseInt($nameLink.attr('href')?.match(/\/spieler\/(\d+)/)?.[1] || '0'),
      name: $nameLink.text().trim(),
      photo: $(tr).find('img.bilderrahmen-fixed').attr('src')?.replace('/small/', '/medium/'),
      position: $(tr).find('td:nth-child(2) table tr:nth-child(2) td').text().trim(),
      age: $(tr).find('td').eq(3).text().trim(),
      nationality: $(tr).find('img.flaggenabzeichen').first().attr('alt') || ''
    });
  });

  return new Response(JSON.stringify({ 
    id, 
    name, 
    shortName: name,
    tla: name.substring(0, 3).toUpperCase(),
    crest: logo, 
    coach, 
    venue, 
    squad 
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id as keyof typeof COMPETITIONS];
  if (!comp) {
    // Si la liga no está en nuestra lista de soportadas, devolver un error amigable o datos vacíos
    return new Response(JSON.stringify({ 
      competition: { id, name: id, emblem: '' },
      standings: [] 
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  const { data } = await fetchWithRetry(comp.url);
  const $ = cheerio.load(data);
  
  const standings: any[] = [];
  const $tables = $('.box:has(h2:contains("Clasificación")), .box:has(h2:contains("Grupo"))');
  
  $tables.each((i, tableBox) => {
    const $table = $(tableBox).find('table.items');
    const table: any[] = [];
    $table.find('tr').each((j, tr) => {
      if (j === 0 || $(tr).hasClass('spacer')) return;
      const $tds = $(tr).find('td');
      if ($tds.length < 5) return;
      const $teamLink = $tds.eq(2).find('a');
      
      table.push({
        position: parseInt($tds.eq(0).text().trim()),
        team: {
          id: $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1],
          name: $teamLink.text().trim(),
          shortName: $teamLink.text().trim(),
          crest: $tds.eq(1).find('img').attr('src') || $tds.eq(1).find('img').attr('data-src')
        },
        playedGames: parseInt($tds.eq(3).text().trim()),
        won: 0,
        draw: 0,
        lost: 0,
        points: parseInt($tds.eq(6).text().trim()),
        goalDifference: parseInt($tds.eq(5).text().trim()),
        form: ''
      });
    });
    if (table.length > 0) standings.push({ type: 'TOTAL', table });
  });

  // Estructura compatible con FDStandingsResponse
  const response = {
    competition: {
      id,
      name: comp.name,
      emblem: '' // Transfermarkt no da el logo de la liga fácil aquí
    },
    standings
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
