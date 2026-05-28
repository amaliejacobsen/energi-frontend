import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from "recharts";
import { supabase } from "./src/supabaseClient";

const YEAR_COLORS = ["#2C3E50","#E74C3C","#3498DB","#2ECC71","#9B59B6","#F39C12","#1ABC9C","#E67E22","#95A5A6","#D35400"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const HOUR_LABELS = Array.from({length: 24}, (_, h) => `${String(h).padStart(2,'0')}:00`);


function calcMedian(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupByYear(data, valueKey) {
  if (!data || data.length === 0) return { years: [], byMonth: [] };
  const currentYear = new Date().getFullYear();
  const years = [...new Set(data.map(d => {
    if (d.year) return d.year;
    return parseInt(String(d.month).split('-')[0]);
  }))].sort();
  const byMonth = MONTH_NAMES.map((name, i) => {
    const monthNum = i + 1;
    const row = { month: name };
    years.forEach(year => {
      const found = data.find(d => {
        const dMonth = String(d.month).includes('-') ? parseInt(d.month.split('-')[1]) : d.month;
        const dYear = d.year || parseInt(d.month.split('-')[0]);
        return dYear === year && dMonth === monthNum;
      });
      row[year] = found ? found[valueKey] : null;
    });
    const historicVals = years.filter(y => y < currentYear).map(year => row[year]).filter(v => v !== null && v !== undefined && v > 0);
    row["Median"] = calcMedian(historicVals);
    return row;
  });
  return { years, byMonth };
}


function groupHourlyByYear(data) {
  if (!data) return { years: [], byHour: [] };
  const years = [...new Set(data.map(d => d.year))].sort();
  const byHour = HOUR_LABELS.map((label, h) => {
    const row = { hour: label };
    years.forEach(year => {
      const found = data.find(d => d.year === year && d.hour === h);
      row[year] = found ? found.value_mwh : null;
    });
    return row;
  });
  return { years, byHour };
}

function dayOfYear(year, month, day = 15) {
  const start = new Date(year, 0, 0);
  const date = new Date(year, month - 1, day);
  return Math.floor((date - start) / 86400000);
}



function groupByDayOfYear(data, valueKey) {
  if (!data || data.length === 0) return { years: [], byDay: [] };
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const years = [...new Set(data.map(d => d.year || parseInt(String(d.month).split('-')[0])))].sort();
  const lookup = {};
  years.forEach(y => { lookup[y] = {}; });
  data.forEach(d => {
    const yr = d.year || parseInt(String(d.month).split('-')[0]);
    const mo = d.month ? (String(d.month).includes('-') ? parseInt(d.month.split('-')[1]) : d.month) : null;
    if (yr && mo && d[valueKey] != null) lookup[yr][mo] = d[valueKey];
  });
  const byDay = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const doy = dayOfYear(2024, month, 15);
    const row = { day: doy, monthLabel: MONTH_NAMES[i] };
    let currentMonthDayOverride = null;
    years.forEach(yr => {
      if (yr === currentYear) {
        const currentMonth = today.getMonth() + 1;
        if (month >= currentMonth) { row[yr] = null; return; }
      }
      row[yr] = lookup[yr][month] ?? null;
    });
    if (currentMonthDayOverride !== null) row.day = currentMonthDayOverride;
    const historicVals = years.filter(y => y < currentYear).map(y => row[y]).filter(v => v != null && v > 0);
    row["Median"] = calcMedian(historicVals);
    return row;
  });
  return { years, byDay };
}



function YearToggleButtons({ years, visibleYears, setVisibleYears, showMedian, setShowMedian }) {
  return (
    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
      {years.map((year, i) => (
        <button key={year} onClick={() => setVisibleYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])}
          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer',
            backgroundColor: visibleYears.includes(year) ? YEAR_COLORS[i % YEAR_COLORS.length] : '#fff',
            color: visibleYears.includes(year) ? '#fff' : '#333' }}>
          {year}
        </button>
      ))}
      {setShowMedian && (
        <button onClick={() => setShowMedian(!showMedian)}
          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #333', cursor: 'pointer',
            backgroundColor: showMedian ? '#333' : '#fff', color: showMedian ? '#fff' : '#333', marginLeft: '10px' }}>
          Median
        </button>
      )}
    </div>
  );
}



function DKProductionChart({ data, valueKey, title, yLabel, source }) {
  const { years, byDay } = groupByDayOfYear(data, valueKey);
  const monthTicks = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
  const [visibleYears, setVisibleYears] = useState([]);
  useEffect(() => { if (years.length > 0) setVisibleYears(years); }, [years.join(',')]);
  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <YearToggleButtons years={years} visibleYears={visibleYears} setVisibleYears={setVisibleYears} />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byDay} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" type="number" domain={[0, 365]} ticks={monthTicks} interval={0}
            tickFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return MONTH_NAMES[monthIdx] || ""; }}
            tick={{ fontSize: 11, fill: '#2C3E50' }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip labelFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return `Måned: ${MONTH_NAMES[monthIdx] || "Dec"}`; }} formatter={(value) => value !== null ? [Number(value).toFixed(2)] : [null]} />
          <Legend />
          {years.map((year, i) => visibleYears.includes(year) && (
            <Line key={year} type="monotone" dataKey={year.toString()} name={year.toString()}
              stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={i === years.length - 1 ? 3 : 1.5} dot={false} connectNulls={true} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {source && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{source}</strong>
          </p>
        </div>
      )}
    </div>
  );
}


