/* SkyNow - Weather App */
/* Data: Open-Meteo (https://open-meteo.com/) */

(() => {
    const els = {
        themeToggle: document.getElementById('theme-toggle'),
        unitToggle: document.getElementById('unit-toggle'),
        status: document.getElementById('status'),
        form: document.getElementById('search-form'),
        input: document.getElementById('search-input'),
        geoBtn: document.getElementById('geo-btn'),
        current: document.getElementById('current'),
        hourly: document.getElementById('hourly'),
        daily: document.getElementById('daily')
    };

    const STORE = {
        get theme() {
            return localStorage.getItem('theme') || 'light'; // default to light
        },
        set theme(v) {
            localStorage.setItem('theme', v);
        },
        get units() {
            return localStorage.getItem('units') || 'metric';
        },
        set units(v) {
            localStorage.setItem('units', v);
        },
        get lastCity() {
            return localStorage.getItem('lastCity') || '';
        },
        set lastCity(v) {
            localStorage.setItem('lastCity', v);
        },
    };


    // Weather code mapping (emoji + text)
    const W = {
        0: ["☀️", "Clear sky"],
        1: ["🌤️", "Mainly clear"],
        2: ["⛅️", "Partly cloudy"],
        3: ["☁️", "Overcast"],
        45: ["🌫️", "Fog"],
        48: ["🌫️", "Depositing rime fog"],
        51: ["🌦️", "Light drizzle"],
        53: ["🌦️", "Moderate drizzle"],
        55: ["🌧️", "Dense drizzle"],
        56: ["🌧️", "Freezing drizzle"],
        57: ["🌧️", "Dense freezing drizzle"],
        61: ["🌧️", "Slight rain"],
        63: ["🌧️", "Moderate rain"],
        65: ["🌧️", "Heavy rain"],
        66: ["🌧️", "Freezing rain"],
        67: ["🌧️", "Heavy freezing rain"],
        71: ["🌨️", "Slight snow"],
        73: ["🌨️", "Moderate snow"],
        75: ["❄️", "Heavy snow"],
        77: ["❄️", "Snow grains"],
        80: ["🌦️", "Rain showers"],
        81: ["🌧️", "Heavy rain showers"],
        82: ["⛈️", "Violent rain showers"],
        85: ["🌨️", "Snow showers"],
        86: ["❄️", "Heavy snow showers"],
        95: ["⛈️", "Thunderstorm"],
        96: ["⛈️", "Thunderstorm w/ hail"],
        99: ["⛈️", "Thunderstorm w/ hail"],
    };

    // ---- Theme ----
    function applyTheme(pref = STORE.theme) {
        const html = document.documentElement;
        html.setAttribute('data-theme', pref);
        els.themeToggle.setAttribute('aria-pressed', pref === 'dark' ? 'true' : 'false');
    }


    // ---- Units ----
    function isMetric() { return STORE.units === 'metric'; }
    function cToF(c) { return (c * 9 / 5) + 32; }
    function kmhToMph(k) { return k * 0.621371; }

    function fmtTemp(c) {
        return isMetric() ? `${Math.round(c)}°C` : `${Math.round(cToF(c))}°F`;
    }
    function fmtWind(kmh) {
        return isMetric() ? `${Math.round(kmh)} km/h` : `${Math.round(kmhToMph(kmh))} mph`;
    }
    function degToCompass(deg) {
        const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return dirs[Math.round(deg / 22.5) % 16];
    }
    function timeLocal(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function dayName(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString([], { weekday: 'short' });
    }

    // ---- UI helpers ----
    function setStatus(msg, type = '') {
        els.status.textContent = msg || '';
        els.status.className = 'status' + (type ? ' ' + type : '');
    }
    function clearPanelsLoading() {
        for (const el of [els.current, els.hourly, els.daily]) el.innerHTML = '';
    }
    function loadingPanels() {
        els.current.innerHTML = `<div class="card loading" style="height:120px;border-radius:14px;"></div>`;
        els.hourly.innerHTML = `<div class="tile loading" style="height:100px;border-radius:14px;"></div>`.repeat(6);
        els.daily.innerHTML = `<div class="tile loading" style="height:120px;border-radius:14px;"></div>`.repeat(7);
    }

    // ---- API ----
    async function geocodeCity(name) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding failed');
        const data = await res.json();
        if (!data.results || !data.results.length) throw new Error('City not found');
        const r = data.results[0];
        return { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.country ? ', ' + r.country : ''}` };
    }

    async function fetchWeather(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            timezone: 'auto',
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'is_day',
                'precipitation',
                'weather_code',
                'wind_speed_10m',
                'wind_direction_10m'
            ].join(','),
            hourly: [
                'temperature_2m',
                'weather_code',
                'precipitation_probability'
            ].join(','),
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_mean'
            ].join(',')
        });

        const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        return res.json();
    }

    // ---- Renderers ----
    function renderCurrent(data, label) {
        const c = data.current;
        const [emoji, desc] = W[c.weather_code] || ["❓", "N/A"];

        els.current.innerHTML = `
      <div class="card">
        <div class="big" aria-hidden="true">${emoji}</div>
        <div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            <h3 style="margin:0;">${label || "Current location"}</h3>
            <span class="chip" title="Feels like">${fmtTemp(c.apparent_temperature)}</span>
          </div>
          <div class="kv" style="margin-top:8px;">
            <span>Condition</span><b>${desc}</b>
            <span>Temperature</span><b>${fmtTemp(c.temperature_2m)}</b>
            <span>Humidity</span><b>${c.relative_humidity_2m}%</b>
            <span>Wind</span><b>${fmtWind(c.wind_speed_10m)} ${degToCompass(c.wind_direction_10m)}</b>
            <span>Precip</span><b>${Math.round(c.precipitation || 0)} mm</b>
          </div>
        </div>
      </div>
    `;
    }

    function renderHourly(data) {
        const t = data.hourly.time;
        const temps = data.hourly.temperature_2m;
        const codes = data.hourly.weather_code;
        const pops = data.hourly.precipitation_probability;

        // Find current index (closest hour >= now)
        const now = Date.now();
        let start = t.findIndex(x => new Date(x).getTime() >= now);
        if (start < 0) start = 0;

        const count = 12;
        const items = [];
        for (let i = start; i < Math.min(start + count, t.length); i++) {
            const [emoji, desc] = W[codes[i]] || ["❓", "N/A"];
            items.push(`
        <div class="tile" title="${desc}">
          <div>${timeLocal(t[i])}</div>
          <div class="em" aria-hidden="true">${emoji}</div>
          <div><b>${fmtTemp(temps[i])}</b></div>
          <div class="muted">${pops?.[i] ?? 0}% rain</div>
        </div>
      `);
        }
        els.hourly.innerHTML = items.join('');
    }

    function renderDaily(data) {
        const t = data.daily.time;
        const code = data.daily.weather_code;
        const tmax = data.daily.temperature_2m_max;
        const tmin = data.daily.temperature_2m_min;
        const pop = data.daily.precipitation_probability_mean;

        const items = t.map((d, i) => {
            const [emoji, desc] = W[code[i]] || ["❓", "N/A"];
            return `
        <div class="tile" title="${desc}">
          <div class="muted">${dayName(d)}</div>
          <div class="em" aria-hidden="true">${emoji}</div>
          <div><b>${fmtTemp(tmax[i])}</b> / <span class="muted">${fmtTemp(tmin[i])}</span></div>
          <div class="muted">${pop?.[i] ?? 0}% rain</div>
        </div>
      `;
        });
        els.daily.innerHTML = items.join('');
    }

    async function updateByCoords(lat, lon, label = '') {
        try {
            setStatus('Fetching weather… ⛅');
            loadingPanels();
            const data = await fetchWeather(lat, lon);
            clearPanelsLoading();
            renderCurrent(data, label);
            renderHourly(data);
            renderDaily(data);
            setStatus('Ready ✅');
        } catch (err) {
            clearPanelsLoading();
            console.error(err);
            setStatus('Something went wrong fetching weather. Please try again. ❌', 'error');
        }
    }

    async function updateByCity(name) {
        try {
            setStatus(`Searching “${name}”… 🔎`);
            loadingPanels();
            const g = await geocodeCity(name);
            STORE.lastCity = g.label;
            await updateByCoords(g.lat, g.lon, g.label);
        } catch (err) {
            clearPanelsLoading();
            console.error(err);
            setStatus(err.message.includes('not found') ? 'City not found. Try another name. 🙏' : 'Search failed. Please try again. ❌', 'error');
        }
    }

    // ---- Events ----
    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = (els.input.value || '').trim();
        if (q) updateByCity(q);
    });

    els.geoBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            setStatus('Geolocation not supported in this browser. ⚠️', 'warn');
            return;
        }
        setStatus('Locating… 📍');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                updateByCoords(latitude, longitude, 'Your location');
            },
            (err) => {
                console.warn(err);
                setStatus('Location permission denied or unavailable. ❌ Try searching a city.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    });

    els.themeToggle.addEventListener('click', () => {
        STORE.theme = STORE.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
    });


    els.unitToggle.addEventListener('click', () => {
        STORE.units = isMetric() ? 'imperial' : 'metric';
        els.unitToggle.setAttribute('aria-pressed', STORE.units === 'imperial' ? 'true' : 'false');
        // Re-render last search/location quickly by triggering the same fetch again:
        const last = STORE.lastCity;
        if (last) {
            updateByCity(last);
        } else {
            // No last city—try geolocate silently (may fail if denied)
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => updateByCoords(pos.coords.latitude, pos.coords.longitude, 'Your location')
                );
            }
        }
    });

    // ---- Init ----
    function initTheme() {
        applyTheme(); // apply saved theme immediately
        els.unitToggle.setAttribute('aria-pressed', STORE.units === 'imperial' ? 'true' : 'false');
    }


    async function initStart() {
        initTheme();
        // If there's a last city, load it; else try to use geolocation
        if (STORE.lastCity) {
            updateByCity(STORE.lastCity);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => updateByCoords(pos.coords.latitude, pos.coords.longitude, 'Your location'),
                () => setStatus('Tip: search for a city to begin. 🔍')
            );
        } else {
            setStatus('Tip: search for a city to begin. 🔍');
        }
    }

    document.addEventListener('DOMContentLoaded', initStart);
})();
