import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CloudDrizzle,
  CloudSun,
  Droplets,
  Eye,
  LayoutDashboard,
  LoaderCircle,
  LocateFixed,
  Map,
  MapPin,
  Maximize2,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Waves,
  Wind,
  X,
} from "lucide-react";
import {
  activities,
  deriveAlerts,
  deriveInsights,
  hour,
  localSlot,
  present,
  scoreLabel,
  value,
  weatherKind,
  weatherLabel,
} from "../shared/weather.js";
import {
  ActivityScores,
  DailyForecast,
  DetailRows,
  HourlyTimeline,
  Modal,
  QuickChat,
  WeatherIcon,
  WeatherMap,
} from "./components.jsx";
import {
  Alerts,
  api,
  Assistant,
  cities,
  Compare,
  Planner,
  post,
} from "./pages.jsx";
import "./App.css";
import "./responsive.css";
const sections = [
  { id: "overview", name: "Tổng quan", icon: LayoutDashboard },
  { id: "forecast", name: "Dự báo thời tiết", icon: CalendarDays },
  { id: "map", name: "Bản đồ thời tiết", icon: Map },
  { id: "assistant", name: "Ask the Sky", icon: Sparkles },
  { id: "planner", name: "Lên lịch hôm nay", icon: CalendarDays },
  { id: "compare", name: "So sánh", icon: Activity },
];
export default function App() {
  const [section, setSection] = useState("overview"),
    [mobileMenu, setMobileMenu] = useState(false);
  const [location, setLocation] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("weather-location")) || {
          ...cities[0],
          source: "default",
        }
      );
    } catch {
      return { ...cities[0], source: "default" };
    }
  });
  const [context, setContext] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [unit, setUnit] = useState("C"),
    [theme, setTheme] = useState(
      () => localStorage.getItem("weather-theme") || "dark",
    );
  const [search, setSearch] = useState(""),
    [results, setResults] = useState([]),
    [searchOpen, setSearchOpen] = useState(false),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [preferences, setPreferences] = useState({}),
    [draft, setDraft] = useState({}),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [saving, setSaving] = useState(false);
  const [aiReady, setAiReady] = useState(false),
    [messages, setMessages] = useState([]),
    [question, setQuestion] = useState(""),
    [chatLoading, setChatLoading] = useState(false);
  const searchRef = useRef(null),
    locationVersion = useRef(0);
  const [aiBrief, setAiBrief] = useState("");
  useEffect(() => {
    setAiBrief("");
    if (!context || !aiReady) return;
    let active = true;
    post("/api/chat", {
      latitude: context.location.latitude,
      longitude: context.location.longitude,
      kind: "brief",
      question:
        "Tạo bản tin thời tiết hôm nay và gợi ý hành động phù hợp với sở thích của tôi.",
    })
      .then((r) => {
        if (active) setAiBrief(r.answer);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [context, aiReady, preferences]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("weather-theme", theme);
  }, [theme]);
  useEffect(() => {
    api("/api/preferences")
      .then(setPreferences)
      .catch(() => {});
    api("/api/status")
      .then((s) => setAiReady(s.ai))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setRefresh((x) => x + 1), 300000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setContext(null);
    api(`/api/weather?lat=${location.latitude}&lon=${location.longitude}`, {
      signal: controller.signal,
    })
      .then((c) => {
        if (active) setContext(c);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [location, refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    const id = setTimeout(
      () =>
        api(`/api/geocode?q=${encodeURIComponent(search)}`, {
          signal: controller.signal,
        })
          .then(setResults)
          .catch((e) => {
            if (e.name !== "AbortError") setSearchError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setSearching(false);
          }),
      350,
    );
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [search]);
  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);
  const selectLocation = (p) => {
    locationVersion.current++;
    const selected = {
      ...p,
      context: undefined,
      source: p.source || "selected",
    };
    setLocation(selected);
    localStorage.setItem("weather-location", JSON.stringify(selected));
    setSearch("");
    setSearchOpen(false);
    setMessages([]);
  };
  const navigate = (id) => {
    setSection(id);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setToast(
        "Trình duyệt không hỗ trợ vị trí. Hãy tìm địa điểm hoặc chọn bản đồ.",
      );
      return;
    }
    setToast("Đang xác định vị trí thiết bị…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        selectLocation({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          name: "Vị trí của tôi",
          source: "gps",
        });
        setToast("Đã lấy tọa độ thiết bị.");
      },
      () =>
        setToast(
          "Chưa lấy được vị trí. Bạn có thể tìm địa điểm hoặc chọn trên bản đồ.",
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  const current = context?.current,
    today = context?.daily[0],
    insights = context ? deriveInsights(context, preferences) : {},
    alerts = context ? deriveAlerts(context, preferences) : [],
    city = context?.location.city || context?.location.name || location.name;
  const temp = (v, s = "°") =>
    value(unit === "F" && present(v) ? (v * 9) / 5 + 32 : v, s);
  const dateText = context
    ? new Date(
        context.currentLocalTime.slice(0, 10) + "T12:00:00",
      ).toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Thời tiết tại tọa độ đã chọn";
  const ask = async (text = question) => {
    if (!text.trim() || chatLoading) return;
    if (!context) {
      setToast("Cần tải dữ liệu thời tiết trước khi hỏi.");
      return;
    }
    const version = locationVersion.current;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text }]);
    setChatLoading(true);
    try {
      const result = await post("/api/chat", {
        latitude: location.latitude,
        longitude: location.longitude,
        question: text,
      });
      if (version === locationVersion.current)
        setMessages((m) => [...m, { role: "assistant", text: result.answer }]);
    } catch (e) {
      if (version === locationVersion.current)
        setMessages((m) => [...m, { role: "system", text: e.message }]);
    } finally {
      setChatLoading(false);
    }
  };
  const savePrefs = async () => {
    setSaving(true);
    try {
      setPreferences(await post("/api/preferences", draft));
      setModal(null);
      setToast("Đã lưu sở thích của bạn.");
    } catch (e) {
      setToast(e.message);
    } finally {
      setSaving(false);
    }
  };
  const openPrefs = () => {
    setDraft(preferences);
    setModal({ type: "preferences" });
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <div className="brand-symbol">
            <CloudSun size={25} />
          </div>
          <span>
            weather<span className="mint-text">ai</span>
            <small>YOUR WEATHER COPILOT</small>
          </span>
        </a>
        <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
        <nav>
          {sections.map((s) => (
            <button
              className={`nav-item ${section === s.id ? "active" : ""}`}
              key={s.id}
              onClick={() => navigate(s.id)}
            >
              <s.icon size={19} />
              <span>{s.name}</span>
              {s.id === "assistant" && <span className="tiny-badge">AI</span>}
              {section === s.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <button
          className={`nav-item ${section === "alerts" ? "active" : ""}`}
          onClick={() => navigate("alerts")}
        >
          <Bell size={19} />
          <span>Cảnh báo thời tiết</span>
          {alerts.length > 0 && (
            <span className="alert-count">{alerts.length}</span>
          )}
        </button>
        <button className="nav-item" onClick={openPrefs}>
          <Settings2 size={19} />
          <span>Cá nhân hóa</span>
        </button>
        <div className="sidebar-bottom">
          <div className="copilot-card">
            <div className="orb-small">
              <Sparkles size={22} />
            </div>
            <h3>Bầu trời có câu trả lời.</h3>
            <p>
              Để thời tiết trở thành
              <br />
              một phần trong kế hoạch.
            </p>
            <button onClick={() => navigate("assistant")}>
              Hỏi WeatherAI <ArrowRight size={15} />
            </button>
          </div>
          <button className="profile" onClick={openPrefs}>
            <div className="avatar">B</div>
            <span>
              Không gian của bạn<small>Trải nghiệm cá nhân</small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Weather intelligence, everyday.
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="nav-scrim"
          aria-label="Đóng menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileMenu(true)}
            aria-label="Mở menu"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Không gian của bạn <ChevronRight size={13} />
            <strong>
              {sections.find((s) => s.id === section)?.name || "Cảnh báo"}
            </strong>
          </div>
          <div className="search-container" ref={searchRef}>
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Tìm thành phố, địa điểm…"
              aria-label="Tìm địa điểm"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
            />
            <kbd>⌕</kbd>
            {searchOpen && (
              <div className="search-results">
                <button onClick={locate}>
                  <LocateFixed size={18} />
                  <span>
                    Sử dụng vị trí của tôi
                    <small>Cho phép truy cập vị trí trên thiết bị</small>
                  </span>
                </button>
                {searching ? (
                  <div className="search-status">
                    <LoaderCircle className="spin" size={16} />
                    Đang tìm địa điểm…
                  </div>
                ) : searchError ? (
                  <p className="search-status">{searchError}</p>
                ) : search.length >= 2 && !results.length ? (
                  <p className="search-status">
                    Không tìm thấy địa điểm phù hợp.
                  </p>
                ) : (
                  (search.length >= 2 ? results : cities).map((r, i) => (
                    <button key={i} onClick={() => selectLocation(r)}>
                      <MapPin size={17} />
                      <span>
                        {r.name}
                        <small>
                          {r.formattedAddress ||
                            `${r.latitude.toFixed(4)}°N, ${r.longitude.toFixed(4)}°E`}
                        </small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <div className="unit-switch">
              <button
                className={unit === "C" ? "active" : ""}
                onClick={() => setUnit("C")}
              >
                °C
              </button>
              <button
                className={unit === "F" ? "active" : ""}
                onClick={() => setUnit("F")}
              >
                °F
              </button>
            </div>
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Đổi giao diện sáng tối"
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => navigate("alerts")}
              aria-label="Xem cảnh báo"
            >
              <Bell size={19} />
              {alerts.length > 0 && <i />}
            </button>
            <div className="avatar small">B</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> YOUR DAY, WITH CLARITY
              </div>
              <h1>
                {section === "overview"
                  ? "Chào bạn, hôm nay trời thế nào?"
                  : section === "assistant"
                    ? "Ask the Sky"
                    : section === "planner"
                      ? "Một ngày trong tầm tay."
                      : section === "map"
                        ? "Khám phá bầu trời."
                        : section === "compare"
                          ? "Chọn nơi đến. Chọn ngày đẹp."
                          : section === "alerts"
                            ? "Chủ động trước thời tiết."
                            : "Nhìn trước những ngày tới."}
              </h1>
              <p>
                {dateText}
                <span className="date-dot">·</span>
                {context?.timezone || "Giờ tại địa điểm đã chọn"}
              </p>
            </div>
            <button className="location-button" onClick={locate}>
              <LocateFixed size={16} /> Vị trí của tôi
            </button>
          </div>
          {location.source === "default" && (
            <div className="location-notice">
              <MapPin size={14} />
              <span>
                Đang xem Hà Nội mặc định. Chọn vị trí của bạn để nhận dự báo phù
                hợp.
              </span>
              <button onClick={locate}>
                Dùng vị trí của tôi <ArrowRight size={13} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <CloudDrizzle size={20} />
              <div>
                <strong>Chưa thể tải thời tiết</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => setRefresh((r) => r + 1)}>
                <RefreshCw size={14} /> Thử lại
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-strip" role="status">
              <LoaderCircle size={14} className="spin" /> Đang cập nhật bầu trời
              tại {location.name}…
            </div>
          )}
          {section === "overview" && (
            <>
              <div className="hero-grid">
                <section
                  className={`weather-hero ${weatherKind(current?.weatherCode, current?.isDay)}`}
                >
                  <div className="hero-top">
                    <div>
                      <button
                        className="hero-location"
                        onClick={() => {
                          setSearchOpen(true);
                          searchRef.current?.querySelector("input")?.focus();
                        }}
                      >
                        <MapPin size={17} />
                        <span>{city}</span>
                        <ChevronDown size={15} />
                      </button>
                      <div className="coordinates">
                        {Math.abs(location.latitude).toFixed(6)}°{" "}
                        {location.latitude >= 0 ? "N" : "S"} &nbsp;{" "}
                        {Math.abs(location.longitude).toFixed(6)}°{" "}
                        {location.longitude >= 0 ? "E" : "W"}
                      </div>
                    </div>
                    <span className="live-tag">
                      <i className={context ? "status-dot" : ""} />
                      {context
                        ? "ĐÃ CẬP NHẬT"
                        : loading
                          ? "ĐANG TẢI"
                          : "CHƯA KẾT NỐI"}
                    </span>
                  </div>
                  <div className="hero-weather">
                    <div>
                      <div className="temperature">
                        {present(current?.temperature)
                          ? Math.round(
                              unit === "F"
                                ? (current.temperature * 9) / 5 + 32
                                : current.temperature,
                            )
                          : "—"}
                        <span>°</span>
                        <small>{unit}</small>
                      </div>
                      <h2>{weatherLabel(current?.weatherCode)}</h2>
                      <p>
                        Cảm giác như {temp(current?.feelsLike)} <span>·</span>{" "}
                        <ArrowUp size={13} />
                        {temp(today?.max)} <ArrowDown size={13} />
                        {temp(today?.min)}
                      </p>
                    </div>
                    <div className="hero-weather-art">
                      <div className="weather-halo" />
                      <WeatherIcon
                        code={current?.weatherCode}
                        day={current?.isDay}
                        size={172}
                      />
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                    </div>
                  </div>
                  <div className="hero-bottom">
                    <span>
                      <Sunrise size={17} />
                      <span>
                        Bình minh <b>{hour(today?.sunrise)}</b>
                      </span>
                    </span>
                    <span>
                      <Sunset size={17} />
                      <span>
                        Hoàng hôn <b>{hour(today?.sunset)}</b>
                      </span>
                    </span>
                    <button
                      onClick={() => setRefresh((r) => r + 1)}
                      aria-label="Cập nhật thời tiết"
                    >
                      <RefreshCw size={12} className={loading ? "spin" : ""} />
                      {context
                        ? `Cập nhật ${new Date(context.fetchedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: context.timezone })}`
                        : "Đang chờ dữ liệu"}
                    </button>
                  </div>
                </section>
                <section className="brief-card">
                  <div className="brief-kicker">
                    <span className="ai-spark">
                      <Sparkles size={19} />
                    </span>
                    <span>
                      WEATHER INTELLIGENCE
                      <small>Bản tin thời tiết của bạn</small>
                    </span>
                    <span className="pill mint">Phân tích</span>
                  </div>
                  <h3>
                    Một ngày chủ động,
                    <br />
                    <span>bắt đầu từ bầu trời.</span>
                  </h3>
                  <p>
                    {aiBrief ||
                      (context ? (
                        <>
                          Hôm nay tại {city}, nhiệt độ từ{" "}
                          <b>
                            {temp(today?.min)}–{temp(today?.max)}
                          </b>
                          .{" "}
                          {insights.rainy ? (
                            <>
                              Khả năng mưa đạt{" "}
                              <b>
                                {value(insights.rainy.rainProbability, "%")}
                              </b>{" "}
                              lúc{" "}
                              <b>
                                {localSlot(
                                  insights.rainy.time,
                                  context?.currentLocalTime,
                                )}
                              </b>
                              . Đừng quên mang theo ô.
                            </>
                          ) : (
                            <>
                              Xem khung giờ phù hợp để lên kế hoạch ngoài trời.
                            </>
                          )}
                        </>
                      ) : (
                        "Bản tin sẽ sẵn sàng khi nhận được dữ liệu thời tiết tại tọa độ đã chọn."
                      ))}
                  </p>
                  <div className="brief-tip">
                    <span className="tip-icon">
                      <Sun size={18} />
                    </span>
                    <div>
                      <strong>
                        {insights.best
                          ? `Giờ đi dạo gợi ý: ${localSlot(insights.best.time, context?.currentLocalTime)}`
                          : "Thời điểm cho những kế hoạch"}
                      </strong>
                      <small>
                        {insights.best
                          ? `${temp(insights.best.temperature)} · Khả năng mưa ${value(insights.best.rainProbability, "%")}`
                          : "Dựa trên nhiệt độ, mưa, gió, UV và AQI."}
                      </small>
                    </div>
                    <ArrowUp size={16} className="tilted" />
                  </div>
                  <button
                    className="brief-link"
                    onClick={() => navigate("assistant")}
                  >
                    Hỏi thêm về ngày của bạn <ArrowRight size={16} />
                  </button>
                  <div className="brief-source">
                    <ShieldCheck size={12} />{" "}
                    {aiBrief
                      ? "AI phân tích dữ liệu Open-Meteo"
                      : "Tổng hợp theo quy tắc từ Open-Meteo"}
                  </div>
                </section>
              </div>
              <div className="metrics-grid">
                {[
                  {
                    icon: Droplets,
                    label: "Khả năng mưa",
                    val: value(current?.rainProbability, "%"),
                    note: `Lượng mưa ${value(current?.precipitation, " mm", 1)}`,
                    type: "rain",
                    progress: current?.rainProbability,
                  },
                  {
                    icon: Wind,
                    label: "Gió",
                    val: value(current?.windSpeed),
                    suffix: "km/h",
                    note: `Hướng gió ${value(current?.windDirection, "°")}`,
                    type: "wind",
                    progress: present(current?.windSpeed)
                      ? (current.windSpeed / 60) * 100
                      : 0,
                  },
                  {
                    icon: Waves,
                    label: "Độ ẩm",
                    val: value(current?.humidity, "%"),
                    note: "Độ ẩm tương đối",
                    type: "humidity",
                    progress: current?.humidity,
                  },
                  {
                    icon: Sun,
                    label: "Chỉ số UV",
                    val: value(current?.uv, "", 1),
                    note:
                      current?.uv >= 6
                        ? "Cao · Cần bảo vệ da"
                        : current?.uv >= 3
                          ? "Trung bình"
                          : present(current?.uv)
                            ? "Thấp"
                            : "Chưa có dữ liệu",
                    type: "uv",
                    progress: present(current?.uv)
                      ? (current.uv / 12) * 100
                      : 0,
                  },
                  {
                    icon: Activity,
                    label: "Chất lượng khí",
                    val: value(current?.aqi),
                    note:
                      current?.aqi > 150
                        ? "Không tốt"
                        : current?.aqi > 100
                          ? "Kém với nhóm nhạy cảm"
                          : current?.aqi > 50
                            ? "Trung bình · US AQI"
                            : present(current?.aqi)
                              ? "Tốt · US AQI"
                              : "Chưa có AQI",
                    type: "aqi",
                    progress: present(current?.aqi)
                      ? (current.aqi / 300) * 100
                      : 0,
                  },
                  {
                    icon: Eye,
                    label: "Tầm nhìn",
                    val: present(current?.visibility)
                      ? value(current.visibility / 1000)
                      : "—",
                    suffix: "km",
                    note: `Áp suất ${value(current?.pressure, " hPa")}`,
                    type: "visibility",
                    progress: present(current?.visibility)
                      ? current.visibility / 500
                      : 0,
                  },
                ].map((m) => (
                  <div className={`metric-card ${m.type}`} key={m.label}>
                    <div className="metric-label">
                      <m.icon size={17} />
                      {m.label}
                    </div>
                    <div className="metric-value">
                      {m.val}
                      <small>{m.suffix}</small>
                    </div>
                    <div className="metric-indicator">
                      <i
                        style={{ width: `${Math.min(100, m.progress || 0)}%` }}
                      />
                    </div>
                    <p>{m.note}</p>
                  </div>
                ))}
              </div>
              <HourlyTimeline
                context={context}
                onSelect={(h) => setModal({ type: "hour", data: h })}
                unit={unit}
              />
              <div className="lower-grid">
                <ActivityScores
                  context={context}
                  preferences={preferences}
                  onSelect={(a) => setModal({ type: "activity", data: a })}
                />
                <QuickChat
                  question={question}
                  setQuestion={setQuestion}
                  disabled={!context}
                  onAsk={(q) => {
                    navigate("assistant");
                    ask(q);
                  }}
                />
              </div>
              <div className="bottom-grid">
                <DailyForecast
                  context={context}
                  unit={unit}
                  onDay={(d) => setModal({ type: "day", data: d })}
                />
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <h2>Bầu trời quanh bạn</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("map")}
                    >
                      Mở bản đồ <Maximize2 size={13} />
                    </button>
                  </div>
                  <WeatherMap
                    location={location}
                    current={current}
                    onSelect={selectLocation}
                  />
                </section>
              </div>
            </>
          )}
          {section === "forecast" && (
            <>
              <HourlyTimeline
                context={context}
                onSelect={(h) => setModal({ type: "hour", data: h })}
                unit={unit}
              />
              <div className="forecast-layout">
                <DailyForecast
                  context={context}
                  unit={unit}
                  full
                  onDay={(d) => setModal({ type: "day", data: d })}
                />
                <ActivityScores
                  context={context}
                  preferences={preferences}
                  full
                  onSelect={(a) => setModal({ type: "activity", data: a })}
                />
              </div>
            </>
          )}
          {section === "map" && (
            <section className="panel map-page">
              <div className="panel-heading">
                <h2>
                  <MapPin size={18} />
                  {city}
                </h2>
                <span className="muted">
                  {location.latitude.toFixed(6)},{" "}
                  {location.longitude.toFixed(6)}
                </span>
              </div>
              <WeatherMap
                location={location}
                current={current}
                onSelect={selectLocation}
                expanded
              />
              <div className="map-details">
                <div>
                  <h3>Thời tiết tại điểm đã chọn</h3>
                  <p>
                    {context?.location.formattedAddress ||
                      "Chọn trên bản đồ hoặc tìm một địa điểm."}
                  </p>
                </div>
                <strong>
                  {temp(current?.temperature)}{" "}
                  <WeatherIcon code={current?.weatherCode} />
                </strong>
              </div>
              <p className="card-footnote">
                Các lớp hiển thị 9 điểm dự báo quanh vị trí đã chọn; không nội
                suy giữa các điểm và không phải radar trực tiếp.{" "}
                {location.accuracy
                  ? `Độ chính xác GPS ±${Math.round(location.accuracy)} m; đây không phải độ phân giải dự báo.`
                  : "Tọa độ được dùng trực tiếp để lấy dự báo."}
              </p>
            </section>
          )}
          {section === "assistant" && (
            <Assistant
              {...{
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
              }}
            />
          )}
          {section === "planner" && (
            <Planner {...{ context, preferences, setToast }} />
          )}
          {section === "compare" && (
            <Compare
              {...{ context, preferences, temp, setToast }}
              selectLocation={(p) => {
                selectLocation(p);
                navigate("overview");
              }}
            />
          )}
          {section === "alerts" && <Alerts {...{ context, alerts, city }} />}
          <footer className="page-footer">
            <span>
              <span className="status-dot" /> Dữ liệu từ{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo
              </a>
              <span className="footer-divider">|</span>Tọa độ chính xác. Quyết
              định thông minh.
            </span>
            <span>
              Made for your everyday <Sparkles size={12} />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "preferences"
              ? "Thời tiết theo cách của bạn"
              : modal.type === "activity"
                ? `${modal.data.name} · Vì sao có điểm này?`
                : modal.type === "hour"
                  ? `Dự báo ${hour(modal.data.time)} · ${modal.data.time.slice(0, 10)}`
                  : `Dự báo ngày ${modal.data.date}`
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "preferences" ? (
            <div className="preferences-form">
              <p>
                Chỉ những sở thích bạn chọn mới được dùng để cá nhân hóa gợi ý.
              </p>
              <label>
                Nhiệt độ tối đa ưa thích (°C)
                <input
                  type="number"
                  min="10"
                  max="45"
                  placeholder="Chưa thiết lập"
                  value={draft.maxTemperature ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      maxTemperature:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Hoạt động thường xuyên
                <select
                  value={draft.activity || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, activity: e.target.value })
                  }
                >
                  <option value="">Chưa chọn</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phương tiện di chuyển
                <select
                  value={draft.transport || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, transport: e.target.value })
                  }
                >
                  <option value="">Chưa chọn</option>
                  <option value="walking">Đi bộ</option>
                  <option value="bike">Xe đạp</option>
                  <option value="motorbike">Xe máy</option>
                  <option value="car">Ô tô</option>
                </select>
              </label>
              <label>
                Giờ đi làm thường ngày
                <input
                  type="time"
                  value={draft.commute || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, commute: e.target.value })
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.uvSensitive || false}
                  onChange={(e) =>
                    setDraft({ ...draft, uvSensitive: e.target.checked })
                  }
                />
                Tôi nhạy cảm với UV
              </label>
              <button
                className="primary-button"
                disabled={saving}
                onClick={savePrefs}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Lưu sở thích
              </button>
              <small>
                Được lưu trong cơ sở dữ liệu, gắn với trình duyệt này.
              </small>
            </div>
          ) : modal.type === "activity" ? (
            <div className="score-details">
              <div className="score-big">
                {modal.data.score ?? "—"}
                <span>/100</span>
              </div>
              <h3>{scoreLabel(modal.data.score)}</h3>
              <p>
                Điểm tham khảo tính từ điều kiện hiện tại, không phải xác suất
                an toàn.
              </p>
              {modal.data.factors.map((f) => (
                <div className="factor" key={f.name}>
                  <span>{f.name}</span>
                  <strong>{f.metric}</strong>
                  <span className={f.penalty > 15 ? "amber" : "mint-text"}>
                    {f.metric === "—"
                      ? "Chưa có"
                      : f.penalty > 15
                        ? "Bất lợi"
                        : f.penalty > 5
                          ? "Cân nhắc"
                          : "Thuận lợi"}
                  </span>
                </div>
              ))}
              {modal.data.missing.length > 0 && (
                <p className="amber">
                  Thiếu dữ liệu: {modal.data.missing.join(", ")}. Các yếu tố
                  thiếu không được chấm điểm.
                </p>
              )}
              <small>
                Bắt đầu từ 100, trừ điểm theo độ lệch nhiệt, mưa, gió, độ ẩm,
                UV, AQI và sở thích. Giông, mưa lớn hoặc gió nguy hiểm giới hạn
                điểm ở 15.
              </small>
            </div>
          ) : (
            <div className="weather-details">
              <WeatherIcon
                code={modal.data.weatherCode}
                day={modal.data.isDay}
                size={56}
              />
              <h3>{weatherLabel(modal.data.weatherCode)}</h3>
              <DetailRows
                rows={
                  modal.type === "hour"
                    ? [
                        ["Nhiệt độ", temp(modal.data.temperature)],
                        ["Cảm nhận", temp(modal.data.feelsLike)],
                        [
                          "Khả năng mưa",
                          value(modal.data.rainProbability, "%"),
                        ],
                        [
                          "Lượng mưa",
                          value(modal.data.precipitation, " mm", 1),
                        ],
                        ["Độ ẩm", value(modal.data.humidity, "%")],
                        ["Gió", value(modal.data.windSpeed, " km/h")],
                        ["UV", value(modal.data.uv)],
                        ["US AQI", value(modal.data.aqi)],
                        [
                          "Tầm nhìn",
                          value(
                            present(modal.data.visibility)
                              ? modal.data.visibility / 1000
                              : null,
                            " km",
                          ),
                        ],
                      ]
                    : [
                        ["Cao nhất", temp(modal.data.max)],
                        ["Thấp nhất", temp(modal.data.min)],
                        [
                          "Khả năng mưa tối đa",
                          value(modal.data.rainProbability, "%"),
                        ],
                        [
                          "Lượng mưa",
                          value(modal.data.precipitation, " mm", 1),
                        ],
                        ["UV tối đa", value(modal.data.uv)],
                        ["Gió mạnh nhất", value(modal.data.windSpeed, " km/h")],
                        ["Bình minh", hour(modal.data.sunrise)],
                        ["Hoàng hôn", hour(modal.data.sunset)],
                      ]
                }
              />
              <small>
                Open-Meteo · {context?.timezone} · “—” nghĩa là chưa có dữ liệu.
              </small>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
