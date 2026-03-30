import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const API = "https://energi-backend-production.up.railway.app/api";
const YEAR_COLORS = ["#2C3E50","#E74C3C","#3498DB","#2ECC71","#9B59B6","#F39C12","#1ABC9C","#E67E22","#95A5A6","#D35400"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupByYear(data, valueKey) {
  const currentYear = new Date().getFullYear();
  const years = [...new Set(data.map(d => d.year))].sort();
  const byMonth = MONTH_NAMES.map((name, i) => {
    const row = { month: name };
    years.forEach(year => {
      const found = data.find(d => d.year === year && d.month === i + 1);
      row[year] = found ? found[valueKey] : null;
    });
    // Beregn median fra alle år undtagen indeværende
    const vals = years
      .filter(y => y !== currentYear)
      .map(y => {
        const f = data.find(d => d.year === y && d.month === i + 1);
        return f ? f[valueKey] : null;
      })
      .filter(v => v !== null && v > 0);
    row["Median"] = median(vals);
    return row;
  });
  return { years, byMonth };
}

function YearlyLineChart({ data, valueKey, title, yLabel }) {
  const currentYear = new Date().getFullYear();
  const { years, byMonth } = groupByYear(data, valueKey);
  return (
    <div className="chart-box">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byMonth}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {years.map((year, i) => (
            <Line key={year} type="monotone" dataKey={year} stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
              strokeWidth={year === currentYear ? 2.5 : 1.25} dot={false} connectNulls={false} />
          ))}
          <Line type="monotone" dataKey="Median" stroke="#000000" strokeWidth={2.25}
            strokeDasharray="6 3" dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DKPrices({ area }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch(`${API}/dk-prices/${area}`).then(r => r.json()).then(setData);
  }, [area]);

  const chartData = data.map(d => ({ month: d.month, Spotpris: d.spot_price, Solar: d.solar_weighted, Offshore: d.offshore_weighted, Onshore: d.onshore_weighted }));
  const captureData = data.map(d => ({ month: d.month, Solar: d.solar_capture_rate, Offshore: d.offshore_capture_rate, Onshore: d.onshore_capture_rate }));

  return (
    <div>
      <div className="chart-box">
        <h3>{area} – Spotpris og vægtet gennemsnit</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "DKK/MWh", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip /><Legend />
            <Line type="monotone" dataKey="Spotpris" stroke="#2C3E50" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Solar" stroke="#F4A927" strokeWidth={1.75} dot={false} />
            <Line type="monotone" dataKey="Offshore" stroke="#1A7BB9" strokeWidth={1.75} dot={false} />
            <Line type="monotone" dataKey="Onshore" stroke="#3DAA6E" strokeWidth={1.75} dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-box">
        <h3>{area} – Capture rate (%)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={captureData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: "%", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip /><Legend />
            <Line type="monotone" dataKey="Solar" stroke="#F4A927" strokeWidth={1.75} dot={false} />
            <Line type="monotone" dataKey="Offshore" stroke="#1A7BB9" strokeWidth={1.75} dot={false} />
            <Line type="monotone" dataKey="Onshore" stroke="#3DAA6E" strokeWidth={1.75} dot={false} strokeDasharray="5 5" />
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
      <YearlyLineChart data={solar} valueKey="value_mwh" title={`${area} – Sol produktion (MWh)`} yLabel="MWh" />
      <YearlyLineChart data={offshore} valueKey="value_mwh" title={`${area} – Offshore vind produktion (MWh)`} yLabel="MWh" />
      <YearlyLineChart data={onshore} valueKey="value_mwh" title={`${area} – Onshore vind produktion (MWh)`} yLabel="MWh" />
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
            <YAxis type="category" dataKey="psr" width={180} tick={{ fontSize: 11 }} />
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
  const [hourly,  setHourly]  = useState({});

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
      {/* din UI */}
    </div>
  );
}
  const HOUR_LABELS = Array.from({length: 24}, (_, h) => `${String(h).padStart(2,'0')}:00`);

  function groupHourlyByYear(data) {
    const currentYear = new Date().getFullYear();
    const years = [...new Set(data.map(d => d.year))].sort();
    const byHour = HOUR_LABELS.map((label, h) => {
      const row = { hour: label };
      years.forEach(year => {
        const found = data.find(d => d.year === year && d.hour === h);
        row[year] = found ? found.value_mwh : null;
      });
      const vals = years
        .filter(y => y !== currentYear)
        .map(y => {
          const f = data.find(d => d.year === y && d.hour === h);
          return f ? f.value_mwh : null;
        })
        .filter(v => v !== null);
      row["Median"] = median(vals);
      return row;
    });
    return { years, byHour };
  }

  return (
    <div>
      {zones.map(zone => (
        <div key={zone}>
          <YearlyLineChart
            data={monthly[zone] || []}
            valueKey="value_mwh"
            title={`Forbrug – ${zone} månedligt gennemsnit (MWh)`}
            yLabel="MWh"
          />
          <div className="chart-box">
            <h3>Forbrug – {zone} timesgennemsnit (MWh)</h3>
            {(() => {
              const { years, byHour } = groupHourlyByYear(hourly[zone] || []);
              return (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={byHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 12 }} />
                    <Tooltip /><Legend />
                    {years.map((year, i) => (
                      <Line key={year} type="monotone" dataKey={year}
                        stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                        strokeWidth={year === new Date().getFullYear() ? 2.5 : 1.25}
                        dot={false} connectNulls={false} />
                    ))}
                    <Line type="monotone" dataKey="Median" stroke="#000000"
                      strokeWidth={2.25} strokeDasharray="6 3" dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
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
```jsx
        {tab === "Installed Capacity" && <InstalledCapacity />}
        {tab === "Forbrug" && <Consumption />}
      </main>
      <style>{`
```
https://energi-backend-production.up.railway.app/api/refresh
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
