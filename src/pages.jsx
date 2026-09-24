import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  activityScore,
  deriveInsights,
  hour,
  present,
  scoreLabel,
  value,
  weatherLabel,
} from "../shared/weather.js";
import { DetailRows, EmptyState, WeatherIcon } from "./components.jsx";
export async function api(url, options) {
  const r = await fetch(url, options),
    data = await r.json();
  if (!r.ok) throw new Error(data.error || "Không thể kết nối.");
  return data;
}
export const post = (url, data) =>
  api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export const cities = [
  { name: "Hà Nội", latitude: 21.028511, longitude: 105.804817 },
  { name: "TP. Hồ Chí Minh", latitude: 10.7769, longitude: 106.7009 },
  { name: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022 },
  { name: "Đà Lạt", latitude: 11.9404, longitude: 108.4583 },
];
export function Assistant({
  context,
  location,
  city,
  temp,
  aiReady,
  messages,
  question,
  setQuestion,
  ask,
  chatLoading,
}) {
  const end = useRef(null),
    current = context?.current;
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  return (
    <div className="assistant-layout">
      <section className="panel chat-panel">
        <div className="panel-heading">
          <h2>
            <Sparkles size={20} className="mint-text" /> Ask the Sky
          </h2>
          <span className={`pill ${aiReady ? "mint" : ""}`}>
            {aiReady ? "AI đã kết nối" : "Chưa kết nối AI"}
          </span>
        </div>
        <div className="chat-context">
          <MapPin size={13} />
          {city} · {location.latitude.toFixed(4)},{" "}
          {location.longitude.toFixed(4)}
          <span>{context?.provider}</span>
        </div>
        <div className="messages">
          {!messages.length && (
            <div className="chat-welcome">
              <div className="orb-small">
                <Sparkles size={35} />
              </div>
              <h2>Bầu trời hôm nay nói gì?</h2>
              <p>
                Mình giúp bạn biến dự báo thành kế hoạch.
                <br />
                Bạn muốn làm gì tại {city}?
              </p>
              <div className="chat-prompts">
                {[
                  "Tối nay có nên chạy bộ không?",
                  "Mai 7 giờ đi học có mưa không?",
                  "Khi nào phù hợp phơi quần áo?",
                  "Cuối tuần ngày nào nên đi picnic?",
                ].map((q) => (
                  <button key={q} onClick={() => ask(q)}>
                    {q}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              {!aiReady && (
                <p className="connection-note">
                  Chat AI cần được kết nối trên máy chủ. Dashboard, gợi ý giờ
                  hoạt động và lịch trình vẫn dùng dữ liệu dự báo thực.
                </p>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.role !== "user" && <Sparkles size={17} />}
              <div>{m.text}</div>
            </div>
          ))}
          {chatLoading && (
            <div className="message assistant">
              <LoaderCircle className="spin" size={16} /> Đang phân tích dự báo…
            </div>
          )}
          <div ref={end} />
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            value={question}
            maxLength={2000}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi về thời tiết và kế hoạch của bạn…"
            aria-label="Hỏi Ask the Sky"
          />
          <button
            disabled={!question.trim() || chatLoading || !context}
            aria-label="Gửi câu hỏi"
          >
            <Send size={17} />
          </button>
        </form>
        <p className="card-footnote">
          Câu trả lời dùng giờ địa phương và dự báo tại tọa độ đã chọn.
        </p>
      </section>
      <aside className="assistant-aside">
        <div className="panel context-panel">
          <span className="eyebrow">NGỮ CẢNH THỜI TIẾT</span>
          <h2>{city}</h2>
          <div className="context-temp">
            {temp(current?.temperature)}
            <WeatherIcon code={current?.weatherCode} size={52} />
          </div>
          <p>{weatherLabel(current?.weatherCode)}</p>
          <DetailRows
            rows={[
              ["Khả năng mưa", value(current?.rainProbability, "%")],
              ["Gió", value(current?.windSpeed, " km/h")],
              ["Độ ẩm", value(current?.humidity, "%")],
              ["Múi giờ", context?.timezone || "—"],
            ]}
          />
        </div>
        <div className="trust-note">
          <ShieldCheck size={22} />
          <h3>Dữ liệu trước. Lời khuyên sau.</h3>
          <p>
            WeatherAI dùng dự báo được cung cấp. Nếu thiếu dữ liệu, trợ lý sẽ
            nói rõ.
          </p>
        </div>
      </aside>
    </div>
  );
}
export function Planner({ context, preferences, setToast }) {
  const [plan, setPlan] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("weather-plan")) || [];
      } catch {
        return [];
      }
    }),
    [time, setTime] = useState(""),
    [name, setName] = useState(""),
    [date, setDate] = useState(""),
    insights = context ? deriveInsights(context, preferences) : {};
  const save = (next) => {
    setPlan(next);
    localStorage.setItem("weather-plan", JSON.stringify(next));
  };
  const add = (e) => {
    e.preventDefault();
    save(
      [
        ...plan,
        {
          id: crypto.randomUUID(),
          time,
          date: date || context?.currentLocalTime.slice(0, 10),
          name,
        },
      ].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    );
    setName("");
    setToast("Đã thêm vào lịch trình.");
  };
  return (
    <div className="planner-layout">
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <CalendarDays size={19} /> Lịch trình của bạn
          </h2>
          <span className="pill mint">Giờ địa phương</span>
        </div>
        <form className="plan-form" onSubmit={add}>
          <label>
            Ngày
            <input
              type="date"
              required
              value={date || context?.currentLocalTime.slice(0, 10) || ""}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Thời gian
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="plan-name">
            Hoạt động
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Chạy bộ ở công viên"
            />
          </label>
          <button className="primary-button">
            <Plus size={17} />
            Thêm
          </button>
        </form>
        <div className="plan-list">
          {!plan.length && (
            <EmptyState
              icon={CalendarDays}
              title="Một ngày tốt bắt đầu từ kế hoạch."
            >
              Thêm hoạt động để đối chiếu với dự báo từng giờ.
            </EmptyState>
          )}
          {plan.map((p) => {
            const h = context?.hourly.find(
                (h) =>
                  h.time.slice(0, 13) === `${p.date}T${p.time.slice(0, 2)}`,
              ),
              score = activityScore(
                h,
                /chạy|run/i.test(p.name)
                  ? "running"
                  : /xe|cycl/i.test(p.name)
                    ? "cycling"
                    : "walking",
                preferences,
              );
            return (
              <div className="plan-item" key={p.id}>
                <div className="plan-time">
                  {p.time}
                  <small>{p.date}</small>
                </div>
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {h
                      ? `${value(h.temperature, "°C")} · Mưa ${value(h.rainProbability, "%")} · UV ${value(h.uv)} · ${scoreLabel(score.score)}`
                      : "Chưa có dự báo cho thời điểm này."}
                  </p>
                  {h && score.score < 55 && insights.best && (
                    <small className="amber">
                      Cân nhắc {hour(insights.best.time)} ngày{" "}
                      {insights.best.time.slice(0, 10)}. Lịch chưa bị thay đổi.
                    </small>
                  )}
                </div>
                <button
                  className="icon-button"
                  aria-label={`Xóa ${p.name}`}
                  onClick={() => save(plan.filter((x) => x.id !== p.id))}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <div className="panel planner-note">
        <Sparkles size={27} className="mint-text" />
        <h2>
          Kế hoạch của bạn,
          <br />
          thời tiết đồng hành.
        </h2>
        <p>
          Các hoạt động được đối chiếu với dự báo theo giờ. Gợi ý đổi giờ chỉ là
          đề xuất — bạn luôn quyết định lịch của mình.
        </p>
        <p className="muted">Lịch trình được lưu trên trình duyệt này.</p>
      </div>
    </div>
  );
}
export function Compare({
  context,
  preferences,
  temp,
  selectLocation,
  setToast,
}) {
  const [days, setDays] = useState([0, 1]),
    [places, setPlaces] = useState([]),
    [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setPlaces(
        await Promise.all(
          cities.map(async (c) => ({
            ...c,
            context: await api(
              `/api/weather?lat=${c.latitude}&lon=${c.longitude}`,
            ),
          })),
        ),
      );
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  };
  const a = context?.daily[days[0]],
    b = context?.daily[days[1]];
  return (
    <div className="compare-page">
      <section className="panel">
        <div className="panel-heading">
          <h2>Ngày nào hợp đi dã ngoại hơn?</h2>
        </div>
        <div className="compare-grid">
          {days.map((selected, i) => {
            const d = context?.daily[selected],
              hours =
                context?.hourly.filter(
                  (h) => h.time.startsWith(d?.date || "!") && h.isDay === 1,
                ) || [],
              scores = hours
                .map((h) => activityScore(h, "picnic", preferences).score)
                .filter(present),
              score = scores.length
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;
            return (
              <div className="comparison-card" key={i}>
                <select
                  aria-label={`Ngày so sánh ${i + 1}`}
                  value={selected}
                  onChange={(e) =>
                    setDays((ds) =>
                      ds.map((n, j) => (j === i ? Number(e.target.value) : n)),
                    )
                  }
                >
                  {context?.daily.map((d, j) => (
                    <option key={d.date} value={j}>
                      {d.date}
                    </option>
                  ))}
                </select>
                <WeatherIcon code={d?.weatherCode} size={50} />
                <h3>
                  {temp(d?.min)} – {temp(d?.max)}
                </h3>
                <p>{weatherLabel(d?.weatherCode)}</p>
                <DetailRows
                  rows={[
                    ["Khả năng mưa tối đa", value(d?.rainProbability, "%")],
                    ["Gió mạnh nhất", value(d?.windSpeed, " km/h")],
                    ["UV tối đa", value(d?.uv)],
                    ["Điểm dã ngoại ban ngày", `${score ?? "—"}/100`],
                  ]}
                />
                <small>Trung bình các giờ ban ngày còn trong dự báo.</small>
              </div>
            );
          })}
        </div>
        {a && b && (
          <div className="comparison-summary">
            <Sparkles size={18} />
            <p>
              {!present(a.rainProbability) || !present(b.rainProbability)
                ? "Chưa đủ dữ liệu mưa để so sánh."
                : a.rainProbability === b.rainProbability
                  ? "Hai ngày có cùng xác suất mưa tối đa. Hãy đối chiếu thêm gió và UV."
                  : `Ngày ${a.rainProbability < b.rainProbability ? a.date : b.date} có xác suất mưa tối đa thấp hơn (${Math.min(a.rainProbability, b.rainProbability)}% so với ${Math.max(a.rainProbability, b.rainProbability)}%). So sánh giờ cụ thể trước khi chốt lịch.`}
            </p>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>So sánh địa điểm</h2>
          <button className="text-button" disabled={loading} onClick={load}>
            {loading ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}{" "}
            Tải dự báo các thành phố
          </button>
        </div>
        <div className="city-comparisons">
          {places.length ? (
            places.map((c) => (
              <button key={c.name} onClick={() => selectLocation(c)}>
                <h3>{c.name}</h3>
                <WeatherIcon code={c.context.current.weatherCode} size={38} />
                <strong>{temp(c.context.current.temperature)}</strong>
                <p>
                  Mưa {value(c.context.current.rainProbability, "%")} · Gió{" "}
                  {value(c.context.current.windSpeed, " km/h")}
                </p>
                <span>
                  Xem địa điểm <ArrowRight size={14} />
                </span>
              </button>
            ))
          ) : (
            <p className="empty-inline">
              Tải dữ liệu thực để so sánh thời tiết giữa các thành phố.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
export function Alerts({ context, alerts, city }) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <h2>Cảnh báo tại {city}</h2>
        <span className="pill">24 giờ tới</span>
      </div>
      <p className="section-caption">
        Phát hiện theo ngưỡng từ dữ liệu dự báo. Không thay thế cảnh báo chính
        thức của cơ quan khí tượng.
      </p>
      {alerts.length ? (
        alerts.map((a, i) => (
          <div className="alert-item" key={i}>
            <div
              className={`alert-symbol ${a.severity === "Severe Alert" ? "severe" : ""}`}
            >
              <Bell size={23} />
            </div>
            <div>
              <div className="alert-title">
                <h3>{a.title}</h3>
                <span className="pill">{a.severity}</span>
              </div>
              <p>
                {a.start.slice(0, 10)} · {hour(a.start)}–{hour(a.end)} ·{" "}
                {a.metric}
              </p>
              <p>{a.advice}</p>
              <small>Khoảng giờ dự báo có điều kiện vượt ngưỡng.</small>
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={
            context
              ? "Chưa phát hiện điều kiện vượt ngưỡng."
              : "Đang chờ dữ liệu thời tiết."
          }
        >
          {context
            ? "Theo dõi cập nhật trước khi di chuyển."
            : "Cảnh báo sẽ được phân tích sau khi tải được dự báo."}
        </EmptyState>
      )}
    </section>
  );
}
