import React, { useEffect, useMemo, useState } from 'react'
import { FETCH_URL } from './config.js'
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts'

/* helpers */
function parseGviz(text){ const s=text.indexOf('(')+1, e=text.lastIndexOf(')'); const p=JSON.parse(text.slice(s,e));
  const header=p.table.cols.map(c=>String(c.label||c.id||'').trim()); const rows=p.table.rows.map(r=>r.c.map(x=>x?x.v:'')); return {header,rows}}
const num = (x)=>{ if(x==null) return 0; if(typeof x==='number') return isFinite(x)?x:0; const n=Number(String(x).replace(/[₹,%\\s,]/g,'')); return isFinite(n)?n:0 }
const onlyDate=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return x.toISOString().slice(0,10) }
const ym=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}` }

export default function App(){
  const [data,setData]=useState([]); const [loading,setLoading]=useState(false); const [lastUpdate,setLastUpdate]=useState(null)
  const [q,setQ]=useState(''); const [indexF,setIndexF]=useState('All Indexes'); const [tfF,setTfF]=useState('All Timeframes')
  const [sigF,setSigF]=useState('All Signals'); const [statusF,setStatusF]=useState('All'); const [auto,setAuto]=useState(true)
  const [dark,setDark]=useState(false)

  const fetchData=async()=>{ try{ setLoading(true)
      const res=await fetch(FETCH_URL,{cache:'no-store'}); const text=await res.text()
      const {header,rows}=parseGviz(text); const col=(n)=>header.indexOf(n)
      const cDate=col('Date'), cSig=col('Signal'), cIdx=col('Index'), cTF=col('Timeframe'),
            cP=col('Profit (INR)'), cROI=col('ROI % on Capital'), cSt=col('Status'), cDur=col('Trade Duration')
      const cT=[col('T1Hit'),col('T2Hit'),col('T3Hit'),col('T4Hit'),col('T5Hit'),col('T6Hit')]
      const parsed=rows.filter(r=>r.some(x=>String(x).trim()!=='')).map(r=>({
        date:r[cDate]?new Date(r[cDate]):null, signal:String(r[cSig]||'').toUpperCase(),
        index:String(r[cIdx]||''), timeframe:String(r[cTF]||''), profit:num(r[cP]), roi:num(r[cROI]),
        status:String(r[cSt]||''), dur:r[cDur]?String(r[cDur]):'',
        tHits:cT.map(i=>{ if(i===-1) return false; const v=r[i]; if(v===true) return true; if(typeof v==='number') return v===1;
          if(typeof v==='string'){ const s=v.toLowerCase(); return ['true','1','y','yes','hit'].includes(s) } return false })
      }))
      setData(parsed); setLastUpdate(new Date())
    } finally{ setLoading(false) } }
  useEffect(()=>{ fetchData() },[])
  useEffect(()=>{ if(!auto) return; const t=setInterval(fetchData,120000); return ()=>clearInterval(t)},[auto])
  useEffect(()=>{ const root=document.documentElement; dark?root.classList.add('dark'):root.classList.remove('dark') },[dark])

  const indexes=useMemo(()=>['All Indexes',...Array.from(new Set(data.map(d=>d.index).filter(Boolean))).sort()], [data])
  const tfs=useMemo(()=>['All Timeframes',...Array.from(new Set(data.map(d=>d.timeframe).filter(Boolean))).sort((a,b)=>Number(a)-Number(b))],[data])

  const filtered=useMemo(()=>{ const qq=q.trim().toLowerCase(); return data.filter(d=>{
    if(indexF!=='All Indexes' && d.index!==indexF) return false
    if(tfF!=='All Timeframes' && d.timeframe!==tfF) return false
    if(sigF!=='All Signals' && d.signal!==sigF) return false
    if(statusF!=='All' && !d.status.toLowerCase().includes(statusF.toLowerCase())) return false
    if(!qq) return true
    return d.index.toLowerCase().includes(qq) || d.signal.toLowerCase().includes(qq) || (d.dur||'').toLowerCase().includes(qq)
  })},[data,indexF,tfF,sigF,statusF,q])

  const total=filtered.length, wins=filtered.filter(d=>d.profit>0).length
  const winRate= total ? (100*wins/total).toFixed(2) : '0.00'
  const grossProfit=filtered.filter(d=>d.profit>0).reduce((s,d)=>s+d.profit,0)
  const grossLossAbs=Math.abs(filtered.filter(d=>d.profit<0).reduce((s,d)=>s+d.profit,0))
  const profitFactor=grossLossAbs? (grossProfit/grossLossAbs).toFixed(2) : (wins>0?'∞':'0.00')
  const avgROI= total ? (filtered.reduce((s,d)=>s+d.roi,0)/total).toFixed(2) : '0.00'
  const netPL= filtered.reduce((s,d)=>s+d.profit,0)

  const dailyMap=new Map(); filtered.forEach(d=>{ const k=onlyDate(d.date||''); if(!k) return; dailyMap.set(k,(dailyMap.get(k)||0)+d.profit) })
  const daily=[...dailyMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([date,pnl])=>({date,pnl}))
  let run=0; const equity=daily.map(x=>({date:x.date, equity:(run+=x.pnl)}))
  const monMap=new Map(); filtered.forEach(d=>{ const k=ym(d.date||''); if(!k) return; monMap.set(k,(monMap.get(k)||0)+d.profit) })
  const monthly=[...monMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([month,pnl])=>({month,pnl}))

  const tAccCounts=[0,0,0,0,0,0]; filtered.forEach(d=>d.tHits.forEach((h,i)=>tAccCounts[i]+=h?1:0))
  const tAcc=[0,1,2,3,4,5].map(i=>({target:`T${i+1}`,hitPct: total? +(100*tAccCounts[i]/total).toFixed(2):0}))

  return (
    <div className={`min-h-screen ${dark?'dark':''}`}>
      {/* gradient header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 opacity-10"></div>
        <header className="relative backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl grid place-items-center text-xl text-white bg-gradient-to-br from-blue-600 to-emerald-500 shadow-md">📊</div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Trading Dashboard</h1>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Last Update: {lastUpdate? lastUpdate.toLocaleString() : '—'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> Auto-Refresh</label>
              <button onClick={fetchData} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-white shadow-sm"> {loading?'Refreshing…':'Refresh'} </button>
              <button onClick={()=>setDark(d=>!d)} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-white shadow-sm">{dark?'Light':'Dark'}</button>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mt-6">
          <Kpi title="Total Trades"  value={total.toLocaleString()}    sub="Total number of trades executed" icon="Σ" />
          <Kpi title="Win Rate"      value={`${winRate}%`}             sub="Percentage of profitable trades" icon="✓" />
          <Kpi title="Profit Factor" value={String(profitFactor)}       sub="Gross profit / gross loss"      icon="%" />
          <Kpi title="Average ROI"   value={`${avgROI}%`}               sub="Average return per trade"       icon="↗︎" />
          <Kpi title="Net P&L"       value={`₹${netPL.toLocaleString()}`} sub="Total profit or loss"         icon="₹" positive={netPL>=0} />
        </div>

        {/* Filters */}
        <div className="mt-6 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm dark:bg-slate-900 dark:border-slate-700" placeholder="Search trades…" value={q} onChange={e=>setQ(e.target.value)} />
            <Selector value={indexF} setValue={setIndexF} options={indexes} />
            <Selector value={tfF} setValue={setTfF} options={tfs} />
            <Selector value={sigF} setValue={setSigF} options={['All Signals','BUY','SELL']} />
            <Selector value={statusF} setValue={setStatusF} options={['All','Completed','In Progress']} />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
          <Chart title="Daily P&L (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Bar dataKey="pnl" /></BarChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Equity Curve (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={equity}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Line type="monotone" dataKey="equity" dot={false} /></LineChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Monthly P&L (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Bar dataKey="pnl" /></BarChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Target Hit Accuracy (%)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tAcc}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="target" /><YAxis tickFormatter={(v)=>`${v}%`} /><Tooltip formatter={(v)=>`${Number(v).toFixed(2)}%`} /><Bar dataKey="hitPct" /></BarChart>
            </ResponsiveContainer>
          </Chart>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700 p-5">
          <div className="text-xl font-semibold mb-3">Trade History</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <Th>Date</Th><Th>Signal</Th><Th>Index</Th><Th>TF</Th><Th>Status</Th><Th>Profit (₹)</Th><Th>ROI %</Th><Th>Duration</Th>
              </tr></thead>
              <tbody>
                {filtered.map((d,i)=>(
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <Td>{d.date? new Date(d.date).toLocaleString():''}</Td>
                    <Td><span className={`px-2 py-1 rounded-full text-xs font-semibold ${d.signal==='BUY'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{d.signal}</span></Td>
                    <Td>{d.index}</Td><Td>{d.timeframe}</Td><Td>{d.status}</Td>
                    <Td className={d.profit>=0?'text-emerald-600':'text-red-500'}>₹{d.profit.toLocaleString()}</Td>
                    <Td>{d.roi?.toFixed? d.roi.toFixed(2): d.roi}</Td>
                    <Td>{d.dur||''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

function Kpi({ title, value, sub, icon, positive }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-400">{title}</div>
        <div className="h-8 w-8 grid place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white text-sm">{icon}</div>
      </div>
      <div className={`mt-1 text-4xl md:text-5xl font-extrabold tracking-tight ${positive===true?'text-emerald-600':''}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
    </div>
  )
}
function Chart({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700 p-4">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  )
}
function Th({children}){ return <th className="py-2 pr-4 font-medium opacity-80">{children}</th> }
function Td({children}){ return <td className="py-2 pr-4">{children}</td> }
function Selector({ value, setValue, options }) {
  return (
    <select value={value} onChange={(e)=>setValue(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm dark:bg-slate-900 dark:border-slate-700">
      {options.map(o=> <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
