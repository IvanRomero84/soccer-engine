import { Context } from '@netlify/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  if (!type || !id) {
    return new Response(JSON.stringify({ error: 'Missing type or id' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    if (type === 'club') {
      return await handleClubScrape(id);
    } else if (type === 'competition') {
      return await handleCompetitionScrape(id);
    }
    return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
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

  return new Response(JSON.stringify({ id, name, logo, coach, venue, squad }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id as keyof typeof COMPETITIONS];
  if (!comp) throw new Error('Competition not supported');

  const { data } = await fetchWithRetry(comp.url);
  const $ = cheerio.load(data);
  
  const standings: any[] = [];
  const $tables = $('.box:has(h2:contains("Clasificación")), .box:has(h2:contains("Grupo"))');
  
  $tables.each((i, tableBox) => {
    const $table = $(tableBox).find('table.items');
    const groupTable: any[] = [];
    $table.find('tr').each((j, tr) => {
      if (j === 0 || $(tr).hasClass('spacer')) return;
      const $tds = $(tr).find('td');
      if ($tds.length < 5) return;
      const $teamLink = $tds.eq(2).find('a');
      groupTable.push({
        rank: parseInt($tds.eq(0).text().trim()),
        teamId: $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1],
        teamName: $teamLink.text().trim(),
        teamLogo: $tds.eq(1).find('img').attr('src') || $tds.eq(1).find('img').attr('data-src'),
        points: parseInt($tds.eq(6).text().trim()),
        goalsDiff: parseInt($tds.eq(5).text().trim()),
        all: { played: parseInt($tds.eq(3).text().trim()) }
      });
    });
    if (groupTable.length > 0) standings.push(groupTable);
  });

  return new Response(JSON.stringify({ leagueId: id, leagueName: comp.name, standings }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
