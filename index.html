import { useState, useEffect, useRef, createContext, useContext } from "react";

// ─── TOKENS ────────────────────────────────────────────────────────────────
const DROPBOX_ACCESS_TOKEN = "sl.u.AGWlyueCeEoysUJd9wLn-PDIvP9Kd6IL9N_JiW2pLLv7Rc8AZpjfeeOJJ6tqD9yyEOujIXViAMTzofOJUnt7kefUyHcu74iHHedEeOieiyfHXsCmbP-q7tLdtyupRgce1C_NJUrZPZr6VvO3bDHkvxDvq71BiYJkHAL5bZOm4BqdIg6BMFXkyzTJU494JuP-wLTEfzMePwtFHdM_E_qYV2g2QeKKD-jB52SUnPTAAamxmPX5n6cWrChOpF1NPPPw_E6suKI5Bpi8BpLzupIe_rnAApADu_3oxjznYHdikDHLn8RcV76KSeM7bz3A7Eb603LoC509BAR4U46IOaqrlqgoJ59sp5Ps9ZuPPpQtBE2fI3hQ_ymafSsu_-eZisHnvWe5buSe8kI6RWHBfW1yhtKFvzpUogRsaaDWm3iNOgwIjur-qCWs0olxrFlZK9RiaSTFKNpUEJwiT5qYGSANKzav3GiTAX-Dj-b26qk1UpRDiriaS_b0Y2Mklvz6Fr-Wg0SPu5OVxHfErayCoVM4myuvXPO5Tqwx7Hll0TkEUgD_DytZIoOdIgvuKxbNnG8xvRrHfHxdTbOK_j6wKDvZCCoGIzkKmMqqd4Q7VYYhBXsxRKMciv2meAwFxrNoc9I6jENFlnOpXZqB0VtaJibmjbEIcrr9BzQF-e2KhD8wwY8VsEAudevG2Xe6g-RnTT6C2YjNr8HdOP51dFnyup6wQ3A0gQ24_hMocyw-q-ku6brqQ-NgSHDzLIO1PrIVl9ayqzGjjBD6k4DIUSpbx0_NWQLqAIQai7RD5cOTHSnveGBMnEUKVuD_gG4m17XRZdy8kLJcSIvQostHhFjASsu9DpINxNKf2ltl57hcjxlXYHnFOhMSf48FcqGdz1oeKs4XTrM9tupLx5Q5Imy-qoOG2q6NQPAe_cAuFM6ULu-2t6wrHDoHNGIcnUgDmJlcS5XvQqsh1F_lVlnHjneAWaiwmmld3DDbjfm6ZcP-2lZRB9P-H2jFifCl58Jrgvos8eW0m40ODbZhOG_cCdyCHBoGZkaoyEhh2lMEgZNQ0oa1RNci09AbYlcsp7OUV22h73JAsyDjXDEH45Go4tQURSlgiQ51GY5s06-Q2_hu3ZE_1d9ID_736o7lWCnG1JSc7YOlkvuDfu48Tg5xN5rEEupI4pCmDVzg12pTXngrrGlS7VbM8uKEpnE3ABneKkXJpCbLTxwBnVrL-3rPzoBRU2wv8W_Y2dWvFv2-h3b-gOZQV8FRzV2jLu5Np7ut4PLrveGx4dMafygCavmZih60HZz2QaTAOf0fnt2dTzu6KsljRbo9Dg";

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
const mockChildren = [
  { id: "c1", name: "Lily Carter", age: 7, avatar: "🌸", color: "#f0a8c0", dob: "2017-03-14", diagnoses: ["Sensory Processing Disorder", "Speech Delay"] },
  { id: "c2", name: "Noah Carter", age: 5, avatar: "🚀", color: "#8ecae6", dob: "2019-07-22", diagnoses: ["Autism Spectrum Disorder"] }
];

const mockSpecialists = [
  { id: "s1", name: "Dr. Sarah Okafor", role: "Speech Therapist", email: "s.okafor@clinic.com", avatar: "👩‍⚕️", permissions: { c1: ["speech", "general"], c2: ["speech"] }, status: "active" },
  { id: "s2", name: "James Whitfield", role: "Occupational Therapist", email: "j.whitfield@ot.com", avatar: "🧑‍⚕️", permissions: { c1: ["ot", "general"], c2: [] }, status: "active" },
  { id: "s3", name: "Dr. Priya Nair", role: "Physical Therapist", email: "p.nair@pt.com", avatar: "👩‍⚕️", permissions: { c1: [], c2: ["pt", "general"] }, status: "active" },
  { id: "s4", name: "Dr. Marcus Webb", role: "Behavioral Therapist", email: "m.webb@behavior.com", avatar: "🧑‍⚕️", permissions: { c1: [], c2: [] }, status: "pending" }
];

const mockFolders = [
  { id: "f1", name: "Speech Therapy", icon: "🗣️", key: "speech", files: [{ name: "Session_Jan.pdf", date: "2025-01-15", locked: true }, { name: "Goals_Q1.pdf", date: "2025-02-01", locked: false }] },
  { id: "f2", name: "Occupational Therapy", icon: "✋", key: "ot", files: [{ name: "OT_Assessment.pdf", date: "2025-01-20", locked: true }] },
  { id: "f3", name: "Physical Therapy", icon: "🏃", key: "pt", files: [{ name: "PT_Progress.pdf", date: "2025-02-10", locked: false }] },
  { id: "f4", name: "Medical Records", icon: "📋", key: "general", files: [{ name: "Annual_Physical.pdf", date: "2024-12-01", locked: true }] },
  { id: "f5", name: "Medications", icon: "💊", key: "meds", files: [{ name: "Med_Schedule.pdf", date: "2025-01-01", locked: true }] },
  { id: "f6", name: "School Reports", icon: "🏫", key: "school", files: [{ name: "IEP_2025.pdf", date: "2025-01-08", locked: false }] }
];

const mockHomework = [
  { id: "h1", childId: "c1", task: "Practice 'S' sound blends for 10 min daily", specialist: "Dr. Sarah Okafor", due: "2025-03-01", completed: false, category: "Speech" },
  { id: "h2", childId: "c1", task: "Sensory bin activity: rice textures (15 min)", specialist: "James Whitfield", due: "2025-02-28", completed: true, category: "OT" },
  { id: "h3", childId: "c2", task: "Morning balance beam walk before school", specialist: "Dr. Priya Nair", due: "2025-03-02", completed: false, category: "PT" },
  { id: "h4", childId: "c2", task: "Social story reading — 'Making Friends'", specialist: "Dr. Sarah Okafor", due: "2025-02-27", completed: false, category: "Speech" }
];

