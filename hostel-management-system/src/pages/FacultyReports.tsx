import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

export default function FacultyReports() {
  const { notify } = useToast();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>("/reports-faculty/attendance").then(setAttendance).catch((e)=>notify(e.message,"error"));
    api<any[]>("/reports-faculty/assignments").then(setAssignments).catch((e)=>notify(e.message,"error"));
  }, []);
  return (
    <section className="content premium-page">
      <div className="page-heading"><div><h2>Faculty Reports</h2><p>Attendance and assignment summaries.</p></div></div>
      <div className="hub-card" style={{marginBottom:16}}>
        <h3>Attendance Records</h3>
        <table className="data-table"><thead><tr><th>Student</th><th>Subject</th><th>Class</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>{attendance.slice(0,50).map((r:any,i:number)=><tr key={i}><td>{r.studentName}</td><td>{r.subject}</td><td>{r.className}</td><td>{r.sessionDate}</td><td>{r.status}</td></tr>)}{!attendance.length&&<tr><td colSpan={5}>No data.</td></tr>}</tbody></table>
      </div>
      <div className="hub-card">
        <h3>Assignment Summary</h3>
        <table className="data-table"><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Deadline</th><th>Status</th><th>Submissions</th><th>Avg Marks</th></tr></thead>
        <tbody>{assignments.map((r:any)=><tr key={r.title}><td>{r.title}</td><td>{r.subject}</td><td>{r.className}</td><td>{r.deadline}</td><td>{r.status}</td><td>{r.submissions}</td><td>{r.avgMarks?Number(r.avgMarks).toFixed(1):"—"}</td></tr>)}{!assignments.length&&<tr><td colSpan={7}>No data.</td></tr>}</tbody></table>
      </div>
    </section>
  );
}