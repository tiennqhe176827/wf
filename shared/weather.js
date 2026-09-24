export const present = (v) => typeof v === "number" && Number.isFinite(v);
export const value = (v, suffix = "", digits = 0) =>
  present(v) ? `${v.toFixed(digits)}${suffix}` : "—";
export const hour = (time) => time?.slice(11, 16) || "—";
export const localSlot = (time, localNow) =>
  !time
    ? "—"
    : `${hour(time)}${time.slice(0, 10) !== localNow?.slice(0, 10) ? ` · ${time.slice(8, 10)}/${time.slice(5, 7)}` : ""}`;
export const weatherLabel = (code) =>
  code == null
    ? "Chưa có dữ liệu"
    : code === 0
      ? "Trời quang"
      : code <= 2
        ? "Mây rải rác"
        : code === 3
          ? "Nhiều mây"
          : code <= 48
            ? "Sương mù"
            : code <= 67
              ? "Trời mưa"
              : code <= 77
                ? "Tuyết rơi"
                : code <= 82
                  ? "Mưa rào"
                  : code <= 86
                    ? "Mưa tuyết"
                    : "Giông bão";
export const weatherKind = (code, day = 1) =>
  code == null
    ? "cloud"
    : code >= 95
      ? "storm"
      : (code >= 71 && code <= 77) || (code >= 85 && code <= 86)
        ? "snow"
        : code >= 51
          ? "rain"
          : !day
            ? "night"
            : code <= 1
              ? "sun"
              : "cloud";
export const activities = [
  { id: "running", name: "Chạy bộ", ideal: 21, rain: 0.42, icon: "run" },
  { id: "cycling", name: "Đạp xe", ideal: 23, rain: 0.42, icon: "bike" },
  { id: "walking", name: "Đi dạo", ideal: 24, rain: 0.32, icon: "walk" },
  { id: "picnic", name: "Dã ngoại", ideal: 25, rain: 0.5, icon: "tent" },
  {
    id: "photography",
    name: "Chụp ảnh",
    ideal: 24,
    rain: 0.22,
    icon: "camera",
  },
  { id: "laundry", name: "Phơi đồ", ideal: 30, rain: 0.6, icon: "shirt" },
  { id: "sport", name: "Thể thao", ideal: 21, rain: 0.4, icon: "run" },
  { id: "travel", name: "Di chuyển", ideal: 25, rain: 0.3, icon: "car" },
  { id: "dating", name: "Hẹn hò", ideal: 24, rain: 0.3, icon: "heart" },
  { id: "camping", name: "Cắm trại", ideal: 23, rain: 0.5, icon: "tent" },
];
export function activityScore(w, id = "running", preferences = {}) {
  const a = activities.find((a) => a.id === id) || activities[0];
  if (
    !w ||
    !present(w.temperature) ||
    !present(w.rainProbability) ||
    !present(w.windSpeed)
  )
    return {
      score: null,
      factors: [],
      missing: ["Nhiệt độ, xác suất mưa hoặc gió"],
    };
  const temp = present(w.feelsLike) ? w.feelsLike : w.temperature;
  const factors = [
    {
      name: "Nhiệt độ cảm nhận",
      metric: value(temp, "°C"),
      penalty: Math.min(30, Math.abs(temp - a.ideal) * 1.6),
    },
    {
      name: "Khả năng mưa",
      metric: value(w.rainProbability, "%"),
      penalty: w.rainProbability * a.rain,
    },
    {
      name: "Gió",
      metric: value(w.windSpeed, " km/h"),
      penalty: Math.max(0, w.windSpeed - 15) * 0.8,
    },
    {
      name: "Độ ẩm",
      metric: value(w.humidity, "%"),
      penalty: present(w.humidity)
        ? Math.max(0, w.humidity - 65) * (id === "laundry" ? 0.5 : 0.18)
        : 0,
    },
    {
      name: "UV",
      metric: value(w.uv),
      penalty: present(w.uv)
        ? Math.max(0, w.uv - 3) * (preferences.uvSensitive ? 3 : 1.5)
        : 0,
    },
    {
      name: "Chất lượng không khí",
      metric: value(w.aqi, " US AQI"),
      penalty: present(w.aqi) ? Math.max(0, w.aqi - 50) * 0.18 : 0,
    },
  ];
  if (present(preferences.maxTemperature) && temp > preferences.maxTemperature)
    factors.push({
      name: "Ngưỡng nhiệt cá nhân",
      metric: `${preferences.maxTemperature}°C`,
      penalty: 8,
    });
  let score = Math.max(
    0,
    Math.min(100, Math.round(100 - factors.reduce((s, f) => s + f.penalty, 0))),
  );
  if (w.weatherCode >= 95 || w.windSpeed >= 60 || w.precipitation >= 10)
    score = Math.min(score, 15);
  return {
    score,
    factors,
    missing: ["humidity", "uv", "aqi"].filter((k) => !present(w[k])),
  };
}
export const scoreLabel = (s) =>
  s == null
    ? "Thiếu dữ liệu"
    : s >= 75
      ? "Rất phù hợp"
      : s >= 55
        ? "Khá phù hợp"
        : s >= 35
          ? "Cân nhắc"
          : "Không lý tưởng";
