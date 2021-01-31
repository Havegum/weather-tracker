const fetch = require('node-fetch');
const data = require('@begin/data');

const table = 'persistence';
const key = 'nowcast';
const url = 'https://api.met.no/weatherapi/nowcast/2.0/complete?lat=60.39&lon=5.327';


function isOutOfDate ({ updated }) {
  const digits = updated.split(/\D/g).map(d => +d)
  digits[1]--;
  const date = new Date(...digits.slice(0, 6));
  const now = Date.now();

  const limit = 1000 * 60 * 60 * 2;
  return now - date > limit;
}

function parseWeather (nowcast) {
  const updated = nowcast.meta['updated_at'];

  const latestEntry = nowcast.timeseries[0].data;
  const symbol = latestEntry['next_1_hours'].summary['symbol_code'];
  const now = latestEntry.instant.details;

  const precipitationRate = nowcast.timeseries.map(d => [
    d.time,
    d.data.instant.details['precipitation_rate'],
  ]);

  return {
    temperature: now['air_temperature'],
    humidity: now['relative_humidity'],
    wind: {
      from: now['wind_from_direction'],
      speed: now['wind_speed'],
      gustSpeed: now['wind_speed_of_gust'],
    },
     precipitationRate,
     symbol,
     updated
  };
}


exports.handler = async function http (req) {
  let weather = await data.get({ table, key });
  if (weather) weather = weather.weather;

  if (weather == null || isOutOfDate(weather)) {
    const response = await fetch(url)
    const json = await response.json();
    weather = parseWeather(json.properties);
    data.set({ table, key, weather });
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf8',
      'cache-control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0'
    },
    body: JSON.stringify(weather),
  }
}
