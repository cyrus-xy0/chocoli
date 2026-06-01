import React from "react";
import ReactDOM from "react-dom/client";
import {
  Baby,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Camera,
  ArrowLeft,
  FileDown,
  Heart,
  Home,
  Images,
  LogOut,
  Mail,
  PenLine,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Star,
  Upload
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./styles/app.css";

type SettingsState = {
  homeTitle: string;
  entranceTitle: string;
  entranceSubtitle: string;
  partnerOneName: string;
  partnerTwoName: string;
  babyNickname: string;
  dueDate: string;
  lastPeriodDate: string;
  homeMessage: string;
};

type MediaItem = {
  id: string;
  url: string;
  original_name: string;
};

type Entry = {
  id: string;
  entry_date: string;
  title: string;
  body: string;
  author: string;
  mood: string;
  tags: string[];
  media: MediaItem[];
};

type PrenatalRecord = {
  id: string;
  title: string;
  record_date: string;
  location: string;
  notes: string;
  questions: string[];
};

type InfoCard = {
  id: string;
  title: string;
  content: string;
  category: string;
  link_url: string;
  pinned: boolean;
};

type LoveNote = {
  id: string;
  body: string;
  author: string;
  note_date: string;
  is_pinned: boolean;
};

type Letter = {
  id: string;
  title: string;
  body: string;
  letter_date: string;
  author: string;
  recipient: string;
  occasion: string;
  is_favorite: boolean;
};

const defaultSettings: SettingsState = {
  homeTitle: "我们的生活小屋",
  entranceTitle: "欢迎回到我们的小屋",
  entranceSubtitle: "这里放着每天的小事、珍贵的记录，还有正在慢慢长大的宝宝。",
  partnerOneName: "我",
  partnerTwoName: "她",
  babyNickname: "小小住客",
  dueDate: "",
  lastPeriodDate: "",
  homeMessage: "今天也想认真照顾你，认真记录我们。"
};

const homeImages = {
  hero: "/assets/home-hero.png",
  moments: "/assets/home-moments.png",
  letters: "/assets/home-letters.png",
  pregnancy: "/assets/home-pregnancy.png"
};

const navItems = [
  { href: "/", label: "今日", icon: Home },
  { href: "/moments", label: "记录", icon: Images },
  { href: "/letters", label: "信件", icon: Mail },
  { href: "/pregnancy", label: "孕期", icon: Baby },
  { href: "/info", label: "资料", icon: BookOpen },
  { href: "/settings", label: "设置", icon: Settings }
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  if (!date) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function pregnancyInfo(settings: SettingsState) {
  const day = 24 * 60 * 60 * 1000;
  let start: Date | null = null;
  if (settings.lastPeriodDate) {
    start = new Date(`${settings.lastPeriodDate}T00:00:00`);
  } else if (settings.dueDate) {
    start = new Date(new Date(`${settings.dueDate}T00:00:00`).getTime() - 280 * day);
  }

  if (!start || Number.isNaN(start.getTime())) {
    return { label: "待设置", detail: "在设置页填入预产期或末次月经日期后，这里会自动计算孕周。", week: 0, days: 0 };
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / day));
  const week = Math.floor(elapsed / 7) + 1;
  const days = elapsed % 7;
  const due = settings.dueDate ? `预产期 ${formatDate(settings.dueDate)}` : "可以在设置页补上预产期";
  return {
    label: `第 ${Math.min(week, 42)} 周 + ${days} 天`,
    detail: `${settings.babyNickname || "宝宝"}正在慢慢长大。${due}`,
    week,
    days
  };
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    let message = "请求失败";
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      message = response.statusText;
    }
    throw new Error(message);
  }
  return response.json();
}

function useAsyncData<T>(loader: () => Promise<T>, deps: React.DependencyList, fallback: T) {
  const [data, setData] = React.useState<T>(fallback);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, deps);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

