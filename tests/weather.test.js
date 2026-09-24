import test from "node:test";
import assert from "node:assert/strict";
import {
  activityScore,
  deriveAlerts,
  deriveInsights,
  localSlot,
  value,
  weatherKind,
} from "../shared/weather.js";
import { coordinates, getWeather } from "../server/weather.js";

const benign = {
  temperature: 21,
  feelsLike: 21,
  rainProbability: 0,
  windSpeed: 5,
  humidity: 50,
  uv: 1,
  aqi: 25,
  weatherCode: 0,
  precipitation: 0,
  isDay: 1,
};
test("Missing observations are unavailable, never fabricated as zero", () => {
  assert.equal(value(null, "%"), "—");
  assert.equal(activityScore({ ...benign, rainProbability: null }).score, null);
  assert.deepEqual(activityScore({ ...benign, aqi: null }).missing, ["aqi"]);
});
test("Activity scores respond to adverse conditions and enforce storm limits", () => {
  assert.equal(activityScore(benign).score, 100);
  assert.ok(
    activityScore({ ...benign, rainProbability: 80 }).score <
      activityScore(benign).score,
  );
  assert.ok(activityScore({ ...benign, weatherCode: 95 }).score <= 15);
  assert.ok(activityScore({ ...benign, windSpeed: 80 }).score <= 15);
  assert.ok(
    activityScore({ ...benign, uv: 9 }, "running", { uvSensitive: true })
      .score < activityScore({ ...benign, uv: 9 }).score,
  );
});
test("Coordinates reject invalid input and preserve exact selected coordinates", () => {
  for (const pair of [
    [null, 20],
    ["", 20],
    [91, 0],
    [0, 181],
    ["hello", 1],
  ])
    assert.throws(() => coordinates(...pair));
  assert.deepEqual(coordinates("21.028511", "105.804817"), {
    latitude: 21.028511,
    longitude: 105.804817,
  });
  assert.deepEqual(coordinates(0, 0), { latitude: 0, longitude: 0 });
});
test("Alerts are bounded to contiguous forecast events and missing visibility is not hazardous", () => {
  const hourly = [0, 1, 2, 3, 4].map((n) => ({
    ...benign,
    time: `2026-09-24T${10 + n}:00`,
    uv: [1, 8, 9, 1, 8][n],
    visibility: null,
  }));
  const alerts = deriveAlerts({ hourly });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].start, "2026-09-24T11:00");
  assert.equal(alerts[0].end, "2026-09-24T12:00");
  assert.match(alerts[0].source, /không phải cảnh báo chính thức/);
});
test("Recommendations use forecast hours and display a date across midnight", () => {
  const first = {
    ...benign,
    time: "2026-09-24T23:00",
    isDay: 0,
    rainProbability: 80,
  };
  const next = { ...benign, time: "2026-09-25T06:00" };
  const insight = deriveInsights({ hourly: [first, next] });
  assert.equal(insight.best.time, next.time);
  assert.equal(localSlot(next.time, first.time), "06:00 · 25/09");
  assert.equal(weatherKind(95, 0), "storm");
});
test("Weather service forwards exact coordinates, normalizes missing AQI and caches requests", async () => {
  const original = globalThis.fetch,
    urls = [];
  const time = new Date().toISOString().slice(0, 13) + ":00";
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes("air-quality")) throw new Error("offline");
    if (String(url).includes("nominatim"))
      return {
        ok: true,
        json: async () => ({ address: { city: "Test City" } }),
      };
    return {
      ok: true,
      json: async () => ({
        timezone: "UTC",
        latitude: 21,
        longitude: 105,
        current: { time, temperature_2m: 28 },
        hourly: {
          time: [time],
          temperature_2m: [28],
          precipitation_probability: [60],
        },
        daily: {
          time: ["2026-09-24"],
          weather_code: [3],
          temperature_2m_max: [30],
          temperature_2m_min: [25],
          sunrise: ["2026-09-24T06:00"],
          sunset: ["2026-09-24T18:00"],
          uv_index_max: [null],
          precipitation_probability_max: [60],
          precipitation_sum: [2],
          wind_speed_10m_max: [10],
        },
      }),
    };
  };
  try {
    const a = await getWeather(21.028512, 105.804818),
      b = await getWeather(21.028512, 105.804818);
    assert.equal(a, b);
    assert.equal(urls.length, 3);
    assert.ok(
      urls.some((url) =>
        url.includes("latitude=21.028512&longitude=105.804818"),
      ),
    );
    assert.equal(a.location.latitude, 21.028512);
    assert.equal(a.modelGrid.latitude, 21);
    assert.equal(a.current.aqi, null);
    assert.equal(a.current.visibility, null);
    assert.equal(a.airQuality.available, false);
    assert.ok(a.fetchedAt);
  } finally {
    globalThis.fetch = original;
  }
});