function groupByDayOfYearDaily(data, valueKey) {
  if (!data || data.length === 0) return { years: [], byDay: [] };
  const today = new Date();
  const currentYear = today.getFullYear();
  const years = [...new Set(data.map(d => parseInt(d.date.split('-')[0])))].sort();
  
  // Byg lookup: year -> dayOfYear -> value
  const lookup = {};
  years.forEach(y => { lookup[y] = {}; });
  data.forEach(d => {
    const [yr, mo, da] = d.date.split('-').map(Number);
    const dt = new Date(yr, mo - 1, da);
    const doy = dayOfYear(yr, dt.getMonth() + 1, dt.getDate());
    if (d[valueKey] != null) lookup[yr][doy] = d[valueKey];
  });

  // Beregn 7-dages glidende gennemsnit per år
  const allDoys = Array.from({ length: 365 }, (_, i) => i + 1);
  const byDay = allDoys.map(doy => {
    const row = { day: doy };
    years.forEach(yr => {
      if (yr === currentYear) {
        const todayDoy = dayOfYear(currentYear, today.getMonth() + 1, today.getDate());
        if (doy > todayDoy) { row[yr] = null; return; }
      }
      // 7-dages glidende gennemsnit
      const vals = [];
      for (let i = 0; i < 7; i++) {
        const v = lookup[yr][doy - i];
        if (v != null) vals.push(v);
      }
      row[yr] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return row;
  });

  return { years, byDay };
}

function DKProductionDailyChart({ data, valueKey, title, yLabel, source }) {
  const { years, byDay } = groupByDayOfYearDaily(data, valueKey);
  const monthTicks = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
  const [visibleYears, setVisibleYears] = useState([]);
  useEffect(() => { if (years.length > 0) setVisibleYears(years); }, [years.join(',')]);

  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{title} – 7-dages glidende gennemsnit</h3>
        <YearToggleButtons years={years} visibleYears={visibleYears} setVisibleYears={setVisibleYears} />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byDay} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" type="number" domain={[0, 365]} ticks={monthTicks} interval={0}
            tickFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return MONTH_NAMES[monthIdx] || ""; }}
            tick={{ fontSize: 11, fill: '#2C3E50' }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip
            labelFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return `Måned: ${MONTH_NAMES[monthIdx] || "Dec"}`; }}
            formatter={(value) => value !== null ? [Number(value).toFixed(0)] : [null]}
          />
          <Legend />
          <Brush dataKey="day" height={25} stroke="#2C3E50" fill="#f0f0f0" travellerWidth={6} />
          {years.map((year, i) => visibleYears.includes(year) && (
            <Line key={year} type="monotone" dataKey={year.toString()} name={year.toString()}
              stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={i === years.length - 1 ? 3 : 1.5} dot={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {source && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{source}</strong>
          </p>
        </div>
      )}
    </div>
  );
}


function YearlyLineChart({ data, valueKey, title, yLabel, source }) {
  const currentYear = new Date().getFullYear();
  const { years, byMonth } = groupByYear(data, valueKey);
  const [visibleYears, setVisibleYears] = useState([]);
  const [showMedian, setShowMedian] = useState(true);
  useEffect(() => { if (years.length > 0) setVisibleYears(years); }, [years.join(',')]);
  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>{title}</h3>
        <YearToggleButtons years={years} visibleYears={visibleYears} setVisibleYears={setVisibleYears} showMedian={showMedian} setShowMedian={setShowMedian} />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" interval={0} tick={{ fontSize: 12, fill: '#2C3E50' }} height={50} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -10 }} />
          <Tooltip formatter={(value) => value !== null ? [Number(value).toFixed(2)] : [null]} />
          {years.map((year, i) => visibleYears.includes(year) && (
            <Line key={year} type="monotone" dataKey={year} stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={year === currentYear ? 3 : 1.25} dot={year === currentYear} connectNulls={false} />
          ))}
          {showMedian && <Line type="monotone" dataKey="Median" stroke="#000000" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={true} />}
        </LineChart>
      </ResponsiveContainer>
      {source && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{source}</strong>
          </p>
        </div>
      )}
    </div>
  );
}


function HourlyLineChart({ data, title, source }) {
  const currentYear = new Date().getFullYear();
  const { years, byHour } = groupHourlyByYear(data);
  const [visibleYears, setVisibleYears] = useState([]);
  useEffect(() => { if (years.length > 0) setVisibleYears(years); }, [years.join(',')]);
  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <YearToggleButtons years={years} visibleYears={visibleYears} setVisibleYears={setVisibleYears} />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byHour}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip /><Legend />
          {years.map((year, i) => visibleYears.includes(year) && (
            <Line key={year} type="monotone" dataKey={year} stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={year === currentYear ? 2.5 : 1.25} dot={false} connectNulls={true} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {source && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{source}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function DKPrices({ area }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    supabase.from("dk_prices").select("*").eq("area", area).order("month").then(({ data }) => setData(data || []));
  }, [area]);

  const sortedData = [...data].map(d => {
    const year = d.year || parseInt(String(d.month).split('-')[0]);
    const month = String(d.month).includes('-') ? parseInt(d.month.split('-')[1]) : d.month;
    return { ...d, _sortKey: year * 100 + month, displayDate: `${MONTH_NAMES[month-1]} ${year}` };
  }).sort((a, b) => a._sortKey - b._sortKey);

  const chartData = sortedData.map((d) => ({
    displayDate: d.displayDate,
    Spotpris: d.spot_price, Solar: d.solar_weighted,
    Offshore: d.offshore_weighted, Onshore: d.onshore_weighted,
    SolarCapture: d.solar_capture_rate, OffshoreCapture: d.offshore_capture_rate, OnshoreCapture: d.onshore_capture_rate
  }));

  return (
    <div>
      <div className="chart-box">
        <h3>{area} – Prisudvikling 2020-2026 (DKK/MWh)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "DKK/MWh", angle: -90, position: 'insideLeft', offset: -10 }} />
            <Tooltip /><Legend verticalAlign="top" height={36} />
            <Line type="monotone" dataKey="Spotpris" stroke="#2C3E50" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Solar" stroke="#F4A927" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Offshore" stroke="#1A7BB9" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Onshore" stroke="#3DAA6E" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            <Brush dataKey="displayDate" height={30} stroke="#2C3E50" fill="#f0f0f0" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>Energidataservice – Elspotprices & ProductionConsumptionSettlement</strong>
          </p>
        </div>
      </div>
      <div className="chart-box">
        <h3>{area} – Capture rate udvikling (%)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "Capture Rate %", angle: -90, position: 'insideLeft', offset: -10 }} />
            <Tooltip /><Legend verticalAlign="top" height={36} />
            <Line type="monotone" dataKey="SolarCapture" name="Solar" stroke="#F4A927" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="OffshoreCapture" name="Offshore" stroke="#1A7BB9" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="OnshoreCapture" name="Onshore" stroke="#3DAA6E" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            <Brush dataKey="displayDate" height={30} stroke="#2C3E50" fill="#f0f0f0" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>Energidataservice – Elspotprices & ProductionConsumptionSettlement</strong>
          </p>
        </div>
      </div>
    </div>
  );
}