function App() {
  const [checking, setChecking] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [settings, setSettings] = React.useState<SettingsState>(defaultSettings);

  async function refreshMe() {
    try {
      const me = await api<{ authenticated: boolean; settings: SettingsState }>("/api/me");
      setAuthenticated(me.authenticated);
      setSettings({ ...defaultSettings, ...me.settings });
    } catch {
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  }

  React.useEffect(() => {
    void refreshMe();
  }, []);

  if (checking) return <div className="boot-screen">正在点亮小屋的灯</div>;
  if (!authenticated) return <Login settings={settings} onLogin={refreshMe} />;

  return <Shell settings={settings} setSettings={setSettings} onLogout={() => setAuthenticated(false)} />;
}

function Login({ settings, onLogin }: { settings: SettingsState; onLogin: () => void }) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "进入失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">
          <Heart size={22} />
        </div>
        <p className="eyebrow">Private cabin</p>
        <h1>{settings.entranceTitle}</h1>
        <p>{settings.entranceSubtitle}</p>
        <form onSubmit={submit} className="login-form">
          <label>
            小屋口令
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入你们的共享密码"
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" disabled={busy}>
            <Sparkles size={18} />
            {busy ? "正在开门" : "进入小屋"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Shell({
  settings,
  setSettings,
  onLogout
}: {
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  onLogout: () => void;
}) {
  const [path, setPath] = React.useState(() => window.location.pathname);
  const current = path === "/" ? "今日小屋" : navItems.find((item) => item.href === path)?.label || "今日小屋";
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const sidebarCloseTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    function syncPath() {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  React.useEffect(() => {
    document.title = `${current} · ${settings.homeTitle}`;
  }, [current, settings.homeTitle]);

  React.useEffect(() => {
    return () => {
      if (sidebarCloseTimer.current) window.clearTimeout(sidebarCloseTimer.current);
    };
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    onLogout();
  }

  function openSidebar() {
    if (sidebarCloseTimer.current) {
      window.clearTimeout(sidebarCloseTimer.current);
      sidebarCloseTimer.current = null;
    }
    setSidebarOpen(true);
  }

  function queueSidebarClose() {
    if (sidebarCloseTimer.current) window.clearTimeout(sidebarCloseTimer.current);
    sidebarCloseTimer.current = window.setTimeout(() => {
      setSidebarOpen(false);
      sidebarCloseTimer.current = null;
    }, 180);
  }

  function closeSidebarOnBlur(event: React.FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      queueSidebarClose();
    }
  }

  function navigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (window.location.pathname !== href || window.location.search) {
      window.history.pushState({}, "", href);
      setPath(href);
    }
    openSidebar();
  }

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <aside
        className="sidebar"
        onBlur={closeSidebarOnBlur}
        onFocus={openSidebar}
        onMouseEnter={openSidebar}
        onMouseLeave={queueSidebarClose}
      >
        <a href="/" className="site-title" onClick={(event) => navigate(event, "/")}>
          <span className="brand-mark small">
            <Heart size={18} />
          </span>
          <span className="sidebar-label">{settings.homeTitle}</span>
        </a>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <a key={item.href} className={active ? "active" : ""} href={item.href} onClick={(event) => navigate(event, item.href)}>
                <Icon size={18} />
                <span className="sidebar-label">{item.label}</span>
              </a>
            );
          })}
        </nav>
        <button className="ghost-button logout-button" onClick={logout}>
          <LogOut size={17} />
          <span className="sidebar-label">离开</span>
        </button>
      </aside>
      <main className="content">
        <header className="mobile-topbar">
          <span>{current}</span>
          <button className="icon-button" onClick={logout} aria-label="离开小屋">
            <LogOut size={18} />
          </button>
        </header>
        {path === "/moments" ? (
          <Moments settings={settings} />
        ) : path === "/letters" ? (
          <Letters settings={settings} />
        ) : path === "/pregnancy" ? (
          <Pregnancy settings={settings} />
        ) : path === "/info" ? (
          <Info />
        ) : path === "/settings" ? (
          <SettingsPage settings={settings} setSettings={setSettings} />
        ) : (
          <Dashboard settings={settings} />
        )}
      </main>
    </div>
  );
}

