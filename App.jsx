import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from "recharts";

const API = "https://energi-backend-production.up.railway.app/api";
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

  // 1. Find unikke år ved at kigge i "2026-03" strengen
  const years = [...new Set(data.map(d => {
    if (d.year) return d.year; // Hvis year findes separat
    return parseInt(String(d.month).split('-')[0]); // Ellers snup "2026" fra "2026-03"
  }))].sort();
  
  const byMonth = MONTH_NAMES.map((name, i) => {
    const monthNum = i + 1;
    const row = { month: name };
    
    years.forEach(year => {
      // 2. Vi skal matche både år og måned korrekt
      const found = data.find(d => {
        const dMonth = String(d.month).includes('-') 
          ? parseInt(d.month.split('-')[1]) 
          : d.month;
        const dYear = d.year || parseInt(d.month.split('-')[0]);
        
        return dYear === year && dMonth === monthNum;
      });
      row[year] = found ? found[valueKey] : null;
    });

    // 3. Beregn median for historiske år (alt før 2026)
    const historicVals = years
      .filter(y => y < currentYear)
      .map(year => row[year]) // Vi har allerede fundet værdien ovenfor
      .filter(v => v !== null && v !== undefined && v > 0);
      
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
// Måneds-start dage (ikke-skudår) for X-akse labels
const MONTH_DAY_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function dayOfYear(year, month, day = 15) {
  const start = new Date(year, 0, 0);
  const date = new Date(year, month - 1, day);
  return Math.floor((date - start) / 86400000);
}

function groupByDayOfYear(data, valueKey) {
  if (!data || data.length === 0) return { years: [], byDay: [] };

  const currentYear = new Date().getFullYear();
  const today = new Date();
  const todayDOY = dayOfYear(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Find unikke år
  const years = [...new Set(data.map(d => d.year || parseInt(String(d.month).split('-')[0])))].sort();

  // Byg lookup: { year: { month: value } }
  const lookup = {};
  years.forEach(y => { lookup[y] = {}; });
  data.forEach(d => {
    const yr = d.year || parseInt(String(d.month).split('-')[0]);
    const mo = d.month ? (String(d.month).includes('-') ? parseInt(d.month.split('-')[1]) : d.month) : null;
    if (yr && mo && d[valueKey] != null) lookup[yr][mo] = d[valueKey];
  });

  // Lav 365 datapunkter (én pr. dag, men vi har kun månedsdata → interpolér til dagsniveau)
  // Byg pr. måned → konvertér til dag-punkt (brug midten af måneden som dag)
  // Derefter rolling average på tværs af måneder er ikke meningsfuld med måneds-granularitet.
  // Vi bruger måneds-midtpunkter som diskrete punkter på dag-aksen.
  const byDay = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const doy = dayOfYear(2024, month, 15); // brug ikke-skudår som reference
    const row = { day: doy, monthLabel: MONTH_NAMES[i] };

    years.forEach(yr => {
      if (yr === currentYear) {
        const dayOfMonth = today.getDate();
        const currentMonth = today.getMonth() + 1;
        // Vis foregående måned hvis vi er 14+ dage inde i nuværende måned
        const cutoff = dayOfMonth >= 14 ? currentMonth : currentMonth - 1;
        if (month > cutoff) { row[yr] = null; return; }
      }
      row[yr] = lookup[yr][month] ?? null;
    });

    // Median (historiske år)
    const historicVals = years
      .filter(y => y < currentYear)
      .map(y => row[y])
      .filter(v => v != null && v > 0);
    row["Median"] = calcMedian(historicVals);

    return row;
  });

  return { years, byDay };
}

function DKProductionChart({ data, valueKey, title, yLabel }) {
  const { years, byDay } = groupByDayOfYear(data, valueKey);

  // Månedsnavne til X-aksen
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  
  // Vi definerer hvor på aksen (1-365) hver måned skal stå (ca. midt i måneden)
  const monthTicks = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];

  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byDay} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          
          <XAxis 
            dataKey="day"               // Bruger dag-nummeret fra din byDay data
            type="number" 
            domain={[0, 365]} 
            ticks={monthTicks}          // Tvinger labels til at stå ved hver måned
            interval={0}                // Viser alle labels
            tickFormatter={(day) => {
              const monthIdx = Math.floor(day / 30.5);
              return MONTH_NAMES[monthIdx] || "";
            }}
            tick={{ fontSize: 11, fill: '#2C3E50' }}
          />
          
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 }}
          />

          <Tooltip
            labelFormatter={(day) => {
              const monthIdx = Math.floor(day / 30.5);
              return `Måned: ${MONTH_NAMES[monthIdx] || "Dec"}`;
            }}
          />
          
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          
          {years.map((year, index) => (
            <Line
              key={year}
              type="monotone"
              dataKey={year.toString()} // Sørger for at matche key fra byDay
              name={year.toString()}
              stroke={index === years.length - 1 ? "#E74C3C" : `hsl(${index * 50}, 60%, 60%)`}
              strokeWidth={index === years.length - 1 ? 3 : 1.5}
              dot={false}
              connectNulls={true} // Tegner linjen selvom der mangler data for enkelte dage
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
function YearlyLineChart({ data, valueKey, title, yLabel, showMedian = true }) {
  const currentYear = new Date().getFullYear();
  const { years, byMonth } = groupByYear(data, valueKey);
  
  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="month" // Her kommer "Jan", "Feb" osv. fra groupByYear
            interval={0}    // Viser alle måneder
            tick={{ fontSize: 12, fill: '#2C3E50' }}
            height={50}
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fontSize: 13, fontWeight: 500 } }} 
          />
          <Tooltip />
          <Legend verticalAlign="top" height={36}/>
          {years.map((year, i) => (
            <Line 
              key={year} 
              type="monotone" 
              dataKey={year}
              stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={year === currentYear ? 3 : 1.25}
              dot={year === currentYear} 
              connectNulls={false} 
            />
          ))}
          {showMedian && (
            <Line type="monotone" dataKey="Median" stroke="#000000"
              strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={true} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlyLineChart({ data, title }) {
  const currentYear = new Date().getFullYear();
  const { years, byHour } = groupHourlyByYear(data);
  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byHour}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip /><Legend />
          {years.map((year, i) => (
            <Line key={year} type="monotone" dataKey={year}
              stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={year === currentYear ? 2.5 : 1.25}
              dot={false} connectNulls={true} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DKPrices({ area }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${API}/dk-prices/${area}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [area]);

  // Sorter data kronologisk (først år, så måned)
  const sortedData = [...data]
    .map(d => {
      const year = d.year || parseInt(String(d.month).split('-')[0]);
      const month = String(d.month).includes('-') ? parseInt(d.month.split('-')[1]) : d.month;
      return { ...d, _sortKey: year * 100 + month, displayDate: `${MONTH_NAMES[month-1]} ${year}` };
    })
    .sort((a, b) => a._sortKey - b._sortKey);

  const chartData = sortedData.map((d) => ({
    displayDate: d.displayDate,
    Spotpris: d.spot_price,
    Solar: d.solar_weighted,
    Offshore: d.offshore_weighted,
    Onshore: d.onshore_weighted,
    SolarCapture: d.solar_capture_rate,
    OffshoreCapture: d.offshore_capture_rate,
    OnshoreCapture: d.onshore_capture_rate
  }));

  return (
    <div>
      {/* SPOTPRIS & VÆGTEDE PRISER 2020-2026 */}
      <div className="chart-box">
        <h3>{area} – Prisudvikling 2020-2026 (DKK/MWh)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 10 }} 
              minTickGap={30} // Sikrer at årstal/måneder ikke overlapper
            />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "DKK/MWh", angle: -90, position: 'insideLeft', offset: -10 }} />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            
            <Line type="monotone" dataKey="Spotpris" stroke="#2C3E50" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Solar" stroke="#F4A927" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Offshore" stroke="#1A7BB9" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Onshore" stroke="#3DAA6E" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            
            {/* ZOOM SLIDER - Gør det muligt at se de enkelte år tættere på */}
            <Brush dataKey="displayDate" height={30} stroke="#2C3E50" fill="#f0f0f0" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CAPTURE RATE UDVIKLING */}
      <div className="chart-box">
        <h3>{area} – Capture rate udvikling (%)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "Capture Rate %", angle: -90, position: 'insideLeft', offset: -10 }} />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            
            <Line type="monotone" dataKey="SolarCapture" name="Solar" stroke="#F4A927" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="OffshoreCapture" name="Offshore" stroke="#1A7BB9" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="OnshoreCapture" name="Onshore" stroke="#3DAA6E" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            
            <Brush dataKey="displayDate" height={30} stroke="#2C3E50" fill="#f0f0f0" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DKProduction({ area }) {
  const [solar, setSolar] = useState([]);
  const [offshore, setOffshore] = useState([]);
  const [onshore, setOnshore] = useState([]);

  useEffect(() => {
    fetch(`${API}/dk-production/${area}/solar`).then(r => r.json()).then(setSolar);
    fetch(`${API}/dk-production/${area}/offshore`).then(r => r.json()).then(setOffshore);
    fetch(`${API}/dk-production/${area}/onshore`).then(r => r.json()).then(setOnshore);
  }, [area]);

  return (
    <div>
      <DKProductionChart data={solar}    valueKey="value_mwh" title={`${area} – Sol produktion (MWh)`}             yLabel="MWh" />
      <DKProductionChart data={offshore} valueKey="value_mwh" title={`${area} – Offshore vind produktion (MWh)`}  yLabel="MWh" />
      <DKProductionChart data={onshore}  valueKey="value_mwh" title={`${area} – Onshore vind produktion (MWh)`}   yLabel="MWh" />
    </div>
  );
}