function DKProduction() {
  const [area, setArea] = useState("Samlet");
  const [viewType, setViewType] = useState("monthly"); // "monthly" eller "rolling7"
  
  // Månedlig data
  const [solar, setSolar] = useState([]);
  const [offshore, setOffshore] = useState([]);
  const [onshore, setOnshore] = useState([]);
  
  // Daglig data
  const [solarDaily, setSolarDaily] = useState([]);
  const [offshoreDaily, setOffshoreDaily] = useState([]);
  const [onshoreDaily, setOnshoreDaily] = useState([]);

  useEffect(() => {
    // Hent månedlig data
    const fetchAndSum = (source, setter) => {
      if (area === "Samlet") {
        Promise.all([
          supabase.from("dk_production").select("*").eq("area", "DK1").eq("source", source).order("year").order("month"),
          supabase.from("dk_production").select("*").eq("area", "DK2").eq("source", source).order("year").order("month"),
        ]).then(([dk1, dk2]) => {
          const combined = {};
          [...(dk1.data || []), ...(dk2.data || [])].forEach(r => {
            const key = `${r.year}-${r.month}`;
            if (!combined[key]) combined[key] = { ...r, area: "Samlet" };
            else combined[key].value_mwh += r.value_mwh;
          });
          setter(Object.values(combined).sort((a, b) => a.year - b.year || a.month - b.month));
        });
      } else {
        supabase.from("dk_production").select("*").eq("area", area).eq("source", source).order("year").order("month")
          .then(({ data }) => setter(data || []));
      }
    };

    // Hent daglig data
    const fetchDailyAndSum = (source, setter) => {
      if (area === "Samlet") {
        Promise.all([
          supabase.from("dk_production_daily").select("*").eq("area", "DK1").eq("source", source).order("date").limit(10000),
          supabase.from("dk_production_daily").select("*").eq("area", "DK2").eq("source", source).order("date").limit(10000),
        ]).then(([dk1, dk2]) => {
          const combined = {};
          [...(dk1.data || []), ...(dk2.data || [])].forEach(r => {
            const key = r.date;
            if (!combined[key]) combined[key] = { ...r, area: "Samlet" };
            else combined[key].value_mwh += r.value_mwh;
          });
          setter(Object.values(combined).sort((a, b) => a.date.localeCompare(b.date)));
        });
      } else {
        supabase.from("dk_production_daily").select("*").eq("area", area).eq("source", source).order("date").limit(10000)
          .then(({ data }) => setter(data || []));
      }
    };

    fetchAndSum("solar", setSolar);
    fetchAndSum("offshore", setOffshore);
    fetchAndSum("onshore", setOnshore);
    fetchDailyAndSum("offshore", setOffshoreDaily);
    fetchDailyAndSum("onshore", setOnshoreDaily);
    fetchDailyAndSum("solar", setSolarDaily);
  }, [area]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="tab-row" style={{ margin: 0 }}>
          {["Samlet", "DK1", "DK2"].map(a => (
            <button key={a} className={area === a ? "tab active" : "tab"} onClick={() => setArea(a)}>{a}</button>
          ))}
        </div>
        <div className="tab-row" style={{ margin: 0 }}>
          <button className={viewType === "monthly" ? "tab active" : "tab"} onClick={() => setViewType("monthly")}>Månedligt</button>
          <button className={viewType === "rolling7" ? "tab active" : "tab"} onClick={() => setViewType("rolling7")}>7-dages glidende</button>
        </div>
      </div>

      {viewType === "monthly" ? (
        <div>
          <DKProductionChart data={solar}    valueKey="value_mwh" title={`${area} – Sol produktion (MWh)`}            yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
          <DKProductionChart data={offshore} valueKey="value_mwh" title={`${area} – Offshore vind produktion (MWh)`} yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
          <DKProductionChart data={onshore}  valueKey="value_mwh" title={`${area} – Onshore vind produktion (MWh)`}  yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
        </div>
      ) : (
        <div>
          <DKProductionDailyChart data={solarDaily}    valueKey="value_mwh" title={`${area} – Sol produktion`}            yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
          <DKProductionDailyChart data={offshoreDaily} valueKey="value_mwh" title={`${area} – Offshore vind produktion`} yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
          <DKProductionDailyChart data={onshoreDaily}  valueKey="value_mwh" title={`${area} – Onshore vind produktion`}  yLabel="MWh" source="Energidataservice – ProductionConsumptionSettlement" />
        </div>
      )}
    </div>
  );
}



function NuclearProduction() {
  const countries = ["Finland", "Frankrig"];
  const [selected, setSelected] = useState("Finland");
  const [data, setData] = useState([]);

  useEffect(() => {
    supabase.from("nuclear_production")
      .select("*")
      .eq("country", selected)
      .order("year")
      .order("month")
      .then(({ data }) => setData(data || []));
  }, [selected]);

  return (
    <div>
      <div className="tab-row">
        {countries.map(c => (
          <button key={c} className={selected === c ? "tab active" : "tab"} onClick={() => setSelected(c)}>{c}</button>
        ))}
      </div>
      <YearlyLineChart data={data} valueKey="value_mwh" title={`Kernekraft produktion – ${selected} (MWh)`} yLabel="MWh" source="ENTSO-E Transparency Platform – A75 Actual Generation (B14 Nuclear)" />
    </div>
  );
}