function Dashboard({ settings }: { settings: SettingsState }) {
  const entries = useAsyncData<Entry[]>(() => api("/api/entries?limit=6"), [], []);
  const notes = useAsyncData<LoveNote[]>(() => api("/api/love-notes"), [], []);
  const letters = useAsyncData<Letter[]>(() => api("/api/letters"), [], []);
  const info = pregnancyInfo(settings);
  const latestEntry = entries.data[0];
  const latestLetter = letters.data[0];
  const noteRailRef = React.useRef<HTMLDivElement>(null);
  const noteDragRef = React.useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    lastTime: 0,
    lastScrollLeft: 0,
    velocity: 0
  });
  const noteMomentumRef = React.useRef<number | null>(null);
  const [isNoteDragging, setIsNoteDragging] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (noteMomentumRef.current) window.cancelAnimationFrame(noteMomentumRef.current);
    };
  }, []);

  function scrollNotes(direction: -1 | 1) {
    const rail = noteRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.min(rail.clientWidth * 0.82, 520), behavior: "smooth" });
  }

  function stopNoteMomentum() {
    if (noteMomentumRef.current) {
      window.cancelAnimationFrame(noteMomentumRef.current);
      noteMomentumRef.current = null;
    }
  }

  function glideNotes(initialVelocity: number) {
    stopNoteMomentum();
    let velocity = initialVelocity;
    const step = () => {
      const rail = noteRailRef.current;
      if (!rail) return;
      const before = rail.scrollLeft;
      rail.scrollLeft += velocity * 16;
      velocity *= before === rail.scrollLeft ? 0 : 0.92;
      if (Math.abs(velocity) > 0.02) {
        noteMomentumRef.current = window.requestAnimationFrame(step);
      } else {
        noteMomentumRef.current = null;
      }
    };
    noteMomentumRef.current = window.requestAnimationFrame(step);
  }

  function isInteractiveNoteTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, label"));
  }

  function startNoteDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isInteractiveNoteTarget(event.target)) return;
    const rail = noteRailRef.current;
    if (!rail) return;
    stopNoteMomentum();
    const now = performance.now();
    noteDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: rail.scrollLeft,
      lastTime: now,
      lastScrollLeft: rail.scrollLeft,
      velocity: 0
    };
    rail.setPointerCapture(event.pointerId);
    setIsNoteDragging(true);
  }

  function moveNoteDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = noteDragRef.current;
    const rail = noteRailRef.current;
    if (!drag.active || !rail) return;
    event.preventDefault();
    const nextScrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
    rail.scrollLeft = nextScrollLeft;
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (rail.scrollLeft - drag.lastScrollLeft) / elapsed;
    drag.lastTime = now;
    drag.lastScrollLeft = rail.scrollLeft;
  }

  function endNoteDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = noteDragRef.current;
    const rail = noteRailRef.current;
    if (!drag.active) return;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    drag.active = false;
    setIsNoteDragging(false);
    if (Math.abs(drag.velocity) > 0.02) glideNotes(drag.velocity);
  }

  return (
    <div className="home-page">
      <section className="today-panel home-hero">
        <div className="page-script-mark today-script" aria-hidden="true">
          <span>Today</span>
          <small>此间有光</small>
        </div>
        <div className="home-hero-copy">
          <p className="eyebrow">Today</p>
          <h1>{settings.homeMessage}</h1>
          <p>{info.detail}</p>
          <div className="stat-row">
            <div>
              <span>{info.label}</span>
              <small>孕期状态</small>
            </div>
            <div>
              <span>{letters.data.length}</span>
              <small>信件</small>
            </div>
            <div>
              <span>{entries.data.length}</span>
              <small>最近记录</small>
            </div>
          </div>
          <div className="hero-actions">
            <a className="primary-button" href="/moments">
              <Images size={18} />
              看记录
            </a>
            <a className="secondary-button" href="/letters">
              <Mail size={18} />
              看信件
            </a>
          </div>
        </div>
        <figure className="home-hero-art">
          <img src={homeImages.hero} alt="" />
        </figure>
      </section>

      <section className="home-note-board" aria-labelledby="love-note-title">
        <div className="home-note-board-head">
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="love-note-title">爱意便签</h2>
          </div>
          <div className="home-note-board-side">
            <span>一句很小的话，也可以被好好留下。</span>
            <div className="note-scroll-controls" aria-label="便签滑动控制">
              <button className="icon-button note-scroll-button" type="button" aria-label="向左滑动便签" onClick={() => scrollNotes(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button className="icon-button note-scroll-button" type="button" aria-label="向右滑动便签" onClick={() => scrollNotes(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="sticky-note-rail-wrap">
          <div
            className={`sticky-note-rail${isNoteDragging ? " is-dragging" : ""}`}
            ref={noteRailRef}
            tabIndex={0}
            aria-label="爱意便签，可以左右滑动"
            onPointerDown={startNoteDrag}
            onPointerMove={moveNoteDrag}
            onPointerUp={endNoteDrag}
            onPointerCancel={endNoteDrag}
          >
            {notes.data.map((note, index) => (
              <blockquote key={note.id} className={`sticky-note sticky-note-${index % 3}`}>
                {note.is_pinned ? <Pin size={15} /> : null}
                <p>{note.body}</p>
                <cite>{note.author} · {formatDate(note.note_date)}</cite>
              </blockquote>
            ))}
            {!notes.data.length ? <div className="sticky-note sticky-note-empty">还没有便签，第一句可以从这里开始。</div> : null}
            <LoveNoteComposer onSaved={notes.reload} settings={settings} />
          </div>
        </div>
      </section>

      <section className="home-summary-grid">
        <HomeSummaryCard
          icon={Images}
          title="生活记录"
          href="/moments"
          meta={latestEntry ? formatDate(latestEntry.entry_date) : "还没有记录"}
          imageSrc={homeImages.moments}
        >
          {latestEntry ? latestEntry.title : "把普通的一天留下来，之后回看会很珍贵。"}
        </HomeSummaryCard>
        <HomeSummaryCard
          icon={Mail}
          title="给她的信"
          href="/letters"
          meta={latestLetter ? formatDate(latestLetter.letter_date) : "还没有信件"}
          imageSrc={homeImages.letters}
        >
          {latestLetter ? latestLetter.title : "长一点、认真一点的话，可以收进信件。"}
        </HomeSummaryCard>
        <HomeSummaryCard icon={Baby} title="孕期进度" href="/pregnancy" meta={info.label} imageSrc={homeImages.pregnancy}>
          {info.detail}
        </HomeSummaryCard>
      </section>
    </div>
  );
}

function Letters({ settings }: { settings: SettingsState }) {
  const letters = useAsyncData<Letter[]>(() => api("/api/letters"), [], []);
  const [editing, setEditing] = React.useState(false);
  const [readingId, setReadingId] = React.useState(() => new URLSearchParams(window.location.search).get("letter"));
  const readingLetter = readingId ? letters.data.find((letter) => letter.id === readingId) || null : null;

  React.useEffect(() => {
    function syncReadingId() {
      setReadingId(new URLSearchParams(window.location.search).get("letter"));
    }
    window.addEventListener("popstate", syncReadingId);
    return () => window.removeEventListener("popstate", syncReadingId);
  }, []);

  function openLetter(letter: Letter) {
    setReadingId(letter.id);
    window.history.pushState({}, "", `/letters?letter=${letter.id}`);
  }

  function closeReader() {
    setReadingId(null);
    window.history.pushState({}, "", "/letters");
  }

  async function toggleFavorite(letter: Letter) {
    const updated = await api<Letter>(`/api/letters/${letter.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite: !letter.is_favorite })
    });
    letters.reload();
  }

  if (editing) {
    return (
      <div className="stack-page">
        <div className="letter-edit-lead">
          <button className="secondary-button" type="button" onClick={() => setEditing(false)}>
            <ArrowLeft size={17} />
            返回信件
          </button>
          <PageLead eyebrow="New letter" title="写一封信" text="先安静写完，再把它收进这里。" />
        </div>
        <LetterComposer
          settings={settings}
          onSaved={() => {
            letters.reload();
            setEditing(false);
          }}
        />
      </div>
    );
  }

  if (readingLetter) {
    return (
      <LetterReader
        letter={readingLetter}
        settings={settings}
        onBack={closeReader}
        onToggleFavorite={() => toggleFavorite(readingLetter)}
      />
    );
  }

  return (
    <div className="stack-page">
      <div className="letter-list-head">
        <div className="letter-title-block">
          <PageLead eyebrow="Letters" title="信件" text="慢慢写、慢慢存。那些不适合只留成一句便签的话，都可以收在这里。" />
          <div className="letter-calligraphy" aria-hidden="true">
            <span>Letter</span>
            <small>见字如面</small>
          </div>
        </div>
        <button className="primary-button letter-add-button" type="button" onClick={() => setEditing(true)}>
          <Plus size={18} />
          新增信件
        </button>
      </div>
      <section className="letter-shelf">
        {letters.data.map((letter) => (
          <article
            key={letter.id}
            data-letter-id={letter.id}
            className={`letter-card${letter.is_favorite ? " favorite" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`打开信件：${letter.title}`}
            onClick={() => openLetter(letter)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openLetter(letter);
              }
            }}
          >
            <div className="letter-envelope-face" aria-hidden="true">
              <div className="letter-stamp">
                <Mail size={16} />
              </div>
              <div className="letter-postmark">{formatDate(letter.letter_date)}</div>
            </div>
            <button
              className="icon-button letter-card-action"
              type="button"
              aria-label={letter.is_favorite ? "取消珍藏" : "珍藏这封信"}
                title={letter.is_favorite ? "取消珍藏" : "珍藏这封信"}
              onClick={async (event) => {
                event.stopPropagation();
                await toggleFavorite(letter);
              }}
            >
              <Star size={18} fill={letter.is_favorite ? "currentColor" : "none"} />
            </button>
            <div className="letter-address">
              <span>To</span>
              <strong>{letter.recipient || settings.partnerTwoName || "她"}</strong>
              <small>{letter.author || settings.partnerOneName || "我"} 写给她</small>
            </div>
            <div className="letter-paper-preview">
              <div className="letter-paper-head">
                <h2>{letter.title}</h2>
                {letter.occasion ? <div className="letter-occasion">{letter.occasion}</div> : null}
              </div>
              <p>{letter.body}</p>
              <footer>
                <span>{formatDate(letter.letter_date)}</span>
                <cite>{letter.author || settings.partnerOneName || "我"}</cite>
              </footer>
            </div>
          </article>
        ))}
        {!letters.data.length ? (
          <button className="empty-state letter-empty-action" type="button" onClick={() => setEditing(true)}>
            这里还空着，第一封信会成为小屋里很重要的一页。
          </button>
        ) : null}
      </section>
    </div>
  );
}

