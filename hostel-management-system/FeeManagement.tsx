import { useEffect, useState } from "react";
import { api, apiRaw } from "../lib/api";
import { formatINRFull } from "../lib/format";
import { useToast } from "../components/Toast";

export default function FeeManagement() {
  const { notify } = useToast();
  const [overview, setOverview] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [lateFee, setLateFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("Hostel");
  const [session, setSession] = useState("");
  const [description, setDescription] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    try {
      const [ov, ps] = await Promise.all([
        apiRaw<any>("/fee-management/admin/overview"),
        apiRaw<any>("/fee-management/admin/payments" + (statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "")),
      ]);
      setOverview(ov.data);
      setPayments(ps.data || []);
    } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };
  useEffect(() => { load(); }, [statusFilter]);

  const searchStudents = async () => {
    const data = await apiRaw<any>(`/fee-management/admin/students/search?q=${encodeURIComponent(search)}`);
    setStudents(data.data || []);
  };

  const payable = (Number(amount) || 0) - (Number(discount) || 0) + (Number(lateFee) || 0);

  const assign = async () => {
    const chosen = students.filter((s) => selected.includes(s.id)).map((s) => ({ userId: s.id, name: s.name, email: s.email, room: s.room_number }));
    if (!chosen.length) { notify("Select at least one student", "error"); return; }
    if (payable <= 0) { notify("Enter a valid amount", "error"); return; }
    if (!window.confirm(`Assign fee of ${formatINRFull(payable)} to ${chosen.length} student(s)?`)) return;
    try {
      await api("/fee-management/admin/assign", { method: "POST", body: { students: chosen, amount: Number(amount), discount: Number(discount) || 0, lateFee: Number(lateFee) || 0, dueDate: dueDate || null, categoryName: category, billingPeriod: session || null } });
      notify("Fees assigned successfully");
      load();
    } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const verify = async (id: number) => {
    if (!window.confirm("Verify this payment?")) return;
    try { const r = await api<any>(`/fee-management/admin/payments/${id}/verify`, { method: "POST" }); notify("Verified" + (r?.data?.receiptNumber ? ` • ${r.data.receiptNumber}` : "")); load(); }
    catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };
  const reject = async (id: number) => {
    const reason = window.prompt("Rejection reason") || "Rejected";
    try { await api(`/fee-management/admin/payments/${id}/reject`, { method: "POST", body: { reason } }); notify("Rejected"); load(); }
    catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string,string> = { "Verified": "badge-success", "Pending Verification": "badge-warning", "Rejected": "badge-danger", "Partial": "badge-info" };
    return <span className={map[status] || "badge-neutral"}>{status}</span>;
  };

  return (
    <section className="page fee-management-premium">
      <h2>Premium Fee Management</h2>
      {overview && (
        <div className="stats-grid">
          <div className="stat-card"><span>Total Assigned</span><strong>{formatINRFull(overview.totalAssigned)}</strong></div>
          <div className="stat-card"><span>Verified Collection</span><strong>{formatINRFull(overview.verifiedCollection)}</strong></div>
          <div className="stat-card"><span>Pending</span><strong>{formatINRFull(overview.pending)}</strong></div>
          <div className="stat-card"><span>Overdue</span><strong>{formatINRFull(overview.overdue)}</strong></div>
          <div className="stat-card"><span>Pending Submissions</span><strong>{overview.pendingSubmissions}</strong></div>
          <div className="stat-card"><span>Rejected</span><strong>{overview.rejectedPayments}</strong></div>
        </div>
      )}

      <div className="card premium-card">
        <h3>Add Fee</h3>
        <div className="form-grid">
          <input placeholder="Search students by name/email/ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={searchStudents}>Search</button>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Hostel","Mess","Security Deposit","Electricity","Water","Maintenance","Other"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Academic session" value={session} onChange={(e) => setSession(e.target.value)} />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input type="number" placeholder="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <input type="number" placeholder="Late fee" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="payable-preview">Final payable: <strong>{formatINRFull(payable)}</strong></div>
        </div>
        <div className="student-checkbox-list">
          {students.map((s) => (
            <label key={s.id}>
              <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => {
                if (e.target.checked) setSelected([...selected, s.id]); else setSelected(selected.filter((x) => x !== s.id));
              }} />
              {s.name} ({s.email}) — Room {s.room_number}
            </label>
          ))}
        </div>
        <button className="primary-btn" onClick={assign}>Assign Selected Fees</button>
      </div>

      <div className="card premium-card">
        <div className="table-toolbar">
          <h3>Payment Verification Queue</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending Verification">Pending Verification</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <table className="data-table">
          <thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Ref</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.student_name}</td>
                <td>{formatINRFull(p.amount)}</td>
                <td>{p.method}</td>
                <td>{p.transaction_ref}</td>
                <td>{statusBadge(p.status)}</td>
                <td>{p.receipt_number || "—"}</td>
                <td>
                  {p.status === "Pending Verification" && (
                    <>
                      <button onClick={() => verify(p.id)}>Verify</button>
                      <button onClick={() => reject(p.id)}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={7}>No payments found</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
