import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { api, apiRaw } from "../lib/api";
import { formatINRFull } from "../lib/format";
import { useToast } from "../components/Toast";

export default function MyFees() {
  const { notify } = useToast();
  const [overview, setOverview] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, fs, ps, st] = await Promise.all([
        apiRaw<any>("/fee-management/my/overview"),
        apiRaw<any>("/fee-management/my/fees"),
        apiRaw<any>("/fee-management/my/payments"),
        apiRaw<any>("/fee-management/settings"),
      ]);
      setOverview(ov.data);
      setFees(fs.data || []);
      setPayments(ps.data || []);
      setSettings(st.data);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const copy = (v: string) => { navigator.clipboard?.writeText(v); notify("Copied"); };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <section className="page">
      <h2>My Fees</h2>
      <div className="stats-grid">
        <div className="stat-card"><span>Total Assigned</span><strong>{formatINRFull(overview?.total || 0)}</strong></div>
        <div className="stat-card"><span>Total Paid</span><strong>{formatINRFull(overview?.paid || 0)}</strong></div>
        <div className="stat-card"><span>Pending</span><strong>{formatINRFull(overview?.pending || 0)}</strong></div>
        <div className="stat-card"><span>Overdue</span><strong>{formatINRFull(overview?.overdue || 0)}</strong></div>
      </div>

      <h3>Fee Records</h3>
      <table className="data-table">
        <thead><tr><th>Category</th><th>Amount</th><th>Paid</th><th>Due Date</th><th>Status</th></tr></thead>
        <tbody>
          {fees.map((f) => (
            <tr key={f.id}>
              <td>{f.category_name || "Fee"}</td>
              <td>{formatINRFull(f.amount)}</td>
              <td>{formatINRFull(f.paid_amount)}</td>
              <td>{f.due_date || "-"}</td>
              <td>{f.status}</td>
            </tr>
          ))}
          {!fees.length && <tr><td colSpan={5}>No fee records</td></tr>}
        </tbody>
      </table>

      <h3>Payment Details</h3>
      {settings && (
        <div className="card">
          <div>UPI ID: {settings.upiId} <button onClick={() => copy(settings.upiId || "")}><Copy size={14} /></button></div>
          <div>Bank: {settings.bankName}</div>
          <div>Account: {settings.accountNumber} <button onClick={() => copy(settings.accountNumber || "")}><Copy size={14} /></button></div>
          <div>IFSC: {settings.ifsc} <button onClick={() => copy(settings.ifsc || "")}><Copy size={14} /></button></div>
          {settings.qrImagePath && <img src={settings.qrImagePath} alt="QR" style={{ maxWidth: 200 }} />}
          <div>{settings.instructions}</div>
        </div>
      )}
    <h3>Submit Payment</h3>
      <PaymentForm fees={fees} onDone={load} />

      <h3>Payment History</h3>
      <table className="data-table">
        <thead><tr><th>Ref</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th><th>Receipt</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.transaction_ref}</td>
              <td>{formatINRFull(p.amount)}</td>
              <td>{p.method}</td>
              <td>{p.payment_date}</td>
              <td>{p.status}</td>
              <td>{p.receipt_number || "-"}</td>
            </tr>
          ))}
          {!payments.length && <tr><td colSpan={6}>No payments</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function PaymentForm({ fees, onDone }: any) {
  const { notify } = useToast();
  const [form, setForm] = useState({ studentFeeId: "", amount: "", method: "UPI", transactionRef: "", paymentDate: new Date().toISOString().slice(0,10), remarks: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api("/fee-management/my/payments", { method: "POST", body: { ...form, studentFeeId: form.studentFeeId ? Number(form.studentFeeId) : null, amount: Number(form.amount) } });
      notify("Payment submitted");
      setForm({ studentFeeId: "", amount: "", method: "UPI", transactionRef: "", paymentDate: new Date().toISOString().slice(0,10), remarks: "" });
      onDone();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed", "error");
    } finally { setSaving(false); }
  };
  return (
    <div className="card">
      <select value={form.studentFeeId} onChange={(e) => setForm({ ...form, studentFeeId: e.target.value })}>
        <option value="">Select fee (optional)</option>
        {fees.map((f: any) => <option key={f.id} value={f.id}>{f.category_name} - {f.amount}</option>)}
      </select>
      <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
        <option>UPI</option><option>Bank Transfer</option>
      </select>
      <input placeholder="Transaction Ref / UTR" value={form.transactionRef} onChange={(e) => setForm({ ...form, transactionRef: e.target.value })} />
      <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
      <textarea placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
      <button onClick={submit} disabled={saving}>{saving ? "Submitting..." : "Submit Payment"}</button>
    </div>
  );
}
