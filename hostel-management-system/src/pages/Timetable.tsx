import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

export default function Timetable() {
  const { notify } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ subject: "", className: "", dayOfWeek: "Monday", startTime: "", endTime: "", room: "" });
  const load = async () => { try { setRows(await api<any[]>("/timetable")); } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); } };
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api("/timetable", { method: "POST", body: form }); notify("Created"); load(); } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };
  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>Timetable</h2><p>Manage class schedule.</p></div></div>
      <div className="hub-card" style={{ marginBottom: 16 }}>
        <div className="hub-form-grid">
          <div className="hub-field"><label>Subject</label><input value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})}/></div>
          <div className="hub-field"><label>Class</label><input value={form.className} onChange={(e)=>setForm({...form,className:e.target.value})}/></div>
          <div className="hub-field"><label>Day</label><select value={form.dayOfWeek} onChange={(e)=>setForm({...form,dayOfWeek:e.target.value})}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d=><option key={d}>{d}</option>)}</select></div>
          <div className="hub-field"><label>Start</label><input type="time" value={form.startTime} onChange={(e)=>setForm({...form,startTime:e.target.value})}/></div>
          <div className="hub-field"><label>End</label><input type="time" value={form.endTime} onChange={(e)=>setForm({...form,endTime:e.target.value})}/></div>
          <div className="hub-field"><label>Room</label><input value={form.room} onChange={(e)=>setForm({...form,room:e.target.value})}/></div>
        </div>
        <button className="primary-btn" onClick={save}>Add Entry</button>
      </div>
      <div className="hub-card">
        <table className="data-table"><thead><tr><th>Day</th><th>Subject</th><th>Class</th><th>Time</th><th>Room</th></tr></thead>
        <tbody>{rows.map((r:any)=><tr key={r.id}><td>{r.dayOfWeek}</td><td>{r.subject}</td><td>{r.className}</td><td>{r.startTime}-{r.endTime}</td><td>{r.room||"—"}</td></tr>)}{!rows.length&&<tr><td colSpan={5}>No entries.</td></tr>}</tbody></table>
      </div>
    </section>
  );
}