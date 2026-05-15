
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

function fixImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.transfermarkt.es${url}`;
  return url;
}

async function test() {
  const url = 'https://www.transfermarkt.es/laliga/startseite/wettbewerb/ES1';
  const { data } = await axios.get(url, { headers: HEADERS });
  const $ = cheerio.load(data);
  
  const leagueEmblem = fixImageUrl($('.data-header__profile-container img').attr('src'));
  console.log('League Emblem:', leagueEmblem);
  
  $('h2').each((i, h2) => console.log(`H2 ${i}:`, $(h2).text().trim()));
  const $tables = $('table.items');
  console.log('Tables found:', $tables.length);
  
  $tables.each((i, table) => {
      console.log(`Table ${i} first row text:`, $(table).find('tr').first().text().trim().substring(0, 50));
  });
  const firstRow = $table.find('tr').eq(1); // Row 0 is header, Row 1 is spacer or first team
  // Wait, Transfermarkt tables sometimes have a spacer tr.
  
  $table.find('tr').each((i, tr) => {
      const $tds = $(tr).find('td');
      if ($tds.length >= 3) {
          const teamName = $tds.eq(2).text().trim();
          const crest = fixImageUrl($tds.eq(1).find('img').attr('src') || $tds.eq(1).find('img').attr('data-src'));
          console.log(`Team: ${teamName}, Crest: ${crest}`);
      }
  });
}

test();