function InstalledCapacity() {
  const countries = ["Danmark", "Norge", "Finland", "Holland", "Frankrig", "Tyskland"];
  const subZones = {
    "Danmark": ["DK1", "DK2"],
    "Norge": ["NO1", "NO2", "NO3", "NO4", "NO5"],
  };

  const [selected, setSelected] = useState("Danmark");
  const [subSelected, setSubSelected] = useState(null);
  const [data, setData] = useState([]);
  const [visibleYears, setVisibleYears] = useState([]);
  const [visibleTypes, setVisibleTypes] = useState([]);

  useEffect(() => {
    const country = subSelected || selected;
    supabase.from("installed_capacity").select("*").eq("country", country).order("year")
      .then(({ data }) => setData(data || []));
  }, [selected, subSelected]);

  const years = [...new Set(data.map(d => d.year))].sort();
  const psrTypes = [...new Set(data.map(d => d.psr_name))];
  const latestYear = years.length > 0 ? Math.max(...years) : null;

  useEffect(() => {
    if (years.length > 0) setVisibleYears(years);
    if (psrTypes.length > 0) setVisibleTypes(psrTypes);
  }, [years.join(','), psrTypes.join(',')]);

  const chartData = psrTypes.filter(psr => visibleTypes.includes(psr)).map(psr => {
    const row = { psr };
    years.forEach(year => {
      const found = data.find(d => d.psr_name === psr && d.year === year);
      row[year] = found ? found.value_mw : 0;
    });
    return row;
  }).sort((a, b) => (b[latestYear] || 0) - (a[latestYear] || 0));

  return (
    <div>
      <div className="tab-row">
        {countries.map(c => (
          <button key={c} className={selected === c && !subSelected ? "tab active" : "tab"}
            onClick={() => { setSelected(c); setSubSelected(null); }}>{c}</button>
        ))}
      </div>
      {subZones[selected] && (
        <div className="tab-row">
          <button className={!subSelected ? "tab active" : "tab"} onClick={() => setSubSelected(null)}>Total</button>
          {subZones[selected].map(z => (
            <button key={z} className={subSelected === z ? "tab active" : "tab"} onClick={() => setSubSelected(z)}>{z}</button>
          ))}
        </div>
      )}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {psrTypes.map(type => (
          <button key={type} onClick={() => setVisibleTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
            style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '20px', cursor: 'pointer',
              border: '1px solid ' + (visibleTypes.includes(type) ? '#444' : '#ccc'),
              backgroundColor: visibleTypes.includes(type) ? '#444' : 'var(--surface)',
              color: visibleTypes.includes(type) ? '#fff' : 'var(--text)' }}>
            {type}
          </button>
        ))}
      </div>
      <div className="chart-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>{subSelected || selected} – Installed Capacity (MW)</h3>
          <YearToggleButtons years={years} visibleYears={visibleYears} setVisibleYears={setVisibleYears} />
        </div>
        <ResponsiveContainer width="100%" height={Math.max(100, visibleTypes.length * years.length * 14)}>
          <BarChart data={chartData} layout="vertical" barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="psr" width={200} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => value !== null ? [Number(value).toFixed(2)] : [null]} /><Legend />
            {years.map((year, i) => visibleYears.includes(year) && (
              <Bar key={year} dataKey={year} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}



function Consumption() {
  const zones = ["DK1", "DK2", "Tyskland"];
  const [monthly, setMonthly] = useState({});
  const [hourly, setHourly] = useState({});
  useEffect(() => {
    zones.forEach(zone => {
      supabase.from("consumption").select("*").eq("zone", zone).order("year").order("month").then(({ data }) => setMonthly(prev => ({ ...prev, [zone]: data || [] })));
      supabase.from("consumption_hourly").select("*").eq("zone", zone).order("year").order("hour").then(({ data }) => setHourly(prev => ({ ...prev, [zone]: data || [] })));
    });
  }, []);
  return (
    <div>
      {zones.map(zone => (
        <div key={zone}>
          <YearlyLineChart data={monthly[zone] || []} valueKey="value_mwh" title={`Forbrug – ${zone} månedligt gennemsnit (MWh)`} yLabel="MWh" source="ENTSO-E Transparency Platform – A65 Total Load" />
          <HourlyLineChart data={hourly[zone] || []} title={`Forbrug – ${zone} timesgennemsnit (MWh)`} source="ENTSO-E Transparency Platform – A65 Total Load" />
        </div>
      ))}
    </div>
  );
}


function DKHourly() {
  const [area, setArea] = useState("DK1");
  const [days, setDays] = useState(7);
  const [prices, setPrices] = useState([]);
  const [production, setProduction] = useState([]);
  const [realtid, setRealtid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState({
    offshore: true, onshore: true, solar: true,
    consumption: true, price: true, residual: true,
  });

  const toggleSeries = (key) => setVisible(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromIso = from.toISOString();

    Promise.all([
      supabase.from("dk_prices_hourly").select("*")
        .eq("area", area).gte("datetime", fromIso)
        .order("datetime"),
      supabase.from("dk_production_hourly").select("*")
        .eq("area", area).gte("datetime", fromIso)
        .order("datetime"),
      supabase.from("dk_realtid").select("*")
        .gte("datetime", fromIso)
        .order("datetime"),
    ]).then(([priceRes, prodRes, realtidRes]) => {
      setPrices(priceRes.data || []);
      setProduction(prodRes.data || []);
      setRealtid(realtidRes.data || []);
      setLoading(false);

      console.log(prices[0]?.datetime, realtid[0]?.datetime)
      console.log("prices:", priceRes.data?.length, "production:", prodRes.data?.length, "realtid:", realtidRes.data?.length);
  });
  }, [area, days]);

  const chartData = (() => {
    const map = {};
    // Priser
    prices.forEach(r => {
      map[r.datetime] = { datetime: r.datetime, price: r.price_dkk };
    });
    // Produktion fra dk_production_hourly (historisk, opdelt på DK1/DK2)
    production.forEach(r => {
      if (!map[r.datetime]) map[r.datetime] = { datetime: r.datetime };
      map[r.datetime][r.source] = r.value_mwh;
    });
    // Realtid fra dk_realtid (hele Danmark, udfyld huller)
    realtid.forEach(r => {
      const key = r.datetime;
      if (!map[key]) map[key] = { datetime: key };
      if (!map[key].solar)       map[key].solar       = r.solar;
      if (!map[key].offshore)    map[key].offshore    = r.offshore;
      if (!map[key].onshore)     map[key].onshore     = r.onshore;
      if (!map[key].consumption) map[key].consumption = r.consumption;
    });

    const sorted = Object.values(map)
      .sort((a, b) => a.datetime.localeCompare(b.datetime));

    console.log("Første 3 rækker:", JSON.stringify(sorted.slice(0,3), null, 2));

    return sorted
    .map((r, i, arr) => {
      const prev = arr[i - 1];
      if (prev) {
        if (r.price == null)       r.price       = prev.price;
        if (r.consumption == null) r.consumption = prev.consumption;
      }
      return r;
    })
    .map(r => {
      const solar       = r.solar       || 0;
      const offshore    = r.offshore    || 0;
      const onshore     = r.onshore     || 0;
      const consumption = r.consumption || null;
      const residual    = consumption !== null
        ? consumption - (solar + offshore + onshore)
        : null;
      const dt = new Date(r.datetime);
      const hour = dt.getHours();
      const isNewDay = hour === 0;
      const dateLabel = days === 1
        ? `${String(hour).padStart(2,'0')}:00`
        : isNewDay
          ? `${dt.getDate()}/${dt.getMonth()+1}`
          : `${String(hour).padStart(2,'0')}:00`;
      return {
          ...r,
          label: dateLabel,
          fullLabel: `${dt.getDate()}/${dt.getMonth()+1} ${String(dt.getHours()).padStart(2,'0')}:00`,
          solar,
          offshore,
          onshore,
          consumption,
          residual,
          renewables: solar + offshore + onshore,
        };
      });
  })();

  

  const filteredData = days === 1
    ? chartData.filter(r => {
        const dt = new Date(r.datetime);
        const now = new Date();
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        return dt >= twentyFourHoursAgo && dt <= now;
      })
    : chartData;
  
  console.log("chartData length:", chartData.length, "days:", days);
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-row" style={{ margin: 0 }}>
          {["DK1", "DK2"].map(a => (
            <button key={a} className={area === a ? "tab active" : "tab"} onClick={() => setArea(a)}>{a}</button>
          ))}
        </div>
        <div className="tab-row" style={{ margin: 0 }}>
          {[1, 3, 7, 14].map(d => (
            <button key={d} className={days === d ? "tab active" : "tab"} onClick={() => setDays(d)}>{d}d</button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ padding: '20px' }}>Henter data...</p> : chartData.length === 0 ? (
        <div className="chart-box">
          <p style={{ color: '#888' }}>Ingen timedata tilgængelig for de seneste {days} dage.</p>
        </div>
      ) : (
        <>
          <div className="chart-box">
            <h3>{area} – Produktion, Forbrug & Spotpris (seneste {days} dage)</h3>
            <ResponsiveContainer width="100%" height={440}>
              <ComposedChart data={filteredData} margin={{ top: 5, right: 70, left: 20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="datetime"
                  ticks={filteredData
                    .filter(item => {
                      const dt = new Date(item.datetime);
                      if (dt.getMinutes() !== 0) return false;
                      const hour = dt.getHours();
                      if (days === 3)  return hour % 3  === 0;
                      if (days === 7)  return hour % 6  === 0;
                      if (days === 14) return hour % 12 === 0;
                      return true;
                    })
                    .map(item => item.datetime)
                  }
                  tickFormatter={(val) => {
                    const dt = new Date(val);
                    const hour = dt.getHours();
                    if (days === 1) return `${String(hour).padStart(2,'0')}:00`;
                    if (hour === 0) return `${dt.getDate()}/${dt.getMonth()+1}`;
                    return `${String(hour).padStart(2,'0')}:00`;
                  }}
                  interval={0}
                  tick={{ fontSize: 10, fill: '#2C3E50' }}
                  angle={days === 1 ? 0 : -35}
                  textAnchor={days === 1 ? 'middle' : 'end'}
                  height={55}
                />
                <Legend
                  verticalAlign="top"
                  align="center"
                  onClick={(e) => toggleSeries(e.dataKey)}
                  formatter={(value, entry) => (
                    <span style={{ color: visible[entry.dataKey] ? entry.color : '#ccc', cursor: 'pointer' }}>
                      {value}
                    </span>
                  )}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "MWh", angle: -90, position: 'insideLeft', offset: -5, fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "DKK/MWh", angle: 90, position: 'insideRight', offset: 15, fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0] ? `🕐 ${payload[0].payload.fullLabel}` : ''}
                  formatter={(value, name) => {
                    if (value === null || value === undefined) return [null];
                    if (name === "Spotpris") return [`${Math.round(value)} DKK/MWh`, name];
                    return [`${Math.round(value)} MWh`, name];
                  }}
                  itemSorter={(item) => {
                    const order = { "Elforbrug": 0, "Spotpris": 1, "Sol": 2, "Onshore vind": 3, "Offshore vind": 4 };
                    return order[item.name] ?? 99;
                  }}
                />
                <Area yAxisId="left" type="monotone" dataKey="offshore" name="Offshore vind"
                  stackId="prod" fill="#1A3A5C" stroke="#1A3A5C" fillOpacity={0.85} hide={!visible.offshore} />
                <Area yAxisId="left" type="monotone" dataKey="onshore" name="Onshore vind"
                  stackId="prod" fill="#3498DB" stroke="#3498DB" fillOpacity={0.85} hide={!visible.onshore} />
                <Area yAxisId="left" type="monotone" dataKey="solar" name="Sol"
                  stackId="prod" fill="#F4A927" stroke="#F4A927" fillOpacity={0.9} hide={!visible.solar} />
                <Line yAxisId="right" type="stepAfter" dataKey="price" name="Spotpris"
                  stroke="#2ECC71" strokeWidth={2} dot={false} connectNulls hide={!visible.price} />
                <Line yAxisId="left" type="monotone" dataKey="consumption" name="Elforbrug"
                  stroke="#E74C3C" strokeWidth={2.5} dot={false} connectNulls hide={!visible.consumption} />
                <Line yAxisId="left" type="stepAfter" dataKey="residual" name="Residual load"
                  stroke="#9B59B6" strokeWidth={2} dot={false} connectNulls strokeDasharray="5 5" hide={!visible.residual} />
                <Brush dataKey="label" height={25} stroke="#2C3E50" fill="#f0f0f0" travellerWidth={6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>       
        </>            
      )}              
    </div>       
  );          
}           

   


function GasStorage() {
  const areas = ["EU", "Tyskland", "Holland"];
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      areas.map(area =>
        supabase.from("gas_storage").select("*").eq("area", area).order("year").order("month")
          .then(({ data: d }) => ({ area, d: d || [] }))
      )
    ).then(results => {
      const newData = {};
      results.forEach(({ area, d }) => { newData[area] = d; });
      setData(newData);
      setLoading(false);
    });
  }, []);

  if (loading) return <p style={{ padding: '20px' }}>Henter gas storage data...</p>;

  return (
    <div>
      {areas.map(area => (
        <div key={area}>
          <YearlyLineChart data={data[area] || []} valueKey="full_pct" title={`Gas storage – ${area} (% kapacitet)`} yLabel="%" />
          <div style={{ marginTop: '-16px', marginBottom: '20px', padding: '10px 12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
              📡 Datakilde: <strong style={{ color: 'var(--text)' }}>AGSI – Gas Storage Europe (agsi.gie.eu)</strong>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DKConsumption({ area }) {
  const [monthly, setMonthly] = useState([]);
  const [hourly, setHourly] = useState([]);
  useEffect(() => {
    supabase.from("consumption").select("*").eq("zone", area).order("year").order("month").then(({ data }) => setMonthly(data || []));
    supabase.from("consumption_hourly").select("*").eq("zone", area).order("year").order("hour").then(({ data }) => setHourly(data || []));
  }, [area]);
  return (
    <div>
      <YearlyLineChart data={monthly} valueKey="value_mwh" title={`Forbrug – ${area} månedligt gennemsnit (MWh)`} yLabel="MWh" />
      <div style={{ marginTop: '-16px', marginBottom: '20px', padding: '10px 12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
          📡 Datakilde: <strong style={{ color: 'var(--text)' }}>ENTSO-E Transparency Platform – A65 Total Load</strong>
        </p>
      </div>
      <HourlyLineChart data={hourly} title={`Forbrug – ${area} timesgennemsnit (MWh)`} />
      <div style={{ marginTop: '-16px', marginBottom: '20px', padding: '10px 12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
          📡 Datakilde: <strong style={{ color: 'var(--text)' }}>ENTSO-E Transparency Platform – A65 Total Load</strong>
        </p>
      </div>
    </div>
  );
}



function DanmarkSamlet() {
  const [view, setView] = useState("DK1 priser");
  const views = ["DK1 priser", "DK2 priser", "DK produktion", "Timesdata", "Forbrug DK"];

  return (
    <div>
      <div className="tab-row">
        {views.map(v => (
          <button key={v} className={view === v ? "tab active" : "tab"} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>
      {view === "DK1 priser"            && <DKPrices area="DK1" />}
      {view === "DK1 produktion"        && <DKProduction area="DK1" />}
      {view === "DK2 priser"            && <DKPrices area="DK2" />}
      {view === "DK2 produktion"        && <DKProduction area="DK2" />}
      {view === "DK produktion"         && <DKProduction />}
      {view === "Timesdata"             && <DKHourly />}
      {view === "Forbrug DK" && (
        <div>
          <DKConsumption area="DK1" />
          <DKConsumption area="DK2" />
        </div>
      )}
    </div>
  );
}



function HydroSection({ country, zones }) {
  const [selected, setSelected] = useState("Total");
  const [data, setData] = useState([]);

  useEffect(() => {
    if (selected === "Total") {
      Promise.all(
        zones.map(z =>
          supabase.from("hydro_production").select("*")
            .eq("country", country).eq("zone", z)
            .order("year").order("month")
            .then(({ data }) => data || [])
        )
      ).then(allZoneData => {
        const combined = {};
        allZoneData.flat().forEach(d => {
          const key = `${d.year}-${d.month}`;
          if (!combined[key]) combined[key] = { ...d };
          else combined[key].value_mwh += d.value_mwh;
        });
        setData(Object.values(combined));
      });
    } else {
      supabase.from("hydro_production").select("*")
        .eq("country", country).eq("zone", selected)
        .order("year").order("month")
        .then(({ data }) => setData(data || []));
    }
  }, [country, selected]);

  return (
    <div>
      <div className="tab-row">
        <button className={selected === "Total" ? "tab active" : "tab"} onClick={() => setSelected("Total")}>Total</button>
        {zones.map(z => (
          <button key={z} className={selected === z ? "tab active" : "tab"} onClick={() => setSelected(z)}>{z}</button>
        ))}
      </div>
      <YearlyLineChart data={data} valueKey="value_mwh" title={`${country} – ${selected} Hydro (MWh)`} yLabel="MWh" />
    </div>
  );
}

function Hydro() {
  const [country, setCountry] = useState("Norge");
  const zones = {
    "Norge": ["NO1","NO2","NO3","NO4","NO5"],
    "Sverige": ["SE1","SE2","SE3","SE4"],
  };
  return (
    <div>
      <div className="tab-row">
        {["Norge","Sverige"].map(c => (
          <button key={c} className={country === c ? "tab active" : "tab"} onClick={() => setCountry(c)}>{c}</button>
        ))}
      </div>
      <HydroSection country={country} zones={zones[country]} />
    </div>
  );
}



function HydroForecastChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Henter data sorteret kronologisk efter dato
    supabase
      .from("hydro_weather_forecast")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data: fetchedData, error }) => {
        if (error) {
          console.error("Fejl ved hentning af hydro-forecast:", error);
        } else {
          // Recharts har nemmere ved at tegne to forskellige linjer, hvis vi 
          // splitter værdien op baseret på data_type
          const formattedData = (fetchedData || []).map(d => ({
            ...d,
            // Formatér datoen en smule mere læsbar (f.eks. "18/5" i stedet for "2026-05-18")
            displayDate: d.date ? d.date.split('-').slice(1).reverse().join('/') : '',
            // Hvis det er historisk eller i dag, lægger vi værdien i historisk-serien
            Historisk: (d.data_type === "historisk" || d.data_type === "i dag") ? d.precipitation_mm : null,
            // Hvis det er i dag eller forecast, lægger vi værdien i forecast-serien (så linjerne hænger sammen)
            Prognose: (d.data_type === "forecast" || d.data_type === "i dag") ? d.precipitation_mm : null,
          }));
          setData(formattedData);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ padding: '20px' }}>Henter vejrprognose...</p>;
  if (data.length === 0) return null;

  return (
    <div className="chart-box" style={{ marginTop: '30px' }}>
      <h3>🌧️ Akkumuleret Nedbørsprognose (Magasin-input)</h3>
      <p style={{ fontSize: '12px', color: '#666', marginTop: '-5px', marginBottom: '15px' }}>
        Viser de seneste 14 dages faktiske nedbør samt de næste 14 dages forecast for de centrale nordiske fjelde.
      </p>
      
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="displayDate" 
            tick={{ fontSize: 11, fill: '#2C3E50' }}
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            label={{ value: "Nedbør (mm)", angle: -90, position: "insideLeft", fontSize: 12 }} 
          />
          <Tooltip 
            formatter={(value) => value !== null ? [`${Number(value).toFixed(1)} mm`] : [null]}
          />
          <Legend />

          {/* ReferenceLine markerer præcis hvor "I dag" skærer grafen visuelt */}
          <ReferenceLine 
            x={data.find(d => d.data_type === "i dag")?.displayDate} 
            stroke="#E74C3C" 
            strokeDasharray="4 4"
            label={{ value: "I DAG", position: "top", fill: "#E74C3C", fontSize: 11, fontWeight: 'bold' }} 
          />

          {/* Historisk data tegnes som en fast, mørkeblå linje (eller som et Area/søjler) */}
          <Line 
            type="monotone" 
            dataKey="Historisk" 
            stroke="#2C3E50" 
            strokeWidth={3} 
            dot={{ r: 3 }} 
            connectNulls={false} 
          />

          {/* Forecast data tegnes som en stiplet lyseblå linje for at indikere usikkerhed */}
          <Line 
            type="monotone" 
            dataKey="Prognose" 
            stroke="#3498DB" 
            strokeWidth={3} 
            strokeDasharray="5 5" 
            dot={{ r: 3 }} 
            connectNulls={false} 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function HydroForecast() {
  const [country, setCountry] = useState("Norge");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("hydro_weather_forecast")
      .select("*")
      .eq("country", country)
      .order("date", { ascending: true })
      .then(({ data: fetchedData, error }) => {
        if (error) console.error("Fejl:", error);
        const formatted = (fetchedData || []).map(d => ({
          ...d,
          displayDate: d.date ? d.date.split('-').slice(1).reverse().join('/') : '',
          Historisk: (d.data_type === "historisk" || d.data_type === "i dag") ? d.precipitation_mm : null,
          Prognose: (d.data_type === "forecast" || d.data_type === "i dag") ? d.precipitation_mm : null,
        }));
        setData(formatted);
        setLoading(false);
      });
  }, [country]);

  if (loading) return <p style={{ padding: '20px' }}>Henter vejrprognose...</p>;
  if (data.length === 0) return <div className="chart-box"><p style={{ color: '#888' }}>Ingen forecast data tilgængelig.</p></div>;

  const todayDisplay = data.find(d => d.data_type === "i dag")?.displayDate;

  const metadataByCountry = {
    "Norge": {
      points: ["Vestlandet (60.5°N, 7.0°E)", "Østlandet (61.5°N, 9.5°E)", "Midt-Norge (63.0°N, 9.0°E)", "Nord-Norge (67.0°N, 16.0°E)"],
      weights: ["30%", "30%", "25%", "15%"],
      source: "Open-Meteo Archive API + Forecast API"
    },
    "Sverige": {
      points: ["Norrland nord (66.0°N, 17.0°E)", "Norrland syd (63.5°N, 14.0°E)", "Dalarna (61.0°N, 13.5°E)"],
      weights: ["35%", "35%", "30%"],
      source: "Open-Meteo Archive API + Forecast API"
    }
  };

  const meta = metadataByCountry[country];

  return (
    <div>
      <div className="tab-row">
        {["Norge", "Sverige"].map(c => (
          <button key={c} className={country === c ? "tab active" : "tab"} onClick={() => setCountry(c)}>{c}</button>
        ))}
      </div>
      <div className="chart-box">
        <h3>🌧️ Nedbørsprognose – {country}</h3>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
          De seneste 14 dages faktiske nedbør samt de næste 14 dages forecast.
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "Nedbør (mm)", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip formatter={(value) => value !== null ? [`${Number(value).toFixed(1)} mm`] : [null]} />
            <Legend />
            {todayDisplay && (
              <ReferenceLine x={todayDisplay} stroke="#E74C3C" strokeDasharray="4 4"
                label={{ value: "I DAG", position: "top", fill: "#E74C3C", fontSize: 11 }} />
            )}
            <Line type="monotone" dataKey="Historisk" stroke="#2C3E50" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="Prognose" stroke="#3498DB" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Metadata footer */}
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
            <strong style={{ color: 'var(--text)' }}>Målepunkter & vægte:</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {meta.points.map((point, i) => (
              <span key={i} style={{ fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text)' }}>
                {point} — {meta.weights[i]}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#888' }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{meta.source}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function TemperatureForecast() {
  const [country, setCountry] = useState("Danmark");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("temperature_forecast")
      .select("*")
      .eq("country", country)
      .order("date", { ascending: true })
      .then(({ data: fetchedData, error }) => {
        if (error) console.error("Fejl:", error);
        const formatted = (fetchedData || []).map(d => ({
          ...d,
          displayDate: d.date ? d.date.split('-').slice(1).reverse().join('/') : '',
          Historisk: (d.data_type === "historisk" || d.data_type === "i dag") ? d.temperature_c : null,
          Prognose:  (d.data_type === "forecast"  || d.data_type === "i dag") ? d.temperature_c : null,
        }));
        setData(formatted);
        setLoading(false);
      });
  }, [country]);

  if (loading) return <p style={{ padding: '20px' }}>Henter temperaturprognose...</p>;
  if (data.length === 0) return <div className="chart-box"><p style={{ color: '#888' }}>Ingen temperaturdata tilgængelig.</p></div>;

  const todayDisplay = data.find(d => d.data_type === "i dag")?.displayDate;

  const metadataByCountry = {
    "Danmark": {
      points: ["Danmark (56.0°N, 10.0°E)"],
      weights: ["100%"],
      source: "Open-Meteo Archive API + Forecast API"
    },
    "Norge": {
      points: ["Oslo (59.9°N, 10.7°E)"],
      weights: ["100%"],
      source: "Open-Meteo Archive API + Forecast API"
    },
    "Sverige": {
      points: ["Stockholm (59.3°N, 18.1°E)"],
      weights: ["100%"],
      source: "Open-Meteo Archive API + Forecast API"
    },
    "Tyskland": {
      points: ["Frankfurt (50.1°N, 8.7°E)"],
      weights: ["100%"],
      source: "Open-Meteo Archive API + Forecast API"
    }
  };

  const meta = metadataByCountry[country];

  return (
    <div>
      <div className="tab-row">
        {["Danmark", "Norge", "Sverige", "Tyskland"].map(c => (
          <button key={c} className={country === c ? "tab active" : "tab"} onClick={() => setCountry(c)}>{c}</button>
        ))}
      </div>
      <div className="chart-box">
        <h3>🌡️ Temperaturprognose – {country}</h3>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
          De seneste 14 dages faktiske temperatur samt de næste 14 dages forecast.
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "Temperatur (°C)", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip formatter={(value) => value !== null ? [`${Number(value).toFixed(1)} °C`] : [null]} />
            <Legend />
            {todayDisplay && (
              <ReferenceLine x={todayDisplay} stroke="#E74C3C" strokeDasharray="4 4"
                label={{ value: "I DAG", position: "top", fill: "#E74C3C", fontSize: 11 }} />
            )}
            <Line type="monotone" dataKey="Historisk" stroke="#2C3E50" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="Prognose"  stroke="#E67E22" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--fafafa)', borderRadius: '6px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
            <strong style={{ color: 'var(--text)' }}>Målepunkter & vægte:</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {meta.points.map((point, i) => (
              <span key={i} style={{ fontSize: '11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text)' }}>
                {point} — {meta.weights[i]}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: '#888' }}>
            📡 Datakilde: <strong style={{ color: 'var(--text)' }}>{meta.source}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function ForecastTab() {
  const [view, setView] = useState("Nedbør");
  return (
    <div>
      <div className="tab-row">
        {["🌧️ Nedbør", "🌡️ Temperatur"].map(v => (
          <button key={v} className={view === v ? "tab active" : "tab"} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>
      {view === "🌧️ Nedbør"     && <HydroForecast />}
      {view === "🌡️ Temperatur" && <TemperatureForecast />}
    </div>
  );
}
const TABS = ["Danmark","Hydro","Forecast","Gas storage","Installed capacity","Kernekraft","Forbrug"];

export default function App() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div className="app">
      <header><h1>⚡ Energianalyse</h1></header>
      <nav className="nav-tabs">
        {TABS.map(t => <button key={t} className={tab === t ? "nav-tab active" : "nav-tab"} onClick={() => setTab(t)}>{t}</button>)}
      </nav>
      <main>
        {tab === "Danmark" && <DanmarkSamlet />}
        {tab === "Hydro" && <Hydro />}
        {tab === "Gas storage" && <GasStorage />}
        {tab === "Installed capacity" && <InstalledCapacity />}
        {tab === "Kernekraft" && <NuclearProduction />}
        {tab === "Forecast" && <ForecastTab />}
        {tab === "Forbrug" && <Consumption />}
      </main>
      <style>{`
        :root {
          --bg: #f5f7fa;
          --surface: #ffffff;
          --border: #e0e6ed;
          --text: #2C3E50;
          --text-muted: #888;
          --tab-bg: #ffffff;
          --tab-border: #d0d7de;
          --tab-text: #444;
          --nav-active-bg: #2C3E50;
          --nav-active-text: #ffffff;
          --tab-active-bg: #1A7BB9;
          --tab-active-text: #ffffff;
          --chart-grid: #f0f0f0;
          --shadow: 0 1px 4px rgba(0,0,0,0.08);
          --fafafa: #fafafa;
        }
        [data-theme="dark"] {
          --bg: #0f1117;
          --surface: #1a1d27;
          --border: #2d3141;
          --text: #e8eaf0;
          --text-muted: #6b7280;
          --tab-bg: #1a1d27;
          --tab-border: #2d3141;
          --tab-text: #b0b8c8;
          --nav-active-bg: #3498DB;
          --nav-active-text: #ffffff;
          --tab-active-bg: #3498DB;
          --tab-active-text: #ffffff;
          --chart-grid: #2d3141;
          --shadow: 0 1px 4px rgba(0,0,0,0.4);
          --fafafa: #13161f;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); transition: background 0.2s, color 0.2s; }
        .app { max-width: 1400px; margin: 0 auto; padding: 0 20px 40px; }
        header { padding: 24px 0 16px; border-bottom: 2px solid var(--border); margin-bottom: 16px; }
        h1 { font-size: 1.6rem; color: var(--text); }
        .nav-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .nav-tab { padding: 8px 14px; border: 1px solid var(--tab-border); background: var(--tab-bg); border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--tab-text); transition: all 0.15s; }
        .nav-tab:hover { opacity: 0.8; }
        .nav-tab.active { background: var(--nav-active-bg); color: var(--nav-active-text); border-color: var(--nav-active-bg); }
        .chart-box { background: var(--surface); border-radius: 10px; padding: 20px 16px; margin-bottom: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }
        .chart-box h3 { font-size: 1rem; color: var(--text); margin-bottom: 16px; }
        .tab-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
       .tab { padding: 6px 12px; border: 1px solid var(--tab-border); background: var(--tab-bg); border-radius: 5px; cursor: pointer; font-size: 13px; color: var(--tab-text); }
        .tab.active { background: var(--tab-active-bg); color: var(--tab-active-text); border-color: var(--tab-active-bg); }
      `}</style>
    </div>
  );
}
