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

  const assign = async () => {
    const chosen = students.filter((s) => selected.includes(s.id)).map((s) => ({ userId: s.id, name: s.name, email: s.email, room: s.room_number }));
    if (!chosen.length) { notify("Select students", "error"); return; }
    if (!amount || Number(amount) <= 0) { notify("Enter a valid amount", "error"); return; }
    try {
      await api("/fee-management/admin/assign", { method: "POST", body: { students: chosen, amount: Number(amount) } });
      notify("Fees assigned");
      load();
    } catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const verify = async (id: number) => {
    if (!window.confirm("Verify this payment?")) return;
    try { const r = await api<any>(`/fee-management/admin/payments/${id}/verify`, { method: "POST" }); notify("Verified" + (r?.data?.receiptNumber ? ` - ${r.data.receiptNumber}` : "")); load(); }
    catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };
  const reject = async (id: number) => {
    const reason = window.prompt("Rejection reason") || "Rejected";
    try { await api(`/fee-management/admin/payments/${id}/reject`, { method: "POST", body: { reason } }); notify("Rejected"); load(); }
    catch (e) { notify(e instanceof Error ? e.message : "Failed", "error"); }
  };

  return (
    <section className="page">
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

      <div className="card">
        <h3>Add Fee</h3>
        <input placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={searchStudents}>Search</button>
        <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div>
          {students.map((s) => (
            <label key={s.id} style={{ display: "block" }}>
              <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => {
                if (e.target.checked) setSelected([...selected, s.id]); else setSelected(selected.filter((x) => x !== s.id));
              }} />
              {s.name} ({s.email}) - Room {s.room_number}
            </label>
          ))}
        </div>
        <button onClick={assign}>Assign Selected</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Payment Verification Queue</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
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
                <td>{p.status}</td>
                <td>{p.receipt_number || "-"}</td>
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
            {!payments.length && <tr><td colSpan={7}>No payments</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
