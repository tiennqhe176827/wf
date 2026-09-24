import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bike,
  CalendarDays,
  Camera,
  Car,
  ChevronRight,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Footprints,
  Heart,
  MapPin,
  Moon,
  Shirt,
  Snowflake,
  Sparkles,
  Sun,
  Tent,
  X,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  activities,
  activityScore,
  deriveInsights,
  hour,
  localSlot,
  present,
  scoreLabel,
  value,
  weatherKind,
} from "../shared/weather.js";

export const activityIcons = {
  run: Activity,
  bike: Bike,
  walk: Footprints,
  tent: Tent,
  camera: Camera,
  shirt: Shirt,
  car: Car,
  heart: Heart,
};
export function WeatherIcon({ code, day = 1, size = 24 }) {
  const kind = weatherKind(code, day),
    Icon = {
      sun: Sun,
      cloud: CloudSun,
      rain: CloudRain,
      storm: CloudLightning,
      snow: Snowflake,
      night: Moon,
    }[kind];
  return (
    <Icon
      size={size}
      strokeWidth={1.5}
      className={`weather-icon ${kind}`}
      aria-hidden="true"
    />
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function WeatherMap({ location, current, onSelect, expanded = false }) {
  const element = useRef(null),
    map = useRef(null),
    marker = useRef(null),
    selectRef = useRef(onSelect),
    samples = useRef(null);
  const [layer, setLayer] = useState("temperature"),
    [tileError, setTileError] = useState(false);
  const [region, setRegion] = useState(null),
    [regionError, setRegionError] = useState("");
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    const instance = L.map(element.current, { zoomControl: false }).setView(
      [location.latitude, location.longitude],
      9,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    })
      .on("tileerror", () => setTileError(true))
      .addTo(instance);
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    marker.current = L.marker([location.latitude, location.longitude], {
      icon: L.divIcon({
        className: "weather-pin",
        html: "<span>◎</span>",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    }).addTo(instance);
    instance.on("click", (e) =>
      selectRef.current({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        name: "Vị trí trên bản đồ",
      }),
    );
    map.current = instance;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
    // Map creation is independent of subsequent coordinate updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    map.current?.setView([location.latitude, location.longitude]);
    marker.current?.setLatLng([location.latitude, location.longitude]);
  }, [location.latitude, location.longitude]);
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    setRegion(null);
    setRegionError("");
    fetch(
      `/api/map-weather?lat=${location.latitude}&lon=${location.longitude}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setRegion)
      .catch((e) => {
        if (e.name !== "AbortError")
          setRegionError("Chưa tải được lớp dữ liệu khu vực.");
      });
    return () => controller.abort();
  }, [location.latitude, location.longitude, expanded]);
  useEffect(() => {
    if (!map.current) return;
    samples.current?.remove();
    if (!region) return;
    const range = {
      temperature: [10, 40],
      rain: [0, 10],
      cloud: [0, 100],
      wind: [0, 50],
      storm: [0, 1],
      aqi: [0, 200],
      uv: [0, 11],
    }[layer];
    const group = L.layerGroup();
    region.points
      .filter((p) => present(p[layer]))
      .forEach((p) => {
        const n = Math.max(
            0,
            Math.min(1, (p[layer] - range[0]) / (range[1] - range[0])),
          ),
          color = `hsl(${180 - n * 155} 65% 60%)`;
        const dot = L.circleMarker([p.latitude, p.longitude], {
          radius: 22,
          color,
          fillColor: color,
          fillOpacity: 0.22,
          weight: 1,
        }).addTo(group);
        dot.bindTooltip(
          layer === "storm"
            ? p[layer]
              ? "Giông"
              : "Không giông"
            : value(p[layer], "", layer === "rain" ? 1 : 0),
          { permanent: true, direction: "center", className: "sample-label" },
        );
        dot.on("click", () =>
          selectRef.current({
            latitude: p.latitude,
            longitude: p.longitude,
            name: "Điểm dự báo trên bản đồ",
          }),
        );
      });
    group.addTo(map.current);
    samples.current = group;
    return () => group.remove();
  }, [region, layer]);
  const layers = [
      ["temperature", "Nhiệt độ", current?.temperature, "°C"],
      ["rain", "Mưa", current?.precipitation, " mm"],
      ["cloud", "Mây", current?.cloudCover, "%"],
      ["wind", "Gió", current?.windSpeed, " km/h"],
      ["storm", "Giông", null, ""],
      ["aqi", "AQI", current?.aqi, ""],
      ["uv", "UV", current?.uv, ""],
    ],
    selected = layers.find((l) => l[0] === layer);
  return (
    <div className={`map-wrap ${expanded ? "expanded" : ""}`}>
      <div
        ref={element}
        className="leaflet-surface"
        aria-label="Bản đồ tương tác, chọn điểm để xem thời tiết"
      />
      <div className="map-layer-control">
        {layers.map(([id, label]) => (
          <button
            key={id}
            className={id === layer ? "active" : ""}
            onClick={() => setLayer(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="map-point">
        <MapPin size={14} />
        <strong>
          {selected[1]}:{" "}
          {layer === "storm"
            ? present(current?.weatherCode)
              ? current.weatherCode >= 95
                ? "Có dự báo giông"
                : "Không có mã giông"
              : "—"
            : value(selected[2], selected[3])}
        </strong>
        <small>Tại tọa độ đã chọn · dữ liệu điểm</small>
      </div>
      <div className="map-caption">
        {tileError
          ? "Bản đồ nền tạm không tải được. Hãy tìm địa điểm."
          : expanded
            ? regionError ||
              (!region
                ? "Đang tải 9 điểm dự báo…"
                : "9 điểm dự báo Open-Meteo · Không phải radar trực tiếp")
            : "Chạm bản đồ để khám phá thời tiết tại một vị trí"}
      </div>
    </div>
  );
}
export function HourlyTimeline({ context, onSelect, unit }) {
  const [metric, setMetric] = useState("temperature"),
    track = useRef(null),
    hours = context?.hourly.slice(0, 24) || [],
    nums = hours.map((h) => h[metric]).filter(present),
    min = Math.min(...nums) - 2,
    max = Math.max(...nums) + 2;
  const y = (h) =>
      present(h[metric])
        ? 90 - ((h[metric] - min) / (max - min || 1)) * 56
        : 70,
    temp = (t) => value(unit === "F" && present(t) ? (t * 9) / 5 + 32 : t, "°"),
    insight = context ? deriveInsights(context) : {};
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <h2>
          Dự báo theo giờ <span className="subtle-label">24 GIỜ TỚI</span>
        </h2>
        <div className="segmented">
          <button
            className={metric === "temperature" ? "selected" : ""}
            onClick={() => setMetric("temperature")}
          >
            Nhiệt độ
          </button>
          <button
            className={metric === "rainProbability" ? "selected" : ""}
            onClick={() => setMetric("rainProbability")}
          >
            Khả năng mưa
          </button>
        </div>
        <button
          className="icon-button timeline-next"
          aria-label="Xem các giờ tiếp theo"
          onClick={() =>
            track.current?.scrollBy({ left: 500, behavior: "smooth" })
          }
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="timeline-scroll" ref={track}>
        {hours.length ? (
          <div className="timeline-inner" style={{ width: 24 * 89 }}>
            <svg
              viewBox={`0 0 ${24 * 89} 110`}
              preserveAspectRatio="none"
              className="timeline-chart"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#52ddc5" stopOpacity=".18" />
                  <stop offset="100%" stopColor="#52ddc5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 44 110 ${hours.map((h, i) => `L ${44 + i * 89} ${y(h)}`).join(" ")} L ${44 + (hours.length - 1) * 89} 110 Z`}
                fill="url(#chartFill)"
              />
              <polyline
                points={hours.map((h, i) => `${44 + i * 89},${y(h)}`).join(" ")}
                stroke="#56d7c0"
                strokeWidth="2"
                fill="none"
              />
              {hours.map((h, i) => (
                <circle
                  key={h.time}
                  cx={44 + i * 89}
                  cy={y(h)}
                  r="3"
                  fill="#73e5ce"
                />
              ))}
            </svg>
            {hours.map((h, i) => (
              <button
                key={h.time}
                className={`hour-column ${i === 0 ? "now" : ""} ${h.time === insight.rainy?.time ? "rain-event" : ""}`}
                onClick={() => onSelect(h)}
              >
                <span>{i === 0 ? "Giờ hiện tại" : hour(h.time)}</span>
                <WeatherIcon code={h.weatherCode} day={h.isDay} size={25} />
                <strong>
                  {metric === "temperature"
                    ? temp(h.temperature)
                    : value(h.rainProbability, "%")}
                </strong>
                <span className="hour-rain">
                  <Droplets size={12} />
                  {value(h.rainProbability, "%")}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Dự báo 24 giờ sẽ xuất hiện khi kết nối được nguồn thời tiết.
          </div>
        )}
      </div>
      <div className="timeline-footer">
        <Sparkles size={14} />
        {insight.rainy ? (
          <>
            Mưa có khả năng từ{" "}
            <strong>
              {localSlot(insight.rainy.time, context?.currentLocalTime)}
            </strong>{" "}
            · {value(insight.rainy.rainProbability, "%")} — cân nhắc mang ô.
          </>
        ) : insight.best ? (
          <>
            Giờ đi dạo gợi ý:{" "}
            <strong>
              {localSlot(insight.best.time, context?.currentLocalTime)}
            </strong>{" "}
            · {value(insight.best.temperature, "°C")}.
          </>
        ) : (
          "Phân tích trực tiếp từ dữ liệu dự báo"
        )}
        <span className="source-note">Giờ địa phương</span>
      </div>
    </section>
  );
}
export function DailyForecast({ context, unit, onDay, full = false }) {
  const temp = (t) =>
      value(unit === "F" && present(t) ? (t * 9) / 5 + 32 : t, "°"),
    days = context?.daily || [],
    min = Math.min(...days.map((d) => d.min)),
    max = Math.max(...days.map((d) => d.max));
  return (
    <section className="panel daily-panel">
      <div className="panel-heading">
        <h2>Dự báo 7 ngày</h2>
        <CalendarDays size={17} className="muted" />
      </div>
      <div className="daily-list">
        {days.map((d, i) => (
          <button key={d.date} className="day-row" onClick={() => onDay(d)}>
            <span>
              {i === 0
                ? "Hôm nay"
                : i === 1
                  ? "Ngày mai"
                  : new Date(d.date + "T12:00:00").toLocaleDateString("vi-VN", {
                      weekday: "short",
                    })}
              <small>
                {d.date.slice(8)}/{d.date.slice(5, 7)}
              </small>
            </span>
            <WeatherIcon code={d.weatherCode} />
            <span className="day-rain">
              <Droplets size={12} />
              {value(d.rainProbability, "%")}
            </span>
            <span className="low-temp">{temp(d.min)}</span>
            <div className="temp-bar">
              <i
                style={{
                  left: `${((d.min - min) / (max - min || 1)) * 100}%`,
                  width: `${Math.max(4, ((d.max - d.min) / (max - min || 1)) * 100)}%`,
                }}
              />
            </div>
            <strong>{temp(d.max)}</strong>
            {full && <span className="day-description">UV {value(d.uv)}</span>}
            <ChevronRight size={14} />
          </button>
        ))}
        {!days.length && <div className="empty-inline">Chưa có dự báo.</div>}
      </div>
      <div className="card-footnote">
        Dự báo có thể thay đổi theo điều kiện thực tế.
      </div>
    </section>
  );
}
export function ActivityScores({
  context,
  preferences,
  onSelect,
  full = false,
}) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <h2>Hôm nay làm gì?</h2>
        <span className="pill mint">
          <Activity size={12} />
          Activity score
        </span>
      </div>
      <p className="section-caption">
        Chọn một hoạt động. Hiểu thời tiết theo cách của bạn.
      </p>
      <div className={`activity-grid ${full ? "all" : ""}`}>
        {activities.slice(0, full ? 10 : 5).map((a) => {
          const result = activityScore(context?.current, a.id, preferences),
            Icon = activityIcons[a.icon];
          return (
            <button
              className="activity-item"
              key={a.id}
              onClick={() => onSelect({ ...a, ...result })}
            >
              <div
                className={`score-ring ${result.score < 40 ? "poor" : result.score < 65 ? "fair" : ""}`}
                style={{ "--score": `${(result.score || 0) * 3.6}deg` }}
              >
                <Icon size={23} />
              </div>
              <span>{a.name}</span>
              <strong className={result.score < 40 ? "amber" : "mint-text"}>
                {result.score ?? "—"}
                <small>/100</small>
              </strong>
              <small>{scoreLabel(result.score)}</small>
            </button>
          );
        })}
      </div>
      {full && (
        <div className="card-footnote">
          Điểm tham khảo theo điều kiện hiện tại; nhấn để xem từng yếu tố.
        </div>
      )}
    </section>
  );
}
export function EmptyState({ icon: Icon = Sparkles, title, children }) {
  return (
    <div className="empty-state">
      <Icon size={38} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function DetailRows({ rows }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export function QuickChat({ question, setQuestion, onAsk, disabled }) {
  return (
    <section className="panel quick-chat">
      <div className="panel-heading">
        <h2>
          <Sparkles size={18} className="mint-text" /> Ask the Sky
        </h2>
        <span className="pill">AI COPILOT</span>
      </div>
      <h3>Hôm nay bạn có kế hoạch gì?</h3>
      <p>Hỏi tự nhiên. Nhận lời khuyên dựa trên thời tiết.</p>
      <div className="suggestion-chips">
        {["Tối nay chạy bộ được không?", "Có cần mang ô không?"].map((q) => (
          <button key={q} onClick={() => onAsk(q)}>
            {q}
            <ArrowRight size={12} />
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(question);
        }}
      >
        <input
          aria-label="Câu hỏi thời tiết"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Hỏi bất cứ điều gì về thời tiết…"
        />
        <button
          aria-label="Gửi câu hỏi"
          disabled={!question.trim() || disabled}
        >
          <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}
