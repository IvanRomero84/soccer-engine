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
  
  // Forzar máxima resolución
  fixed = fixed.replace('/tiny/', '/big/')
               .replace('/small/', '/big/')
               .replace('/medium/', '/big/')
               .replace('/header/', '/big/')
               .replace('/portrait_small/', '/header/')
               .replace('/portrait_medium/', '/header/');

  return fixed.replace(/([^:])\/\//g, '$1/');
}

function parseSpanishDate(dateStr: string): string {
  // Ej: "vie, 15/08/25" o "15/08/2025"
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return new Date().toISOString();
  let [_, d, mnt, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mnt.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`;
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  let type = url.searchParams.get('type') || '';
  let id = url.searchParams.get('id') || '';

  const parts = path.split('/');
  if (parts.includes('competitions')) {
    id = parts[parts.indexOf('competitions') + 1];
    type = 'competition';
  } else if (parts.includes('teams')) {
    id = parts[parts.indexOf('teams') + 1];
    type = 'club';
  }

  if (!id || !type) return new Response(JSON.stringify({ error: 'Missing id or type' }), { status: 400 });

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
  const homeRes = await fetchWithRetry(baseUrl);
  const $ = cheerio.load(homeRes.status === 'fulfilled' ? homeRes.value?.data : '');

  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ');
  const logo = fixImageUrl($('.data-header__profile-container img').attr('src'));

  // Coach
  const coachName = $('.data-header__details th:contains("Entrenador:")').next('td').text().trim();
  const coach = {
    name: coachName.split('(')[0].trim() || 'No disponible',
    photo: '', // Se podría buscar en la pestaña staff
    age: coachName.match(/\((\d+)\)/)?.[1] || ''
  };

  // Trophies from header
  const trophies: any[] = [];
  $('.data-header__success-data a').each((i, el) => {
    trophies.push({
      league: $(el).attr('title') || '',
      count: parseInt($(el).find('span').text().trim()) || 1,
      image: fixImageUrl($(el).find('img').attr('src'))
    });
  });

  // Squad
  const squad: any[] = [];
  $('table.items').first().find('tbody > tr').each((i, tr) => {
    const $nameLink = $(tr).find('.hauptlink a').first();
    if (!$nameLink.length) return;
    
    squad.push({
      id: parseInt($nameLink.attr('href')?.match(/\/spieler\/(\d+)/)?.[1] || '0'),
      name: $nameLink.text().trim(),
      photo: fixImageUrl($(tr).find('img.bilderrahmen-fixed, img.player-profile-image').attr('src')),
      position: $(tr).find('td:nth-child(2) table tr:nth-child(2) td').text().trim(),
      age: $(tr).find('td').eq(3).text().trim(),
      marketValue: $(tr).find('.rechts.hauptlink').text().trim(),
      number: $(tr).find('.rn_nummer').text().trim()
    });
  });

  return new Response(JSON.stringify({ 
    id, name, crest: logo, coach, venue: { name: $('.data-header__details th:contains("Estadio:")').next('td').text().trim() }, squad, trophies,
    founded: $('.data-header__details th:contains("Fundado:")').next('td').text().trim(),
    country: $('.data-header__club-link').text().trim()
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id];
  const url = comp ? comp.url.replace('startseite', 'tabelle') : `https://www.transfermarkt.es/laliga/tabelle/wettbewerb/${id}`;
  const { data } = await fetchWithRetry(url);
  const $ = cheerio.load(data);
  const emblem = fixImageUrl($('.data-header__profile-container img').attr('src'));

  const standings: any[] = [];
  const $table = $('table.items').first();
  
  if ($table.length) {
    const tableData: any[] = [];
    $table.find('tbody > tr').each((j, tr) => {
      if ($(tr).hasClass('spacer') || $(tr).find('th').length > 0) return;
      const $tds = $(tr).find('td');
      if ($tds.length < 5) return;

      const $teamLink = $tds.find('a[href*="/verein/"]').first();
      const goalsStr = $tds.eq(7).text().trim() || '0:0';
      const [gf, ga] = goalsStr.split(':').map(n => parseInt(n) || 0);

      tableData.push({
        position: parseInt($tds.eq(0).text().trim()) || j,
        team: { 
          id: $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], 
          name: $teamLink.text().trim(),
          crest: fixImageUrl($tds.eq(1).find('img').attr('src'))
        },
        playedGames: parseInt($tds.eq(3).text().trim()) || 0,
        won: parseInt($tds.eq(4).text().trim()) || 0,
        draw: parseInt($tds.eq(5).text().trim()) || 0,
        lost: parseInt($tds.eq(6).text().trim()) || 0,
        goalsFor: gf,
        goalsAgainst: ga,
        points: parseInt($tds.eq(9).text().trim()) || 0,
        goalDifference: parseInt($tds.eq(8).text().trim()) || (gf - ga),
        form: '' // En esta página no hay forma, se requeriría otra subpágina
      });
    });
    standings.push({ type: 'TOTAL', table: tableData });
  }

  return new Response(JSON.stringify({ competition: { id, name: comp?.name || id, emblem }, standings }), {
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

      const homeCell = $tds.filter((_, el) => $(el).hasClass('text-right') && $(el).find('a').length > 0).first();
      const awayCell = $tds.filter((_, el) => $(el).hasClass('no-border-links') && $(el).find('a').length > 0).last();
      const scoreCell = $tds.find('a[href*="/ergebnis/"]').parent();

      if (!homeCell.length || !awayCell.length) return;

      const homeLink = homeCell.find('a').first();
      const awayLink = awayCell.find('a').first();
      const score = scoreCell.text().trim();

      matches.push({
        id: Math.random().toString(36).substr(2, 9),
        round: roundName,
        date: parseSpanishDate($tds.eq(0).text().trim()),
        homeTeam: { id: homeLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: homeLink.text().trim(), logo: fixImageUrl(homeCell.next('td').find('img').attr('src')) },
        awayTeam: { id: awayLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: awayLink.text().trim(), logo: fixImageUrl(awayCell.prev('td').find('img').attr('src')) },
        status: score.includes(':') ? 'NS' : 'FT',
        goals: { home: score.split(':')[0] || null, away: score.split(':')[1] || null },
        score: { fullTime: { home: score.split(':')[0] || null, away: score.split(':')[1] || null }, penalty: { home: null, away: null } },
        leagueName: comp?.name || ''
      });
    });
  });

  return new Response(JSON.stringify({ matches: matches.slice(0, 30) }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