export function deriveInsights(context, preferences = {}) {
  const hours = context.hourly.slice(0, 24);
  const rainy = hours.find((h) => h.rainProbability >= 60);
  const best = hours
    .filter((h) => h.isDay === 1)
    .map((h) => ({
      ...h,
      score: activityScore(h, "walking", preferences).score,
    }))
    .filter((h) => h.score != null)
    .sort((a, b) => b.score - a.score)[0];
  const hot = hours
    .filter((h) => present(h.temperature))
    .sort((a, b) => b.temperature - a.temperature)[0];
  return { rainy, best, hot };
}
export function deriveAlerts(context, preferences = {}) {
  const rules = [
    {
      title: "Mưa lớn",
      severity: "Warning",
      test: (h) => h.precipitation >= 7.5,
      metric: (h) => `${value(h.precipitation, " mm/h")}`,
      advice: "Cân nhắc lùi giờ di chuyển, tránh các đoạn đường ngập.",
    },
    {
      title: "Nguy cơ giông",
      severity: "Severe Alert",
      test: (h) => h.weatherCode >= 95,
      metric: (h) => weatherLabel(h.weatherCode),
      advice: "Hạn chế hoạt động ngoài trời, tìm nơi trú trong nhà.",
    },
    {
      title: "Gió mạnh",
      severity: "Warning",
      test: (h) => h.windSpeed >= 40,
      metric: (h) => value(h.windSpeed, " km/h"),
      advice: "Thận trọng khi đi xe máy và tránh đứng dưới cây lớn.",
    },
    {
      title: "Chỉ số UV cao",
      severity: "Advisory",
      test: (h) => h.uv >= 6,
      metric: (h) => `UV ${value(h.uv)}`,
      advice: "Ưu tiên bóng râm, dùng kem chống nắng khi ra ngoài.",
    },
    {
      title: "Nhiệt độ cảm nhận cao",
      severity: "Warning",
      test: (h) => h.feelsLike >= 38,
      metric: (h) => value(h.feelsLike, "°C"),
      advice: "Giảm vận động ngoài trời và bổ sung nước.",
    },
    {
      title: "Không khí kém",
      severity: "Warning",
      test: (h) => h.aqi > 150,
      metric: (h) => value(h.aqi, " US AQI"),
      advice: "Cân nhắc tập luyện trong nhà.",
    },
    {
      title: "Tầm nhìn thấp",
      severity: "Advisory",
      test: (h) => present(h.visibility) && h.visibility < 1000,
      metric: (h) => value(h.visibility, " m"),
      advice: "Giảm tốc độ và giữ khoảng cách khi di chuyển.",
    },
  ];
  if (present(preferences.maxTemperature))
    rules.push({
      title: "Vượt ngưỡng nhiệt của bạn",
      severity: "Personal",
      test: (h) => h.feelsLike > preferences.maxTemperature,
      metric: (h) => value(h.feelsLike, "°C"),
      advice: `Nhiệt độ cảm nhận vượt mức ${preferences.maxTemperature}°C bạn đã chọn. Ưu tiên giờ mát hơn.`,
    });
  return rules.flatMap((rule) => {
    const all = context.hourly.slice(0, 24),
      first = all.findIndex(rule.test);
    if (first < 0) return [];
    let end = first;
    while (end + 1 < all.length && rule.test(all[end + 1])) end++;
    return [
      {
        title: rule.title,
        severity: rule.severity,
        start: all[first].time,
        end: all[end].time,
        metric: rule.metric(all[first]),
        advice: rule.advice,
        source: "Phân tích ngưỡng dự báo; không phải cảnh báo chính thức",
      },
    ];
  });
}
