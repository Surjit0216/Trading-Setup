import React, { useEffect, useMemo, useState } from 'react'
import { FETCH_URL } from './config.js'
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts'

function parseGviz(text){ const s=text.indexOf('(')+1; const e=text.lastIndexOf(')'); const p=JSON.parse(text.slice(s,e));
  const header=p.table.cols.map(c=>String(c.label||c.id||'').trim()); const rows=p.table.rows.map(r=>r.c.map(x=>x?x.v:'')); return {header,rows}}
const num = (x)=>{ if(x==null) return 0; if(typeof x==='number') return isFinite(x)?x:0; const n=Number(String(x).replace(/[₹,%\s,]/g,'')); return isFinite(n)?n:0 }
const onlyDate=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return x.toISOString().slice(0,10) }
const ym=(d)=>{ const x=d instanceof Date?d:new Date(d); if(isNaN(x)) return ''; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}` }

export default function App(){
  const [data,setData]=useState([]); const [loading,setLoading]=useState(false); const [lastUpdate,setLastUpdate]=useState(null)
  const [q,setQ]=useState(''); const [indexF,setIndexF]=useState('All Indexes'); const [tfF,setTfF]=useState('All Timeframes')
  const [sigF,setSigF]=useState('All Signals'); const [statusF,setStatusF]=useState('All'); const [auto,setAuto]=useState(true)
  const [dark,setDark]=useState(false)

  const fetchData=async()=>{ try{ setLoading(true); const res=await fetch(FETCH_URL,{cache:'no-store'}); const text=await res.text()
      const {header,rows}=parseGviz(text); const col=(n)=>header.indexOf(n)
      const cDate=col('Date'), cSig=col('Signal'), cIdx=col('Index'), cTF=col('Timeframe'), cP=col('Profit (INR)'),
            cROI=col('ROI % on Capital'), cSt=col('Status'), cDur=col('Trade Duration')
      const cT=[col('T1Hit'),col('T2Hit'),col('T3Hit'),col('T4Hit'),col('T5Hit'),col('T6Hit')]
      const parsed=rows.filter(r=>r.some(x=>String(x).trim()!=='')).map(r=>({
        date:r[cDate]?new Date(r[cDate]):null, signal:String(r[cSig]||'').toUpperCase(), index:String(r[cIdx]||''),
        timeframe:String(r[cTF]||''), profit:num(r[cP]), roi:num(r[cROI]), status:String(r[cSt]||''), dur:r[cDur]?String(r[cDur]):'',
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
      if(indexF!=='All Indexes'&&d.index!==indexF) return false
      if(tfF!=='All Timeframes'&&d.timeframe!==tfF) return false
      if(sigF!=='All Signals'&&d.signal!==sigF) return false
      if(statusF!=='All'&&!d.status.toLowerCase().includes(statusF.toLowerCase())) return false
      if(!qq) return true; return d.index.toLowerCase().includes(qq)||d.signal.toLowerCase().includes(qq)||(d.dur||'').toLowerCase().includes(qq)
    })},[data,indexF,tfF,sigF,statusF,q])

  const total=filtered.length, wins=filtered.filter(d=>d.profit>0).length
  const winRate=total? (100*wins/total).toFixed(2) : '0.00'
  const grossProfit=filtered.filter(d=>d.profit>0).reduce((s,d)=>s+d.profit,0)
  const grossLossAbs=Math.abs(filtered.filter(d=>d.profit<0).reduce((s,d)=>s+d.profit,0))
  const profitFactor=grossLossAbs? (grossProfit/grossLossAbs).toFixed(2) : (wins>0?'∞':'0.00')
  const avgROI=total? (filtered.reduce((s,d)=>s+d.roi,0)/total).toFixed(2) : '0.00'
  const netPL=filtered.reduce((s,d)=>s+d.profit,0)
  const avgDur=(()=>{ const m=new Map(); filtered.forEach(d=>{ if(d.dur) m.set(d.dur,(m.get(d.dur)||0)+1) }); return m.size? [...m.entries()].sort((a,b)=>b[1]-a[1])[0][0]:'—' })()

  const tAccCounts=[0,0,0,0,0,0]; filtered.forEach(d=>d.tHits.forEach((h,i)=>tAccCounts[i]+=h?1:0))
  const tAcc=[0,1,2,3,4,5].map(i=>({target:`T${i+1}`,hitPct: total? +(100*tAccCounts[i]/total).toFixed(2):0}))

  const dailyMap=new Map(); filtered.forEach(d=>{ const k=onlyDate(d.date||''); if(!k) return; dailyMap.set(k,(dailyMap.get(k)||0)+d.profit) })
  const daily=[...dailyMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([date,pnl])=>({date,pnl}))
  let run=0; const equity=daily.map(x=>({date:x.date,equity:(run+=x.pnl)}))
  const monMap=new Map(); filtered.forEach(d=>{ const k=ym(d.date||''); if(!k) return; monMap.set(k,(monMap.get(k)||0)+d.profit) })
  const monthly=[...monMap.entries()].sort(([a],[b])=>a<b?-1:1).map(([month,pnl])=>({month,pnl}))

  return (
    <div className={`min-h-screen px-4 sm:px-6 lg:px-8 py-6 ${dark?'dark bg-[#0b0f1a] text-gray-100':'bg-white text-gray-900'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📈</span>
          <h1 className="text-2xl sm:text-3xl font-semibold">Trading Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-75">Last Update: {lastUpdate? lastUpdate.toLocaleString() : '—'}</span>
          <label className="flex items-center gap-1 ml-3"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} /> Auto-Refresh</label>
          <button onClick={fetchData} className="px-3 py-2 border rounded-md hover:bg-gray-50">Refresh</button>
          <button onClick={()=>setDark(d=>!d)} className="px-3 py-2 border rounded-md">{dark?'Light':'Dark'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Kpi title="Total Trades" value={total.toLocaleString()} subtitle="Total number of trades executed" />
        <Kpi title="Win Rate" value={`${winRate}%`} subtitle="Percentage of profitable trades" danger={winRate==='0.00'} />
        <Kpi title="Profit Factor" value={String(profitFactor)} subtitle="Gross profit / gross loss" />
        <Kpi title="Average ROI" value={`${avgROI}%`} subtitle="Average return on investment per trade" />
        <Kpi title="Net P&L" value={`₹${netPL.toLocaleString()}`} subtitle="Total profit or loss" highlight />
      </div>

      <div className="card p-4 mb-6 dark:card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input placeholder="Search trades..." value={q} onChange={e=>setQ(e.target.value)} className="border rounded-md px-3 py-2" />
          <Select value={indexF} setValue={setIndexF} options={indexes} />
          <Select value={tfF} setValue={setTfF} options={tfs} />
          <Select value={sigF} setValue={setSigF} options={['All Signals','BUY','SELL']} />
          <Select value={statusF} setValue={setStatusF} options={['All','Completed','In Progress']} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Daily P&L (₹)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Bar dataKey="pnl" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Equity Curve (₹)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equity}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Line type="monotone" dataKey="equity" dot={false} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly P&L (₹)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={(v)=>`₹${v}`} /><Tooltip formatter={(v)=>`₹${Number(v).toLocaleString()}`} /><Bar dataKey="pnl" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Target Hit Accuracy (%)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tAcc}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="target" /><YAxis tickFormatter={(v)=>`${v}%`} /><Tooltip formatter={(v)=>`${Number(v).toFixed(2)}%`} /><Bar dataKey="hitPct" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Signal Split">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart><Pie dataKey="value" data={[{name:'BUY',value:sigCounts.BUY||0},{name:'SELL',value:sigCounts.SELL||0}]} nameKey="name" outerRadius={100} label /><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Index Split">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={idxData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="card p-4 dark:card">
        <div className="text-xl font-semibold mb-2">Trade History</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b border-gray-200"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Signal</th><th className="py-2 pr-4">Index</th><th className="py-2 pr-4">TF</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Profit (₹)</th><th className="py-2 pr-4">ROI %</th><th className="py-2 pr-4">Duration</th></tr></thead>
            <tbody>
              {filtered.map((d,i)=>(
                <tr key={i} className="table-row border-b border-gray-100">
                  <td className="py-2 pr-4">{d.date? new Date(d.date).toLocaleString():''}</td>
                  <td className="py-2 pr-4"><span className={`badge ${d.signal==='BUY'?'buy':'sell'}`}>{d.signal}</span></td>
                  <td className="py-2 pr-4">{d.index}</td>
                  <td className="py-2 pr-4">{d.timeframe}</td>
                  <td className="py-2 pr-4">{d.status}</td>
                  <td className={`py-2 pr-4 ${d.profit>=0?'text-green-600':'text-red-500'}`}>₹{d.profit.toLocaleString()}</td>
                  <td className="py-2 pr-4">{d.roi?.toFixed? d.roi.toFixed(2): d.roi}</td>
                  <td className="py-2 pr-4">{d.dur||''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs opacity-60 mt-6 text-center">Google Sheets → React (client-only). Update sheet, hit Refresh.</div>
    </div>
  )
}

function Kpi({title, value, subtitle, highlight, danger}){
  return (
    <div className="card p-4 dark:card">
      <div className="text-sm opacity-70">{title}</div>
      <div className={`text-3xl font-semibold mt-1 ${highlight?'text-emerald-600':''} ${danger?'text-red-500':''}`}>{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-1">{subtitle}</div>}
    </div>
  )
}

function ChartCard({title, children}){
  return (
    <div className="card p-4 dark:card">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  )
}

function Select({ value, setValue, options }){
  return (
    <select value={value} onChange={e=>setValue(e.target.value)} className="border rounded-md px-3 py-2">
      {options.map(o=> <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
