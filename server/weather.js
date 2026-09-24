import { deriveAlerts } from "../shared/weather.js";

const cache = new Map();
export async function jsonFetch(url, options = {}) {
  const { timeoutMs = 18000, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(
      `Nguồn dữ liệu tạm không phản hồi (${response.status}). Vui lòng thử lại.`,
    );
  return response.json();
}
export function coordinates(lat, lon) {
  if (lat == null || lon == null || lat === "" || lon === "")
    throw new Error("Thiếu tọa độ.");
  const latitude = Number(lat),
    longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error("Tọa độ không hợp lệ.");
  return { latitude, longitude };
}
export class WeatherProvider {
  async getForecast() {
    throw new Error("Provider chưa được cấu hình");
  }
  async getAirQuality() {
    return null;
  }
  async getCurrentWeather(lat, lon) {
    return (await this.getForecast(lat, lon)).current;
  }
  async getHourlyForecast(lat, lon) {
    return (await this.getForecast(lat, lon)).hourly;
  }
  async getDailyForecast(lat, lon) {
    return (await this.getForecast(lat, lon)).daily;
  }
  async getWeatherAlerts() {
    return [];
  }
}
export class OpenMeteoProvider extends WeatherProvider {
  async getForecast(latitude, longitude) {
    const params = new URLSearchParams({
      latitude,
      longitude,
      timezone: "auto",
      forecast_days: "7",
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m",
      hourly:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_direction_10m,uv_index,is_day,cloud_cover,pressure_msl",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    });
    return jsonFetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  }
  async getAirQuality(latitude, longitude) {
    return jsonFetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ latitude, longitude, timezone: "auto", hourly: "us_aqi", forecast_days: "5" })}`,
    );
  }
}
export async function geocode(query) {
  if (query.trim().length < 2) return [];
  const data = await jsonFetch(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: "8", language: "vi", format: "json" })}`,
  );
  return (data.results || []).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    name: p.name,
    city: p.name,
    country: p.country,
    countryCode: p.country_code,
    province: p.admin1,
    timezone: p.timezone,
    formattedAddress: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
  }));
}
let reverseQueue = Promise.resolve(),
  lastReverse = 0;
