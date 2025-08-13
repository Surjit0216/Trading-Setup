import React, { useEffect, useMemo, useState } from 'react'
import { FETCH_URL } from './config.js'
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts'

/* ---------- helpers ---------- */
function parseGviz(text){ const s=text.indexOf('(')+1; const e=text.lastIndexOf(')'); const p=JSON.parse(text.slice(s,e));
  const header=p.table.cols.map(c=>String(c.label||c.id||'').trim()); const rows=p.table.rows.map(r=>r.c.map(x=>x?x.v:'')); return {header,rows}}
const num=(x)=>{ if(x==null) return 0; if(typeof x==='number') return isFinite(x)?x:0; const n=Number(String(x).replace(/[₹,%\s,]/g,'')); return isFinite(n)?n:0 }
const onlyDate=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return x.toISOString().slice(0,10) }
const ym=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}` }

/* ---------- app ---------- */
export default function App(){
  const [data,setData]=useState([]), [loading,setLoading]=useState(false), [lastUpdate,setLastUpdate]=useState(null)
  const [q,setQ]=useState(''), [indexF,setIndexF]=useState('All Indexes'), [tfF,setTfF]=useState('All Timeframes')
  const [sigF,setSigF]=useState('All Signals'), [statusF,setStatusF]=useState('All'), [auto,setAuto]=useState(true)
  const [dark,setDark]=useState(false)

  const fetchData=async()=>{ setLoading(true); try{
      const res=await fetch(FETCH_URL,{cache:'no-store'}); const text=await res.text()
      const {header,rows}=parseGviz(text); const col=(n)=>header.indexOf(n)
      const cDate=col('Date'), cSig=col('Signal'), cIdx=col('Index'), cTF=col('Timeframe'), cP=col('Profit (INR)'),
            cROI=col('ROI % on Capital'), cSt=col('Status'), cDur=col('Trade Duration')
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

  /* KPIs */
  const total=filtered.length, wins=filtered.filter(d=>d.profit>0).length
  const winRate= total ? (100*wins/total).toFixed(2) : '0.00'
  const grossProfit=filtered.filter(d=>d.profit>0).reduce((s,d)=>s+d.profit,0)
  const grossLossAbs=Math.abs(filtered.filter(d=>d.profit<0).reduce((s,d)=>s+d.profit,0))
  const profitFactor = grossLossAbs ? (grossProfit/grossLossAbs).toFixed(2) : (wins>0?'∞':'0.00')
  const avgROI = total ? (filtered.reduce((s,d)=>s+d.roi,0)/total).toFixed(2) : '0.00'
  const netPL = filtered.reduce((s,d)=>s+d.profit,0)

  /* Charts data */
  const dailyMap=new Map(); filtered.forEach(d=>{ const k=onlyDate(d.date||''); if(!k) return; dailyMap.set(k,(dailyMap.get(k)||0)+d.profit) })
  const daily=[...dailyMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([date,pnl])=>({date,pnl}))
  let run=0; const equity=daily.map(x=>({date:x.date, equity:(run+=x.pnl)}))
  const monMap=new Map(); filtered.forEach(d=>{ const k=ym(d.date||''); if(!k) return; monMap.set(k,(monMap.get(k)||0)+d.profit) })
  const monthly=[...monMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([month,pnl])=>({month,pnl}))

  const tAccCounts=[0,0,0,0,0,0]; filtered.forEach(d=>d.tHits.forEach((h,i)=>tAccCounts[i]+=h?1:0))
  const tAcc=[0,1,2,3,4,5].map(i=>({target:`T${i+1}`,hitPct: total ? +(100*tAccCounts[i]/total).toFixed(2) : 0}))

  return (
    <div className={`min-h-screen app-bg ${dark?'dark':''}`}>
      <div className="container-app py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 grid place-items-center text-white text-xl">📊</div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold">Trading Dashboard</h1>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Last Update: {lastUpdate? lastUpdate.toLocaleString() : '—'}
              </div>
            </div>
          </div>
          <div className="toolbar">
            <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> Auto-Refresh</label>
            <button className="btn" onClick={fetchData}>{loading?'Refreshing…':'Refresh'}</button>
            <button className="btn" onClick={()=>setDark(d=>!d)}>{dark?'Light':'Dark'}</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
          <Kpi icon="Σ"  title="Total Trades" value={total.toLocaleString()} sub="Total number of trades executed" />
          <Kpi icon="✓"  title="Win Rate"    value={`${winRate}%`} sub="Percentage of profitable trades" color={Number(winRate)===0?'text-loss':''} />
          <Kpi icon="%"  title="Profit Factor" value={String(profitFactor)} sub="Gross profit / gross loss" />
          <Kpi icon="↗︎" title="Average ROI" value={`${avgROI}%`} sub="Average return on investment per trade" />
          <Kpi icon="₹"  title="Net P&L" value={`₹${netPL.toLocaleString()}`} sub="Total profit or loss" color={netPL>=0?'text-profit':'text-loss'} />
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input className="input" placeholder="Search trades…" value={q} onChange={(e)=>setQ(e.target.value)} />
            <Select value={indexF} setValue={setIndexF} options={indexes} />
            <Select value={tfF}    setValue={setTfF}    options={tfs} />
            <Select value={sigF}   setValue={setSigF}   options={['All Signals','BUY','SELL']} />
            <Select value={statusF}setValue={setStatusF}options={['All','Completed','In Progress']} />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Daily P&L (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v)=>`₹${v}`} />
                <Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} />
                <Bar dataKey="pnl" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Equity Curve (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={equity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v)=>`₹${v}`} />
                <Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="equity" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Monthly P&L (₹)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v)=>`₹${v}`} />
                <Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} />
                <Bar dataKey="pnl" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Target Hit Accuracy (%)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tAcc}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="target" />
                <YAxis tickFormatter={(v)=>`${v}%`} />
                <Tooltip formatter={(v)=>`${Number(v).toFixed(2)}%`} />
                <Bar dataKey="hitPct" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Table */}
        <div className="card p-5 fade-in">
          <div className="text-xl font-semibold mb-3">Trade History</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                  <Th>Date</Th><Th>Signal</Th><Th>Index</Th><Th>TF</Th><Th>Status</Th><Th>Profit (₹)</Th><Th>ROI %</Th><Th>Duration</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d,i)=>(
                  <tr key={i} className="table-row border-b border-slate-100 dark:border-slate-800">
                    <Td>{d.date? new Date(d.date).toLocaleString():''}</Td>
                    <Td><span className={`badge ${d.signal==='BUY'?'buy':'sell'}`}>{d.signal}</span></Td>
                    <Td>{d.index}</Td><Td>{d.time
