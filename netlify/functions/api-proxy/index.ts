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
  'Referer': 'https://www.transfermarkt.es/'
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
  
  let type = url.searchParams.get('type') || '';
  let id = url.searchParams.get('id') || '';

  if (type.includes('/')) {
    const parts = type.split('/');
    if (parts.includes('competitions')) {
      const idx = parts.indexOf('competitions');
      id = id || parts[idx + 1];
      type = 'competition';
    } else if (parts.includes('teams')) {
      const idx = parts.indexOf('teams');
      id = id || parts[idx + 1];
      type = 'club';
    }
  }

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

  if (!type || !id) {
    if (url.pathname.endsWith('/matches') || type.includes('matches')) {
      return new Response(JSON.stringify({ matches: [] }), { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    return new Response(JSON.stringify({ error: 'Missing type or id' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    if (type === 'club' || type === 'team') {
      return await handleClubScrape(id);
    } else if (type === 'competition' || type === 'league') {
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

function fixImageUrl(url: string | undefined): string {
  if (!url) return '';
  let fixed = url;
  if (url.startsWith('//')) fixed = `https:${url}`;
  else if (url.startsWith('/')) fixed = `https://www.transfermarkt.es${url}`;
  
  // High res replacements
  fixed = fixed.replace('/tiny/', '/big/')
               .replace('/small/', '/big/')
               .replace('/medium/', '/big/')
               .replace('/header/', '/big/')
               .replace('/mediumsmall/', '/big/');

  return fixed.replace(/([^:])\/\//g, '$1/');
}

async function handleClubScrape(id: string) {
  const baseUrl = `https://www.transfermarkt.es/real-madrid/startseite/verein/${id}`;
  const mitarbeiterUrl = baseUrl.replace('startseite', 'mitarbeiter');
  const stadionUrl = baseUrl.replace('startseite', 'stadion');
  const erfolgeUrl = baseUrl.replace('startseite', 'erfolge');

  const [homeRes, staffRes, stadiumRes, successRes] = await Promise.allSettled([
    fetchWithRetry(baseUrl),
    fetchWithRetry(mitarbeiterUrl),
    fetchWithRetry(stadionUrl),
    fetchWithRetry(erfolgeUrl)
  ]);

  const $ = cheerio.load(homeRes.status === 'fulfilled' ? homeRes.value?.data : '');
  const $staff = cheerio.load(staffRes.status === 'fulfilled' ? staffRes.value?.data : '');
  const $stadium = cheerio.load(stadiumRes.status === 'fulfilled' ? stadiumRes.value?.data : '');
  const $success = cheerio.load(successRes.status === 'fulfilled' ? successRes.value?.data : '');

  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ');
  const logo = fixImageUrl($('header.data-header img.data-header__profile-image').attr('src') || $('.data-header__profile-container img').attr('src'));

  // Coach Fix
  const $coachRow = $staff('tr:has(td:contains("Entrenador"))').first();
  const coachName = $coachRow.find('a[href*="/profil/trainer/"]').first().text().trim();
  const coachAge = $coachRow.find('td').eq(2).text().trim().replace(/[^0-9]/g, '');
  const coach = {
    name: coachName || 'No disponible',
    photo: fixImageUrl($coachRow.find('img').first().attr('src')),
    age: coachAge
  };

  // Stadium Fix
  const venue = {
    name: $stadium('h1').text().replace('Estadio - ', '').trim() || $('.data-header__details th:contains("Estadio:")').next('td').text().trim(),
    image: fixImageUrl($stadium('.stadion-galerie img, .reveal img').first().attr('src')),
    capacity: $stadium('.profil-header-datentabelle th:contains("Aforo:")').next('td').text().trim().replace(/[^0-9.]/g, ''),
    yearBuilt: $stadium('table tr:has(th:contains("Año de construcción:")) td').first().text().trim()
  };

  // Trophies Scrape
  const trophies: any[] = [];
  $success('.box').each((i, box) => {
    const title = $(box).find('.header-social').text().trim();
    if (!title) return;
    const count = parseInt($(box).find('.success-score').text().trim()) || 1;
    const image = fixImageUrl($(box).find('img').attr('src'));
    const seasons = $(box).find('.success-table-detail').text().trim();
    
    trophies.push({
      league: title,
      count: count,
      image: image,
      seasons: seasons
    });
  });

  // Squad Scrape with detailed stats
  const squad: any[] = [];
  $('.items > tbody > tr').each((i, tr) => {
    const $tds = $(tr).find('td');
    if ($tds.length < 5) return;
    const $nameLink = $(tr).find('.hauptlink a').first();
    const photo = fixImageUrl($(tr).find('img.bilderrahmen-fixed').attr('src'));
    
    squad.push({
      id: parseInt($nameLink.attr('href')?.match(/\/spieler\/(\d+)/)?.[1] || '0'),
      name: $nameLink.text().trim(),
      photo: photo,
      position: $(tr).find('td:nth-child(2) table tr:nth-child(2) td').text().trim(),
      age: $(tr).find('td').eq(3).text().trim(),
      marketValue: $(tr).find('.rechts.hauptlink').text().trim(),
      number: $(tr).find('.rn_nummer').text().trim()
    });
  });

  return new Response(JSON.stringify({ 
    id, name, crest: logo, coach, venue, squad, trophies,
    founded: $('.data-header__details th:contains("Fundado:")').next('td').text().trim(),
    country: $('.data-header__club-link').text().trim()
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id as keyof typeof COMPETITIONS];
  if (!comp) return new Response(JSON.stringify({ competition: { id, name: id }, standings: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  const { data } = await fetchWithRetry(comp.url);
  const $ = cheerio.load(data);
  const leagueEmblem = fixImageUrl($('.data-header__profile-container img').attr('src'));

  const standings: any[] = [];
  $('table.items').each((i, table) => {
    const headerText = $(table).find('tr').first().text();
    if (!headerText.includes('Club') || !headerText.includes('Ptos')) return;

    const groupTable: any[] = [];
    const headers: string[] = [];
    $(table).find('tr').first().find('th, td').each((h, el) => headers.push($(el).text().trim()));

    const idxW = headers.findIndex(h => h === 'G');
    const idxD = headers.findIndex(h => h === 'E');
    const idxL = headers.findIndex(h => h === 'P');
    const idxGoals = headers.findIndex(h => h === 'Goles');
    const idxDiff = headers.findIndex(h => h === '+/-');
    const idxPts = headers.findIndex(h => h === 'Ptos');

    $(table).find('tr').each((j, tr) => {
      if (j === 0 || $(tr).hasClass('spacer') || $(tr).find('th').length > 0) return;
      const $tds = $(tr).find('td');
      if ($tds.length < 4) return;

      const pos = parseInt($tds.eq(0).text().trim());
      const $teamLink = $tds.find('a[href*="/verein/"]').first();
      if (!$teamLink.length) return;

      const teamId = $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1];
      const teamName = $teamLink.text().trim();
      const crest = fixImageUrl($tds.find('img').first().attr('src') || $tds.find('img').first().attr('data-src'));

      const goalsStr = idxGoals !== -1 ? $tds.eq(idxGoals).text().trim() : '0:0';
      const [gf, ga] = goalsStr.split(':').map(n => parseInt(n) || 0);

      groupTable.push({
        position: pos,
        team: { id: teamId, name: teamName, crest: crest },
        playedGames: parseInt($tds.eq(3).text().trim()) || 0,
        won: idxW !== -1 ? parseInt($tds.eq(idxW).text().trim()) || 0 : 0,
        draw: idxD !== -1 ? parseInt($tds.eq(idxD).text().trim()) || 0 : 0,
        lost: idxL !== -1 ? parseInt($tds.eq(idxL).text().trim()) || 0 : 0,
        goalsFor: gf,
        goalsAgainst: ga,
        points: idxPts !== -1 ? parseInt($tds.eq(idxPts).text().trim()) || 0 : 0,
        goalDifference: idxDiff !== -1 ? parseInt($tds.eq(idxDiff).text().trim()) || 0 : 0,
        form: $tds.last().find('.tm-form-chart__dot').map((f, el) => $(el).hasClass('tm-form-chart__dot--win') ? 'W' : $(el).hasClass('tm-form-chart__dot--draw') ? 'D' : 'L').get().join('')
      });
    });
    if (groupTable.length > 0) standings.push({ type: 'TOTAL', table: groupTable });
  });

  return new Response(JSON.stringify({ competition: { id, name: comp.name, emblem: leagueEmblem }, standings }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