export async function reverseGeocode(latitude, longitude) {
  // Serialize public Nominatim requests to respect its one-request-per-second limit.
  const task = reverseQueue
    .catch(() => {})
    .then(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastReverse))),
      );
      lastReverse = Date.now();
      const r = await jsonFetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=vi`,
        {
          headers: { "User-Agent": "WeatherAI/1.0 (local weather dashboard)" },
        },
      );
      const a = r.address || {};
      return {
        country: a.country ?? null,
        countryCode: a.country_code ?? null,
        province: a.state ?? null,
        city: a.city || a.town || a.village || null,
        district: a.city_district || a.county || null,
        ward: a.suburb || a.quarter || null,
        neighborhood: a.neighbourhood ?? null,
        street: a.road ?? null,
        formattedAddress: r.display_name ?? null,
        name: a.city || a.town || a.village || a.state || "Vị trí đã chọn",
      };
    });
  reverseQueue = task;
  return task;
}
const provider = new OpenMeteoProvider();
const mapCache = new Map();
export async function getMapWeather(lat, lon) {
  const { latitude, longitude } = coordinates(lat, lon),
    key = `${latitude},${longitude}`;
  if (mapCache.has(key) && Date.now() - mapCache.get(key).at < 600000)
    return mapCache.get(key).promise;
  const points = [
    [-0.3, -0.4],
    [-0.3, 0],
    [-0.3, 0.4],
    [0, -0.4],
    [0, 0],
    [0, 0.4],
    [0.3, -0.4],
    [0.3, 0],
    [0.3, 0.4],
  ].map(([dy, dx]) => ({
    latitude: Math.max(-89.9, Math.min(89.9, latitude + dy)),
    longitude: ((longitude + dx + 540) % 360) - 180,
  }));
  const latitudes = points.map((p) => p.latitude).join(","),
    longitudes = points.map((p) => p.longitude).join(",");
  const promise = (async () => {
    const params = new URLSearchParams({
      latitude: latitudes,
      longitude: longitudes,
      timezone: "GMT",
      forecast_days: "1",
      current:
        "temperature_2m,precipitation,cloud_cover,wind_speed_10m,weather_code",
      hourly: "uv_index",
    });
    const [raw, air] = await Promise.all([
      jsonFetch(`https://api.open-meteo.com/v1/forecast?${params}`),
      jsonFetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({ latitude: latitudes, longitude: longitudes, timezone: "GMT", hourly: "us_aqi", forecast_days: "1" })}`,
      ).catch(() => null),
    ]);
    return {
      provider: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
      points: points.map((point, i) => {
        const r = raw[i],
          index = r.hourly.time.indexOf(r.current.time.slice(0, 13) + ":00"),
          aqIndex = air?.[i]?.hourly.time.indexOf(
            r.current.time.slice(0, 13) + ":00",
          );
        return {
          ...point,
          temperature: r.current.temperature_2m ?? null,
          rain: r.current.precipitation ?? null,
          cloud: r.current.cloud_cover ?? null,
          wind: r.current.wind_speed_10m ?? null,
          storm:
            r.current.weather_code == null
              ? null
              : r.current.weather_code >= 95
                ? 1
                : 0,
          uv: r.hourly.uv_index[index] ?? null,
          aqi: air?.[i]?.hourly.us_aqi[aqIndex] ?? null,
        };
      }),
    };
  })();
  mapCache.set(key, { at: Date.now(), promise });
  if (mapCache.size > 50) mapCache.delete(mapCache.keys().next().value);
  try {
    return await promise;
  } catch (error) {
    mapCache.delete(key);
    throw error;
  }
}
const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fields = {
  temperature: "temperature_2m",
  feelsLike: "apparent_temperature",
  humidity: "relative_humidity_2m",
  rainProbability: "precipitation_probability",
  precipitation: "precipitation",
  weatherCode: "weather_code",
  visibility: "visibility",
  windSpeed: "wind_speed_10m",
  windDirection: "wind_direction_10m",
  uv: "uv_index",
  isDay: "is_day",
  cloudCover: "cloud_cover",
  pressure: "pressure_msl",
};
export async function getWeather(lat, lon) {
  const { latitude, longitude } = coordinates(lat, lon);
  const key = `${latitude},${longitude}`;
  const old = cache.get(key);
  if (old && Date.now() - old.at < 5 * 60 * 1000) return old.promise;
  const promise = (async () => {
    const [raw, air, location] = await Promise.all([
      provider.getForecast(latitude, longitude),
      provider.getAirQuality(latitude, longitude).catch(() => null),
      reverseGeocode(latitude, longitude).catch(() => ({})),
    ]);
    const aq = new Map(
      (air?.hourly?.time || []).map((t, i) => [
        t,
        number(air.hourly.us_aqi[i]),
      ]),
    );
    const currentLocalTime = new Date()
      .toLocaleString("sv-SE", { timeZone: raw.timezone })
      .replace(" ", "T");
    const hourly = raw.hourly.time
      .map((time, i) => ({
        time,
        ...Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [
            k,
            number(raw.hourly[v]?.[i]),
          ]),
        ),
        aqi: aq.get(time) ?? null,
      }))
      .filter((h) => h.time >= currentLocalTime.slice(0, 13) + ":00");
    const nearest = raw.hourly.time.indexOf(
      raw.current.time.slice(0, 13) + ":00",
    );
    const current = {
      time: raw.current.time,
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [
          k,
          number(raw.current[v] ?? raw.hourly[v]?.[nearest]),
        ]),
      ),
      aqi: aq.get(raw.current.time.slice(0, 13) + ":00") ?? null,
    };
    const daily = raw.daily.time.map((date, i) => ({
      date,
      weatherCode: number(raw.daily.weather_code[i]),
      max: number(raw.daily.temperature_2m_max[i]),
      min: number(raw.daily.temperature_2m_min[i]),
      sunrise: raw.daily.sunrise[i],
      sunset: raw.daily.sunset[i],
      uv: number(raw.daily.uv_index_max[i]),
      rainProbability: number(raw.daily.precipitation_probability_max[i]),
      precipitation: number(raw.daily.precipitation_sum[i]),
      windSpeed: number(raw.daily.wind_speed_10m_max[i]),
    }));
    const result = {
      provider: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
      timezone: raw.timezone,
      currentLocalTime,
      location: { ...location, latitude, longitude, timezone: raw.timezone },
      modelGrid: { latitude: raw.latitude, longitude: raw.longitude },
      current,
      hourly,
      daily,
      airQuality: { available: !!air, standard: "US AQI" },
      officialAlerts: [],
      officialAlertsAvailable: false,
    };
    result.alerts = deriveAlerts(result);
    return result;
  })();
  cache.set(key, { at: Date.now(), promise });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}
