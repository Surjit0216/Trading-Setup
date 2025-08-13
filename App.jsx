
import React, { useEffect, useMemo, useState } from 'react'
import { FETCH_URL } from './config.js'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Legend } from 'recharts'

function parseGviz(text){
  const s = text.indexOf('(')+1
  const e = text.lastIndexOf(')')
  const payload = JSON.parse(text.slice(s,e))
  const header = payload.table.cols.map(c => String(c.label || c.id || '').trim())
  const rows = payload.table.rows.map(r => r.c.map(x => x ? x.v : ''))
  return { header, rows }
}
const num = (x) => {
  if (x===null || x===undefined) return 0
  if (typeof x==='number') return isFinite(x)?x:0
  const n = Number(String(x).replace(/[₹,%\s,]/g,''))
  return isFinite(n)?n:0
}
const onlyDate = (d) => {
  const x = d instanceof Date ? d : new Date(d)
  if (isNaN(x)) return ''
  return x.toISOString().slice(0,10)
}
const ym = (d) => {
  const x = d instanceof Date ? d : new Date(d)
  if (isNaN(x)) return ''
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`
}

export default function App(){
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [q, setQ] = useState('')
  const [indexF, setIndexF] = useState('All Indexes')
  const [tfF, setTfF] = useState('All Timeframes')
  const [sigF, setSigF] = useState('All Signals')
  const [statusF, setStatusF] = useState('All')
  const [auto, setAuto] = useState(true)
  const [dark, setDark] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch(FETCH_URL, { cache: 'no-store' })
      const text = await res.text()
      const { header, rows } = parseGviz(text)
      const col = (n) => header.indexOf(n)
      const cDate = col('Date'), cSig=col('Signal'), cIdx=col('Index'), cTF=col('Timeframe')
      const cP = col('Profit (INR)'), cROI = col('ROI % on Capital'), cSt = col('Status')
      const cDur = col('Trade Duration')
      const cT=[col('T1Hit'),col('T2Hit'),col('T3Hit'),col('T4Hit'),col('T5Hit'),col('T6Hit')]
      const parsed = rows.filter(r => r.some(x => String(x).trim()!=='')).map(r => ({
        date: r[cDate]? new Date(r[cDate]) : null,
        signal: String(r[cSig]||'').toUpperCase(),
        index: String(r[cIdx]||''),
        timeframe: String(r[cTF]||''),
        profit: num(r[cP]),
        roi: num(r[cROI]),
        status: String(r[cSt]||''),
        dur: r[cDur]? String(r[cDur]):'',
        tHits: cT.map(i=>{
          if(i===-1) return false
          const v=r[i]
          if(v===true) return true
          if(typeof v==='number') return v===1
          if(typeof v==='string'){ const s=v.toLowerCase(); return ['true','1','y','yes','hit'].includes(s) }
          return false
        })
      }))
      setData(parsed); setLastUpdate(new Date())
    } catch(e){ setError(String(e)); console.error(e) } finally { setLoading(false) }
  }

  useEffect(()=>{ fetchData() },[])
  useEffect(()=>{ if(!auto) return; const t=setInterval(fetchData,120000); return ()=>clearInterval(t)},[auto])

  const indexes = useMemo(()=>['All Indexes',...Array.from(new Set(data.map(d=>d.index).filter(Boolean))).sort()], [data])
  const tfs = useMemo(()=>['All Timeframes',...Array.from(new Set(data.map(d=>d.timeframe).filter(Boolean))).sort((a,b)=>Number(a)-Number(b))],[data])
  const signals = ['All Signals','BUY','SELL']
  const statuses = ['All','Completed','In Progress']

  const filtered = useMemo(()=>{
    const qq = q.trim().toLowerCase()
    return data.filter(d=>{
      if(indexF!=='All Indexes' && d.index!==indexF) return false
      if(tfF!=='All Timeframes' && d.timeframe!==tfF) return false
      if(sigF!=='All Signals' && d.signal!==sigF) return false
      if(statusF!=='All' && !d.status.toLowerCase().includes(statusF.toLowerCase())) return false
      if(!qq) return true
      return d.index.toLowerCase().includes(qq) || d.signal.toLowerCase().includes(qq) || (d.dur||'').toLowerCase().includes(qq)
    })
  },[data,indexF,tfF,sigF,statusF,q])

  const total = filtered.length
  const wins = filtered.filter(d=>d.profit>0).length
  const winRate = total? (100*wins/total).toFixed(2) : '0.00'
  const grossProfit = filtered.filter(d=>d.profit>0).reduce((s,d)=>s+d.profit,0)
  const grossLossAbs = Math.abs(filtered.filter(d=>d.profit<0).reduce((s,d)=>s+d.profit,0))
  const profitFactor = grossLossAbs? (grossProfit/grossLossAbs).toFixed(2) : (wins>0? '∞':'0.00')
  const avgROI = total? (filtered.reduce((s,d)=>s+d.roi,0)/total).toFixed(2): '0.00'
  const netPL = filtered.reduce((s,d)=>s+d.profit,0)
  const avgDur = (()=>{
    const map = new Map()
    filtered.forEach(d=>{ if(d.dur){ map.set(d.dur,(map.get(d.dur)||0)+1) } })
    if(!map.size) return '—'
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1])[0][0]
  })()

  const tAccCounts = [0,0,0,0,0,0]; filtered.forEach(d=>d.tHits.forEach((h,i)=>tAccCounts[i]+=h?1:0))
  const tAcc = [0,1,2,3,4,5].map(i=>({target:`T${i+1}`, hitPct: total? +(100*tAccCounts[i]/total).toFixed(2):0}))

  const dailyMap = new Map(); filtered.forEach(d=>{ const k=onlyDate(d.date||''); if(!k) return; dailyMap.set(k,(dailyMap.get(k)||0)+d.profit) })
  const daily = Array.from(dailyMap.entries()).sort(([a],[b])=>a<b?-1:1).map(([date,pnl])=>({date,pnl}))
  let run=0; const equity = daily.map(x=>({date:x.date, equity:(run+=x.pnl)}))

  const monMap = new Map(); filtered.forEach(d=>{ const k=ym(d.date||''); if(!k) return; monMap.set(k,(monMap.get(k)||0)+d.profit) })
  const monthly = Array.from(monMap.entries()).sort(([a],[b])=>a<b?-1:1).map(([month,pnl])=>({month,pnl}))

  const sigCounts = {BUY:0,SELL:0}; filtered.forEach(d=>sigCounts[d.signal]=(sigCounts[d.signal]||0)+1)
  const sigData = [{name:'BUY', value:sigCounts.BUY||0},{name:'SELL', value:sigCounts.SELL||0}]

  const idxMap = new Map(); filtered.forEach(d=>idxMap.set(d.index||'—',(idxMap.get(d.index||'—')||0)+1))
  const idxData = Array.from(idxMap.entries()).map(([name,value])=>({name,value}))

  useEffect(()=>{ const root=document.documentElement; if(dark) root.classList.add('dark'); else root.classList.remove('dark') },[dark])

  return (
    <div className={`min-h-screen px-4 sm:px-6 lg:px-8 py-6 ${dark?'dark bg-[#0b0f1a] text-gray-100':'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="text-4xl float-animation">🚀</div>
          <h1 className="text-3xl sm:text-4xl font-bold dashboard-header">Trading Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg">
            <span className="opacity-75">Last Update: {lastUpdate? lastUpdate.toLocaleString() : '—'}</span>
          </div>
          <label className="flex items-center gap-2 ml-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg">
            <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} className="w-4 h-4" /> 
            <span>Auto-Refresh</span>
          </label>
          <button onClick={fetchData} className="btn-modern">🔄 Refresh</button>
          <button onClick={()=>setDark(d=>!d)} className="btn-modern">{dark?'☀️ Light':'🌙 Dark'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Kpi title="Total Trades" value={total.toLocaleString()} subtitle="Total number of trades executed" icon="📊" />
        <Kpi title="Win Rate" value={`${winRate}%`} subtitle="Percentage of profitable trades" danger={winRate==='0.00'} icon="🎯" />
        <Kpi title="Profit Factor" value={String(profitFactor)} subtitle="Gross profit / gross loss" icon="📈" />
        <Kpi title="Average ROI" value={`${avgROI}%`} subtitle="Average return on investment per trade" icon="💰" />
        <Kpi title="Net P&L" value={`₹${netPL.toLocaleString()}`} subtitle="Total profit or loss" highlight icon="🏆" />
      </div>

      <div className="card p-6 mb-8 dark:card glow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input 
            placeholder="🔍 Search trades..." 
            value={q} 
            onChange={e=>setQ(e.target.value)} 
            className="search-input rounded-xl px-4 py-3 w-full" 
          />
          <Select value={indexF} setValue={setIndexF} options={indexes} />
          <Select value={tfF} setValue={setTfF} options={tfs} />
          <Select value={sigF} setValue={setSigF} options={['All Signals','BUY','SELL']} />
          <Select value={statusF} setValue={setStatusF} options={['All','Completed','In Progress']} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <ChartCard title="📊 Daily P&L (₹)" icon="📈">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis tickFormatter={(v)=>`₹${v}`} stroke="#64748b" />
              <Tooltip 
                formatter={(v)=>`₹${Number(v).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="pnl" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="📈 Equity Curve (₹)" icon="📊">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={equity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis tickFormatter={(v)=>`₹${v}`} stroke="#64748b" />
              <Tooltip 
                formatter={(v)=>`₹${Number(v).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="equity" 
                dot={false} 
                stroke="url(#lineGradient)"
                strokeWidth={3}
              />
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="📅 Monthly P&L (₹)" icon="📊">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis tickFormatter={(v)=>`₹${v}`} stroke="#64748b" />
              <Tooltip 
                formatter={(v)=>`₹${Number(v).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="pnl" fill="url(#monthlyGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="🎯 Target Hit Accuracy (%)" icon="🎯">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tAcc}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="target" stroke="#64748b" />
              <YAxis tickFormatter={(v)=>`${v}%`} stroke="#64748b" />
              <Tooltip 
                formatter={(v)=>`${Number(v).toFixed(2)}%`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="hitPct" fill="url(#accuracyGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="📊 Signal Split" icon="📈">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie 
                dataKey="value" 
                data={[{name:'BUY',value:sigCounts.BUY||0},{name:'SELL',value:sigCounts.SELL||0}]} 
                nameKey="name" 
                outerRadius={100} 
                label 
                fill="url(#pieGradient)"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="📊 Index Split" icon="📈">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={idxData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}
              />
              <Bar dataKey="value" fill="url(#indexGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card p-6 dark:card glow">
        <div className="text-2xl font-bold mb-4 flex items-center gap-3">
          <span>📋</span>
          Trade History
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 pr-4 font-semibold">📅 Date</th>
                <th className="py-3 pr-4 font-semibold">📊 Signal</th>
                <th className="py-3 pr-4 font-semibold">📈 Index</th>
                <th className="py-3 pr-4 font-semibold">⏰ TF</th>
                <th className="py-3 pr-4 font-semibold">📋 Status</th>
                <th className="py-3 pr-4 font-semibold">💰 Profit (₹)</th>
                <th className="py-3 pr-4 font-semibold">📊 ROI %</th>
                <th className="py-3 pr-4 font-semibold">⏱️ Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d,i)=>(
                <tr key={i} className="table-row border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-4">{d.date? new Date(d.date).toLocaleString():''}</td>
                  <td className="py-3 pr-4"><span className={`badge ${d.signal==='BUY'?'buy':'sell'}`}>{d.signal}</span></td>
                  <td className="py-3 pr-4">{d.index}</td>
                  <td className="py-3 pr-4">{d.timeframe}</td>
                  <td className="py-3 pr-4">{d.status}</td>
                  <td className={`py-3 pr-4 font-semibold ${d.profit>=0?'text-green-600':'text-red-500'}`}>₹{d.profit.toLocaleString()}</td>
                  <td className="py-3 pr-4">{d.roi?.toFixed? d.roi.toFixed(2): d.roi}</td>
                  <td className="py-3 pr-4">{d.dur||''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center mt-8 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg">
        <div className="text-sm opacity-75">🚀 Google Sheets → React (client-only). Update sheet, hit Refresh.</div>
      </div>
    </div>
  )
}

function Kpi({title, value, subtitle, highlight, danger, icon}){
  let cardClass = "kpi-card"
  if (highlight) cardClass += " highlight"
  else if (danger) cardClass += " danger"
  else if (title === "Win Rate" && value !== "0.00%") cardClass += " success"
  else if (title === "Profit Factor") cardClass += " warning"
  
  return (
    <div className={`${cardClass} p-6 rounded-2xl shadow-xl relative overflow-hidden`}>
      <div className="absolute top-4 right-4 text-4xl opacity-20">{icon}</div>
      <div className="text-sm opacity-90 font-medium">{title}</div>
      <div className="text-4xl font-bold mt-2 mb-1">{value}</div>
      {subtitle && <div className="text-xs opacity-75">{subtitle}</div>}
    </div>
  )
}

function ChartCard({title, children, icon}){
  return (
    <div className="chart-card p-6 rounded-2xl shadow-xl dark:chart-card">
      <div className="text-lg font-bold mb-4 flex items-center gap-3">
        <span>{icon}</span>
        {title}
      </div>
      <div className="h-72">{children}</div>
    </div>
  )
}

function Select({ value, setValue, options }){
  return (
    <select 
      value={value} 
      onChange={e=>setValue(e.target.value)} 
      className="select-modern rounded-xl px-4 py-3 w-full cursor-pointer"
    >
      {options.map(o=> <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
