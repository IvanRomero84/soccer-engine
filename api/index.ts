import axios from 'axios';
import * as cheerio from 'cheerio';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

const getHeaders = () => ({
  'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Referer': 'https://www.transfermarkt.es/'
});

const COMPETITIONS: Record<string, { name: string, url: string }> = {
  'PD': { name: 'La Liga', url: 'https://www.transfermarkt.es/laliga/tabelle/wettbewerb/ES1' },
  'PL': { name: 'Premier League', url: 'https://www.transfermarkt.es/premier-league/tabelle/wettbewerb/GB1' },
  'BL1': { name: 'Bundesliga', url: 'https://www.transfermarkt.es/bundesliga/tabelle/wettbewerb/L1' },
  'SA': { name: 'Serie A', url: 'https://www.transfermarkt.es/serie-a/tabelle/wettbewerb/IT1' },
  'FL1': { name: 'Ligue 1', url: 'https://www.transfermarkt.es/ligue-1/tabelle/wettbewerb/FR1' },
  'DED': { name: 'Eredivisie', url: 'https://www.transfermarkt.es/eredivisie/tabelle/wettbewerb/NL1' },
  'PPL': { name: 'Primeira Liga', url: 'https://www.transfermarkt.es/liga-nos/tabelle/wettbewerb/PO1' }
};