function LetterReader({
  letter,
  settings,
  onBack,
  onToggleFavorite
}: {
  letter: Letter;
  settings: SettingsState;
  onBack: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="letter-reader-page">
      <div className="letter-reader-top">
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          收起信纸
        </button>
        <button className="secondary-button reader-favorite-button" type="button" onClick={onToggleFavorite}>
          <Star size={17} fill={letter.is_favorite ? "currentColor" : "none"} />
          {letter.is_favorite ? "已珍藏" : "珍藏这封信"}
        </button>
      </div>

      <section className={`letter-reader-stage${letter.is_favorite ? " favorite" : ""}`} aria-label={`正在读信：${letter.title}`}>
        <div className="reader-ambient" aria-hidden="true" />
        <div className="reader-envelope" aria-hidden="true">
          <div className="reader-envelope-back" />
          <div className="reader-envelope-flap" />
          <div className="reader-envelope-left" />
          <div className="reader-envelope-right" />
          <div className="reader-envelope-front" />
          <div className="reader-envelope-seal">
            <Heart size={18} />
          </div>
        </div>

        <article className="reader-paper">
          <div className="reader-paper-meta">
            <div>
              <span>To</span>
              <strong>{letter.recipient || settings.partnerTwoName || "她"}</strong>
            </div>
            <div className="reader-postmark">{formatDate(letter.letter_date)}</div>
          </div>
          {letter.occasion ? <div className="reader-occasion">{letter.occasion}</div> : null}
          <h1>{letter.title}</h1>
          <p>{letter.body}</p>
          <footer>
            <span>From</span>
            <cite>{letter.author || settings.partnerOneName || "我"}</cite>
          </footer>
        </article>
      </section>
    </div>
  );
}

