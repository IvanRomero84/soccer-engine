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
  'Referer': 'https://www.transfermarkt.es/'
};

const COMPETITIONS: Record<string, { name: string, url: string }> = {
  'PD': { name: 'La Liga', url: 'https://www.transfermarkt.es/laliga/startseite/wettbewerb/ES1' },
  'PL': { name: 'Premier League', url: 'https://www.transfermarkt.es/premier-league/startseite/wettbewerb/GB1' },
  'BL1': { name: 'Bundesliga', url: 'https://www.transfermarkt.es/bundesliga/startseite/wettbewerb/L1' },
  'SA': { name: 'Serie A', url: 'https://www.transfermarkt.es/serie-a/startseite/wettbewerb/IT1' },
  'FL1': { name: 'Ligue 1', url: 'https://www.transfermarkt.es/ligue-1/startseite/wettbewerb/FR1' },
  'DED': { name: 'Eredivisie', url: 'https://www.transfermarkt.es/eredivisie/startseite/wettbewerb/NL1' },
  'PPL': { name: 'Primeira Liga', url: 'https://www.transfermarkt.es/liga-nos/startseite/wettbewerb/PO1' },
  'ELC': { name: 'Championship', url: 'https://www.transfermarkt.es/championship/startseite/wettbewerb/GB2' },
  'CL': { name: 'Champions League', url: 'https://www.transfermarkt.es/uefa-champions-league/startseite/pokalwettbewerb/CL' },
  'CLI': { name: 'Copa Libertadores', url: 'https://www.transfermarkt.es/copa-libertadores/startseite/pokalwettbewerb/CLI' },
  'WC': { name: 'Copa del Mundo', url: 'https://www.transfermarkt.es/weltmeisterschaft-2022/startseite/pokalwettbewerb/WM22' }
};

async function fetchWithRetry(url: string, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, { headers: HEADERS, timeout: 10000 });
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

