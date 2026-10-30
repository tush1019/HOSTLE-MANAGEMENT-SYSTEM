import { useState, type FormEvent } from "react";
import {
  Building2, UserRound, Mail, Lock, UserPlus,
  CheckCircle2, ArrowLeft, Eye, EyeOff,
  KeyRound
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";
import heroImage from "../assets/hero.png";

type SignupProps = { onSignup: () => void; onLogin: () => void; onBackHome: () => void };
type Step = "details" | "otp" | "success";
type Role = "Admin" | "Student" | "Faculty";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let data: any = null;
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Server returned an invalid response (${response.status}). ${rawText.slice(0, 160)}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }
  if (data && data.success === false) {
    throw new Error(data.message || "Request failed.");
  }
  return data as T;
}

function strengthOf(value: string) {
  if (!value) return { label: "", width: "0%", color: "#e2e8f0" };
  let s = 0;
  if (value.length >= 6) s += 1;
  if (value.length >= 10) s += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) s += 1;
  if (/\d/.test(value)) s += 1;
  if (/[^A-Za-z0-9]/.test(value)) s += 1;
  if (s <= 2) return { label: "Weak", width: "33%", color: "#ef4444" };
  if (s <= 3) return { label: "Fair", width: "66%", color: "#f59e0b" };
  return { label: "Strong", width: "100%", color: "#10b981" };
}

