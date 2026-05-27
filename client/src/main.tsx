import React from "react";
import ReactDOM from "react-dom/client";
import {
  Baby,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  FileDown,
  Heart,
  Home,
  Images,
  LogOut,
  Pin,
  Plus,
  Settings,
  Sparkles,
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

type Task = {
  id: string;
  title: string;
  notes: string;
  due_date: string;
  category: string;
  status: string;
  author: string;
};

type Appointment = {
  id: string;
  title: string;
  appointment_date: string;
  location: string;
  notes: string;
  questions: string[];
  status: string;
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

const defaultSettings: SettingsState = {
  homeTitle: "我们的生日小屋",
  entranceTitle: "欢迎回到我们的小屋",
  entranceSubtitle: "这里放着每天的小事、重要的提醒，还有正在慢慢长大的宝宝。",
  partnerOneName: "我",
  partnerTwoName: "她",
  babyNickname: "小小住客",
  dueDate: "",
  lastPeriodDate: "",
  homeMessage: "今天也想认真照顾你，认真记录我们。"
};

const navItems = [
  { href: "/", label: "今日", icon: Home },
  { href: "/moments", label: "记录", icon: Images },
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
  const path = window.location.pathname;
  const current = path === "/" ? "今日小屋" : navItems.find((item) => item.href === path)?.label || "今日小屋";

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    onLogout();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="site-title">
          <span className="brand-mark small">
            <Heart size={18} />
          </span>
          <span>{settings.homeTitle}</span>
        </a>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <a key={item.href} className={active ? "active" : ""} href={item.href}>
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <button className="ghost-button logout-button" onClick={logout}>
          <LogOut size={17} />
          离开
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
  const tasks = useAsyncData<Task[]>(() => api("/api/tasks"), [], []);
  const appointments = useAsyncData<Appointment[]>(() => api("/api/appointments"), [], []);
  const notes = useAsyncData<LoveNote[]>(() => api("/api/love-notes"), [], []);
  const info = pregnancyInfo(settings);

  return (
    <div className="page-grid">
      <section className="today-panel">
        <p className="eyebrow">Today</p>
        <h1>{settings.homeMessage}</h1>
        <p>{info.detail}</p>
        <div className="stat-row">
          <div>
            <span>{info.label}</span>
            <small>孕期状态</small>
          </div>
          <div>
            <span>{tasks.data.filter((task) => task.status !== "done").length}</span>
            <small>待办事项</small>
          </div>
          <div>
            <span>{entries.data.length}</span>
            <small>最近记录</small>
          </div>
        </div>
      </section>

      <LoveNoteComposer onSaved={notes.reload} settings={settings} />

      <section className="panel">
        <PanelTitle icon={CalendarDays} title="近期待办与产检" actionHref="/pregnancy" />
        <div className="quiet-list">
          {appointments.data.slice(0, 2).map((item) => (
            <div key={item.id} className="list-row">
              <CalendarDays size={18} />
              <div>
                <strong>{item.title}</strong>
                <span>{formatDate(item.appointment_date)} · {item.location || "地点待补"}</span>
              </div>
            </div>
          ))}
          {tasks.data
            .filter((task) => task.status !== "done")
            .slice(0, 4)
            .map((task) => (
              <div key={task.id} className="list-row">
                <Circle size={18} />
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.due_date ? formatDate(task.due_date) : "没有截止日期"} · {task.category}</span>
                </div>
              </div>
            ))}
          {!tasks.data.length && !appointments.data.length ? <EmptyState text="还没有提醒，可以从孕期页添加第一条。" /> : null}
        </div>
      </section>

      <section className="panel wide">
        <PanelTitle icon={Images} title="最近生活片段" actionHref="/moments" />
        <div className="moment-strip">
          {entries.data.map((entry) => (
            <article key={entry.id} className="memory-card">
              {entry.media?.[0] ? <img src={entry.media[0].url} alt={entry.title} /> : <div className="paper-tile" />}
              <div>
                <span>{formatDate(entry.entry_date)} · {entry.author}</span>
                <strong>{entry.title}</strong>
                <p>{entry.body}</p>
              </div>
            </article>
          ))}
          {!entries.data.length ? <EmptyState text="第一条记录还在等你写下。" /> : null}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Heart} title="爱意便签" />
        <div className="note-stack">
          {notes.data.slice(0, 5).map((note) => (
            <blockquote key={note.id}>
              {note.is_pinned ? <Pin size={15} /> : null}
              <p>{note.body}</p>
              <cite>{note.author} · {formatDate(note.note_date)}</cite>
            </blockquote>
          ))}
          {!notes.data.length ? <EmptyState text="可以留一句她随时能看到的话。" /> : null}
        </div>
      </section>
    </div>
  );
}

