/**
 * Weather Dashboard
 * City Search
 * 5-day forecast
 */

'use strict';

//DOM LOOKUPS
const form = document.getElementById('search-form');
const cityInput = document.getElementById('city');
const currentEl = document.getElementById('current');
const forecastEl = document.getElementById('forecast');
const errorEl = document.getElementById('error');
const unitToggle = document.getElementById('unit-toggle');
const geoBtn = document.getElementById('geo-btn');
const forecastGrid = document.getElementById('forecast-grid');

let lastLocation = null;

//EVENT HANDLERS

/**
 * Handles search form
 * geocodes city
 * fetches weather app
 * renders forecast panels
 */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;

  //shows that it is in progress
  showError('');
  currentEl.innerHTML = 'Looking up location…';
  forecastEl.innerHTML = '';

  try {
    //gets Lat/Lon for the city
    const loc = await geocodeCity(city);
    if (!loc) {
      currentEl.innerHTML = '';
      showError('City not found. Try again.');
      return;
    }
    lastLocation = loc;

    currentEl.innerHTML = `Location: ${loc.name}, ${loc.country}<br>Fetching weather…`;

    //fetches weather using unit chosen (C/F)
    const useF = unitToggle.checked;
    const unitParam = useF ? 'fahrenheit' : 'celsius';
    const data = await fetchWeather(loc.latitude, loc.longitude, unitParam);

    //render panels
    renderCurrent(loc, data, useF);
    renderForecast(data, useF);
  } catch (err) {
    console.error(err);
    currentEl.innerHTML = '';
    forecastEl.innerHTML = '';
    showError('Something went wrong fetching weather.');
  }
});

/**
 * Handles the current location feature
 * browser asks for current location
 * fetches coordinates
 */


geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }
  showError('');
  geoBtn.disabled = true;
  geoBtn.textContent = 'Locating…';

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const useF = unitToggle.checked;
      const unitParam = useF ? 'fahrenheit' : 'celsius';
      const data = await fetchWeather(latitude, longitude, unitParam);
      
      const loc = { name: 'Your location', country: '', latitude, longitude };
      lastLocation = loc;

      renderCurrent(loc, data, useF);
      renderForecast(data, useF);
    } catch (err) {
      console.error(err);
      showError('Could not fetch weather for your location.');
    } finally {
      geoBtn.disabled = false;
      geoBtn.textContent = 'Use my location';
    }
  }, (err) => {
    //permission denied/ unavailable
    showError(err?.message || 'Permission denied or unavailable.');
    geoBtn.disabled = false;
    geoBtn.textContent = 'Use my location';
  }, { enableHighAccuracy: true, timeout: 10000 });
});

/**
 * Handle °C/°F unit change
 * re-fetches the same place in new units
 */
unitToggle.addEventListener('change', async () => {
  if (!lastLocation) return;
  try {
    showError('');
    currentEl.innerHTML = `Location: ${lastLocation.name}${lastLocation.country ? ', ' + lastLocation.country : ''}<br>Fetching weather…`;
    forecastEl.innerHTML = '';

    const useF = unitToggle.checked;
    const unitParam = useF ? 'fahrenheit' : 'celsius';
    const data = await fetchWeather(lastLocation.latitude, lastLocation.longitude, unitParam);

    renderCurrent(lastLocation, data, useF);
    renderForecast(data, useF);
  } catch (err) {
    console.error(err);
    currentEl.innerHTML = '';
    forecastEl.innerHTML = '';
    showError('Something went wrong fetching weather.');
  }
});

//api helpers
/**
 * geocode city using Open-Meteo's API
 * @param {string} name City 
 * @returns {Promise<{name:string,country:string,latitude:number,longitude:number} | null>}
 */
async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status}`);
  const json = await res.json();
  if (!json.results || json.results.length === 0) return null;
  const r = json.results[0];
  return { name: r.name, country: r.country, latitude: r.latitude, longitude: r.longitude };
}

/**
 * Fetch current + daily forecast from Open-Meteo for given coords.
 * @param {number} lat
 * @param {number} lon
 * @param {'celsius'|'fahrenheit'} tempUnit
 * @returns {Promise<any>} Open-Meteo response JSON
 */
async function fetchWeather(lat, lon, tempUnit) {
  //Daily array to store weather info
  const daily = [
    'temperature_2m_max',
    'temperature_2m_min',
    'weathercode',
    'precipitation_probability_max',
  ].join(',');

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true&daily=${daily}` +
    `&timezone=auto&temperature_unit=${tempUnit}&windspeed_unit=mph`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
  return res.json();
}

