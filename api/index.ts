import * as cheerio from 'cheerio';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Cache-Control': 'no-cache'
};

const COMPETITIONS: Record<string, { name: string, url: string }> = {
  'PD': { name: 'La Liga', url: 'https://www.transfermarkt.es/laliga/tabelle/wettbewerb/ES1' },
  'PL': { name: 'Premier League', url: 'https://www.transfermarkt.es/premier-league/tabelle/wettbewerb/GB1' },
  'BL1': { name: 'Bundesliga', url: 'https://www.transfermarkt.es/bundesliga/tabelle/wettbewerb/L1' },
  'SA': { name: 'Serie A', url: 'https://www.transfermarkt.es/serie-a/tabelle/wettbewerb/IT1' },
  'FL1': { name: 'Ligue 1', url: 'https://www.transfermarkt.es/ligue-1/tabelle/wettbewerb/FR1' },
  'DED': { name: 'Eredivisie', url: 'https://www.transfermarkt.es/eredivisie/tabelle/wettbewerb/NL1' },
  'PPL': { name: 'Primeira Liga', url: 'https://www.transfermarkt.es/liga-nos/tabelle/wettbewerb/PO1' }
};

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`TM responded with ${res.status}`);
  return await res.text();
}

function fixImageUrl(url: string | undefined): string {
  if (!url || url.includes('placeholder')) return '';
  let fixed = url.startsWith('//') ? `https:${url}` : (url.startsWith('/') ? `https://www.transfermarkt.es${url}` : url);
  return fixed.replace('/tiny/', '/big/').replace('/small/', '/big/').replace('/medium/', '/big/').replace('/header/', '/big/').replace(/([^:])\/\//g, '$1/');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type: qType, id: qId } = req.query;
  let type = String(qType || ''), id = String(qId || '');
  const path = req.url || '';

  if (path.includes('competitions')) { type = 'competition'; id = id || path.split('competitions/')[1]?.split(/[/?]/)[0]; }
  else if (path.includes('teams')) { type = 'club'; id = id || path.split('teams/')[1]?.split(/[/?]/)[0]; }

  if (!id || !type) return res.status(400).json({ error: 'Missing ID/Type' });

  try {
    if (type === 'club') {
      const html = await fetchHtml(`https://www.transfermarkt.es/club/startseite/verein/${id}`);
      const $ = cheerio.load(html);
      
      const name = $('h1.data-header__headline-wrapper').text().trim() || $('.data-header__profile-container img').attr('alt') || '';
      const logo = fixImageUrl($('.data-header__profile-container img').attr('src'));
      const coachName = $('.data-header__details th:contains("Entrenador")').next('td').text().trim();
      
      const squad: any[] = [];
      $('table.items').first().find('tbody > tr').each((i, tr) => {
        const link = $(tr).find('.hauptlink a').first();
        if (!link.length) return;
        squad.push({
          id: link.attr('href')?.match(/\/spieler\/(\d+)/)?.[1],
          name: link.text().trim(),
          photo: fixImageUrl($(tr).find('img').attr('data-src') || $(tr).find('img').attr('src')),
          position: $(tr).find('td:nth-child(2) table tr:nth-child(2) td').text().trim(),
          age: $(tr).find('td').eq(3).text().trim(),
          marketValue: $(tr).find('.rechts.hauptlink').text().trim()
        });
      });

      const trophies: any[] = [];
      $('.data-header__success-data a').each((i, el) => {
        trophies.push({ league: $(el).attr('title'), count: parseInt($(el).find('span').text()), image: fixImageUrl($(el).find('img').attr('src')) });
      });

      return res.status(200).json({ 
        id, name, logo, crest: logo, 
        coach: { name: coachName.split('(')[0].trim(), age: coachName.match(/\((\d+)\)/)?.[1] || '' },
        venue: { name: $('.data-header__details th:contains("Estadio")').next('td').text().trim() },
        squad, trophies, 
        founded: $('.data-header__details th:contains("Fundado")').next('td').text().trim(),
        country: $('.data-header__club-link').text().trim()
      });
    }

    if (type === 'competition') {
      const url = COMPETITIONS[id]?.url || `https://www.transfermarkt.es/league/tabelle/wettbewerb/${id}`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const tableData: any[] = [];
      
      $('table.items').first().find('tbody > tr').each((i, tr) => {
        if ($(tr).hasClass('spacer')) return;
        const tds = $(tr).find('td');
        if (tds.length < 5) return;
        const link = tds.find('a[href*="/verein/"]').first();
        const goals = tds.eq(7).text().trim().split(':');
        tableData.push({
          position: parseInt(tds.eq(0).text()),
          team: { id: link.attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: link.text().trim(), logo: fixImageUrl(tds.eq(1).find('img').attr('src')), crest: fixImageUrl(tds.eq(1).find('img').attr('src')) },
          playedGames: parseInt(tds.eq(3).text()),
          won: parseInt(tds.eq(4).text()),
          draw: parseInt(tds.eq(5).text()),
          lost: parseInt(tds.eq(6).text()),
          goalsFor: parseInt(goals[0]), goalsAgainst: parseInt(goals[1]),
          points: parseInt(tds.eq(9).text()),
          goalDifference: parseInt(tds.eq(8).text()),
          form: tds.eq(10).find('.tm-form-chart__dot').map((_, e) => $(e).hasClass('tm-form-chart__dot--win') ? 'W' : ($(e).hasClass('tm-form-chart__dot--draw') ? 'D' : 'L')).get().join('')
        });
      });

      return res.status(200).json({ competition: { id, name: id, emblem: fixImageUrl($('.data-header__profile-container img').attr('src')) }, standings: [{ type: 'TOTAL', table: tableData }] });
    }

    return res.status(404).send('Not found');
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