function Moments({ settings }: { settings: SettingsState }) {
  const entries = useAsyncData<Entry[]>(() => api("/api/entries"), [], []);

  return (
    <div className="stack-page">
      <PageLead eyebrow="Moments" title="生活记录" text="把普通的一天放进这里，未来回看会很珍贵。" />
      <EntryForm settings={settings} onSaved={entries.reload} />
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
  const tasks = useAsyncData<Task[]>(() => api("/api/tasks"), [], []);
  const appointments = useAsyncData<Appointment[]>(() => api("/api/appointments"), [], []);
  const info = pregnancyInfo(settings);

  return (
    <div className="stack-page">
      <PageLead eyebrow="Pregnancy" title={`${settings.babyNickname || "宝宝"}的小小进度`} text={info.detail} />
      <section className="pregnancy-band">
        <div>
          <span>{info.label}</span>
          <p>这里只做记录、提醒和问题整理；医疗判断请以医生意见为准。</p>
        </div>
        <a className="secondary-button" href="/settings">更新日期</a>
      </section>

      <div className="two-column">
        <ResourceComposer
          title="新增待办"
          fields={[
            { name: "title", label: "事项", placeholder: "准备建档材料" },
            { name: "due_date", label: "日期", type: "date" },
            { name: "notes", label: "备注", type: "textarea", placeholder: "需要带什么、谁负责" }
          ]}
          defaults={{ category: "pregnancy", author: "我们", status: "open" }}
          endpoint="/api/tasks"
          onSaved={tasks.reload}
        />
        <ResourceComposer
          title="新增产检"
          fields={[
            { name: "title", label: "产检名称", placeholder: "第几次产检 / NT / B 超" },
            { name: "appointment_date", label: "日期", type: "date" },
            { name: "location", label: "地点", placeholder: "医院 / 科室" },
            { name: "notes", label: "备注", type: "textarea", placeholder: "注意事项" },
            { name: "questions", label: "想问医生的问题", placeholder: "用逗号分隔" }
          ]}
          defaults={{ status: "planned" }}
          endpoint="/api/appointments"
          onSaved={appointments.reload}
        />
      </div>

      <div className="two-column">
        <section className="panel">
          <PanelTitle icon={CheckCircle2} title="孕期待办" />
          <div className="quiet-list">
            {tasks.data.map((task) => (
              <button
                key={task.id}
                className="task-row"
                onClick={async () => {
                  await api(`/api/tasks/${task.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ status: task.status === "done" ? "open" : "done" })
                  });
                  tasks.reload();
                }}
              >
                {task.status === "done" ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.due_date ? formatDate(task.due_date) : "随时"} · {task.notes || task.category}</small>
                </span>
              </button>
            ))}
            {!tasks.data.length ? <EmptyState text="还没有待办。" /> : null}
          </div>
        </section>
        <section className="panel">
          <PanelTitle icon={CalendarDays} title="产检日程" />
          <div className="quiet-list">
            {appointments.data.map((item) => (
              <div key={item.id} className="appointment-card">
                <div className="card-meta">{formatDate(item.appointment_date)} · {item.location || "地点待补"}</div>
                <strong>{item.title}</strong>
                {item.notes ? <p>{item.notes}</p> : null}
                {item.questions.length ? <div className="tags">{item.questions.map((question) => <span key={question}>{question}</span>)}</div> : null}
              </div>
            ))}
            {!appointments.data.length ? <EmptyState text="还没有产检安排。" /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Info() {
  const cards = useAsyncData<InfoCard[]>(() => api("/api/info-cards"), [], []);

  return (
    <div className="stack-page">
      <PageLead eyebrow="Info" title="家庭资料库" text="医院、联系人、证件、链接和临时记忆，都可以放在这里。" />
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
        onSaved={cards.reload}
      />
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
      <PageLead eyebrow="Settings" title="小屋设置" text="把称呼、宝宝昵称、孕期日期和入口文案都放在这里维护。" />
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
    <form className="panel note-composer" onSubmit={submit}>
      <PanelTitle icon={Heart} title="留一句话" />
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

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