function HydroSection({ country, zones }) {
  const [selected, setSelected] = useState(zones[0]);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${API}/hydro/${country}/${selected}`).then(r => r.json()).then(setData);
  }, [country, selected]);

  return (
    <div>
      <div className="tab-row">
        {zones.map(z => (
          <button key={z} className={selected === z ? "tab active" : "tab"} onClick={() => setSelected(z)}>{z}</button>
        ))}
      </div>
      <YearlyLineChart data={data} valueKey="value_mwh" title={`${country} – ${selected} Hydro (MWh)`} yLabel="MWh" />
    </div>
  );
}

function GasStorage() {
  const areas = ["EU", "Tyskland", "Holland"];
  const [data, setData] = useState({});

  useEffect(() => {
    areas.forEach(area => {
      fetch(`${API}/gas/${area}`).then(r => r.json()).then(d => {
        setData(prev => ({ ...prev, [area]: d }));
      });
    });
  }, []);

  return (
    <div>
      {areas.map(area => (
        <YearlyLineChart key={area} data={data[area] || []} valueKey="full_pct"
          title={`Gas storage – ${area} (% kapacitet)`} yLabel="%" />
      ))}
    </div>
  );
}

function InstalledCapacity() {
  const countries = ["Danmark","Norge","Sverige","Finland","Holland","Frankrig"];
  const [selected, setSelected] = useState("Danmark");
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${API}/capacity/${selected}`).then(r => r.json()).then(setData);
  }, [selected]);

  const years = [...new Set(data.map(d => d.year))].sort();
  const psrTypes = [...new Set(data.map(d => d.psr_name))];
  const chartData = psrTypes.map(psr => {
    const row = { psr };
    years.forEach(year => {
      const found = data.find(d => d.psr_name === psr && d.year === year);
      row[year] = found ? found.value_mw : 0;
    });
    return row;
  });

  return (
    <div>
      <div className="tab-row">
        {countries.map(c => (
          <button key={c} className={selected === c ? "tab active" : "tab"} onClick={() => setSelected(c)}>{c}</button>
        ))}
      </div>
      <div className="chart-box">
        <h3>{selected} – Installed Capacity (MW)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="psr" width={200} tick={{ fontSize: 11 }} />
            <Tooltip /><Legend />
            {years.map((year, i) => (
              <Bar key={year} dataKey={year} stackId="a" fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
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
      fetch(`${API}/consumption/${zone}`)
        .then(r => r.json())
        .then(d => setMonthly(prev => ({ ...prev, [zone]: d })));
      fetch(`${API}/consumption-hourly/${zone}`)
        .then(r => r.json())
        .then(d => setHourly(prev => ({ ...prev, [zone]: d })));
    });
  }, []);

  return (
    <div>
      {zones.map(zone => (
        <div key={zone}>
          <YearlyLineChart
            data={monthly[zone] || []}
            valueKey="value_mwh"
            title={`Forbrug – ${zone} månedligt gennemsnit (MWh)`}
            yLabel="MWh"
            showMedian={false}
          />
          <HourlyLineChart
            data={hourly[zone] || []}
            title={`Forbrug – ${zone} timesgennemsnit (MWh)`}
          />
        </div>
      ))}
    </div>
  );
}

