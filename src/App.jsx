import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Pencil, Calendar as CalendarIcon, Flame, Target } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

// ---- palette ----
const C = {
  bg: "#08090a",
  surface: "#121316",
  surfaceRaised: "#17181c",
  border: "#232529",
  text: "#e6e5e1",
  muted: "#8d8f96",
  faint: "#5c5e64",
  gain: "#3ddc97",
  gainDim: "#1f6b4f",
  loss: "#ff6b5e",
  lossDim: "#7a352e",
  amber: "#e8b04b",
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAY = ["dom","seg","ter","qua","qui","sex","sáb"];

// deterministic decorative candlestick pattern for the header background
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const HEADER_CANDLES = (() => {
  const rand = seededRandom(7);
  return Array.from({ length: 26 }, (_, i) => {
    const base = 45 + Math.sin(i / 3.2) * 16;
    const bodyH = 6 + rand() * 20;
    const up = rand() > 0.42;
    const top = base - bodyH / 2;
    const bottom = base + bodyH / 2;
    return {
      top, bottom,
      wickTop: top - rand() * 12,
      wickBottom: bottom + rand() * 12,
      up,
    };
  });
})();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthKeyOf(dateStr) { return dateStr.slice(0,7); }
function yearOf(dateStr) { return dateStr.slice(0,4); }
function fmtBRL(v) {
  const s = v < 0 ? "-" : "";
  return `${s}R$ ${Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtUSD(v) {
  const s = v < 0 ? "-" : "";
  return `${s}$${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtPct(v) {
  if (!isFinite(v)) return "0.0%";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}
function parseDateLocal(str) { return new Date(str + "T00:00:00"); }

export default function TradingJournal() {
  const [loaded, setLoaded] = useState(false);
  const [trades, setTrades] = useState([]);
  const [balanceInicial, setBalanceInicial] = useState(1000);
  const [exchangeRate, setExchangeRate] = useState(5.4);
  const [riscoPercent, setRiscoPercent] = useState(10);
  const [metaValor, setMetaValor] = useState(5000);
  const [metaData, setMetaData] = useState(`${new Date().getFullYear()}-12-31`);
  const [editingRate, setEditingRate] = useState(false);
  const [editingInicial, setEditingInicial] = useState(false);
  const [editingRisco, setEditingRisco] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [showMetaDatePicker, setShowMetaDatePicker] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthKeyOf(todayStr()));
  const [activeTab, setActiveTab] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: todayStr(), tipo: "ganho", valor: "" });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // ---- load from localStorage ----
  useEffect(() => {
    try {
      const t = localStorage.getItem("fx-journal-trades");
      if (t) setTrades(JSON.parse(t));
    } catch (e) {}
    try {
      const s = localStorage.getItem("fx-journal-settings");
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.balanceInicial != null) setBalanceInicial(parsed.balanceInicial);
        if (parsed.exchangeRate != null) setExchangeRate(parsed.exchangeRate);
        if (parsed.riscoPercent != null) setRiscoPercent(parsed.riscoPercent);
        if (parsed.metaValor != null) setMetaValor(parsed.metaValor);
        if (parsed.metaData != null) setMetaData(parsed.metaData);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  function persistTrades(next) {
    setTrades(next);
    try {
      localStorage.setItem("fx-journal-trades", JSON.stringify(next));
    } catch (e) { setSaveError(true); }
  }
  function persistSettings(next) {
    try {
      localStorage.setItem("fx-journal-settings", JSON.stringify(next));
    } catch (e) { setSaveError(true); }
  }
  function saveSettings(overrides) {
    const next = { balanceInicial, exchangeRate, riscoPercent, metaValor, metaData, ...overrides };
    persistSettings(next);
  }

  const sorted = useMemo(
    () => [...trades].sort((a,b) => a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)),
    [trades]
  );

  const currentMonthKey = monthKeyOf(todayStr());

  const monthsAvailable = useMemo(() => {
    const set = new Set(sorted.map(t => monthKeyOf(t.date)));
    set.add(currentMonthKey);
    return Array.from(set).sort().reverse();
  }, [sorted, currentMonthKey]);

  const currentYearKey = currentMonthKey.slice(0,4);
  const yearsAvailable = useMemo(() => {
    const set = new Set(monthsAvailable.map(m => m.slice(0,4)));
    return Array.from(set).sort().reverse();
  }, [monthsAvailable]);

  function sumBefore(dateStr) {
    return sorted.filter(t => t.date < dateStr).reduce((s,t) => s + t.valor, 0);
  }
  function sumOnDate(dateStr) {
    return sorted.filter(t => t.date === dateStr).reduce((s,t) => s + t.valor, 0);
  }
  function sumInMonth(monthKey) {
    return sorted.filter(t => monthKeyOf(t.date) === monthKey).reduce((s,t) => s + t.valor, 0);
  }
  function sumInYear(year) {
    return sorted.filter(t => yearOf(t.date) === year).reduce((s,t) => s + t.valor, 0);
  }

  const totalBalance = balanceInicial + sorted.reduce((s,t) => s + t.valor, 0);

  const monthFirstDay = `${selectedMonthKey}-01`;
  const balanceStartOfMonth = balanceInicial + sumBefore(monthFirstDay);
  const monthPnl = sumInMonth(selectedMonthKey);
  const balanceEndOfMonth = balanceStartOfMonth + monthPnl;
  const monthPct = balanceStartOfMonth !== 0 ? (monthPnl / balanceStartOfMonth) * 100 : 0;

  const selectedYear = selectedMonthKey.slice(0,4);
  const yearFirstDay = `${selectedYear}-01-01`;
  const balanceStartOfYear = balanceInicial + sumBefore(yearFirstDay);
  const yearPnl = sumInYear(selectedYear);
  const yearPct = balanceStartOfYear !== 0 ? (yearPnl / balanceStartOfYear) * 100 : 0;

  const tradesInMonth = useMemo(
    () => sorted.filter(t => monthKeyOf(t.date) === selectedMonthKey),
    [sorted, selectedMonthKey]
  );
  const daysInMonth = useMemo(() => {
    const set = new Set(tradesInMonth.map(t => t.date));
    return Array.from(set).sort();
  }, [tradesInMonth]);

  useEffect(() => {
    if (daysInMonth.length && !daysInMonth.includes(selectedDay)) {
      setSelectedDay(daysInMonth[daysInMonth.length - 1]);
    } else if (!daysInMonth.length) {
      setSelectedDay(selectedMonthKey === currentMonthKey ? todayStr() : `${selectedMonthKey}-01`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonthKey]);

  const balanceStartOfDay = balanceInicial + sumBefore(selectedDay);
  const dayPnl = sumOnDate(selectedDay);
  const dayPct = balanceStartOfDay !== 0 ? (dayPnl / balanceStartOfDay) * 100 : 0;
  const balanceEndOfDay = balanceStartOfDay + dayPnl;
  const balanceEndOfYear = balanceStartOfYear + yearPnl;

  const tradesInYear = useMemo(
    () => sorted.filter(t => yearOf(t.date) === selectedYear),
    [sorted, selectedYear]
  );
  const tradesInDay = useMemo(
    () => sorted.filter(t => t.date === selectedDay),
    [sorted, selectedDay]
  );

  // equity curve for the selected month (daily closing balance)
  const curveData = useMemo(() => {
    const points = [{ label: "início", saldo: balanceStartOfMonth }];
    let running = balanceStartOfMonth;
    const byDay = {};
    tradesInMonth.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + t.valor; });
    Object.keys(byDay).sort().forEach(d => {
      running += byDay[d];
      points.push({ label: d.slice(8,10), saldo: Number(running.toFixed(2)) });
    });
    return points;
  }, [tradesInMonth, balanceStartOfMonth]);

  // equity curve for the selected day (trade by trade)
  const dayCurveData = useMemo(() => {
    const points = [{ label: "início", saldo: balanceStartOfDay }];
    let running = balanceStartOfDay;
    tradesInDay.forEach((t, i) => {
      running += t.valor;
      points.push({ label: `#${i + 1}`, saldo: Number(running.toFixed(2)) });
    });
    return points;
  }, [tradesInDay, balanceStartOfDay]);

  // per-month breakdown for the selected year (the main chart)
  const yearMonthlyData = useMemo(() => {
    const lastMonthIdx = selectedYear === currentYearKey ? parseInt(currentMonthKey.slice(5,7), 10) - 1 : 11;
    const arr = [];
    for (let m = 0; m <= lastMonthIdx; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
      const firstDay = `${key}-01`;
      const startBal = balanceInicial + sumBefore(firstDay);
      const pnl = sumInMonth(key);
      const pct = startBal !== 0 ? (pnl / startBal) * 100 : 0;
      arr.push({ label: MONTH_NAMES[m].slice(0, 3), monthKey: key, pct: Number(pct.toFixed(2)), pnl: Number(pnl.toFixed(2)) });
    }
    return arr;
  }, [selectedYear, sorted, balanceInicial, currentYearKey, currentMonthKey]);

  const bestMonth = useMemo(
    () => yearMonthlyData.reduce((best, m) => (!best || m.pnl > best.pnl ? m : best), null),
    [yearMonthlyData]
  );
  const worstMonth = useMemo(
    () => yearMonthlyData.reduce((worst, m) => (!worst || m.pnl < worst.pnl ? m : worst), null),
    [yearMonthlyData]
  );

  // ---- streak: consecutive trading days with a positive result ----
  const { currentStreak, bestStreak } = useMemo(() => {
    const byDate = {};
    sorted.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + t.valor; });
    const days = Object.keys(byDate).sort();
    let best = 0, running = 0, cur = 0;
    days.forEach((d, i) => {
      if (byDate[d] > 0) {
        running += 1;
        if (running > best) best = running;
      } else {
        running = 0;
      }
      if (i === days.length - 1) cur = byDate[d] > 0 ? running : 0;
    });
    return { currentStreak: cur, bestStreak: best };
  }, [sorted]);

  // ---- risk reference for today ----
  const riscoValor = totalBalance * (riscoPercent / 100);

  // ---- goal progress ----
  const metaProgressPct = metaValor > 0 ? Math.min(100, Math.max(0, (totalBalance / metaValor) * 100)) : 0;
  const metaReached = totalBalance >= metaValor && metaValor > 0;
  const metaDaysRemaining = Math.ceil((parseDateLocal(metaData) - parseDateLocal(todayStr())) / 86400000);
  const metaDeadlinePassed = metaDaysRemaining <= 0 && !metaReached;
  const metaAmountRemaining = metaValor - totalBalance;
  const metaDailyNeeded = (!metaReached && !metaDeadlinePassed && metaDaysRemaining > 0)
    ? metaAmountRemaining / metaDaysRemaining
    : 0;

  function monthLabel(key) {
    const [y,m] = key.split("-");
    return `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`;
  }
  function shiftMonth(dir) {
    const idx = monthsAvailable.indexOf(selectedMonthKey);
    // months sorted desc: dir=-1 goes to older (higher idx), dir=1 goes to newer (lower idx)
    const newIdx = idx - dir;
    if (newIdx >= 0 && newIdx < monthsAvailable.length) {
      setSelectedMonthKey(monthsAvailable[newIdx]);
    }
  }
  function shiftYear(dir) {
    const idx = yearsAvailable.indexOf(selectedYear);
    const newIdx = idx - dir;
    if (newIdx >= 0 && newIdx < yearsAvailable.length) {
      const newYear = yearsAvailable[newIdx];
      const monthsOfYear = monthsAvailable.filter(m => m.startsWith(newYear)).sort();
      setSelectedMonthKey(monthsOfYear.length ? monthsOfYear[monthsOfYear.length - 1] : `${newYear}-01`);
    }
  }

  function addTrade(e) {
    e.preventDefault();
    const raw = parseFloat(String(form.valor).replace(",", "."));
    if (!raw || raw <= 0 || !form.date) return;
    const valor = form.tipo === "ganho" ? raw : -raw;
    const next = [...trades, { id: Date.now(), date: form.date, valor }];
    persistTrades(next);
    if (!monthsAvailable.includes(monthKeyOf(form.date))) {
      setSelectedMonthKey(monthKeyOf(form.date));
    }
    setForm({ date: form.date, tipo: "ganho", valor: "" });
    setShowDatePicker(false);
    setShowForm(false);
  }
  function removeTrade(id) {
    persistTrades(trades.filter(t => t.id !== id));
  }
  function clearMonth() {
    persistTrades(trades.filter(t => monthKeyOf(t.date) !== selectedMonthKey));
    setShowClearConfirm(false);
  }

  if (!loaded) {
    return (
      <div style={{ background: C.bg, color: C.muted, minHeight: 400 }} className="flex items-center justify-center text-sm font-sans">
        carregando diário…
      </div>
    );
  }

  const tabs = [
    { id: "dia", label: "Dia" },
    { id: "mes", label: "Mês" },
    { id: "ano", label: "Ano" },
    { id: "metas", label: "Metas" },
  ];

  const tabPct = activeTab === "dia" ? dayPct : activeTab === "mes" ? monthPct : activeTab === "ano" ? yearPct : 0;
  const tabPnl = activeTab === "dia" ? dayPnl : activeTab === "mes" ? monthPnl : activeTab === "ano" ? yearPnl : 0;
  const tabTitle = activeTab === "dia"
    ? (parseDateLocal(selectedDay).getDate() + " de " + MONTH_NAMES[parseDateLocal(selectedDay).getMonth()])
    : activeTab === "mes" ? monthLabel(selectedMonthKey)
    : activeTab === "ano" ? selectedYear
    : "";

  const scopeTrades = activeTab === "ano" ? tradesInYear : activeTab === "dia" ? tradesInDay : tradesInMonth;
  const scopeWins = scopeTrades.filter(t => t.valor > 0).length;
  const scopeLosses = scopeTrades.filter(t => t.valor < 0).length;
  const scopeWinRate = (scopeWins + scopeLosses) > 0 ? (scopeWins / (scopeWins + scopeLosses)) * 100 : 0;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }} className="font-sans px-4 py-5 sm:px-8 sm:py-6 max-w-2xl lg:max-w-6xl mx-auto">
      {/* header */}
      <div
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
        className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-5"
      >
        <svg
          viewBox="0 0 640 90"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {HEADER_CANDLES.map((cd, i) => {
            const x = i * (640 / HEADER_CANDLES.length) + 4;
            const color = cd.up ? C.gain : C.loss;
            return (
              <g key={i} opacity={0.16}>
                <line x1={x + 4} x2={x + 4} y1={cd.wickTop} y2={cd.wickBottom} stroke={color} strokeWidth="1" />
                <rect x={x} y={Math.min(cd.top, cd.bottom)} width="8" height={Math.max(2, Math.abs(cd.bottom - cd.top))} fill={color} rx="1" />
              </g>
            );
          })}
        </svg>
        <div className="relative flex items-baseline justify-between">
          <div>
            <div style={{ color: C.faint, letterSpacing: "0.15em" }} className="text-[10px] uppercase font-medium">Diário de Trading · FX</div>
            <h1 style={{ color: C.text }} className="text-xl font-semibold mt-0.5">Meu Trading</h1>
          </div>
          <button
            onClick={() => { setShowDatePicker(false); setShowForm(true); }}
            style={{ background: C.gain, color: "#04120c" }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg active:opacity-80"
          >
            <Plus size={16} /> Operação
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-6 lg:items-start">
      <div>
      {/* balance card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 mb-4">
        <div style={{ color: C.muted }} className="text-xs mb-1">
          {activeTab === "dia"
            ? (selectedDay === todayStr() ? "Saldo atual" : `Saldo ao fim do dia ${parseDateLocal(selectedDay).toLocaleDateString("pt-BR")}`)
            : activeTab === "ano"
            ? (selectedYear === currentYearKey ? "Saldo atual" : `Saldo ao fim de ${selectedYear}`)
            : (selectedMonthKey === currentMonthKey ? "Saldo atual" : `Saldo ao fim de ${monthLabel(selectedMonthKey)}`)}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ fontVariantNumeric: "tabular-nums" }} className="text-3xl font-semibold">
            {fmtUSD(
              activeTab === "dia" ? (selectedDay === todayStr() ? totalBalance : balanceEndOfDay)
              : activeTab === "ano" ? (selectedYear === currentYearKey ? totalBalance : balanceEndOfYear)
              : (selectedMonthKey === currentMonthKey ? totalBalance : balanceEndOfMonth)
            )}
          </div>
          <div style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }} className="text-base pb-0.5">
            {fmtBRL((
              activeTab === "dia" ? (selectedDay === todayStr() ? totalBalance : balanceEndOfDay)
              : activeTab === "ano" ? (selectedYear === currentYearKey ? totalBalance : balanceEndOfYear)
              : (selectedMonthKey === currentMonthKey ? totalBalance : balanceEndOfMonth)
            ) * (exchangeRate || 1))}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: C.faint }}>
          {editingInicial ? (
            <input
              autoFocus
              type="number"
              defaultValue={balanceInicial}
              onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setBalanceInicial(v); saveSettings({ balanceInicial: v }); setEditingInicial(false); }}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
              className="w-24 rounded px-1.5 py-0.5"
            />
          ) : (
            <button onClick={() => setEditingInicial(true)} className="flex items-center gap-1 hover:opacity-80">
              banca inicial {fmtUSD(balanceInicial)} <Pencil size={10} />
            </button>
          )}
          <span style={{ color: C.border }}>·</span>
          {editingRate ? (
            <input
              autoFocus
              type="number"
              step="0.01"
              defaultValue={exchangeRate}
              onBlur={(e) => { const v = parseFloat(e.target.value) || 1; setExchangeRate(v); saveSettings({ exchangeRate: v }); setEditingRate(false); }}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
              className="w-20 rounded px-1.5 py-0.5"
            />
          ) : (
            <button onClick={() => setEditingRate(true)} className="flex items-center gap-1 hover:opacity-80">
              câmbio R$ {exchangeRate.toFixed(2)} / US$1 <Pencil size={10} />
            </button>
          )}
        </div>
      </div>

      {/* streak & risk */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-xl px-3.5 py-3 flex items-center gap-2.5">
          <div style={{ background: currentStreak > 0 ? C.gainDim : C.surfaceRaised }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
            <Flame size={16} color={currentStreak > 0 ? C.gain : C.faint} />
          </div>
          <div>
            <div style={{ color: C.faint }} className="text-[10px] uppercase tracking-wide">Streak</div>
            <div style={{ color: C.text, fontVariantNumeric: "tabular-nums" }} className="text-sm font-semibold">
              {currentStreak} {currentStreak === 1 ? "dia positivo" : "dias positivos"}
            </div>
            {bestStreak > 0 && (
              <div style={{ color: C.faint }} className="text-[10px]">recorde: {bestStreak} {bestStreak === 1 ? "dia" : "dias"}</div>
            )}
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-2">
          <div>
            <div style={{ color: C.faint }} className="text-[10px] uppercase tracking-wide">Risco máx. hoje</div>
            <div style={{ color: C.text, fontVariantNumeric: "tabular-nums" }} className="text-sm font-semibold">{fmtUSD(riscoValor)}</div>
          </div>
          {editingRisco ? (
            <input
              autoFocus
              type="number"
              step="0.5"
              defaultValue={riscoPercent}
              onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setRiscoPercent(v); saveSettings({ riscoPercent: v }); setEditingRisco(false); }}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
              className="w-14 rounded px-1.5 py-1 text-xs text-right"
            />
          ) : (
            <button
              onClick={() => setEditingRisco(true)}
              style={{ color: C.faint }}
              className="flex items-center gap-1 text-xs shrink-0 hover:opacity-80"
            >
              {riscoPercent}% <Pencil size={10} />
            </button>
          )}
        </div>
      </div>

      {/* period navigator */}
      <div className="flex items-center justify-between mb-4">
        {activeTab === "ano" ? (
          <>
            <button
              onClick={() => shiftYear(-1)}
              disabled={yearsAvailable.indexOf(selectedYear) >= yearsAvailable.length - 1}
              style={{ color: yearsAvailable.indexOf(selectedYear) >= yearsAvailable.length - 1 ? C.faint : C.text }}
              className="p-1.5 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-medium" style={{ color: C.text }}>Ano {selectedYear}</div>
            <button
              onClick={() => shiftYear(1)}
              disabled={yearsAvailable.indexOf(selectedYear) <= 0}
              style={{ color: yearsAvailable.indexOf(selectedYear) <= 0 ? C.faint : C.text }}
              className="p-1.5 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => shiftMonth(-1)}
              disabled={monthsAvailable.indexOf(selectedMonthKey) >= monthsAvailable.length - 1}
              style={{ color: monthsAvailable.indexOf(selectedMonthKey) >= monthsAvailable.length - 1 ? C.faint : C.text }}
              className="p-1.5 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-medium" style={{ color: C.text }}>{monthLabel(selectedMonthKey)}</div>
            <button
              onClick={() => shiftMonth(1)}
              disabled={monthsAvailable.indexOf(selectedMonthKey) <= 0}
              style={{ color: monthsAvailable.indexOf(selectedMonthKey) <= 0 ? C.faint : C.text }}
              className="p-1.5 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* stat grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <StatCard label="Operações" value={scopeTrades.length} />
        <StatCard label="Win rate" value={`${scopeWinRate.toFixed(1)}%`} accent={scopeWinRate >= 50 ? C.gain : C.loss} />
        <StatCard label="Wins / Losses" value={`${scopeWins} / ${scopeLosses}`} />
      </div>

      {/* tabs */}
      <div style={{ border: `1px solid ${C.border}`, background: C.surface }} className="rounded-2xl overflow-hidden mb-5">
        <div className="flex" style={{ borderBottom: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                color: activeTab === t.id ? C.text : C.faint,
                borderBottom: activeTab === t.id ? `2px solid ${C.amber}` : "2px solid transparent",
                background: "transparent",
              }}
              className="flex-1 text-sm font-medium py-2.5"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab !== "metas" && (
          <>
          {activeTab === "dia" && daysInMonth.length > 0 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              {daysInMonth.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    background: selectedDay === d ? C.amber : C.surfaceRaised,
                    color: selectedDay === d ? "#241a04" : C.muted,
                    border: `1px solid ${selectedDay === d ? C.amber : C.border}`,
                  }}
                  className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                >
                  {parseDateLocal(d).getDate()} {WEEKDAY[parseDateLocal(d).getDay()]}
                </button>
              ))}
            </div>
          )}

          <div style={{ color: C.muted }} className="text-xs mb-1 capitalize">{tabTitle}</div>
          <div className="flex items-center gap-2">
            {tabPct >= 0 ? <TrendingUp size={20} color={C.gain} /> : <TrendingDown size={20} color={C.loss} />}
            <span style={{ color: tabPct >= 0 ? C.gain : C.loss, fontVariantNumeric: "tabular-nums" }} className="text-3xl font-semibold">
              {fmtPct(tabPct)}
            </span>
          </div>
          <div style={{ color: C.muted }} className="text-sm mt-1">
            {fmtUSD(tabPnl)} <span style={{ color: C.faint }}>·</span> {fmtBRL(tabPnl * (exchangeRate || 1))}
          </div>

          {activeTab === "dia" && dayCurveData.length > 1 && (
            <div className="h-24 mt-4 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dayCurveData}>
                  <defs>
                    <linearGradient id="fillDay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dayPct >= 0 ? C.gain : C.loss} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={dayPct >= 0 ? C.gain : C.loss} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: C.muted }}
                    itemStyle={{ color: C.text }}
                    formatter={(v) => [fmtUSD(v), "saldo"]}
                  />
                  <Area type="monotone" dataKey="saldo" stroke={dayPct >= 0 ? C.gain : C.loss} strokeWidth={2} fill="url(#fillDay)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === "mes" && curveData.length > 1 && (
            <div className="h-24 mt-4 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData}>
                  <defs>
                    <linearGradient id="fillCurve" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={monthPct >= 0 ? C.gain : C.loss} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={monthPct >= 0 ? C.gain : C.loss} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: C.muted }}
                    itemStyle={{ color: C.text }}
                    formatter={(v) => [fmtUSD(v), "saldo"]}
                  />
                  <Area type="monotone" dataKey="saldo" stroke={monthPct >= 0 ? C.gain : C.loss} strokeWidth={2} fill="url(#fillCurve)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === "ano" && yearMonthlyData.length > 0 && (
            <>
              <div className="h-64 mt-5 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearMonthlyData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: C.faint, fontSize: 11 }}
                      axisLine={{ stroke: C.border }}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: C.surfaceRaised }}
                      contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: C.text, marginBottom: 4 }}
                      formatter={(v, name, props) => [`${fmtUSD(props.payload.pnl)} · ${fmtPct(v)}`, "resultado"]}
                    />
                    <Bar dataKey="pct" radius={[5, 5, 5, 5]} maxBarSize={34}>
                      {yearMonthlyData.map((m, i) => (
                        <Cell key={i} fill={m.pct >= 0 ? C.gain : C.loss} fillOpacity={m.monthKey === selectedMonthKey ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {(bestMonth || worstMonth) && (
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }} className="rounded-xl px-3 py-2.5">
                    <div style={{ color: C.faint }} className="text-[10px] uppercase tracking-wide mb-0.5">Melhor mês</div>
                    <div style={{ color: C.gain, fontVariantNumeric: "tabular-nums" }} className="text-sm font-semibold">
                      {bestMonth ? `${MONTH_NAMES[parseInt(bestMonth.monthKey.slice(5,7),10)-1]} · ${fmtPct(bestMonth.pct)}` : "—"}
                    </div>
                  </div>
                  <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }} className="rounded-xl px-3 py-2.5">
                    <div style={{ color: C.faint }} className="text-[10px] uppercase tracking-wide mb-0.5">Pior mês</div>
                    <div style={{ color: C.loss, fontVariantNumeric: "tabular-nums" }} className="text-sm font-semibold">
                      {worstMonth ? `${MONTH_NAMES[parseInt(worstMonth.monthKey.slice(5,7),10)-1]} · ${fmtPct(worstMonth.pct)}` : "—"}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          </>
          )}

          {activeTab === "metas" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div style={{ color: C.muted }} className="text-xs">Meta de saldo</div>
                {editingMeta ? (
                  <input
                    autoFocus
                    type="number"
                    step="1"
                    defaultValue={metaValor}
                    onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setMetaValor(v); saveSettings({ metaValor: v }); setEditingMeta(false); }}
                    style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
                    className="w-24 rounded px-1.5 py-0.5 text-xs text-right"
                  />
                ) : (
                  <button onClick={() => setEditingMeta(true)} style={{ color: C.faint }} className="flex items-center gap-1 text-xs hover:opacity-80">
                    {fmtUSD(metaValor)} <Pencil size={10} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                <Target size={18} color={metaReached ? C.gain : C.amber} />
                <span style={{ color: metaReached ? C.gain : C.text, fontVariantNumeric: "tabular-nums" }} className="text-3xl font-semibold">
                  {metaProgressPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ color: C.muted }} className="text-sm mb-3">
                {fmtUSD(totalBalance)} de {fmtUSD(metaValor)}
              </div>

              <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }} className="w-full h-2.5 rounded-full overflow-hidden mb-4">
                <div
                  style={{
                    width: `${metaProgressPct}%`,
                    background: metaReached ? C.gain : C.amber,
                    height: "100%",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }} className="rounded-xl p-3.5 mb-3">
                {metaReached ? (
                  <div style={{ color: C.gain }} className="text-sm font-medium">🎉 Meta batida! Bora definir a próxima.</div>
                ) : metaDeadlinePassed ? (
                  <div style={{ color: C.loss }} className="text-sm font-medium">O prazo dessa meta já passou — ajuste a data ou o valor.</div>
                ) : (
                  <>
                    <div style={{ color: C.muted }} className="text-xs mb-1">
                      Faltam {fmtUSD(metaAmountRemaining)} em {metaDaysRemaining} {metaDaysRemaining === 1 ? "dia" : "dias"}
                    </div>
                    <div style={{ color: C.amber, fontVariantNumeric: "tabular-nums" }} className="text-lg font-semibold">
                      {fmtUSD(metaDailyNeeded)} <span style={{ color: C.faint }} className="text-xs font-normal">por dia até a meta</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ color: C.muted }} className="text-xs mb-1">Data alvo</div>
              <button
                type="button"
                onClick={() => setShowMetaDatePicker(s => !s)}
                style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <span className="capitalize">
                  {parseDateLocal(metaData).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
                <CalendarIcon size={15} color={C.faint} />
              </button>
              {showMetaDatePicker && (
                <div className="mt-2">
                  <CalendarPicker
                    value={metaData}
                    onChange={(d) => { setMetaData(d); saveSettings({ metaData: d }); setShowMetaDatePicker(false); }}
                    disableDate={(d) => d < todayStr()}
                    allowFuture
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      </div>

      <div>
      {/* operations list */}
      <div style={{ color: C.muted }} className="text-xs uppercase tracking-wide mb-2 flex items-center justify-between">
        <span>Operações — {monthLabel(selectedMonthKey)}</span>
        {tradesInMonth.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            style={{ color: C.loss }}
            className="flex items-center gap-1 text-[11px] normal-case tracking-normal hover:opacity-80"
          >
            <Trash2 size={11} /> Limpar mês
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {tradesInMonth.length === 0 && (
          <div style={{ color: C.faint, border: `1px dashed ${C.border}` }} className="text-sm text-center py-6 rounded-xl">
            Nenhuma operação neste mês.
          </div>
        )}
        {[...tradesInMonth].reverse().map(t => (
          <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.border}` }} className="flex items-center justify-between rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <div style={{ background: t.valor >= 0 ? C.gainDim : C.lossDim }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                {t.valor >= 0 ? <TrendingUp size={14} color={C.gain} /> : <TrendingDown size={14} color={C.loss} />}
              </div>
              <div>
                <div style={{ color: C.text }} className="text-sm">{parseDateLocal(t.date).toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div style={{ color: t.valor >= 0 ? C.gain : C.loss, fontVariantNumeric: "tabular-nums" }} className="text-sm font-medium">
                  {t.valor >= 0 ? "+" : ""}{fmtUSD(t.valor)}
                </div>
                <div style={{ color: C.faint, fontVariantNumeric: "tabular-nums" }} className="text-[11px]">
                  {t.valor >= 0 ? "+" : ""}{fmtBRL(t.valor * (exchangeRate || 1))}
                </div>
              </div>
              <button onClick={() => removeTrade(t.id)} style={{ color: C.faint }} className="p-1 hover:opacity-70">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>

      {saveError && (
        <div style={{ color: C.loss }} className="text-xs mt-4 text-center">
          não foi possível salvar automaticamente — tente novamente
        </div>
      )}

      {/* add trade modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => { setShowDatePicker(false); setShowForm(false); }}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={addTrade}
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div style={{ color: C.text }} className="font-medium">Nova operação</div>
              <button type="button" onClick={() => { setShowDatePicker(false); setShowForm(false); }} style={{ color: C.faint }}><X size={18} /></button>
            </div>

            <label style={{ color: C.muted }} className="text-xs block mb-1">Data</label>
            <button
              type="button"
              onClick={() => setShowDatePicker(s => !s)}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
              className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm mb-2"
            >
              <span className="capitalize">
                {parseDateLocal(form.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              <CalendarIcon size={15} color={C.faint} />
            </button>
            {showDatePicker && (
              <div className="mb-3">
                <CalendarPicker
                  value={form.date}
                  onChange={(d) => { setForm({ ...form, date: d }); setShowDatePicker(false); }}
                />
              </div>
            )}

            <label style={{ color: C.muted }} className="text-xs block mb-1">Resultado</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "ganho" })}
                style={{
                  background: form.tipo === "ganho" ? C.gain : C.surfaceRaised,
                  color: form.tipo === "ganho" ? "#04120c" : C.muted,
                  border: `1px solid ${form.tipo === "ganho" ? C.gain : C.border}`,
                }}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
              >
                Ganho
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "perda" })}
                style={{
                  background: form.tipo === "perda" ? C.loss : C.surfaceRaised,
                  color: form.tipo === "perda" ? "#1c0705" : C.muted,
                  border: `1px solid ${form.tipo === "perda" ? C.loss : C.border}`,
                }}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
              >
                Perda
              </button>
            </div>

            <label style={{ color: C.muted }} className="text-xs block mb-1">Valor (US$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text }}
              className="w-full rounded-lg px-3 py-2 text-sm mb-4"
            />

            <button
              type="submit"
              style={{ background: C.amber, color: "#241a04" }}
              className="w-full rounded-lg py-2.5 text-sm font-semibold"
            >
              Salvar operação
            </button>
          </form>
        </div>
      )}

      {/* clear month confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowClearConfirm(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            className="w-full sm:max-w-sm rounded-2xl p-5"
          >
            <div style={{ color: C.text }} className="font-medium mb-2">Limpar {monthLabel(selectedMonthKey)}?</div>
            <div style={{ color: C.muted }} className="text-sm mb-5">
              Isso apaga as {tradesInMonth.length} operações desse mês. Não dá pra desfazer.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={clearMonth}
                style={{ background: C.loss, color: "#1c0705" }}
                className="flex-1 rounded-lg py-2 text-sm font-semibold"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: "#121316", border: "1px solid #232529" }} className="rounded-xl px-3 py-3">
      <div style={{ color: "#8d8f96" }} className="text-[10px] uppercase tracking-wide mb-1">{label}</div>
      <div style={{ color: accent || "#e6e5e1", fontVariantNumeric: "tabular-nums" }} className="text-base font-semibold">{value}</div>
    </div>
  );
}

function CalendarPicker({ value, onChange, disableDate, allowFuture = false }) {
  const initial = parseDateLocal(value);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const today = todayStr();
  const now = new Date();
  const nextDisabled = !allowFuture && viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const isDateDisabled = disableDate || ((d) => d > today);

  const startWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function goPrev() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function goNext() {
    if (nextDisabled) return;
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }
  function cellDateStr(d) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }} className="rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={goPrev} style={{ color: C.text }} className="p-1 hover:opacity-70">
          <ChevronLeft size={16} />
        </button>
        <div style={{ color: C.text }} className="text-sm font-medium capitalize">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          style={{ color: nextDisabled ? C.faint : C.text }}
          className="p-1 hover:opacity-70 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY.map(w => (
          <div key={w} style={{ color: C.faint }} className="text-[10px] text-center uppercase">{w[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = cellDateStr(d);
          const disabled = isDateDisabled(dateStr);
          const selected = dateStr === value;
          const isToday = dateStr === today;
          return (
            <button
              type="button"
              key={i}
              disabled={disabled}
              onClick={() => onChange(dateStr)}
              style={{
                background: selected ? C.amber : "transparent",
                color: disabled ? C.faint : selected ? "#241a04" : C.text,
                border: isToday && !selected ? `1px solid ${C.amber}` : "1px solid transparent",
              }}
              className="text-xs rounded-lg py-1.5 disabled:cursor-not-allowed"
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