function fixImageUrl(url: string | undefined): string {
  if (!url || url.includes('placeholder')) return '';
  let fixed = url;
  if (url.startsWith('//')) fixed = `https:${url}`;
  else if (url.startsWith('/')) fixed = `https://www.transfermarkt.es${url}`;
  
  // High res replacements
  fixed = fixed.replace('/tiny/', '/header/')
               .replace('/small/', '/medium/')
               .replace('/medium/', '/big/')
               .replace('/header/', '/big/')
               .replace('/portrait/medium/', '/portrait/header/');

  return fixed.replace(/([^:])\/\//g, '$1/');
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  let type = url.searchParams.get('type') || '';
  let id = url.searchParams.get('id') || '';

  // Extract from path splat
  const parts = path.split('/');
  if (parts.includes('competitions')) {
    id = parts[parts.indexOf('competitions') + 1];
    type = 'competition';
  } else if (parts.includes('teams')) {
    id = parts[parts.indexOf('teams') + 1];
    type = 'club';
  }

  if (!id || !type) {
    return new Response(JSON.stringify({ error: 'Missing id or type', path }), { status: 400 });
  }

  try {
    if (type === 'club') return await handleClubScrape(id);
    if (type === 'competition') {
      if (path.endsWith('/matches')) return await handleCompetitionMatches(id);
      return await handleCompetitionScrape(id);
    }
    return new Response(JSON.stringify({ error: 'Not implemented' }), { status: 404 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

async function handleClubScrape(id: string) {
  const baseUrl = `https://www.transfermarkt.es/club/startseite/verein/${id}`;
  const mitarbeiterUrl = baseUrl.replace('startseite', 'mitarbeiter');
  const erfolgeUrl = baseUrl.replace('startseite', 'erfolge');

  const [homeRes, staffRes, successRes] = await Promise.allSettled([
    fetchWithRetry(baseUrl),
    fetchWithRetry(mitarbeiterUrl),
    fetchWithRetry(erfolgeUrl)
  ]);

  const $ = cheerio.load(homeRes.status === 'fulfilled' ? homeRes.value?.data : '');
  const $staff = cheerio.load(staffRes.status === 'fulfilled' ? staffRes.value?.data : '');
  const $success = cheerio.load(successRes.status === 'fulfilled' ? successRes.value?.data : '');

  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ');
  const logo = fixImageUrl($('img.data-header__profile-image').attr('src') || $('.data-header__profile-container img').attr('src'));

  // Coach
  const $coachRow = $staff('tr:has(td:contains("Entrenador"))').first();
  const coach = {
    name: $coachRow.find('a[href*="/profil/trainer/"]').first().text().trim() || 'No disponible',
    photo: fixImageUrl($coachRow.find('img').first().attr('src')),
    age: $coachRow.find('td').eq(2).text().trim().replace(/[^0-9]/g, '')
  };

  // Venue from details
  const venue = {
    name: $('.data-header__details th:contains("Estadio:")').next('td').text().trim(),
    image: '',
    capacity: $('.data-header__details th:contains("Aforo:")').next('td').text().trim().replace(/[^0-9.]/g, '')
  };

  // Trophies
  const trophies: any[] = [];
  $success('.box').each((i, box) => {
    const title = $(box).find('.header-social').text().trim();
    if (!title) return;
    const count = parseInt($(box).find('.success-score').text().trim()) || 1;
    const image = fixImageUrl($(box).find('img').attr('src'));
    const seasons = $(box).find('.success-table-detail').text().trim();
    trophies.push({ league: title, count, image, seasons });
  });

  // Squad
  const squad: any[] = [];
  $('.items > tbody > tr').each((i, tr) => {
    const $nameLink = $(tr).find('.hauptlink a').first();
    if (!$nameLink.length) return;
    
    squad.push({
      id: parseInt($nameLink.attr('href')?.match(/\/spieler\/(\d+)/)?.[1] || '0'),
      name: $nameLink.text().trim(),
      photo: fixImageUrl($(tr).find('img.bilderrahmen-fixed, img.player-profile-image').attr('src') || $(tr).find('img').attr('src')),
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
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id];
  if (!comp) return new Response(JSON.stringify({ error: 'Competition not found' }), { status: 404 });

  const { data } = await fetchWithRetry(comp.url);
  const $ = cheerio.load(data);
  const emblem = fixImageUrl($('.data-header__profile-container img').attr('src'));

  const standings: any[] = [];
  const $table = $('table.items').filter((i, el) => $(el).text().includes('Club') && $(el).text().includes('Ptos')).first();
  
  if ($table.length) {
    const tableData: any[] = [];
    const headers: string[] = [];
    $table.find('tr').first().find('th, td').each((h, el) => headers.push($(el).text().trim()));

    const idxW = headers.findIndex(h => ['G', 'V', 'W'].includes(h));
    const idxD = headers.findIndex(h => ['E', 'D'].includes(h));
    const idxL = headers.findIndex(h => ['P', 'L'].includes(h));
    const idxGoals = headers.findIndex(h => ['Goles', 'Goals', 'Dif.'].includes(h) || h.includes(':'));
    const idxPts = headers.findIndex(h => ['Ptos', 'Pts'].includes(h));

    $table.find('tr').each((j, tr) => {
      if (j === 0 || $(tr).hasClass('spacer') || $(tr).find('th').length > 0) return;
      const $tds = $(tr).find('td');
      if ($tds.length < 5) return;

      const $teamLink = $tds.find('a[href*="/verein/"]').first();
      const goalsStr = idxGoals !== -1 ? $tds.eq(idxGoals).text().trim() : ($tds.filter((i, el) => $(el).text().includes(':')).text().trim() || '0:0');
      const [gf, ga] = goalsStr.split(':').map(n => parseInt(n) || 0);

      tableData.push({
        position: parseInt($tds.eq(0).text().trim()) || j,
        team: { 
          id: $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], 
          name: $teamLink.text().trim(),
          crest: fixImageUrl($tds.find('img').first().attr('src'))
        },
        playedGames: parseInt($tds.eq(3).text().trim()) || 0,
        won: idxW !== -1 ? parseInt($tds.eq(idxW).text().trim()) || 0 : 0,
        draw: idxD !== -1 ? parseInt($tds.eq(idxD).text().trim()) || 0 : 0,
        lost: idxL !== -1 ? parseInt($tds.eq(idxL).text().trim()) || 0 : 0,
        goalsFor: gf,
        goalsAgainst: ga,
        points: idxPts !== -1 ? parseInt($tds.eq(idxPts).text().trim()) || 0 : 0,
        goalDifference: gf - ga,
        form: $tds.last().find('.tm-form-chart__dot').map((f, el) => $(el).hasClass('tm-form-chart__dot--win') ? 'W' : $(el).hasClass('tm-form-chart__dot--draw') ? 'D' : 'L').get().join('')
      });
    });
    standings.push({ type: 'TOTAL', table: tableData });
  }

  return new Response(JSON.stringify({ competition: { id, name: comp.name, emblem }, standings }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleCompetitionMatches(id: string) {
  const comp = COMPETITIONS[id];
  const url = comp ? comp.url.replace('startseite', 'gesamtspielplan') : `https://www.transfermarkt.es/laliga/gesamtspielplan/wettbewerb/${id}`;
  const { data } = await fetchWithRetry(url);
  const $ = cheerio.load(data);

  const matches: any[] = [];
  $('.box').each((i, box) => {
    const roundName = $(box).find('h2').text().trim();
    $(box).find('tr').each((j, tr) => {
      const $tds = $(tr).find('td');
      if ($tds.length < 5) return;

      const homeLink = $tds.eq(2).find('a').first();
      const awayLink = $tds.eq(4).find('a').first();
      const score = $tds.eq(3).text().trim();

      matches.push({
        id: Math.random().toString(36).substr(2, 9),
        round: roundName,
        date: $tds.eq(0).text().trim(),
        homeTeam: { id: homeLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: homeLink.text().trim(), logo: fixImageUrl($tds.eq(1).find('img').attr('src')) },
        awayTeam: { id: awayLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: awayLink.text().trim(), logo: fixImageUrl($tds.eq(5).find('img').attr('src')) },
        status: score.includes(':') ? 'NS' : 'FT',
        goals: { home: score.split(':')[0] || null, away: score.split(':')[1] || null },
        leagueName: comp?.name || ''
      });
    });
  });

  return new Response(JSON.stringify({ matches: matches.slice(0, 20) }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