const mockAppointments = [
  { id: "a1", childId: "c1", title: "Speech Session", specialist: "Dr. Sarah Okafor", date: "2025-03-03", time: "10:00 AM", type: "speech" },
  { id: "a2", childId: "c1", title: "OT Session", specialist: "James Whitfield", date: "2025-03-05", time: "2:00 PM", type: "ot" },
  { id: "a3", childId: "c2", title: "PT Session", specialist: "Dr. Priya Nair", date: "2025-03-04", time: "11:30 AM", type: "pt" },
  { id: "a4", childId: "c2", title: "Speech Session", specialist: "Dr. Sarah Okafor", date: "2025-03-06", time: "9:00 AM", type: "speech" }
];

const mockVaultNotes = [
  { id: "v1", specialistId: "s1", childId: "c1", date: "2025-02-24", title: "Session #14 Clinical Notes", content: "Patient demonstrated improved phonological awareness during /s/ cluster production. Scored 78% accuracy on CELF-5 subtest. Observed perseverative behavior during transitions — recommend further OT collaboration. Parent reported increased frustration at home during homework tasks. Consider modifying HEP frequency. Will trial visual schedules next session.", published: false, locked: false, summary: null },
  { id: "v2", specialistId: "s1", childId: "c1", date: "2025-02-10", title: "Session #13 Clinical Notes", content: "Baseline re-assessment completed. Good engagement throughout. Articulation improving measurably.", published: true, locked: true, summary: "Lily had a great session today! She's making wonderful progress with her speech sounds and showed real improvement during our assessment. Keep encouraging her talking at home!" }
];

const mockChats = [
  {
    id: "ch1", participants: ["parent", "s1"], childId: "c1", approved: true,
    messages: [
      { id: "m1", sender: "s1", text: "Hi! Just wanted to share that Lily did wonderfully today 🌟", time: "10:32 AM", date: "2025-02-24" },
      { id: "m2", sender: "parent", text: "That's so great to hear! She was practicing all week.", time: "11:05 AM", date: "2025-02-24" },
      { id: "m3", sender: "s1", text: "It really shows. I'll publish the summary shortly.", time: "11:08 AM", date: "2025-02-24" }
    ]
  }
];

const mockNotifications = [
  { id: "n1", type: "report", message: "Dr. Sarah Okafor published a new summary for Lily", time: "2h ago", read: false, childId: "c1" },
  { id: "n2", type: "homework", message: "James Whitfield marked OT homework complete for Lily", time: "1d ago", read: false, childId: "c1" },
  { id: "n3", type: "chat", message: "New message from Dr. Sarah Okafor", time: "1d ago", read: true, childId: "c1" },
  { id: "n4", type: "invite", message: "Dr. Marcus Webb requested to join Noah's care team", time: "2d ago", read: true, childId: "c2" }
];

