import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, X, Pencil } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";

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
  const [editingRate, setEditingRate] = useState(false);
  const [editingInicial, setEditingInicial] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthKeyOf(todayStr()));
  const [activeTab, setActiveTab] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: todayStr(), tipo: "ganho", valor: "" });
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
  const wins = tradesInMonth.filter(t => t.valor > 0).length;
  const losses = tradesInMonth.filter(t => t.valor < 0).length;
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

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
    setShowForm(false);
  }
  function removeTrade(id) {
    persistTrades(trades.filter(t => t.id !== id));
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
  ];

  const tabPct = activeTab === "dia" ? dayPct : activeTab === "mes" ? monthPct : yearPct;
  const tabPnl = activeTab === "dia" ? dayPnl : activeTab === "mes" ? monthPnl : yearPnl;
  const tabTitle = activeTab === "dia"
    ? (parseDateLocal(selectedDay).getDate() + " de " + MONTH_NAMES[parseDateLocal(selectedDay).getMonth()])
    : activeTab === "mes" ? monthLabel(selectedMonthKey)
    : selectedYear;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }} className="font-sans px-4 py-5 sm:px-6 sm:py-6 max-w-2xl mx-auto">
      {/* header */}
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div style={{ color: C.faint, letterSpacing: "0.15em" }} className="text-[10px] uppercase font-medium">Diário de Trading · FX</div>
          <h1 style={{ color: C.text }} className="text-xl font-semibold mt-0.5">Meu Trading</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: C.gain, color: "#04120c" }}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg active:opacity-80"
        >
          <Plus size={16} /> Operação
        </button>
      </div>

      {/* balance card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 mb-4">
        <div style={{ color: C.muted }} className="text-xs mb-1">
          {selectedMonthKey === currentMonthKey ? "Saldo atual" : `Saldo ao fim de ${monthLabel(selectedMonthKey)}`}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ fontVariantNumeric: "tabular-nums" }} className="text-3xl font-semibold">
            {fmtUSD(selectedMonthKey === currentMonthKey ? totalBalance : balanceEndOfMonth)}
          </div>
          <div style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }} className="text-base pb-0.5">
            {fmtBRL((selectedMonthKey === currentMonthKey ? totalBalance : balanceEndOfMonth) * (exchangeRate || 1))}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: C.faint }}>
          {editingInicial ? (
            <input
              autoFocus
              type="number"
              defaultValue={balanceInicial}
              onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setBalanceInicial(v); persistSettings({ balanceInicial: v, exchangeRate }); setEditingInicial(false); }}
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
              onBlur={(e) => { const v = parseFloat(e.target.value) || 1; setExchangeRate(v); persistSettings({ balanceInicial, exchangeRate: v }); setEditingRate(false); }}
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

      {/* month navigator */}
      <div className="flex items-center justify-between mb-4">
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
      </div>

      {/* stat grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <StatCard label="Operações" value={tradesInMonth.length} />
        <StatCard label="Win rate" value={`${winRate.toFixed(1)}%`} accent={winRate >= 50 ? C.gain : C.loss} />
        <StatCard label="Wins / Losses" value={`${wins} / ${losses}`} />
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
        </div>
      </div>

      {/* operations list */}
      <div style={{ color: C.muted }} className="text-xs uppercase tracking-wide mb-2 flex items-center justify-between">
        <span>Operações — {monthLabel(selectedMonthKey)}</span>
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

      {saveError && (
        <div style={{ color: C.loss }} className="text-xs mt-4 text-center">
          não foi possível salvar automaticamente — tente novamente
        </div>
      )}

      {/* add trade modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowForm(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={addTrade}
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div style={{ color: C.text }} className="font-medium">Nova operação</div>
              <button type="button" onClick={() => setShowForm(false)} style={{ color: C.faint }}><X size={18} /></button>
            </div>

            <label style={{ color: C.muted }} className="text-xs block mb-1">Data</label>
            <input
              type="date"
              value={form.date}
              max={todayStr()}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, color: C.text, colorScheme: "dark" }}
              className="w-full rounded-lg px-3 py-2 text-sm mb-3"
            />

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
