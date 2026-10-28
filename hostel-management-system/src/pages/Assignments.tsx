import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

export default function Assignments() {
  const { notify } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", subject: "", className: "", deadline: "", status: "Draft", instructions: "" });
  const load = async () => { try { setRows(await api<any[]>("/assignments")); } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); } };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.title.trim() || !form.subject.trim() || !form.className.trim() || !form.deadline) { notify("Required fields missing", "error"); return; }
    try { await api("/assignments", { method: "POST", body: form }); notify("Created"); setForm({ title: "", subject: "", className: "", deadline: "", status: "Draft", instructions: "" }); load(); } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };
  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>Assignments</h2><p>Create and manage assignments.</p></div></div>
      <div className="hub-card" style={{ marginBottom: 16 }}>
        <div className="hub-form-grid">
          <div className="hub-field"><label>Title</label><input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
          <div className="hub-field"><label>Subject</label><input value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})}/></div>
          <div className="hub-field"><label>Class</label><input value={form.className} onChange={(e)=>setForm({...form,className:e.target.value})}/></div>
          <div className="hub-field"><label>Deadline</label><input type="datetime-local" value={form.deadline} onChange={(e)=>setForm({...form,deadline:e.target.value})}/></div>
          <div className="hub-field"><label>Status</label><select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option>Draft</option><option>Published</option><option>Archived</option></select></div>
          <div className="hub-field"><label>Instructions</label><input value={form.instructions} onChange={(e)=>setForm({...form,instructions:e.target.value})}/></div>
        </div>
        <button className="primary-btn" onClick={save}>Create</button>
      </div>
      <div className="hub-card">
        <table className="data-table"><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Deadline</th><th>Status</th></tr></thead>
        <tbody>{rows.map((r:any)=><tr key={r.id}><td>{r.title}</td><td>{r.subject}</td><td>{r.className}</td><td>{r.deadline}</td><td>{r.status}</td></tr>)}{!rows.length&&<tr><td colSpan={5}>No assignments.</td></tr>}</tbody></table>
      </div>
    </section>
  );
}