// ─── GLOBAL STATE ───────────────────────────────────────────────────────────
const AppContext = createContext(null);

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --teal: #0d9488;
    --teal-light: #14b8a6;
    --teal-dark: #0f766e;
    --mint: #a7f3d0;
    --mint-light: #d1fae5;
    --coral: #f97316;
    --coral-light: #fed7aa;
    --amber: #f59e0b;
    --navy: #1e293b;
    --navy-mid: #334155;
    --slate: #64748b;
    --slate-light: #94a3b8;
    --bg: #f0fdf9;
    --bg2: #ffffff;
    --card: #ffffff;
    --border: #d1fae5;
    --text: #1e293b;
    --text-muted: #64748b;
    --shadow: 0 4px 24px rgba(13,148,136,0.10);
    --shadow-lg: 0 8px 40px rgba(13,148,136,0.15);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  .fraunces { font-family: 'Fraunces', serif; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--teal-light); border-radius: 4px; }

  /* Animations */
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes badgePop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }

  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .slide-up { animation: slideUp 0.5s cubic-bezier(.16,1,.3,1) forwards; }

  /* Blurred folder */
  .blurred-folder {
    filter: blur(3px);
    pointer-events: none;
    user-select: none;
  }

  /* Spinner */
  .spinner {
    width: 20px; height: 20px;
    border: 2px solid var(--mint);
    border-top-color: var(--teal);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
const typeColor = { speech: "#0d9488", ot: "#f97316", pt: "#8b5cf6", general: "#64748b", meds: "#f59e0b", school: "#ec4899" };

// ─── MODAL ──────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} className="slide-up" style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="fraunces" style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--navy)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", color: "var(--slate)", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── CONFIRM MODAL ──────────────────────────────────────────────────────────
function ConfirmModal({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={380}>
      <p style={{ color: "var(--slate)", marginBottom: "24px", lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid var(--border)", background: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: danger ? "#ef4444" : "var(--teal)", color: "white", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Confirm</button>
      </div>
    </Modal>
  );
}

// ─── BUTTON ─────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled, fullWidth, style: s }) {
  const base = { display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "12px", fontFamily: "inherit", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.18s", opacity: disabled ? 0.6 : 1, width: fullWidth ? "100%" : undefined, justifyContent: fullWidth ? "center" : undefined, ...s };
  const sizes = { sm: { padding: "7px 14px", fontSize: "0.82rem" }, md: { padding: "11px 22px", fontSize: "0.9rem" }, lg: { padding: "14px 28px", fontSize: "1rem" } };
  const variants = {
    primary: { background: "var(--teal)", color: "white", boxShadow: "0 2px 12px rgba(13,148,136,0.3)" },
    secondary: { background: "var(--mint-light)", color: "var(--teal-dark)" },
    ghost: { background: "transparent", color: "var(--teal)", border: "1.5px solid var(--teal)" },
    danger: { background: "#fee2e2", color: "#dc2626" },
    coral: { background: "var(--coral)", color: "white", boxShadow: "0 2px 12px rgba(249,115,22,0.3)" }
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}

// ─── BADGE ──────────────────────────────────────────────────────────────────
function Badge({ children, color = "teal" }) {
  const colors = { teal: { bg: "var(--mint-light)", text: "var(--teal-dark)" }, coral: { bg: "#fed7aa", text: "#c2410c" }, amber: { bg: "#fef3c7", text: "#92400e" }, slate: { bg: "#f1f5f9", text: "var(--slate)" }, purple: { bg: "#ede9fe", text: "#5b21b6" }, pink: { bg: "#fce7f3", text: "#9d174d" } };
  const c = colors[color] || colors.teal;
  return <span style={{ background: c.bg, color: c.text, borderRadius: "20px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

// ─── CARD ────────────────────────────────────────────────────────────────────
function Card({ children, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", padding: "20px", cursor: onClick ? "pointer" : undefined, transition: "box-shadow 0.2s", ...s }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = "var(--shadow)"; }}>
      {children}
    </div>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function Avatar({ emoji, color, size = 40, name }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color || "var(--mint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, flexShrink: 0, border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      {emoji || name?.[0]?.toUpperCase()}
    </div>
  );
}

// ─── LOGIN / ONBOARDING ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [step, setStep] = useState("landing"); // landing | role | parent-login | specialist-login
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(role, role === "specialist" ? "s1" : null);
    }, 1200);
  };

  const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", transition: "border-color 0.2s", background: "var(--bg)" };

  if (step === "landing") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 40%, #a7f3d0 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div className="fade-in" style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🤝</div>
        <h1 className="fraunces" style={{ fontSize: "3rem", color: "white", fontWeight: 700, marginBottom: "8px", lineHeight: 1.1 }}>Huddledin</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.05rem", marginBottom: "40px", lineHeight: 1.6 }}>Collaborative care for children with special needs — all in one place.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Btn onClick={() => setStep("role")} size="lg" style={{ background: "white", color: "var(--teal-dark)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>Get Started</Btn>
          <Btn onClick={() => setStep("role")} variant="ghost" size="lg" style={{ borderColor: "rgba(255,255,255,0.5)", color: "white" }}>Sign In</Btn>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: "32px" }}>Secure • HIPAA-aware • Parent-first</p>
      </div>
    </div>
  );

  if (step === "role") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="slide-up" style={{ width: "100%", maxWidth: 440 }}>
        <button onClick={() => setStep("landing")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--slate)", marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}>← Back</button>
        <h2 className="fraunces" style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px", color: "var(--navy)" }}>Who are you?</h2>
        <p style={{ color: "var(--slate)", marginBottom: "32px" }}>Choose your role to personalize your experience.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[{ r: "parent", emoji: "👨‍👩‍👧", label: "Parent / Guardian", desc: "Manage your child's care team, files, and appointments" }, { r: "specialist", emoji: "🩺", label: "Specialist / Therapist", desc: "View patient notes, publish summaries, assign homework" }].map(({ r, emoji, label, desc }) => (
            <Card key={r} onClick={() => { setRole(r); setStep(r + "-login"); }} style={{ display: "flex", alignItems: "center", gap: "16px", border: role === r ? "2px solid var(--teal)" : "1px solid var(--border)" }}>
              <div style={{ fontSize: "2.5rem" }}>{emoji}</div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "4px" }}>{label}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--slate)" }}>{desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="slide-up" style={{ width: "100%", maxWidth: 440 }}>
        <button onClick={() => setStep("role")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--slate)", marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}>← Back</button>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "8px" }}>{role === "parent" ? "👨‍👩‍👧" : "🩺"}</div>
          <h2 className="fraunces" style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--navy)" }}>{role === "parent" ? "Parent Sign In" : "Specialist Sign In"}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {role === "parent" && <input style={inputStyle} placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />}
          <input style={inputStyle} placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inputStyle} placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} />
          <Btn onClick={handleLogin} disabled={loading} fullWidth size="lg" style={{ marginTop: "8px" }}>
            {loading ? <><span className="spinner" /> Signing in...</> : "Sign In"}
          </Btn>
        </div>
        <p style={{ textAlign: "center", color: "var(--slate)", fontSize: "0.85rem", marginTop: "20px" }}>Demo: any credentials work ✨</p>
      </div>
    </div>
  );
}