function fixImageUrl(url: string | undefined): string {
  if (!url || url.includes('placeholder')) return '';
  let fixed = url.startsWith('//') ? `https:${url}` : (url.startsWith('/') ? `https://www.transfermarkt.es${url}` : url);
  return fixed.replace('/tiny/', '/big/').replace('/small/', '/big/').replace('/medium/', '/big/').replace('/header/', '/big/').replace('/portrait_small/', '/header/');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || '';
  const { type: qType, id: qId, season: qSeason } = req.query;
  let type = String(qType || ''), id = String(qId || ''), season = String(qSeason || '');

  // Detect type and ID from path if not in query
  if (path.includes('competitions')) { type = 'competition'; id = id || path.split('competitions/')[1]?.split(/[/?]/)[0]; }
  else if (path.includes('teams')) { type = 'club'; id = id || path.split('teams/')[1]?.split(/[/?]/)[0]; }

  try {
    if (type === 'club') {
      // Intentar buscar el club directamente por ID. Si falla 404, es que el ID no es de Transfermarkt.
      const url = `https://www.transfermarkt.es/startseite/verein/${id}`;
      const { data: html } = await axios.get(url, { headers: getHeaders(), timeout: 8000 });
      const $ = cheerio.load(html);
      
      const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ') || $('.data-header__profile-container img').attr('alt') || '';
      const logo = fixImageUrl($('.data-header__profile-container img').attr('src'));
      const coachLabel = $('.data-header__details th:contains("Entrenador")');
      const coachName = coachLabel.next('td').text().trim();
      
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
          marketValue: $(tr).find('.rechts.hauptlink').text().trim(),
          number: $(tr).find('.rn_nummer').text().trim()
        });
      });

      const trophies: any[] = [];
      $('.data-header__success-data a').each((i, el) => {
        trophies.push({ league: $(el).attr('title'), count: parseInt($(el).find('span').text()) || 1, image: fixImageUrl($(el).find('img').attr('src')) });
      });

      return res.status(200).json({ 
        id, name, logo, crest: logo, 
        coach: { name: coachName.split('(')[0].trim(), age: coachName.match(/\((\d+)\)/)?.[1] || '' },
        venue: { name: $('.data-header__details th:contains("Estadio")').next('td').text().trim() },
        squad, trophies, founded: $('.data-header__details th:contains("Fundado")').next('td').text().trim(), country: $('.data-header__club-link').text().trim()
      });
    }

    if (type === 'competition') {
      const comp = COMPETITIONS[id];
      const seasonPart = season ? `/saison_id/${season}` : '';
      
      if (path.includes('/matches')) {
        const matchUrl = comp ? comp.url.replace('/tabelle/', '/gesamtspielplan/') + seasonPart : `https://www.transfermarkt.es/league/gesamtspielplan/wettbewerb/${id}${seasonPart}`;
        const { data: mHtml } = await axios.get(matchUrl, { headers: getHeaders(), timeout: 8000 });
        const $m = cheerio.load(mHtml);
        const matches: any[] = [];
        $m('.box').each((i, box) => {
          const roundName = $m(box).find('h2').text().trim();
          $m(box).find('tr').each((j, tr) => {
            const tds = $m(tr).find('td');
            if (tds.length < 5) return;
            const homeCell = tds.filter((_, el) => $m(el).hasClass('text-right') && $m(el).find('a').length > 0).first();
            const awayCell = tds.filter((_, el) => $m(el).hasClass('no-border-links') && $m(el).find('a').length > 0).last();
            const score = tds.find('a[href*="/ergebnis/"]').text().trim();
            if (!homeCell.length || !awayCell.length) return;
            matches.push({
              id: Math.random().toString(36).substr(2, 9),
              round: roundName,
              homeTeam: { id: homeCell.find('a').attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: homeCell.find('a').text().trim(), logo: fixImageUrl(homeCell.next('td').find('img').attr('src')) },
              awayTeam: { id: awayCell.find('a').attr('href')?.match(/\/verein\/(\d+)/)?.[1], name: awayCell.find('a').text().trim(), logo: fixImageUrl(awayCell.prev('td').find('img').attr('src')) },
              status: score.includes(':') ? 'NS' : 'FT',
              goals: { home: score.split(':')[0] || null, away: score.split(':')[1] || null }
            });
          });
        });
        return res.status(200).json({ matches });
      }

      const tableUrl = (comp ? comp.url : `https://www.transfermarkt.es/league/tabelle/wettbewerb/${id}`) + seasonPart;
      const { data: tHtml } = await axios.get(tableUrl, { headers: getHeaders(), timeout: 8000 });
      const $ = cheerio.load(tHtml);
      const tableData: any[] = [];
      
      $('table.items').first().find('tbody > tr').each((i, tr) => {
        if ($(tr).hasClass('spacer')) return;
        const tds = $(tr).find('td');
        if (tds.length < 8) return;
        const link = tds.find('a[href*="/verein/"]').first();
        const goals = tds.eq(7).text().trim().split(':');
        let form = '';
        tds.each((idx, td) => {
          const dots = $(td).find('.tm-form-chart__dot');
          if (dots.length > 0) form = dots.map((_, e) => $(e).hasClass('tm-form-chart__dot--win') ? 'W' : ($(e).hasClass('tm-form-chart__dot--draw') ? 'D' : 'L')).get().join('');
        });

        tableData.push({
          position: parseInt(tds.eq(0).text()),
          team: { 
            id: link.attr('href')?.match(/\/verein\/(\d+)/)?.[1], // Este es el ID real de Transfermarkt
            name: link.text().trim(), 
            logo: fixImageUrl(tds.eq(1).find('img').attr('src')),
            crest: fixImageUrl(tds.eq(1).find('img').attr('src'))
          },
          playedGames: parseInt(tds.eq(3).text()), won: parseInt(tds.eq(4).text()), draw: parseInt(tds.eq(5).text()), lost: parseInt(tds.eq(6).text()),
          goalsFor: parseInt(goals[0]), goalsAgainst: parseInt(goals[1]),
          points: parseInt(tds.eq(9).text()), goalDifference: parseInt(tds.eq(8).text()), form
        });
      });
      return res.status(200).json({ competition: { id, name: id, emblem: fixImageUrl($('.data-header__profile-container img').attr('src')) }, standings: [{ type: 'TOTAL', table: tableData }] });
    }
    return res.status(404).send('Not found');
  } catch (e: any) {
    return res.status(500).json({ error: `TM Error: ${e.message}` });
  }
}
