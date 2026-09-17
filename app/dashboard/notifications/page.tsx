'use client';
import { useEffect, useState } from 'react';
type N={id:string;title:string;body:string;readAt:string|null;createdAt:string};
export default function NotificationsPage(){
  const [rows,setRows]=useState<N[]>([]),[live,setLive]=useState(false);
  async function load(){const r=await fetch('/api/notifications',{cache:'no-store'});if(r.ok)setRows(await r.json())}
  useEffect(()=>{load(); const es=new EventSource('/api/notifications/stream'); es.addEventListener('notification',e=>{const n=JSON.parse((e as MessageEvent).data) as N;setRows(prev=>prev.some(x=>x.id===n.id)?prev:[n,...prev]);setLive(true)});es.onerror=()=>setLive(false);return()=>es.close()},[]);
  async function read(id?:string){await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{id}:{all:true})});load()}
  return <section className="dashboard-page narrow"><div className="page-heading"><div><p className="eyebrow">Inbox · {live?'Live':'Connecting'}</p><h1 className="page-title">Notifications</h1><p className="section-intro">Assignments, status changes and workspace activity.</p></div><button className="btn btn-outline" onClick={()=>read()}>Mark all read</button></div><div className="card">{rows.length===0?<div className="empty-state"><h3>You're all caught up</h3><p>New operational notifications will appear here.</p></div>:rows.map(n=><button key={n.id} onClick={()=>read(n.id)} style={{display:'block',width:'100%',textAlign:'left',border:0,borderBottom:'1px solid var(--line)',background:n.readAt?'transparent':'#fffaf0',padding:'18px 4px',color:'var(--ink)',cursor:'pointer'}}><strong>{n.title}</strong><small style={{display:'block',color:'var(--muted)'}}>{n.body} · {new Date(n.createdAt).toLocaleString()}</small></button>)}</div></section>
}
