import axios from 'axios';
import * as cheerio from 'cheerio';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Referer': 'https://www.transfermarkt.es/'
};

const COMPETITIONS: Record<string, { name: string, url: string }> = {
  'PD': { name: 'La Liga', url: 'https://www.transfermarkt.es/laliga/tabelle/wettbewerb/ES1' },
  'PL': { name: 'Premier League', url: 'https://www.transfermarkt.es/premier-league/tabelle/wettbewerb/GB1' },
  'BL1': { name: 'Bundesliga', url: 'https://www.transfermarkt.es/bundesliga/tabelle/wettbewerb/L1' },
  'SA': { name: 'Serie A', url: 'https://www.transfermarkt.es/serie-a/tabelle/wettbewerb/IT1' },
  'FL1': { name: 'Ligue 1', url: 'https://www.transfermarkt.es/ligue-1/tabelle/wettbewerb/FR1' },
  'DED': { name: 'Eredivisie', url: 'https://www.transfermarkt.es/eredivisie/tabelle/wettbewerb/NL1' },
  'PPL': { name: 'Primeira Liga', url: 'https://www.transfermarkt.es/liga-nos/tabelle/wettbewerb/PO1' },
  'ELC': { name: 'Championship', url: 'https://www.transfermarkt.es/championship/tabelle/wettbewerb/GB2' },
  'CL': { name: 'Champions League', url: 'https://www.transfermarkt.es/uefa-champions-league/tabelle/wettbewerb/CL' },
  'CLI': { name: 'Copa Libertadores', url: 'https://www.transfermarkt.es/copa-libertadores/tabelle/wettbewerb/CLI' },
  'WC': { name: 'Copa del Mundo', url: 'https://www.transfermarkt.es/weltmeisterschaft-2022/tabelle/wettbewerb/WM22' }
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
  
  fixed = fixed.replace('/tiny/', '/big/')
               .replace('/small/', '/big/')
               .replace('/medium/', '/big/')
               .replace('/header/', '/big/')
               .replace('/portrait_small/', '/header/')
               .replace('/portrait_medium/', '/header/');

  return fixed.replace(/([^:])\/\//g, '$1/');
}

function parseSpanishDate(dateStr: string): string {
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return new Date().toISOString();
  let [_, d, mnt, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mnt.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type: queryType, id: queryId } = req.query;
  let type = Array.isArray(queryType) ? queryType[0] : (queryType as string) || '';
  let id = Array.isArray(queryId) ? queryId[0] : (queryId as string) || '';

  const path = req.url || '';
  if (path.includes('competitions')) {
    const parts = path.split('/');
    id = id || parts[parts.indexOf('competitions') + 1].split('?')[0];
    type = 'competition';
  } else if (path.includes('teams')) {
    const parts = path.split('/');
    id = id || parts[parts.indexOf('teams') + 1].split('?')[0];
    type = 'club';
  }

  if (!id || !type) return res.status(400).json({ error: 'Missing id or type' });

  try {
    if (type === 'club') {
      const data = await handleClubScrape(id);
      return res.status(200).json(data);
    }
    if (type === 'competition') {
      if (path.includes('/matches')) {
        const data = await handleCompetitionMatches(id);
        return res.status(200).json(data);
      }
      const data = await handleCompetitionScrape(id);
      return res.status(200).json(data);
    }
    return res.status(404).json({ error: 'Not implemented' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleClubScrape(id: string) {
  const baseUrl = `https://www.transfermarkt.es/startseite/verein/${id}`;
  const homeRes = await fetchWithRetry(baseUrl);
  const $ = cheerio.load(homeRes?.data || '');

  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ') || $('.data-header__profile-container img').attr('alt') || '';
  const logo = fixImageUrl($('.data-header__profile-container img').attr('src'));
  
  // Coach detection by keyword
  const coachLabel = $('.data-header__details th:contains("Entrenador")');
  const coachName = coachLabel.next('td').text().trim();
  const coach = {
    name: coachName.split('(')[0].trim() || 'No disponible',
    photo: '', 
    age: coachName.match(/\((\d+)\)/)?.[1] || ''
  };

  const trophies: any[] = [];
  $('.data-header__success-data a').each((i, el) => {
    trophies.push({
      league: $(el).attr('title') || '',
      count: parseInt($(el).find('span').text().trim()) || 1,
      image: fixImageUrl($(el).find('img').attr('src'))
    });
  });

  const squad: any[] = [];
  // Target the main squad table specifically
  $('table.items').first().find('tbody > tr').each((i, tr) => {
    const $nameLink = $(tr).find('.hauptlink a').first();
    if (!$nameLink.length) return;
    
    squad.push({
      id: parseInt($nameLink.attr('href')?.match(/\/spieler\/(\d+)/)?.[1] || '0'),
      name: $nameLink.text().trim(),
      photo: fixImageUrl($(tr).find('img.bilderrahmen-fixed, img.player-profile-image').attr('src') || $(tr).find('img').attr('data-src') || $(tr).find('img').attr('src')),
      position: $(tr).find('td:nth-child(2) table tr:nth-child(2) td').text().trim(),
      age: $(tr).find('td').eq(3).text().trim(),
      marketValue: $(tr).find('.rechts.hauptlink').text().trim(),
      number: $(tr).find('.rn_nummer').text().trim()
    });
  });

  const venueLabel = $('.data-header__details th:contains("Estadio")');
  const venue = {
    name: venueLabel.next('td').text().trim(),
    capacity: $('.data-header__details th:contains("Aforo")').next('td').text().trim().replace(/[^0-9.]/g, '')
  };

  return {
    id, name, logo, crest: logo, coach, venue, squad, trophies,
    founded: $('.data-header__details th:contains("Fundado")').next('td').text().trim(),
    country: $('.data-header__club-link').text().trim()
  };
}

async function handleCompetitionScrape(id: string) {
  const comp = COMPETITIONS[id];
  const url = comp ? comp.url : `https://www.transfermarkt.es/laliga/tabelle/wettbewerb/${id}`;
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
      
      const form = $tds.eq(10).find('.tm-form-chart__dot').map((f, el) => {
          if ($(el).hasClass('tm-form-chart__dot--win')) return 'W';
          if ($(el).hasClass('tm-form-chart__dot--draw')) return 'D';
          return 'L';
      }).get().join('');

      tableData.push({
        position: parseInt($tds.eq(0).text().trim()) || j,
        team: { 
          id: $teamLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], 
          name: $teamLink.text().trim(),
          crest: fixImageUrl($tds.eq(1).find('img').attr('src')),
          logo: fixImageUrl($tds.eq(1).find('img').attr('src'))
        },
        playedGames: parseInt($tds.eq(3).text().trim()) || 0,
        won: parseInt($tds.eq(4).text().trim()) || 0,
        draw: parseInt($tds.eq(5).text().trim()) || 0,
        lost: parseInt($tds.eq(6).text().trim()) || 0,
        goalsFor: gf,
        goalsAgainst: ga,
        points: parseInt($tds.eq(9).text().trim()) || 0,
        goalDifference: gf - ga,
        form: form
      });
    });
    standings.push({ type: 'TOTAL', table: tableData });
  }
  return { competition: { id, name: comp?.name || id, emblem, logo: emblem }, standings };
}

async function handleCompetitionMatches(id: string) {
  const comp = COMPETITIONS[id];
  // Convert table URL to fixtures URL
  const url = comp ? comp.url.replace('/tabelle/', '/gesamtspielplan/') : `https://www.transfermarkt.es/laliga/gesamtspielplan/wettbewerb/${id}`;
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
        homeTeam: { 
          id: homeLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], 
          name: homeLink.text().trim(), 
          logo: fixImageUrl(homeCell.next('td').find('img').attr('src')),
          crest: fixImageUrl(homeCell.next('td').find('img').attr('src'))
        },
        awayTeam: { 
          id: awayLink.attr('href')?.match(/\/verein\/(\d+)/)?.[1], 
          name: awayLink.text().trim(), 
          logo: fixImageUrl(awayCell.prev('td').find('img').attr('src')),
          crest: fixImageUrl(awayCell.prev('td').find('img').attr('src'))
        },
        status: score.includes(':') ? 'NS' : 'FT',
        score: { 
          fullTime: { 
            home: score.split(':')[0] || null, 
            away: score.split(':')[1] || null 
          }, 
          halfTime: { home: null, away: null },
          penalty: { home: null, away: null } 
        },
        goals: { home: score.split(':')[0] || null, away: score.split(':')[1] || null },
        leagueName: comp?.name || ''
      });
    });
  });

  return { matches: matches.slice(0, 30) };
}