function Signup({ onSignup, onLogin, onBackHome }: SignupProps) {
  const [step, setStep] = useState<Step>("details");
  const [role, setRole] = useState<Role>("Student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const strength = strengthOf(password);

  /* Guard: validate OTP is exactly 6 digits before comparing with backend */
  function validateOtpInput(value: string): boolean {
    const isValid = /^\d{6}$/.test(value);
    if (!isValid) {
      setOtpError("Enter a valid 6-digit code.");
    } else {
      setOtpError("");
    }
    return isValid;
  }

  const signup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setOtpError("");
    if (name.trim().length < 2) { setError("Please enter your full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters long."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (role === "Admin" || role === "Faculty") {
      if (!/^\d{6}$/.test(passkey)) { setError(role === "Admin" ? "Please enter the 6-digit admin passkey." : "Please enter the 6-digit faculty pass key."); return; }
    }
    setLoading(true);
    try {
      const data = await postJson<{ message: string; user: { name: string }; devOtp?: string; demoOtp?: string }>(
        `${API_BASE_URL}/auth/register`,
        {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          ...(role === "Admin" || role === "Faculty" ? { passkey } : {}),
          profile: extra,
        }
      );
      setCreatedName(data.user?.name || name.trim());
      setInfo(data.message);
      setDevOtp(data.demoOtp || data.devOtp || null);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    const code = otp.replace(/\s/g, "");
    if (!validateOtpInput(code)) {
      setError(otpError || "Invalid OTP.");
      return;
    }
    setLoading(true);
    try {
      const data = await postJson<{ message: string; user: { name: string; role: string } }>(
        `${API_BASE_URL}/auth/verify`,
        { email: email.trim(), otp: code }
      );
      setCreatedName(data.user?.name || email.trim());
      setInfo(data.message);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP or rate limit exceeded.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="signup-page">
      <div className="signup-left">
        <div className="signup-brand">
          <div className="signup-logo"><Building2 size={30} /></div>
          <div><h1>HostelHub</h1><span>Management System</span></div>
          <div className="signup-brand-image" aria-hidden="true">
            <img src={heroImage} alt="Hostel campus" loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="signup-welcome">
          <h2>Join HostelHub<br />in seconds.</h2>
          <p>Create your account with a secure password — fast and free for every resident.</p>
          <div className="signup-features">
            <div><CheckCircle2 size={16} /> Secure password signup</div>
            <div><CheckCircle2 size={16} /> Role-based dashboards</div>
            <div><CheckCircle2 size={16} /> Rooms, fees &amp; mess in one place</div>
            <div><CheckCircle2 size={16} /> Complaints &amp; notices</div>
          </div>
        </div>
      </div>

      <div className="signup-right">
        <div className="signup-card">
          <button type="button" className="back-home-btn" onClick={onBackHome}>
            <ArrowLeft size={16} /> Home
          </button>
          <div className="signup-icon"><UserPlus size={22} /></div>
          <h2>Create account</h2>
          <p>
            {step === "details" && "Fill in your details to create your account."}
            {step === "success" && "Your account is ready!"}
          </p>

          <div className="role-tabs" style={step === "success" ? { display: "none" } : undefined}>
            {(["Student", "Faculty", "Admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                className={role === r ? "role-active" : ""}
                onClick={() => { setRole(r); setError(""); }}
              >
                <UserRound size={17} /> {r}
              </button>
            ))}
          </div>
          {step === "details" && (
            <form onSubmit={signup}>
              <div className="signup-field">
                <label>Full Name</label>
                <div className="signup-input-wrapper">
                  <UserRound size={17} />
                  <input type="text" placeholder="Enter your full name" value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }} required />
                </div>
              </div>
              <div className="signup-field">
                <label>Email Address</label>
                <div className="signup-input-wrapper">
                  <Mail size={17} />
                  <input type="email" placeholder="Enter your email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }} required />
                </div>
              </div>
              <div className="signup-field">
                <label>Password</label>
                <div className="signup-input-wrapper">
                  <Lock size={17} />
                  <input type={showPassword ? "text" : "password"} placeholder="Min. 6 characters"
                    value={password} minLength={6} required
                    onChange={(e) => { setPassword(e.target.value); setError(""); }} />
                  <button type="button" aria-label="Toggle password"
                    onClick={() => setShowPassword((s) => !s)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div className="signup-field">
                <label>Confirm Password</label>
                <div className="signup-input-wrapper">
                  <Lock size={17} />
                  <input type={showPassword ? "text" : "password"} placeholder="Repeat your password"
                    value={confirm} required
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }} />
                </div>
              </div>
              {role === "Student" && (
                <>
                  <div className="signup-field"><label>Mobile Number</label><div className="signup-input-wrapper"><input placeholder="10-digit mobile" value={extra.mobile || ""} onChange={(e) => setExtra({ ...extra, mobile: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Parent/Guardian Name</label><div className="signup-input-wrapper"><input placeholder="Parent/Guardian full name" value={extra.parentGuardianName || ""} onChange={(e) => setExtra({ ...extra, parentGuardianName: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Parent Mobile</label><div className="signup-input-wrapper"><input placeholder="Parent mobile" value={extra.parentGuardianMobile || ""} onChange={(e) => setExtra({ ...extra, parentGuardianMobile: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Course</label><div className="signup-input-wrapper"><input placeholder="e.g. B.Tech CSE" value={extra.course || ""} onChange={(e) => setExtra({ ...extra, course: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Year/Semester</label><div className="signup-input-wrapper"><input placeholder="e.g. 2nd Year / 3rd Sem" value={extra.yearSemester || ""} onChange={(e) => setExtra({ ...extra, yearSemester: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Address</label><div className="signup-input-wrapper"><input placeholder="Residential address" value={extra.address || ""} onChange={(e) => setExtra({ ...extra, address: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Emergency Contact</label><div className="signup-input-wrapper"><input placeholder="Emergency contact number" value={extra.emergencyContact || ""} onChange={(e) => setExtra({ ...extra, emergencyContact: e.target.value })} /></div></div>
                </>
              )}
              {role === "Faculty" && (
                <>
                  <div className="signup-field"><label>Mobile Number</label><div className="signup-input-wrapper"><input placeholder="10-digit mobile" value={extra.mobile || ""} onChange={(e) => setExtra({ ...extra, mobile: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Department</label><div className="signup-input-wrapper"><input placeholder="Department" value={extra.department || ""} onChange={(e) => setExtra({ ...extra, department: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Designation</label><div className="signup-input-wrapper"><input placeholder="Designation" value={extra.designation || ""} onChange={(e) => setExtra({ ...extra, designation: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Assigned Hostel/Block</label><div className="signup-input-wrapper"><input placeholder="Hostel/Block" value={extra.hostel || ""} onChange={(e) => setExtra({ ...extra, hostel: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Address</label><div className="signup-input-wrapper"><input placeholder="Residential address" value={extra.address || ""} onChange={(e) => setExtra({ ...extra, address: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Emergency Contact</label><div className="signup-input-wrapper"><input placeholder="Emergency contact number" value={extra.emergencyContact || ""} onChange={(e) => setExtra({ ...extra, emergencyContact: e.target.value })} /></div></div>
                </>
              )}
              {role === "Admin" && (
                <>
                  <div className="signup-field"><label>Mobile Number</label><div className="signup-input-wrapper"><input placeholder="10-digit mobile" value={extra.mobile || ""} onChange={(e) => setExtra({ ...extra, mobile: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Designation</label><div className="signup-input-wrapper"><input placeholder="Designation" value={extra.designation || ""} onChange={(e) => setExtra({ ...extra, designation: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Address</label><div className="signup-input-wrapper"><input placeholder="Residential address" value={extra.address || ""} onChange={(e) => setExtra({ ...extra, address: e.target.value })} /></div></div>
                  <div className="signup-field"><label>Emergency Contact</label><div className="signup-input-wrapper"><input placeholder="Emergency contact number" value={extra.emergencyContact || ""} onChange={(e) => setExtra({ ...extra, emergencyContact: e.target.value })} /></div></div>
                </>
              )}
              {(role === "Admin" || role === "Faculty") && (
                <div className="signup-field">
                  <label>{role === "Admin" ? "Admin Passkey" : "Faculty Pass Key"}</label>
                  <div className="signup-input-wrapper">
                    <KeyRound size={17} />
                      <input type="password" inputMode="numeric" maxLength={6}
                      placeholder={role === "Admin" ? "6-digit admin passkey" : "6-digit faculty pass key"} value={passkey} required
                      onChange={(e) => { setPasskey(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} />
                  </div>
                </div>
              )}
              {password.length > 0 && (
                <div style={{ margin: "-6px 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                    <div style={{ width: strength.width, background: strength.color, height: "100%" }} />
                  </div>
                  <small style={{ color: strength.color, fontWeight: 700 }}>{strength.label}</small>
                </div>
              )}
              {error && <div className="signup-error">{error}</div>}
              {info && <div className="signup-success">{info}</div>}
              <button className="signup-button" type="submit" disabled={loading}>
                {loading ? "Creating account..." : (<><UserPlus size={18} /> Create Account</>)}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={(e) => { e.preventDefault(); verifyOtp(e); }}>
              <div>
                <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "#1e293b" }}>
                  Enter 6-digit OTP
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <input
                      key={i}
                      className="otp-box"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otp[i] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(-1);
                        if (val) {
                          setOtp((prev) => {
                            const chars = prev.split("");
                            while (chars.length < 6) chars.push("");
                            chars[i] = val;
                            return chars.join("");
                          });
                          if (i < 5) {
                            const inputs = document.querySelectorAll<HTMLInputElement>(".otp-box");
                            if (inputs[i + 1]) (inputs[i + 1] as HTMLInputElement).focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace") {
                          setOtp((prev) => {
                            const chars = prev.split("");
                            while (chars.length < 6) chars.push("");
                            chars[i] = "";
                            return chars.join("");
                          });
                          if (i > 0 && !(otp[i])) {
                            const inputs = document.querySelectorAll<HTMLInputElement>(".otp-box");
                            if (inputs[i - 1]) (inputs[i - 1] as HTMLInputElement).focus();
                          }
                        }
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        if (text) {
                          e.preventDefault();
                          setOtp(text.padEnd(6, ""));
                          const inputs = document.querySelectorAll<HTMLInputElement>(".otp-box");
                          const idx = Math.min(text.length, 5);
                          if (inputs[idx]) (inputs[idx] as HTMLInputElement).focus();
                        }
                      }}
                      style={{
                        width: "48px", height: "48px", textAlign: "center",
                        fontSize: "18px", border: "2px solid #e2e8f0",
                        borderRadius: "8px", outline: "none", fontFamily: "monospace"
                      }}
                      aria-label={`OTP ${i + 1}`}
                    />
                  ))}
                </div>
                {devOtp && (
                  <div className="demo-otp-box">
                    <span>Demo OTP:</span>
                    <strong>{devOtp}</strong>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: "12px", color: "#64748b" }}>
                  <KeyRound size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Enter the 6-digit code sent to your email
                </div>
              </div>
              {otpError && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: 8 }}>{otpError}</div>}
              {error && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: 8 }}>{error}</div>}
              {info && <div style={{ color: "#10b981", fontSize: "13px", marginBottom: 8 }}>{info}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="signup-button" onClick={() => { setOtp(""); setStep("details"); }}>
                  Back
                </button>
                <button type="submit" className="signup-button" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>
              </div>
            </form>
          )}
          {step === "success" && (
            <div className="signup-success-card">
              <div className="success-circle"><CheckCircle2 size={44} /></div>
              <h2>Welcome, {createdName}! 🎉</h2>
              <p>{info || "Account created successfully."}</p>
              <div className="success-user">
                <strong>{createdName}</strong>
                <span>{email.trim()}</span>
              </div>
              <div style={{ marginTop: 20 }}>
                <button className="signup-button" type="button" onClick={onSignup}>
                  Continue to Login <ArrowLeft size={16} style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
              <p className="success-loading">Redirecting you to login…</p>
            </div>
          )}

          {step !== "success" && (
            <div className="signup-login-text">
              Already have an account? <button type="button" onClick={onLogin}>Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Signup;

