import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from "recharts";
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
    years.forEach(yr => {
      if (yr === currentYear) {
        const dayOfMonth = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const cutoff = dayOfMonth >= 14 ? currentMonth : currentMonth - 1;
        if (month > cutoff) { row[yr] = null; return; }
      }
      row[yr] = lookup[yr][month] ?? null;
    });
    const historicVals = years.filter(y => y < currentYear).map(y => row[y]).filter(v => v != null && v > 0);
    row["Median"] = calcMedian(historicVals);
    return row;
  });
  return { years, byDay };
}

function DKProductionChart({ data, valueKey, title, yLabel }) {
  const { years, byDay } = groupByDayOfYear(data, valueKey);
  const monthTicks = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
  
  // Tilføj denne state og useEffect
  const [visibleYears, setVisibleYears] = useState([]);

  useEffect(() => {
    if (years.length > 0) {
      setVisibleYears(years);
    }
  }, [years.join(',')]);

  const toggleYear = (year) => {
    setVisibleYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '5px' }}>
          {years.map((year, i) => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`toggle-btn ${visibleYears.includes(year) ? 'active' : ''}`}
              style={{
                padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                backgroundColor: visibleYears.includes(year) ? YEAR_COLORS[i % YEAR_COLORS.length] : '#e0e0e0',
                color: visibleYears.includes(year) ? '#fff' : '#666'
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byDay} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" type="number" domain={[0, 365]} ticks={monthTicks} interval={0}
            tickFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return MONTH_NAMES[monthIdx] || ""; }}
            tick={{ fontSize: 11, fill: '#2C3E50' }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip labelFormatter={(day) => { const monthIdx = Math.floor(day / 30.5); return `Måned: ${MONTH_NAMES[monthIdx] || "Dec"}`; }} />
          <Legend />
          {years.map((year, i) => (
            visibleYears.includes(year) && (
              <Line key={year} type="monotone" dataKey={year.toString()} name={year.toString()}
                stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                strokeWidth={i === years.length - 1 ? 3 : 1.5} dot={false} connectNulls={true} />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearlyLineChart({ data, valueKey, title, yLabel }) {
  const currentYear = new Date().getFullYear();
  const { years, byMonth } = groupByYear(data, valueKey);
  
  // State starter tom
  const [visibleYears, setVisibleYears] = useState([]);
  const [showMedian, setShowMedian] = useState(true);

  // Sørger for at tænde alle år når data er indlæst
  useEffect(() => {
    if (years.length > 0) {
      setVisibleYears(years);
    }
  }, [years.join(',')]);

  const toggleYear = (year) => {
    setVisibleYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>{title}</h3>
        
        {/* Årsvælger menu */}
        <div className="chart-controls" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {years.map((year, i) => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`toggle-btn ${visibleYears.includes(year) ? 'active' : ''}`}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                cursor: 'pointer',
                backgroundColor: visibleYears.includes(year) ? YEAR_COLORS[i % YEAR_COLORS.length] : '#fff',
                color: visibleYears.includes(year) ? '#fff' : '#333'
              }}
            >
              {year}
            </button>
          ))}
          <button
            onClick={() => setShowMedian(!showMedian)}
            className={`toggle-btn ${showMedian ? 'active' : ''}`}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '4px',
              border: '1px solid #333',
              cursor: 'pointer',
              backgroundColor: showMedian ? '#333' : '#fff',
              color: showMedian ? '#fff' : '#333',
              marginLeft: '10px'
            }}
          >
            Median
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" interval={0} tick={{ fontSize: 12, fill: '#2C3E50' }} height={50} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: -10 }} />
          <Tooltip />
          <Legend verticalAlign="top" height={36}/>
          
          {years.map((year, i) => (
            visibleYears.includes(year) && (
              <Line 
                key={year} 
                type="monotone" 
                dataKey={year} 
                stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                strokeWidth={year === currentYear ? 3 : 1.25} 
                dot={year === currentYear} 
                connectNulls={false} 
              />
            )
          ))}
          
          {showMedian && (
            <Line type="monotone" dataKey="Median" stroke="#000000" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={true} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlyLineChart({ data, title }) {
  const currentYear = new Date().getFullYear();
  const { years, byHour } = groupHourlyByYear(data);
  
  // Tilføj denne state og useEffect
  const [visibleYears, setVisibleYears] = useState([]);

  useEffect(() => {
    if (years.length > 0) {
      setVisibleYears(years);
    }
  }, [years.join(',')]);

  const toggleYear = (year) => {
    setVisibleYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  return (
    <div className="chart-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '5px' }}>
          {years.map((year, i) => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`toggle-btn ${visibleYears.includes(year) ? 'active' : ''}`}
              style={{
                padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                backgroundColor: visibleYears.includes(year) ? YEAR_COLORS[i % YEAR_COLORS.length] : '#e0e0e0',
                color: visibleYears.includes(year) ? '#fff' : '#666'
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={byHour}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 12 }} />
          <Tooltip /><Legend />
          {years.map((year, i) => (
            visibleYears.includes(year) && (
              <Line key={year} type="monotone" dataKey={year} stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                strokeWidth={year === currentYear ? 2.5 : 1.25} dot={false} connectNulls={true} />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
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
      </div>
    </div>
  );
}

function DKProduction({ area }) {
  const [solar, setSolar] = useState([]);
  const [offshore, setOffshore] = useState([]);
  const [onshore, setOnshore] = useState([]);
  useEffect(() => {
    supabase.from("dk_production").select("*").eq("area", area).eq("source", "solar").order("year").order("month").then(({ data }) => setSolar(data || []));
    supabase.from("dk_production").select("*").eq("area", area).eq("source", "offshore").order("year").order("month").then(({ data }) => setOffshore(data || []));
    supabase.from("dk_production").select("*").eq("area", area).eq("source", "onshore").order("year").order("month").then(({ data }) => setOnshore(data || []));
  }, [area]);
  return (
    <div>
      <DKProductionChart data={solar}    valueKey="value_mwh" title={`${area} – Sol produktion (MWh)`}            yLabel="MWh" />
      <DKProductionChart data={offshore} valueKey="value_mwh" title={`${area} – Offshore vind produktion (MWh)`} yLabel="MWh" />
      <DKProductionChart data={onshore}  valueKey="value_mwh" title={`${area} – Onshore vind produktion (MWh)`}  yLabel="MWh" />
    </div>
  );
}

function HydroSection({ country, zones }) {
  const [selected, setSelected] = useState("Total");
  const [data, setData] = useState([]);

  useEffect(() => {
    if (selected === "Total") {
      // Hent alle zoner og læg dem sammen
      Promise.all(
        zones.map(z =>
          supabase.from("hydro_production").select("*")
            .eq("country", country).eq("zone", z)
            .order("year").order("month")
            .then(({ data }) => data || [])
        )
      ).then(allZoneData => {
        // Læg alle zoner sammen per år og måned
        const combined = {};
        allZoneData.flat().forEach(d => {
          const key = `${d.year}-${d.month}`;
          if (!combined[key]) {
            combined[key] = { ...d };
          } else {
            combined[key].value_mwh += d.value_mwh;
          }
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

function GasStorage() {
  const areas = ["EU", "Tyskland", "Holland"];
  const [data, setData] = useState({});
  useEffect(() => {
    areas.forEach(area => {
      supabase.from("gas_storage").select("*").eq("area", area).order("year").order("month").then(({ data: d }) => {
        setData(prev => ({ ...prev, [area]: d || [] }));
      });
    });
  }, []);
  return (
    <div>
      {areas.map(area => (
        <YearlyLineChart key={area} data={data[area] || []} valueKey="full_pct" title={`Gas storage – ${area} (% kapacitet)`} yLabel="%" />
      ))}
    </div>
  );
}

function InstalledCapacity() {
  const countries = ["Danmark", "Norge", "Finland", "Holland", "Frankrig", "Tyskland"];
  const dkZones = ["DK1", "DK2"];
  const noZones = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const [selected, setSelected] = useState("Danmark");
  const [subZone, setSubZone] = useState(null);
  const [data, setData] = useState([]);
  const [visibleYears, setVisibleYears] = useState([]);
  const [visibleTypes, setVisibleTypes] = useState([]);

  // Henter data fra Supabase
  useEffect(() => {
    const country = subZone || selected;
    supabase.from("installed_capacity")
      .select("*")
      .eq("country", country)
      .order("year")
      .then(({ data }) => setData(data || []));
  }, [selected, subZone]);

  // Finder unikke år og teknologier (PSR)
  const years = [...new Set(data.map(d => d.year))].sort();
  const psrTypes = [...new Set(data.map(d => d.psr_name))];

  // NYT: State til at styre hvilke år der er synlige (knapperne)
  const [visibleYears, setVisibleYears] = useState([]);

  // NYT: Sørger for at alle år er tændt som standard når data lander
 
  useEffect(() => {
    if (years.length > 0) {
      setVisibleYears(years);
    }
    // NYT: Tænd alle teknologityper som standard
    if (psrTypes.length > 0) {
      setVisibleTypes(psrTypes);
    }
  }, [years.join(','), psrTypes.join(',')]);

  // Den ENESTE korrekte definition af chartData:
 
  const chartData = psrTypes
    .filter(psr => visibleTypes.includes(psr))
    .map(psr => {
      const row = { psr };
      years.forEach(year => {
        const found = data.find(d => d.psr_name === psr && d.year === year);
        row[year] = found ? found.value_mw : 0;
      });
      return row;
    });

  // NU starter din return (kun én gang!)
  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
      {/* 1. LAND-VÆLGER */}
      <div className="tab-row" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {countries.map(c => (
          <button 
            key={c}
            className={selected === c && !subZone ? "tab active" : "tab"}
            onClick={() => { setSelected(c); setSubZone(null); }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: (selected === c && !subZone) ? '#444' : '#f5f5f5',
              color: (selected === c && !subZone) ? '#fff' : '#666',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 2. TEKNOLOGI-VÆLGER (DE NYE KNAPPER) */}
      <div style={{ marginBottom: '25px', padding: '15px', background: '#fafafa', borderRadius: '6px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '10px', textTransform: 'uppercase' }}>
          Vælg kapaciteter der skal vises:
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {psrTypes.map(type => (
            <button
              key={type}
              onClick={() => {
                setVisibleTypes(prev => 
                  prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                );
              }}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                cursor: 'pointer',
                border: '1px solid ' + (visibleTypes.includes(type) ? '#444' : '#ccc'),
                backgroundColor: visibleTypes.includes(type) ? '#444' : '#fff',
                color: visibleTypes.includes(type) ? '#fff' : '#666',
                transition: 'all 0.1s ease'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 3. GRAFEN */}
      <div style={{ marginTop: '10px' }}>
        <ResponsiveContainer width="100%" height={Math.max(450, visibleTypes.length * (visibleYears.length * 22))}>
          <BarChart data={chartData} layout="vertical" barGap={2} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} unit=" MW" />
            <YAxis type="category" dataKey="psr" width={150} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: '#f9f9f9' }} />
            <Legend verticalAlign="top" height={36}/>
            {years.map((year, i) => (
              visibleYears.includes(year) && (
                <Bar 
                  key={year} 
                  dataKey={year} 
                  fill={YEAR_COLORS[i % YEAR_COLORS.length]} 
                  radius={[0, 4, 4, 0]}
                />
              )
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
          <YearlyLineChart data={monthly[zone] || []} valueKey="value_mwh" title={`Forbrug – ${zone} månedligt gennemsnit (MWh)`} yLabel="MWh" showMedian={false} />
          <HourlyLineChart data={hourly[zone] || []} title={`Forbrug – ${zone} timesgennemsnit (MWh)`} />
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
        {TABS.map(t => <button key={t} className={tab === t ? "nav-tab active" : "nav-tab"} onClick={() => setTab(t)}>{t}</button>)}
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
        .toggle-btn {
        transition: all 0.2s ease;
        font-weight: 500;
        }
        .toggle-btn:hover {
        opacity: 0.8;
        transform: translateY(-1px);
        }
        .toggle-btn.active {
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }     
      `}</style>
    </div>
  );
}
