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
  
  // Extraer parámetros: pueden venir en la query o en el path (vía splat de Netlify)
  let type = url.searchParams.get('type') || '';
  let id = url.searchParams.get('id') || '';

  // Si type contiene el path completo del splat: football/competitions/PD/standings
  if (type.includes('/')) {
    const parts = type.split('/');
    if (parts.includes('competitions')) {
      const idx = parts.indexOf('competitions');
      id = id || parts[idx + 1];
      type = 'competition';
    } else if (parts.includes('teams') || parts.includes('teams')) {
      const idx = parts.indexOf('teams');
      id = id || parts[idx + 1];
      type = 'club';
    }
  }

  // Fallback si id sigue vacío pero está en el pathname real
  if (!id) {
    const parts = url.pathname.split('/');
    if (parts.includes('competitions')) {
      id = parts[parts.indexOf('competitions') + 1];
      type = 'competition';
    } else if (parts.includes('teams')) {
      id = parts[parts.indexOf('teams') + 1];
      type = 'club';
    }
  }

  // Debug for headers/logs
  console.log(`Scraper execution: type=${type}, id=${id}, url=${url.toString()}`);

  if (!type || !id) {
    // Si la URL es simplemente /matches (global en vivo)
    if (url.pathname.endsWith('/matches') || type.includes('matches')) {
      return new Response(JSON.stringify({ matches: [] }), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Missing type or id',
      debug: { type, id, pathname: url.pathname, query: url.search }
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    if (type === 'club' || type === 'team') {
      return await handleClubScrape(id);
    } else if (type === 'competition' || type === 'league') {
      // Ignorar peticiones de partidos si no están implementadas para evitar 404
      if (url.pathname.endsWith('/matches') || url.search.includes('/matches')) {
        return new Response(JSON.stringify({ matches: [] }), { 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return await handleCompetitionScrape(id);
    }
    
    return new Response(JSON.stringify({ error: `Not implemented: ${type}` }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

/**
 * Helper para asegurar que las URLs de imágenes sean absolutas
 */
function fixImageUrl(url: string | undefined): string {
  if (!url) return '';
  let fixed = url;
  if (url.startsWith('//')) fixed = `https:${url}`;
  else if (url.startsWith('/')) fixed = `https://www.transfermarkt.es${url}`;
  
  // Limpiar dobles slashes accidentales (ej: .net//images -> .net/images)
  return fixed.replace(/([^:])\/\//g, '$1/');
}

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
  const logo = fixImageUrl($('header.data-header img.data-header__profile-image').attr('src'));

  // Coach
  const $coachRow = $staff('tr:has(td:contains("Entrenador"))').first();
  const coach = $coachRow.length > 0 ? {
    name: $coachRow.find('a[href*="/profil/trainer/"]').first().text().trim(),
    photo: fixImageUrl($coachRow.find('img').first().attr('src')?.replace('/small/', '/big/')),
    age: $staff($coachRow.find('td').get(2)).text().trim() || ''
  } : { name: 'No disponible', photo: '', age: '' };

  // Stadium
  const venue = {
    name: $stadium('.stadion-profil-head-grafik img').attr('alt')?.trim() || $stadium('h1').text().replace('Estadio - ', '').trim() || '',
    image: fixImageUrl($stadium('.stadion-galerie img, .reveal img').first().attr('src')?.replace('/header/', '/big/')),
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
      photo: fixImageUrl($(tr).find('img.bilderrahmen-fixed').attr('src')?.replace('/small/', '/big/').replace('/medium/', '/big/')),
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
  
  // Scrape league emblem
  const leagueEmblem = fixImageUrl($('.data-header__profile-container img').attr('src')?.replace('/header/', '/medium/'));

  const standings: any[] = [];
  // Buscar tablas que parezcan de clasificación (tienen #, Club, Ptos, etc.)
  const $allTables = $('table.items');
  
  $allTables.each((i, table) => {
    const headerText = $(table).find('tr').first().text();
    if (!headerText.includes('Club') || !headerText.includes('Ptos')) return;

    const groupTable: any[] = [];
    $(table).find('tr').each((j, tr) => {
      // Ignorar cabecera y espaciadores
      if (j === 0 || $(tr).hasClass('spacer') || $(tr).find('th').length > 0) return;
      
      const $tds = $(tr).find('td');
      if ($tds.length < 4) return;

      // En Transfermarkt el formato suele ser:
      // td0: Posición, td1: Escudo, td2: Nombre equipo, td3: Partidos, td4: +/-, td5: Puntos
      // O variaciones. Vamos a ser flexibles.
      
      const pos = parseInt($tds.eq(0).text().trim());
      const $teamLink = $tds.find('a[href*="/verein/"]').first();
      if (!$teamLink.length) return;

      const teamId = $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1];
      const teamName = $teamLink.text().trim();
      const crest = fixImageUrl($tds.find('img').first().attr('src')?.replace('/tiny/', '/header/') || $tds.find('img').first().attr('data-src')?.replace('/tiny/', '/header/'));

      // Intentar encontrar puntos y partidos jugados
      // Normalmente Ptos es la última o penúltima columna
      const points = parseInt($tds.last().text().trim());
      const played = parseInt($tds.eq(3).text().trim()) || 0;
      const goalsDiff = parseInt($tds.eq($tds.length - 2).text().trim()) || 0;
      
      groupTable.push({
        position: pos,
        team: {
          id: teamId,
          name: teamName,
          shortName: teamName,
          crest: crest
        },
        playedGames: played,
        won: 0,
        draw: 0,
        lost: 0,
        points: points,
        goalDifference: goalsDiff,
        form: ''
      });
    });

    if (groupTable.length > 0) standings.push({ type: 'TOTAL', table: groupTable });
  });

  // Estructura compatible con FDStandingsResponse
  const response = {
    competition: {
      id,
      name: comp.name,
      emblem: leagueEmblem
    },
    standings
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