function HomeSummaryCard({
  icon: Icon,
  title,
  href,
  meta,
  imageSrc,
  children
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  meta: string;
  imageSrc: string;
  children: React.ReactNode;
}) {
  return (
    <article className="home-summary-card">
      <div className="home-summary-image">
        <img src={imageSrc} alt="" loading="lazy" />
      </div>
      <div>
        <span className="home-summary-meta">
          <Icon size={15} />
          {meta}
        </span>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <a className="ghost-button" href={href}>
        查看
      </a>
    </article>
  );
}

function LetterComposer({ settings, onSaved }: { settings: SettingsState; onSaved: () => void }) {
  const initialForm = {
    title: "",
    body: "",
    letter_date: today(),
    author: settings.partnerOneName || "我",
    recipient: settings.partnerTwoName || "她",
    occasion: ""
  };
  const [form, setForm] = React.useState(initialForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/letters", {
        method: "POST",
        body: JSON.stringify({ ...form, is_favorite: false })
      });
      setForm({ ...initialForm, letter_date: today() });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="editor-panel letter-composer" onSubmit={submit}>
      <div className="form-grid">
        <label>
          主题
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：写给某个傍晚的你" />
        </label>
        <label>
          日期
          <input type="date" value={form.letter_date} onChange={(event) => setForm({ ...form, letter_date: event.target.value })} />
        </label>
        <label>
          收信人
          <input value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} />
        </label>
        <label>
          署名
          <input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
        </label>
        <label>
          场景
          <input value={form.occasion} onChange={(event) => setForm({ ...form, occasion: event.target.value })} placeholder="某个纪念日、产检后、只是很想你" />
        </label>
      </div>
      <label>
        信
        <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="把想认真留给她的话写在这里。" />
      </label>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="primary-button" disabled={busy}>
        <PenLine size={18} />
        {busy ? "正在收好" : "收进信箱"}
      </button>
    </form>
  );
}