// render helpers

/**
 * Show or clear an error message.
 * @param {string} msg
 */
function showError(msg) {
  errorEl.textContent = msg ?? '';
}

/**
 * Render the "Current" panel (icon + temp + wind).
 * @param {{name:string,country:string}} loc
 * @param {*} data Open-Meteo response
 * @param {boolean} useF true => °F, false => °C
 */
function renderCurrent(loc, data, useF) {
  const unit = useF ? '°F' : '°C';

  //temp, wind speed, weathercode, time
  const c = data.current_weather;
  const desc = weatherCodeToText(c.weathercode);
  const isDay = c.is_day === 1;

  //rebuilds content each time
  currentEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h2>Current — ${loc.name}${loc.country ? ', ' + loc.country : ''}</h2>
    <div class="big-temp" style="display:flex; align-items:center; gap:10px;">
      <span><strong>${Math.round(c.temperature)}${unit}</strong> — ${desc}</span>
    </div>
    <div><strong>Wind:</strong> ${Math.round(c.windspeed)} mph</div>
    <div><strong>Updated:</strong> ${new Date(c.time).toLocaleString()}</div>`;

  //inserts icon before the temp label
  wrap.querySelector('.big-temp').prepend(makeIconImg(c.weathercode, isDay));
  currentEl.appendChild(wrap);
}

/**
 * Render the 5-day forecast grid.
 * @param {*} data Open-Meteo response
 * @param {boolean} useF true => °F, false => °C
 */
function renderForecast(data, useF) {
  const d = data.daily;
  const unit = useF ? '°F' : '°C';

  // build a grid inside forecastEl
  forecastEl.innerHTML = `<h2>5-Day Forecast</h2>
    <div id="forecast-grid" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));"></div>`;
  const grid = document.getElementById('forecast-grid');

  for (let i = 0; i < Math.min(5, d.time.length); i++) {
    const dateStr = new Date(d.time[i]).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const hi = Math.round(d.temperature_2m_max[i]);
    const lo = Math.round(d.temperature_2m_min[i]);
    const code = d.weathercode[i];
    const precip = d.precipitation_probability_max?.[i];

    const card = document.createElement('div');
    card.className = 'day';

    //Inline CSS to keep demo self-contained
    card.style.cssText = 'border:1px solid #eee;border-radius:8px;padding:10px;background:#fff;';
    card.innerHTML = `
      <div><strong>${dateStr}</strong></div>
      <div class="desc">${weatherCodeToText(code)}</div>
      <div><span class="hi">${hi}${unit}</span> / <span class="lo">${lo}${unit}</span></div>
      ${Number.isFinite(precip) ? `<div>💧 ${precip}%</div>` : ''}`;

    //puts icon at the top of card
    card.prepend(makeIconImg(code, true));
    grid.appendChild(card);
  }

}

//Icon/ Text Mapping
/**
 * Map Open-Meteo weather codes
 * (Collapsed families for brevity.)
 * Docs: https://open-meteo.com/en/docs
 */
function weatherCodeToText(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle (dense)',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Freezing rain (light)',
    67: 'Freezing rain (heavy)',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers (slight)',
    81: 'Rain showers (moderate)',
    82: 'Rain showers (violent)',
    85: 'Snow showers (slight)',
    86: 'Snow showers (heavy)',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] ?? '—';
}


/**
 * Return a small inline icon element
 * - Here: emoji for portability 
 * @param {number} code Open-Meteo weather code
 * @param {boolean} isDay choose day/night variant for some codes
 * @returns {HTMLElement} span containing the icon
 */
function makeIconImg(code, isDay) {
  //emoji fallback
  let emoji = '🌡️';
  if ([0].includes(code)) emoji = isDay ? '☀️' : '🌙';
  else if ([1,2].includes(code)) emoji = '⛅';
  else if ([3].includes(code)) emoji = '☁️';
  else if ([45,48].includes(code)) emoji = '🌫️';
  else if ([51,53,55].includes(code)) emoji = '🌦️';
  else if ([61,63,65,80,81,82].includes(code)) emoji = '🌧️';
  else if ([66,67].includes(code)) emoji = '🌧️❄️';
  else if ([71,73,75,77,85,86].includes(code)) emoji = '❄️';
  else if ([95,96,99].includes(code)) emoji = '⛈️';
  const span = document.createElement('span');
  span.textContent = emoji;
  span.style.fontSize = '1.4rem';
  return span;
}

// TODO:
// - Dark mode toggle
// - Hourly temperature chart (Chart.js)
// - Reverse geocode coords -> city for geolocation
