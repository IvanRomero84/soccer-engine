/**
 * @file extractors.js
 * Funciones para parsear el HTML de Transfermarkt usando Cheerio.
 */

import * as cheerio from 'cheerio';

/**
 * Extrae la plantilla de un club desde la página de inicio (startseite).
 * @param {string} html HTML de la página de inicio del club.
 */
export function extractSquad(html) {
  const $ = cheerio.load(html);
  const players = [];

  $('table.items > tbody > tr:not(.group-header)').each((i, el) => {
    const $row = $(el);
    
    const $link = $row.find('td.hauptlink a');
    let name = $link.text().trim();
    const profileUrl = $link.attr('href');
    const id = profileUrl ? profileUrl.split('/').pop() : null;

    // Limpiar nombre (a veces trae el valor de mercado pegado)
    name = name.split(/\s\s+/)[0].trim();

    const position = $row.find('table.inline-table tr:nth-child(2) td').text().trim();

    const ageText = $row.find('td:nth-child(3)').text().trim();
    const ageMatch = ageText.match(/\((\d+)\)/);
    const age = ageMatch ? parseInt(ageMatch[1]) : null;

    const marketValue = $row.find('td.rechts.hauptlink').text().trim();

    // Foto: Priorizar data-src (lazy load) y usar resolución 'big'
    let photo = $row.find('img.bilderrahmen-fixed').attr('data-src') || 
                $row.find('img.bilderrahmen-fixed').attr('src') || '';
    
    if (photo && !photo.includes('placeholder')) {
      photo = photo.replace('/small/', '/big/').replace('/medium/', '/big/').replace('/header/', '/big/');
    } else {
      photo = ''; // Clear placeholder
    }

    if (name) {
      players.push({
        id,
        name,
        position,
        age,
        marketValue,
        photo,
        profileUrl: profileUrl ? `https://www.transfermarkt.es${profileUrl}` : null
      });
    }
  });

  return players;
}

/**
 * Extrae estadísticas de rendimiento de los jugadores.
 * @param {string} html HTML de la página de leistungsdaten.
 */
export function extractPerformance(html) {
  const $ = cheerio.load(html);
  const stats = {};

  $('table.items > tbody > tr:not(.group-header)').each((i, el) => {
    const $row = $(el);
    const profileUrl = $row.find('td.hauptlink a').attr('href');
    const id = profileUrl ? profileUrl.split('/').pop() : null;

    if (id) {
      // Diferenciar entre porteros y jugadores de campo por la posición o columnas
      const isGK = $row.find('td.zentriert').text().includes('POR') || $row.find('td:nth-child(5)').text().includes('Portero');
      
      stats[id] = {
        goals: parseInt($row.find('td:nth-child(7)').text()) || 0,
        assists: parseInt($row.find('td:nth-child(8)').text()) || 0,
        yellowCards: parseInt($row.find('td:nth-child(9)').text()) || 0,
        secondYellows: parseInt($row.find('td:nth-child(10)').text()) || 0,
        redCards: parseInt($row.find('td:nth-child(11)').text()) || 0,
        minutes: parseInt($row.find('td:nth-child(15)').text().replace(/[^0-9]/g, '')) || 0,
        // Stats extra para porteros (si están en las columnas 12 y 13 en la vista plus=1)
        goalsConceded: isGK ? parseInt($row.find('td:nth-child(12)').text()) || 0 : undefined,
        cleanSheets: isGK ? parseInt($row.find('td:nth-child(13)').text()) || 0 : undefined
      };
    }
  });

  return stats;
}

/**
 * Extrae el palmarés histórico desde la página de éxitos (erfolge).
 * @param {string} html HTML de la página de éxitos del club.
 */
export function extractTrophies(html) {
  const $ = cheerio.load(html);
  const trophies = [];

  $('div.box').each((i, el) => {
    const title = $(el).find('h2').text().trim();
    if (!title) return;

    // Imagen del trofeo
    let image = $(el).find('img').attr('src') || '';
    if (image.includes('placeholder')) {
      image = $(el).find('img').attr('data-src') || image;
    }

    const match = title.match(/(\d+)x\s+(.+)/);
    if (match) {
      const count = parseInt(match[1]);
      const name = match[2];
      const seasons = $(el).find('div.erfolg_infotext_box').text().trim().split(',').map(s => s.trim());

      trophies.push({
        name,
        count,
        image,
        seasons: seasons.filter(s => s.length > 0)
      });
    }
  });

  return trophies;
}

/**
 * Extrae información detallada del estadio desde su página específica.
 * @param {string} html 
 */
export function extractStadiumDetailed(html) {
  const $ = cheerio.load(html);
  
  const image = $('.stadion-galerie img').first().attr('src') || $('.reveal img').first().attr('src');
  
  const getVal = (label) => {
    return $('table tr:has(th:contains("' + label + '")) td').first().text().trim();
  };

  return {
    image,
    yearBuilt: getVal('Año de construcción:'),
    pitchSize: getVal('Medidas del terreno de juego:'),
    surface: getVal('Superficie:'),
    address: getVal('Dirección:')
  };
}

/**
 * Extrae información básica del club desde el header.
 * @param {string} html 
 */
export function extractClubInfo(html) {
  const $ = cheerio.load(html);
  
  const name = $('h1.data-header__headline-wrapper').text().trim().replace(/\s\s+/g, ' ');
  const logo = $('header.data-header img.data-header__profile-image').attr('src');

  // Entrenador (Coach)
  const $coachLink = $('a[href*="/profil/trainer/"]').first();
  let coachName = $coachLink.text().trim();
  let coachPhoto = '';
  let coachAge = '';

  if ($coachLink.length) {
    const $coachBox = $coachLink.closest('.box, .team-staff-box, .data-header');
    coachPhoto = $coachBox.find('img').first().attr('src') || $coachBox.find('img').first().attr('data-src');
    coachAge = $coachBox.text().match(/Edad:?\s*(\d+)/)?.[1];
  }
  
  if (!coachName) {
    const $datosBox = $('.box:contains("Datos")');
    coachName = $datosBox.find('th:contains("Entrenador")').next('td').text().trim();
    if (!coachPhoto) coachPhoto = $datosBox.find('img').attr('src');
  }

  if (coachPhoto && coachPhoto.includes('placeholder')) {
    coachPhoto = ''; 
  }
  if (coachPhoto) {
    coachPhoto = coachPhoto.replace('/header/', '/big/').replace('/small/', '/big/').replace('/medium/', '/big/');
  }

  const coach = {
    name: coachName,
    photo: coachPhoto,
    age: coachAge
  };

  // Estadio (Info rápida)
  const $stadiumRow = $('.data-header__label:contains("Estadio")');
  const venue = {
    name: $stadiumRow.find('.data-header__content a').text().trim(),
    capacity: $stadiumRow.find('.tabellenplatz').text().replace(/[^0-9.]/g, '')
  };

  // Estadísticas rápidas de liga (Standings)
  const $standingBox = $('.box:has(h2:contains("Clasificación"))');
  const $row = $standingBox.find('tr.table-highlight');
  const seasonStats = {
    rank: parseInt($row.find('td:nth-child(1)').text()) || 0,
    played: parseInt($row.find('td:nth-child(4)').text()) || 0,
    goalsDiff: $row.find('td:nth-child(5)').text().trim(),
    points: parseInt($row.find('td:nth-child(6)').text()) || 0
  };

  return {
    name,
    logo,
    coach,
    venue,
    seasonStats
  };
}