function Moments({ settings }: { settings: SettingsState }) {
  const entries = useAsyncData<Entry[]>(() => api("/api/entries"), [], []);
  const [editing, setEditing] = React.useState(false);

  if (editing) {
    return (
      <div className="stack-page">
        <div className="edit-lead">
          <button className="secondary-button" type="button" onClick={() => setEditing(false)}>
            <ArrowLeft size={17} />
            返回记录
          </button>
          <PageLead eyebrow="New moment" title="写一条记录" text="把今天值得留下的事放进小屋。" />
        </div>
        <EntryForm
          settings={settings}
          onSaved={() => {
            entries.reload();
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack-page">
      <div className="page-action-head">
        <OrnateLead
          eyebrow="Moments"
          title="生活记录"
          text="把普通的一天放进这里，未来回看会很珍贵。"
          script="Journal"
          seal="片羽成册"
        />
        <button className="primary-button" type="button" onClick={() => setEditing(true)}>
          <Plus size={18} />
          新增记录
        </button>
      </div>
      <section className="timeline">
        {entries.data.map((entry) => (
          <article key={entry.id} className="timeline-item">
            <div className="timeline-date">{formatDate(entry.entry_date)}</div>
            <div className="timeline-body">
              <div className="card-meta">{entry.author}{entry.mood ? ` · ${entry.mood}` : ""}</div>
              <h2>{entry.title}</h2>
              <p>{entry.body}</p>
              {entry.tags.length ? <div className="tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
              {entry.media.length ? (
                <div className="photo-grid">
                  {entry.media.map((media) => (
                    <img key={media.id} src={media.url} alt={media.original_name} />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!entries.data.length ? <EmptyState text="还没有生活记录。" /> : null}
      </section>
    </div>
  );
}

function EntryForm({ settings, onSaved }: { settings: SettingsState; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    title: "",
    body: "",
    entry_date: today(),
    author: "我们",
    mood: "",
    tags: ""
  });
  const [files, setFiles] = React.useState<FileList | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let mediaIds: string[] = [];
      if (files?.length) {
        const payload = new FormData();
        Array.from(files).forEach((file) => payload.append("files", file));
        const uploaded = await api<MediaItem[]>("/api/uploads", { method: "POST", body: payload });
        mediaIds = uploaded.map((item) => item.id);
      }
      await api("/api/entries", {
        method: "POST",
        body: JSON.stringify({ ...form, tags: form.tags, mediaIds })
      });
      setForm({ title: "", body: "", entry_date: today(), author: "我们", mood: "", tags: "" });
      setFiles(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="editor-panel" onSubmit={submit}>
      <div className="form-grid">
        <label>
          标题
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="今天想记住什么" />
        </label>
        <label>
          日期
          <input type="date" value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} />
        </label>
        <label>
          作者
          <select value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })}>
            <option>我们</option>
            <option>{settings.partnerOneName || "我"}</option>
            <option>{settings.partnerTwoName || "她"}</option>
          </select>
        </label>
        <label>
          心情
          <input value={form.mood} onChange={(event) => setForm({ ...form, mood: event.target.value })} placeholder="安心、期待、想念" />
        </label>
      </div>
      <label>
        内容
        <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="写下今天的小事、想说的话、宝宝相关的变化。" />
      </label>
      <div className="form-grid compact">
        <label>
          标签
          <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="用逗号分隔，例如 产检, 周末" />
        </label>
        <label className="file-input">
          <Upload size={18} />
          <span>{files?.length ? `已选择 ${files.length} 张` : "上传照片"}</span>
          <input type="file" multiple accept="image/*" onChange={(event) => setFiles(event.target.files)} />
        </label>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="primary-button" disabled={busy}>
        <Plus size={18} />
        {busy ? "正在保存" : "保存记录"}
      </button>
    </form>
  );
}

function Pregnancy({ settings }: { settings: SettingsState }) {
  const prenatalRecords = useAsyncData<PrenatalRecord[]>(() => api("/api/prenatal-records"), [], []);
  const [creatingRecord, setCreatingRecord] = React.useState(false);
  const info = pregnancyInfo(settings);

  if (creatingRecord) {
    return (
      <div className="stack-page">
        <div className="edit-lead">
          <button className="secondary-button" type="button" onClick={() => setCreatingRecord(false)}>
            <ArrowLeft size={17} />
            返回孕期
          </button>
          <PageLead
            eyebrow="New record"
            title="新增产检记录"
            text="把这次检查看到的、听到的、想继续确认的事收好。"
          />
        </div>
        <ResourceComposer
          title="记录一次产检"
          fields={[
            { name: "title", label: "记录标题", placeholder: "NT / B 超 / 常规产检" },
            { name: "record_date", label: "记录日期", type: "date" },
            { name: "location", label: "医院或科室", placeholder: "可选" },
            { name: "notes", label: "这次记下来的事", type: "textarea", placeholder: "医生怎么说、看到了什么、你们当时的感受" },
            { name: "questions", label: "下次想确认的问题", placeholder: "用逗号分隔" }
          ]}
          endpoint="/api/prenatal-records"
          onSaved={() => {
            prenatalRecords.reload();
            setCreatingRecord(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack-page">
      <div className="page-action-head">
        <OrnateLead
          eyebrow="Pregnancy"
          title={`${settings.babyNickname || "宝宝"}的小小进度`}
          text={info.detail}
          script="Bloom"
          seal="小小生长"
        />
        <div className="page-action-buttons">
          <button className="primary-button" type="button" onClick={() => setCreatingRecord(true)}>
            <PenLine size={18} />
            新增产检记录
          </button>
        </div>
      </div>
      <section className="pregnancy-band">
        <div>
          <span>{info.label}</span>
          <p>这里只做记录和问题整理；医疗判断请以医生意见为准。</p>
        </div>
        <a className="secondary-button" href="/settings">更新日期</a>
      </section>

      <div className="pregnancy-records">
        <section className="panel">
          <PanelTitle icon={BookOpen} title="产检记录" />
          <div className="quiet-list">
            {prenatalRecords.data.map((item) => (
              <div key={item.id} className="prenatal-record-card">
                <div className="card-meta">{formatDate(item.record_date)} · {item.location || "未填写医院"}</div>
                <strong>{item.title}</strong>
                {item.notes ? <p>{item.notes}</p> : null}
                {item.questions.length ? <div className="tags">{item.questions.map((question) => <span key={question}>{question}</span>)}</div> : null}
              </div>
            ))}
            {!prenatalRecords.data.length ? <EmptyState text="还没有产检记录。" /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Info() {
  const cards = useAsyncData<InfoCard[]>(() => api("/api/info-cards"), [], []);
  const [creating, setCreating] = React.useState(false);

  if (creating) {
    return (
      <div className="stack-page">
        <div className="edit-lead">
          <button className="secondary-button" type="button" onClick={() => setCreating(false)}>
            <ArrowLeft size={17} />
            返回资料
          </button>
          <PageLead eyebrow="New info" title="新增资料" text="把要随时查到的信息安放好。" />
        </div>
        <ResourceComposer
          title="新增资料"
          fields={[
            { name: "title", label: "标题", placeholder: "医院建档信息" },
            { name: "category", label: "分类", placeholder: "医院 / 联系人 / 证件 / 链接" },
            { name: "content", label: "内容", type: "textarea", placeholder: "写下具体信息" },
            { name: "link_url", label: "链接", placeholder: "可选" }
          ]}
          defaults={{ pinned: false }}
          endpoint="/api/info-cards"
          onSaved={() => {
            cards.reload();
            setCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="stack-page">
      <div className="page-action-head">
        <OrnateLead
          eyebrow="Info"
          title="家庭资料库"
          text="医院、联系人、证件、链接和临时记忆，都可以放在这里。"
          script="Archive"
          seal="妥帖安放"
        />
        <button className="primary-button" type="button" onClick={() => setCreating(true)}>
          <Plus size={18} />
          新增资料
        </button>
      </div>
      <section className="info-grid">
        {cards.data.map((card) => (
          <article key={card.id} className="info-card">
            <div className="card-meta">
              {card.pinned ? <Pin size={14} /> : null}
              {card.category}
            </div>
            <h2>{card.title}</h2>
            <p>{card.content}</p>
            {card.link_url ? <a href={card.link_url} target="_blank" rel="noreferrer">打开链接</a> : null}
            <button
              className="ghost-button"
              onClick={async () => {
                await api(`/api/info-cards/${card.id}`, { method: "PUT", body: JSON.stringify({ pinned: !card.pinned }) });
                cards.reload();
              }}
            >
              <Pin size={15} />
              {card.pinned ? "取消置顶" : "置顶"}
            </button>
          </article>
        ))}
        {!cards.data.length ? <EmptyState text="还没有资料卡片。" /> : null}
      </section>
    </div>
  );
}

function SettingsPage({
  settings,
  setSettings
}: {
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
}) {
  const [form, setForm] = React.useState(settings);
  const [saved, setSaved] = React.useState("");
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved("");
    setError("");
    try {
      const next = await api<SettingsState>("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      setSettings({ ...defaultSettings, ...next });
      setSaved("已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  return (
    <div className="stack-page">
      <OrnateLead eyebrow="Settings" title="小屋设置" text="把称呼、宝宝昵称、孕期日期和入口文案都放在这里维护。" script="Cabin" seal="小屋有序" />
      <form className="editor-panel" onSubmit={submit}>
        <div className="form-grid">
          <label>
            小屋名字
            <input value={form.homeTitle} onChange={(event) => setForm({ ...form, homeTitle: event.target.value })} />
          </label>
          <label>
            宝宝昵称
            <input value={form.babyNickname} onChange={(event) => setForm({ ...form, babyNickname: event.target.value })} />
          </label>
          <label>
            你的称呼
            <input value={form.partnerOneName} onChange={(event) => setForm({ ...form, partnerOneName: event.target.value })} />
          </label>
          <label>
            她的称呼
            <input value={form.partnerTwoName} onChange={(event) => setForm({ ...form, partnerTwoName: event.target.value })} />
          </label>
          <label>
            预产期
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </label>
          <label>
            末次月经日期
            <input type="date" value={form.lastPeriodDate} onChange={(event) => setForm({ ...form, lastPeriodDate: event.target.value })} />
          </label>
        </div>
        <label>
          首页一句话
          <textarea value={form.homeMessage} onChange={(event) => setForm({ ...form, homeMessage: event.target.value })} />
        </label>
        <label>
          入口标题
          <input value={form.entranceTitle} onChange={(event) => setForm({ ...form, entranceTitle: event.target.value })} />
        </label>
        <label>
          入口说明
          <textarea value={form.entranceSubtitle} onChange={(event) => setForm({ ...form, entranceSubtitle: event.target.value })} />
        </label>
        <div className="deploy-note">
          共享密码通过服务器环境变量 <code>CABIN_PASSWORD</code> 设置；生产环境也要设置 <code>SESSION_SECRET</code>。
        </div>
        {saved ? <div className="form-success">{saved}</div> : null}
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-button">
          <Settings size={18} />
          保存设置
        </button>
      </form>
      <a className="secondary-button export-button" href="/api/export.json">
        <FileDown size={18} />
        导出备份
      </a>
    </div>
  );
}

type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "textarea";
  placeholder?: string;
};

function ResourceComposer({
  title,
  fields,
  defaults,
  endpoint,
  onSaved
}: {
  title: string;
  fields: Field[];
  defaults?: Record<string, unknown>;
  endpoint: string;
  onSaved: () => void;
}) {
  const initial = Object.fromEntries(fields.map((field) => [field.name, field.type === "date" ? today() : ""]));
  const [form, setForm] = React.useState<Record<string, string>>(initial);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify({ ...defaults, ...form }) });
      setForm(initial);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  return (
    <form className="mini-composer" onSubmit={submit}>
      <h2>{title}</h2>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              value={form[field.name] || ""}
              placeholder={field.placeholder}
              onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
            />
          ) : (
            <input
              type={field.type || "text"}
              value={form[field.name] || ""}
              placeholder={field.placeholder}
              onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
            />
          )}
        </label>
      ))}
      {error ? <div className="form-error">{error}</div> : null}
      <button className="primary-button">
        <Plus size={18} />
        保存
      </button>
    </form>
  );
}

function LoveNoteComposer({ onSaved, settings }: { onSaved: () => void; settings: SettingsState }) {
  const [body, setBody] = React.useState("");
  const [author, setAuthor] = React.useState(settings.partnerOneName || "我");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await api("/api/love-notes", {
      method: "POST",
      body: JSON.stringify({ body, author, note_date: today(), is_pinned: false })
    });
    setBody("");
    onSaved();
  }

  return (
    <form className="sticky-note sticky-note-composer" onSubmit={submit}>
      <div className="sticky-note-composer-title">
        <Heart size={16} />
        <h3>留一句话</h3>
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="写给她，或写给未来的你们。" />
      <div className="inline-actions">
        <select value={author} onChange={(event) => setAuthor(event.target.value)}>
          <option>{settings.partnerOneName || "我"}</option>
          <option>{settings.partnerTwoName || "她"}</option>
          <option>我们</option>
        </select>
        <button className="primary-button">
          <Heart size={17} />
          留下
        </button>
      </div>
    </form>
  );
}

function PanelTitle({
  icon: Icon,
  title,
  actionHref
}: {
  icon: LucideIcon;
  title: string;
  actionHref?: string;
}) {
  return (
    <div className="panel-title">
      <h2>
        <Icon size={18} />
        {title}
      </h2>
      {actionHref ? <a href={actionHref}>查看</a> : null}
    </div>
  );
}

function PageLead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header className="page-lead">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  );
}

function OrnateLead({
  eyebrow,
  title,
  text,
  script,
  seal
}: {
  eyebrow: string;
  title: string;
  text: string;
  script: string;
  seal: string;
}) {
  return (
    <div className="ornate-lead">
      <PageLead eyebrow={eyebrow} title={title} text={text} />
      <div className="page-script-mark" aria-hidden="true">
        <span>{script}</span>
        <small>{seal}</small>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