// ─── NOTIFICATION BELL ──────────────────────────────────────────────────────
function NotifBell({ notifications, onOpenFull }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  const notifIcon = { report: "📄", homework: "✅", chat: "💬", invite: "🤝" };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "white", border: "1.5px solid var(--border)", borderRadius: "12px", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
        🔔
        {unread > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "var(--coral)", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, animation: "badgePop 0.3s ease" }}>{unread}</span>}
      </button>
      {open && (
        <div className="fade-in" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "white", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", width: 300, zIndex: 500 }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "var(--navy)" }}>Notifications</span>
            <button onClick={() => { setOpen(false); onOpenFull(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal)", fontSize: "0.8rem", fontFamily: "inherit" }}>See all</button>
          </div>
          <div style={{ maxHeight: 280, overflow: "auto" }}>
            {notifications.slice(0, 5).map(n => (
              <div key={n.id} style={{ padding: "12px 20px", borderBottom: "1px solid #f0fdf9", display: "flex", gap: "12px", alignItems: "flex-start", background: n.read ? "white" : "var(--mint-light)" }}>
                <span>{notifIcon[n.type]}</span>
                <div>
                  <div style={{ fontSize: "0.83rem", color: "var(--navy)", lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-light)", marginTop: "2px" }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────
function Header({ userRole, children, activeChild, onChildSwitch, notifications, onNotifPage, onLogout }) {
  return (
    <header style={{ background: "white", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(13,148,136,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.4rem" }}>🤝</span>
          <span className="fraunces" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--teal)" }}>Huddledin</span>
        </div>
        {userRole === "parent" && (
          <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
            {children.map(child => (
              <button key={child.id} onClick={() => onChildSwitch(child.id)} title={child.name}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "20px", border: "2px solid", borderColor: activeChild === child.id ? "var(--teal)" : "transparent", background: activeChild === child.id ? "var(--mint-light)" : "var(--bg)", cursor: "pointer", transition: "all 0.2s" }}>
                <span style={{ fontSize: "1.1rem" }}>{child.avatar}</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--navy)", display: "none" }} className="child-name">{child.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <NotifBell notifications={notifications} onOpenFull={onNotifPage} />
        <button onClick={onLogout} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px 14px", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", color: "var(--slate)", fontWeight: 500 }}>Sign Out</button>
      </div>
    </header>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
function BottomNav({ tabs, active, onSelect }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid var(--border)", display: "flex", zIndex: 99, boxShadow: "0 -4px 20px rgba(13,148,136,0.08)" }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onSelect(tab.id)} style={{ flex: 1, padding: "10px 4px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", border: "none", background: "none", cursor: "pointer", color: active === tab.id ? "var(--teal)" : "var(--slate-light)", transition: "color 0.2s" }}>
          <span style={{ fontSize: "1.3rem" }}>{tab.icon}</span>
          <span style={{ fontSize: "0.65rem", fontWeight: 600 }}>{tab.label}</span>
          {active === tab.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--teal)", marginTop: "1px" }} />}
        </button>
      ))}
    </nav>
  );
}

// ─── SIDEBAR NAV (desktop) ───────────────────────────────────────────────────
function SideNav({ tabs, active, onSelect, userRole, specialistName }) {
  return (
    <aside style={{ width: 220, background: "white", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "24px 12px", gap: "4px", minHeight: "100%" }}>
      <div style={{ padding: "8px 12px 20px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--slate)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Signed in as</div>
        <div style={{ fontWeight: 700, color: "var(--navy)", marginTop: "2px", fontSize: "0.9rem" }}>{userRole === "parent" ? "The Carter Family" : specialistName || "Dr. Sarah Okafor"}</div>
        <Badge color="teal">{userRole === "parent" ? "Parent" : "Specialist"}</Badge>
      </div>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onSelect(tab.id)}
          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", border: "none", background: active === tab.id ? "var(--mint-light)" : "transparent", color: active === tab.id ? "var(--teal-dark)" : "var(--slate)", cursor: "pointer", fontFamily: "inherit", fontWeight: active === tab.id ? 700 : 500, fontSize: "0.9rem", textAlign: "left", transition: "all 0.18s" }}>
          <span style={{ fontSize: "1.15rem" }}>{tab.icon}</span>{tab.label}
        </button>
      ))}
    </aside>
  );
}

// ─── PARENT DASHBOARD ────────────────────────────────────────────────────────
function ParentDashboard({ activeChild, homework, appointments, onToggleHomework }) {
  const child = mockChildren.find(c => c.id === activeChild);
  const childHW = homework.filter(h => h.childId === activeChild);
  const childAppts = appointments.filter(a => a.childId === activeChild);
  const pending = childHW.filter(h => !h.completed).length;

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <span style={{ fontSize: "2rem" }}>{child?.avatar}</span>
          <div>
            <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>{child?.name}'s Dashboard</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
              {child?.diagnoses.map(d => <Badge key={d} color="teal">{d}</Badge>)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        {[{ label: "Upcoming Appointments", value: childAppts.length, icon: "📅", color: "#14b8a6" }, { label: "Pending Tasks", value: pending, icon: "📋", color: "#f97316" }, { label: "Care Team Members", value: mockSpecialists.filter(s => s.status === "active").length, icon: "👥", color: "#8b5cf6" }].map(stat => (
          <Card key={stat.label} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: 48, height: 48, borderRadius: "14px", background: stat.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--navy)", lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--slate)", marginTop: "2px" }}>{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
        <Card>
          <h3 style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>📋 Homework & Tasks</h3>
          {childHW.length === 0 ? <p style={{ color: "var(--slate)", fontSize: "0.9rem" }}>No tasks assigned yet.</p> : childHW.map(hw => (
            <div key={hw.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f0fdf9" }}>
              <button onClick={() => onToggleHomework(hw.id)} style={{ width: 22, height: 22, borderRadius: "6px", border: "2px solid", borderColor: hw.completed ? "var(--teal)" : "var(--slate-light)", background: hw.completed ? "var(--teal)" : "white", cursor: "pointer", flexShrink: 0, marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem" }}>{hw.completed ? "✓" : ""}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.88rem", color: hw.completed ? "var(--slate-light)" : "var(--navy)", textDecoration: hw.completed ? "line-through" : "none", lineHeight: 1.4 }}>{hw.task}</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                  <Badge color={hw.category === "Speech" ? "teal" : hw.category === "OT" ? "coral" : "purple"}>{hw.category}</Badge>
                  <span style={{ fontSize: "0.75rem", color: "var(--slate-light)" }}>Due {hw.due}</span>
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "16px" }}>📅 Upcoming Appointments</h3>
          {childAppts.length === 0 ? <p style={{ color: "var(--slate)", fontSize: "0.9rem" }}>No appointments scheduled.</p> : childAppts.map(apt => (
            <div key={apt.id} style={{ display: "flex", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f0fdf9", alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: "12px", background: (typeColor[apt.type] || "#14b8a6") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📅</div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: "0.88rem" }}>{apt.title}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{apt.specialist}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--teal)", fontWeight: 600, marginTop: "2px" }}>{apt.date} · {apt.time}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── FILE MANAGER ────────────────────────────────────────────────────────────
function FileManager({ activeChild, userRole, specialistPerms, onUploadDropbox }) {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [shareModal, setShareModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareFile, setShareFile] = useState(null);
  const [sharePerms, setSharePerms] = useState({});
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileRef = useRef();

  const canAccess = (folderKey) => {
    if (userRole === "parent") return true;
    return specialistPerms.includes(folderKey);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setShareFile(file);
    setShareModal(true);
  };

  const handleConfirmUpload = async () => {
    setShareModal(false);
    setUploading(true);
    try {
      const arrayBuffer = await shareFile.arrayBuffer();
      const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ path: `/Huddledin/${activeChild}/${selectedFolder?.name || "General"}/${shareFile.name}`, mode: "add", autorename: true })
        },
        body: arrayBuffer
      });
      const data = await resp.json();
      setUploadSuccess(data.name || shareFile.name);
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>File Manager</h2>
          <p style={{ color: "var(--slate)", fontSize: "0.88rem", marginTop: "4px" }}>All medical records, reports and documents</p>
        </div>
        {userRole === "parent" && (
          <Btn onClick={() => fileRef.current?.click()} icon="📤" disabled={uploading}>
            {uploading ? <><span className="spinner" /> Uploading...</> : "Upload to Dropbox"}
          </Btn>
        )}
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
      </div>

      {uploadSuccess && (
        <div className="fade-in" style={{ background: "var(--mint-light)", border: "1px solid var(--teal)", borderRadius: "12px", padding: "12px 20px", marginBottom: "16px", color: "var(--teal-dark)", fontWeight: 600 }}>
          ✅ "{uploadSuccess}" uploaded to Dropbox successfully!
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
        {mockFolders.map(folder => {
          const access = canAccess(folder.key);
          return (
            <div key={folder.id} style={{ position: "relative" }}>
              <Card onClick={access ? () => setSelectedFolder(folder) : null}
                style={{ textAlign: "center", padding: "24px 16px", cursor: access ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
                <div className={!access ? "blurred-folder" : ""}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>{folder.icon}</div>
                  <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: "0.88rem" }}>{folder.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate)", marginTop: "4px" }}>{folder.files.length} files</div>
                </div>
                {!access && (
                  <div onClick={() => setRequestModal(folder)} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}>
                    <span style={{ fontSize: "1.8rem" }}>🔒</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--slate)", fontWeight: 600, marginTop: "4px" }}>Request Access</span>
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {selectedFolder && (
        <Modal open={!!selectedFolder} onClose={() => setSelectedFolder(null)} title={`${selectedFolder.icon} ${selectedFolder.name}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedFolder.files.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "1.4rem" }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--navy)" }}>{f.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate)" }}>{f.date}</div>
                </div>
                {f.locked && <Badge color="amber">🔒 Locked</Badge>}
              </div>
            ))}
            {userRole === "parent" && (
              <Btn onClick={() => { setSelectedFolder(null); fileRef.current?.click(); }} icon="📤" fullWidth>Upload File Here</Btn>
            )}
          </div>
        </Modal>
      )}

      <Modal open={!!requestModal} onClose={() => setRequestModal(null)} title="🔒 Request Folder Access" width={380}>
        <p style={{ color: "var(--slate)", marginBottom: "20px", lineHeight: 1.6 }}>You don't have access to the <strong>{requestModal?.name}</strong> folder. Would you like to send an access request to the Carter family?</p>
        <Btn onClick={() => { alert("Request sent to parent! They will be notified."); setRequestModal(null); }} fullWidth>Send Request</Btn>
      </Modal>

      <Modal open={shareModal} onClose={() => setShareModal(false)} title="📤 Share Settings">
        <p style={{ color: "var(--slate)", marginBottom: "20px" }}>Choose which specialists can view <strong>"{shareFile?.name}"</strong>:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {mockSpecialists.filter(s => s.status === "active").map(s => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <input type="checkbox" checked={sharePerms[s.id] ?? true} onChange={e => setSharePerms(p => ({ ...p, [s.id]: e.target.checked }))} />
              <Avatar emoji={s.avatar} size={32} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{s.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{s.role}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Btn onClick={() => setShareModal(false)} variant="ghost" fullWidth>Cancel</Btn>
          <Btn onClick={handleConfirmUpload} fullWidth>Upload & Share</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── CARE TEAM ────────────────────────────────────────────────────────────────
function CareTeam({ activeChild, onHandshake }) {
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [consultModal, setConsultModal] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const handleInvite = () => {
    alert(`Invite sent to ${inviteEmail}! A draft profile has been created.`);
    setInviteModal(false);
    setInviteEmail(""); setInviteRole("");
  };

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>Care Team</h2>
        <Btn onClick={() => setInviteModal(true)} icon="➕" size="sm">Invite Specialist</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {mockSpecialists.map(s => {
          const hasAccess = s.permissions[activeChild]?.length > 0;
          const isPending = s.status === "pending";
          return (
            <Card key={s.id} style={{ display: "flex", alignItems: "center", gap: "16px", opacity: isPending ? 0.7 : 1, border: isPending ? "1.5px dashed var(--slate-light)" : "1px solid var(--border)", position: "relative" }}>
              {isPending && (
                <div style={{ position: "absolute", top: -8, right: 12 }}>
                  <Badge color="amber">⏳ Pending Invite</Badge>
                </div>
              )}
              <Avatar emoji={s.avatar} size={48} color="#d1fae5" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--navy)" }}>{s.name}</div>
                <div style={{ fontSize: "0.83rem", color: "var(--slate)" }}>{s.role}</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  {s.permissions[activeChild]?.map(p => <Badge key={p} color="teal">{p.toUpperCase()}</Badge>)}
                  {!hasAccess && !isPending && <Badge color="slate">No access for this child</Badge>}
                </div>
              </div>
              {!isPending && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn onClick={() => onHandshake(s)} size="sm" variant="secondary" icon="🤝">Consult</Btn>
                  <Btn onClick={() => setConfirmRemove(s)} size="sm" variant="danger">Remove</Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="➕ Invite Specialist" width={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input placeholder="Specialist's email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none" }} />
          <input placeholder="Role (e.g. Speech Therapist)" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none" }} />
          <p style={{ fontSize: "0.82rem", color: "var(--slate)", lineHeight: 1.5 }}>An invitation will be sent and a draft profile created. The specialist can also request to join your care team.</p>
          <Btn onClick={handleInvite} fullWidth disabled={!inviteEmail}>Send Invitation</Btn>
        </div>
      </Modal>

      <ConfirmModal open={!!confirmRemove} onClose={() => setConfirmRemove(null)} onConfirm={() => alert(`${confirmRemove?.name} removed. Their authored notes are retained in their Legacy Archive.`)} title="Remove Specialist" message={`Remove ${confirmRemove?.name} from the care team? They will retain a Legacy Archive of their own authored notes.`} danger />
    </div>
  );
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
function ChatView({ userRole, chats, onSend }) {
  const [activeChat, setActiveChat] = useState(chats[0]);
  const [msg, setMsg] = useState("");
  const [handshakeModal, setHandshakeModal] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages]);

  const senderName = (sid) => sid === "parent" ? "You (Parent)" : mockSpecialists.find(s => s.id === sid)?.name || sid;

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>Messages</h2>
        {userRole === "specialist" && <Btn onClick={() => setHandshakeModal(true)} icon="🤝" size="sm">Request to Consult</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "20px", height: 480 }}>
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--border)", overflow: "auto" }}>
          {chats.map(chat => {
            const other = chat.participants.find(p => p !== "parent");
            const spec = mockSpecialists.find(s => s.id === other);
            const child = mockChildren.find(c => c.id === chat.childId);
            return (
              <div key={chat.id} onClick={() => setActiveChat(chat)} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: activeChat?.id === chat.id ? "var(--mint-light)" : "white", transition: "background 0.15s" }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--navy)" }}>{spec?.name || "Chat"}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--slate)", marginTop: "2px" }}>{child?.avatar} {child?.name}</div>
              </div>
            );
          })}
          {chats.length === 0 && <div style={{ padding: "20px", color: "var(--slate)", fontSize: "0.85rem" }}>No chats yet.</div>}
        </div>

        <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeChat ? (
            <>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar emoji="💬" size={36} color="#d1fae5" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--navy)" }}>{mockSpecialists.find(s => activeChat.participants.includes(s.id))?.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--teal)" }}>🔒 Secure Chat · Parent-approved</div>
                </div>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {activeChat.messages.map(m => {
                  const isMe = (userRole === "parent" && m.sender === "parent") || (userRole === "specialist" && m.sender !== "parent");
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "70%", background: isMe ? "var(--teal)" : "var(--bg)", color: isMe ? "white" : "var(--navy)", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 16px" }}>
                        {!isMe && <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "4px", color: "var(--teal)" }}>{senderName(m.sender)}</div>}
                        <div style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>{m.text}</div>
                        <div style={{ fontSize: "0.68rem", opacity: 0.7, marginTop: "4px", textAlign: "right" }}>{m.time}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEnd} />
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && msg.trim()) { onSend(activeChat.id, msg); setMsg(""); } }}
                  placeholder="Type a message..." style={{ flex: 1, padding: "10px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.88rem", outline: "none" }} />
                <Btn onClick={() => { if (msg.trim()) { onSend(activeChat.id, msg); setMsg(""); } }} disabled={!msg.trim()}>Send</Btn>
              </div>
            </>
          ) : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--slate)" }}>Select a chat to start messaging</div>}
        </div>
      </div>

      <Modal open={handshakeModal} onClose={() => setHandshakeModal(false)} title="🤝 Request to Consult" width={400}>
        <p style={{ color: "var(--slate)", marginBottom: "20px", lineHeight: 1.6 }}>Select a specialist to request a consultation. The parent will receive an approve/deny notification.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {mockSpecialists.filter(s => s.id !== "s1").map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
              <Avatar emoji={s.avatar} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{s.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{s.role}</div>
              </div>
              <Btn onClick={() => { alert(`Consultation request sent! The Carter family will be notified.`); setHandshakeModal(false); }} size="sm">Request</Btn>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── SPECIALIST VAULT ────────────────────────────────────────────────────────
function SpecialistVault({ specialistId, activeChild }) {
  const [notes, setNotes] = useState(mockVaultNotes.filter(n => n.specialistId === specialistId && n.childId === activeChild));
  const [activeNote, setActiveNote] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryEdit, setSummaryEdit] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [newNote, setNewNote] = useState(false);

  const openNote = (note) => { setActiveNote(note); setEditContent(note.content); setEditTitle(note.title); setSummary(note.summary || ""); setSummaryEdit(note.summary || ""); };

  const handleAISummarize = async () => {
    setSummarizing(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: `You are a specialist writing a parent-friendly summary of clinical session notes. Convert these clinical notes into a warm, encouraging, and easy-to-understand summary for parents. Avoid jargon. Be positive but honest. Keep it to 3-4 sentences.\n\nClinical notes:\n${editContent}` }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "Unable to generate summary.";
      setSummary(text); setSummaryEdit(text);
    } catch (e) {
      setSummary("AI summarization failed. Please try again or write manually."); setSummaryEdit("");
    }
    setSummarizing(false);
  };

  const handlePublish = () => {
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, published: true, summary: summaryEdit } : n));
    setActiveNote(null); setConfirmPublish(false);
    alert("Summary published to parent's profile! 🎉");
  };

  const handleLock = () => {
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, locked: true } : n));
    setConfirmLock(false);
    alert("Report locked permanently. ✅");
  };

  const createNewNote = () => {
    const note = { id: "v_" + Date.now(), specialistId, childId: activeChild, date: new Date().toISOString().split("T")[0], title: "New Session Notes", content: "", published: false, locked: false, summary: null };
    setNotes(prev => [note, ...prev]); openNote(note); setNewNote(false);
  };

  const child = mockChildren.find(c => c.id === activeChild);

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>Private Vault</h2>
          <p style={{ color: "var(--slate)", fontSize: "0.85rem" }}>🔒 Notes not visible to parents until published · {child?.avatar} {child?.name}</p>
        </div>
        <Btn onClick={() => createNewNote()} icon="✏️" size="sm">New Note</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeNote ? "280px 1fr" : "1fr", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {notes.length === 0 && <p style={{ color: "var(--slate)" }}>No vault notes yet. Create your first one!</p>}
          {notes.map(note => (
            <Card key={note.id} onClick={() => openNote(note)} style={{ cursor: "pointer", border: activeNote?.id === note.id ? "2px solid var(--teal)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--navy)", lineHeight: 1.3 }}>{note.title}</span>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  {note.locked && <span title="Locked">🔒</span>}
                  {note.published && <Badge color="teal">Published</Badge>}
                </div>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{note.date}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--slate-light)", marginTop: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.content.slice(0, 60)}...</div>
            </Card>
          ))}
        </div>

        {activeNote && (
          <Card style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} disabled={activeNote.locked} style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, border: "none", outline: "none", flex: 1, background: "transparent", color: "var(--navy)" }} />
              <button onClick={() => setActiveNote(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--slate)" }}>✕</button>
            </div>

            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Clinical Notes (Private)</div>
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} disabled={activeNote.locked}
                style={{ width: "100%", minHeight: 160, padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.88rem", outline: "none", resize: "vertical", background: "var(--bg)", lineHeight: 1.6 }} />
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {!activeNote.locked && (
                <Btn onClick={handleAISummarize} disabled={summarizing || !editContent.trim()} variant="secondary" icon="✨">
                  {summarizing ? <><span className="spinner" /> Summarizing...</> : "AI Summarize"}
                </Btn>
              )}
              {!activeNote.locked && <Btn onClick={() => setConfirmLock(true)} variant="ghost" icon="🔒" size="sm">Lock Report</Btn>}
            </div>

            {(summary || summarizing) && (
              <div style={{ background: "linear-gradient(135deg, var(--mint-light), #fff)", borderRadius: "14px", padding: "20px", border: "1.5px solid var(--teal-light)" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>✨ Parent-Friendly Summary</div>
                {summarizing ? (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "var(--slate)" }}><span className="spinner" /> Generating AI summary...</div>
                ) : (
                  <>
                    <textarea value={summaryEdit} onChange={e => setSummaryEdit(e.target.value)}
                      style={{ width: "100%", minHeight: 100, padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border)", fontFamily: "inherit", fontSize: "0.88rem", outline: "none", resize: "vertical", background: "white", lineHeight: 1.6 }} />
                    <Btn onClick={() => setConfirmPublish(true)} disabled={!summaryEdit.trim()} icon="📤" style={{ marginTop: "12px" }}>Lock & Publish to Parent</Btn>
                  </>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <ConfirmModal open={confirmPublish} onClose={() => setConfirmPublish(false)} onConfirm={handlePublish} title="Publish Summary?" message="This will send the summary to the parent's profile. You can still edit it before locking." />
      <ConfirmModal open={confirmLock} onClose={() => setConfirmLock(false)} onConfirm={handleLock} title="Lock Report?" message="Locking this report makes it a permanent, uneditable record. This cannot be undone." danger />
    </div>
  );
}

// ─── SPECIALIST PATIENTS ─────────────────────────────────────────────────────
function SpecialistPatients({ onSelectChild, activeChild }) {
  const [search, setSearch] = useState("");
  const filtered = mockChildren.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => a.name.split(" ").pop().localeCompare(b.name.split(" ").pop()));

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 700, margin: "0 auto" }}>
      <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)", marginBottom: "20px" }}>My Patients</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ width: "100%", padding: "12px 16px", borderRadius: "14px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", marginBottom: "20px", background: "white" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sorted.map(child => (
          <Card key={child.id} onClick={() => onSelectChild(child.id)} style={{ display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", border: activeChild === child.id ? "2px solid var(--teal)" : "1px solid var(--border)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "14px", background: child.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>{child.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "var(--navy)" }}>{child.name}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--slate)", marginTop: "2px" }}>Age {child.age} · DOB {child.dob}</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                {child.diagnoses.map(d => <Badge key={d} color="teal">{d}</Badge>)}
              </div>
            </div>
            <div style={{ color: "var(--slate-light)", fontSize: "1.2rem" }}>›</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS FULL PAGE ─────────────────────────────────────────────────
function NotificationsPage({ notifications }) {
  const icons = { report: "📄", homework: "✅", chat: "💬", invite: "🤝" };
  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 700, margin: "0 auto" }}>
      <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)", marginBottom: "20px" }}>All Notifications</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifications.map(n => (
          <Card key={n.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start", background: n.read ? "white" : "var(--mint-light)", border: n.read ? "1px solid var(--border)" : "1.5px solid var(--teal-light)" }}>
            <div style={{ fontSize: "1.5rem" }}>{icons[n.type]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--navy)", fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>{n.message}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--slate-light)", marginTop: "4px" }}>{n.time}</div>
            </div>
            {!n.read && <Badge color="teal">New</Badge>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── CALENDAR ────────────────────────────────────────────────────────────────
function CalendarView({ appointments, activeChild }) {
  const childAppts = appointments.filter(a => activeChild === "all" || a.childId === activeChild);
  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>Calendar</h2>
        <Btn onClick={() => alert("Google Calendar OAuth integration — coming soon!")} variant="ghost" icon="📅" size="sm">Sync with Google</Btn>
      </div>
      <div style={{ background: "white", borderRadius: "20px", border: "1px solid var(--border)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ background: "var(--teal)", color: "white", padding: "20px 24px" }}>
          <div className="fraunces" style={{ fontSize: "1.2rem", fontWeight: 600 }}>March 2025</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "16px" }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--slate)", padding: "8px 0" }}>{d}</div>)}
          {Array.from({ length: 6 }, (_, i) => i).map(offset => <div key={offset} style={{ padding: "8px", textAlign: "center" }} />)}
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
            const dayStr = `2025-03-${String(day).padStart(2, "0")}`;
            const dayAppts = childAppts.filter(a => a.date === dayStr);
            return (
              <div key={day} style={{ padding: "6px", textAlign: "center", minHeight: 44 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: dayAppts.length ? "var(--teal)" : "transparent", color: dayAppts.length ? "white" : "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "0.85rem", fontWeight: dayAppts.length ? 700 : 400, cursor: dayAppts.length ? "pointer" : "default" }}
                  title={dayAppts.map(a => a.title).join(", ")}>
                  {day}
                </div>
                {dayAppts.map(a => <div key={a.id} style={{ fontSize: "0.55rem", color: "white", background: typeColor[a.type] || "var(--teal)", borderRadius: "4px", padding: "1px 3px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>)}
              </div>
            );
          })}
        </div>
      </div>
      <h3 style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "14px" }}>Upcoming Appointments</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {childAppts.sort((a, b) => a.date.localeCompare(b.date)).map(apt => {
          const child = mockChildren.find(c => c.id === apt.childId);
          return (
            <Card key={apt.id} style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "14px", background: (typeColor[apt.type] || "#14b8a6") + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "1.3rem" }}>📅</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--navy)" }}>{apt.title}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--slate)" }}>{apt.specialist}</div>
                {child && <div style={{ fontSize: "0.78rem", color: "var(--slate-light)" }}>{child.avatar} {child.name}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--teal)", fontSize: "0.88rem" }}>{apt.date}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{apt.time}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── HOMEWORK SPECIALIST VIEW ─────────────────────────────────────────────────
function HomeworkSpecialist({ homework, onAddTask, activeChild }) {
  const [modal, setModal] = useState(false);
  const [task, setTask] = useState("");
  const [cat, setCat] = useState("Speech");
  const [due, setDue] = useState("");
  const childHW = homework.filter(h => h.childId === activeChild);

  const handleAdd = () => {
    onAddTask({ id: "h_" + Date.now(), childId: activeChild, task, specialist: "Dr. Sarah Okafor", due, completed: false, category: cat });
    setModal(false); setTask(""); setDue("");
  };

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)" }}>Homework & Tasks</h2>
        <Btn onClick={() => setModal(true)} icon="➕" size="sm">Assign Task</Btn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {childHW.map(hw => (
          <Card key={hw.id} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ width: 22, height: 22, borderRadius: "6px", border: "2px solid", borderColor: hw.completed ? "var(--teal)" : "var(--slate-light)", background: hw.completed ? "var(--teal)" : "white", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem", flexShrink: 0, marginTop: "2px" }}>{hw.completed ? "✓" : ""}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: hw.completed ? "var(--slate-light)" : "var(--navy)", textDecoration: hw.completed ? "line-through" : "none" }}>{hw.task}</div>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                <Badge color={hw.category === "Speech" ? "teal" : hw.category === "OT" ? "coral" : "purple"}>{hw.category}</Badge>
                <span style={{ fontSize: "0.75rem", color: "var(--slate-light)" }}>Due {hw.due}</span>
                {hw.completed && <Badge color="teal">✅ Completed by parent</Badge>}
              </div>
            </div>
          </Card>
        ))}
        {childHW.length === 0 && <p style={{ color: "var(--slate)" }}>No tasks assigned yet.</p>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="➕ Assign Homework Task" width={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <textarea value={task} onChange={e => setTask(e.target.value)} placeholder="Describe the homework task..." style={{ width: "100%", minHeight: 100, padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", resize: "vertical" }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none" }}>
            {["Speech", "OT", "PT", "General"].map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ padding: "12px 16px", borderRadius: "12px", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none" }} />
          <Btn onClick={handleAdd} fullWidth disabled={!task.trim() || !due}>Assign Task</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings() {
  const [notifs, setNotifs] = useState({ reports: true, chat: true, homework: true, appointments: false });
  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: 600, margin: "0 auto" }}>
      <h2 className="fraunces" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--navy)", marginBottom: "24px" }}>Settings</h2>
      <Card style={{ marginBottom: "16px" }}>
        <h3 style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "16px" }}>🔔 Notification Preferences</h3>
        {Object.entries(notifs).map(([key, val]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ textTransform: "capitalize", color: "var(--navy)" }}>{key} notifications</span>
            <div onClick={() => setNotifs(p => ({ ...p, [key]: !p[key] }))} style={{ width: 44, height: 24, borderRadius: "12px", background: val ? "var(--teal)" : "var(--slate-light)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: val ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <h3 style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "16px" }}>🔒 Privacy & Security</h3>
        <p style={{ color: "var(--slate)", fontSize: "0.88rem", lineHeight: 1.6 }}>All data is encrypted end-to-end. Specialists only see files you explicitly share with them. Files are stored securely in Dropbox with your access tokens.</p>
      </Card>
    </div>
  );
}

// ─── HANDSHAKE MODAL (parent side) ──────────────────────────────────────────
function HandshakeModal({ open, onClose, specialist, onApprove }) {
  const [includeParent, setIncludeParent] = useState(true);
  if (!specialist) return null;
  return (
    <Modal open={open} onClose={onClose} title="🤝 Consult Request" width={400}>
      <p style={{ color: "var(--slate)", marginBottom: "20px", lineHeight: 1.6 }}><strong>{specialist.name}</strong> would like to consult with another specialist on your child's care. Do you approve?</p>
      <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", cursor: "pointer" }}>
        <input type="checkbox" checked={includeParent} onChange={e => setIncludeParent(e.target.checked)} />
        <span style={{ color: "var(--navy)", fontSize: "0.9rem" }}>Include me in the conversation</span>
      </label>
      <div style={{ display: "flex", gap: "12px" }}>
        <Btn onClick={onClose} variant="danger" fullWidth>Deny</Btn>
        <Btn onClick={() => { onApprove(includeParent); onClose(); }} fullWidth>Approve ✓</Btn>
      </div>
    </Modal>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [specialistId, setSpecialistId] = useState("s1");
  const [activeChild, setActiveChild] = useState("c1");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [homework, setHomework] = useState(mockHomework);
  const [appointments] = useState(mockAppointments);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [chats, setChats] = useState(mockChats);
  const [handshakeTarget, setHandshakeTarget] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleHomework = (id) => {
    setHomework(prev => prev.map(h => h.id === id ? { ...h, completed: !h.completed } : h));
  };

  const addTask = (task) => setHomework(prev => [task, ...prev]);

  const sendMessage = (chatId, text) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, { id: "m_" + Date.now(), sender: userRole === "parent" ? "parent" : specialistId, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date: new Date().toISOString().split("T")[0] }] } : c));
  };

  const handleLogin = (role, sid) => {
    setUserRole(role);
    if (sid) setSpecialistId(sid);
    setActiveTab(role === "parent" ? "dashboard" : "patients");
  };

  if (!userRole) return (
    <>
      <style>{styles}</style>
      <LoginScreen onLogin={handleLogin} />
    </>
  );

  const parentTabs = [
    { id: "dashboard", label: "Home", icon: "🏠" },
    { id: "files", label: "Files", icon: "📁" },
    { id: "team", label: "Team", icon: "👥" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "notifications", label: "Alerts", icon: "🔔" },
    { id: "settings", label: "Settings", icon: "⚙️" }
  ];

  const specialistTabs = [
    { id: "patients", label: "Patients", icon: "👤" },
    { id: "vault", label: "Vault", icon: "🔒" },
    { id: "homework", label: "Tasks", icon: "📋" },
    { id: "files", label: "Files", icon: "📁" },
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "notifications", label: "Alerts", icon: "🔔" }
  ];

  const tabs = userRole === "parent" ? parentTabs : specialistTabs;
  const specialistPerms = mockSpecialists.find(s => s.id === specialistId)?.permissions[activeChild] || [];

  const renderContent = () => {
    if (activeTab === "dashboard" && userRole === "parent") return <ParentDashboard activeChild={activeChild} homework={homework} appointments={appointments} onToggleHomework={toggleHomework} />;
    if (activeTab === "files") return <FileManager activeChild={activeChild} userRole={userRole} specialistPerms={specialistPerms} />;
    if (activeTab === "team" && userRole === "parent") return <CareTeam activeChild={activeChild} onHandshake={s => setHandshakeTarget(s)} />;
    if (activeTab === "calendar") return <CalendarView appointments={appointments} activeChild={activeChild} />;
    if (activeTab === "chat") return <ChatView userRole={userRole} chats={chats} onSend={sendMessage} />;
    if (activeTab === "notifications") return <NotificationsPage notifications={notifications} />;
    if (activeTab === "settings") return <Settings />;
    if (activeTab === "patients") return <SpecialistPatients activeChild={activeChild} onSelectChild={id => { setActiveChild(id); setActiveTab("vault"); }} />;
    if (activeTab === "vault") return <SpecialistVault specialistId={specialistId} activeChild={activeChild} />;
    if (activeTab === "homework") return <HomeworkSpecialist homework={homework} onAddTask={addTask} activeChild={activeChild} />;
    return null;
  };

  return (
    <>
      <style>{styles}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Header userRole={userRole} children={mockChildren} activeChild={activeChild} onChildSwitch={setActiveChild} notifications={notifications} onNotifPage={() => setActiveTab("notifications")} onLogout={() => setUserRole(null)} />

        <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
          {isDesktop && <SideNav tabs={tabs} active={activeTab} onSelect={setActiveTab} userRole={userRole} specialistName={mockSpecialists.find(s => s.id === specialistId)?.name} />}
          <main style={{ flex: 1, overflowY: "auto", paddingBottom: isDesktop ? "24px" : "80px" }}>
            {renderContent()}
          </main>
        </div>

        {!isDesktop && <BottomNav tabs={tabs} active={activeTab} onSelect={setActiveTab} />}

        <HandshakeModal open={!!handshakeTarget} onClose={() => setHandshakeTarget(null)} specialist={handshakeTarget} onApprove={(includeParent) => alert(`Consultation approved! ${includeParent ? "You've been included in the chat." : "Specialists will chat privately."}`)} />
      </div>
    </>
  );
}