const TABS = ["DK1 Priser","DK2 Priser","DK1 Produktion","DK2 Produktion","Norge Hydro","Sverige Hydro","Gas Storage","Installed Capacity","Forbrug"];

export default function App() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="app">
      <header><h1>⚡ Energianalyse</h1></header>
      <nav className="nav-tabs">
        {TABS.map(t => (
          <button key={t} className={tab === t ? "nav-tab active" : "nav-tab"} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <main>
        {tab === "DK1 Priser" && <DKPrices area="DK1" />}
        {tab === "DK2 Priser" && <DKPrices area="DK2" />}
        {tab === "DK1 Produktion" && <DKProduction area="DK1" />}
        {tab === "DK2 Produktion" && <DKProduction area="DK2" />}
        {tab === "Norge Hydro" && <HydroSection country="Norge" zones={["NO1","NO2","NO3","NO4","NO5"]} />}
        {tab === "Sverige Hydro" && <HydroSection country="Sverige" zones={["SE1","SE2","SE3","SE4"]} />}
        {tab === "Gas Storage" && <GasStorage />}
        {tab === "Installed Capacity" && <InstalledCapacity />}
        {tab === "Forbrug" && <Consumption />}
      </main>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; }
        .app { max-width: 1400px; margin: 0 auto; padding: 0 20px 40px; }
        header { padding: 24px 0 16px; border-bottom: 2px solid #e0e6ed; margin-bottom: 16px; }
        h1 { font-size: 1.6rem; color: #2C3E50; }
        .nav-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .nav-tab { padding: 8px 14px; border: 1px solid #d0d7de; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; color: #444; transition: all 0.15s; }
        .nav-tab:hover { background: #f0f4f8; }
        .nav-tab.active { background: #2C3E50; color: #fff; border-color: #2C3E50; }
        .chart-box { background: #fff; border-radius: 10px; padding: 20px 16px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .chart-box h3 { font-size: 1rem; color: #2C3E50; margin-bottom: 16px; }
        .tab-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .tab { padding: 6px 12px; border: 1px solid #d0d7de; background: #fff; border-radius: 5px; cursor: pointer; font-size: 13px; }
        .tab.active { background: #1A7BB9; color: #fff; border-color: #1A7BB9; }
      `}</style>
    </div>
  );
}
