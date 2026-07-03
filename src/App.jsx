import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    "#0F2B4A",
  navyL:   "#1A3D5C",
  navyXL:  "#EAF1F8",
  amber:   "#E8A020",
  amberL:  "#FEF3DC",
  amberD:  "#B87D18",
  grn:     "#15803D",
  grnL:    "#DCFCE7",
  red:     "#DC2626",
  redL:    "#FEF2F2",
  pur:     "#6D28D9",
  purL:    "#EDE9FE",
  sky:     "#0369A1",
  skyL:    "#E0F2FE",
  surf:    "#F7F9FC",
  card:    "#FFFFFF",
  bdr:     "#E2E8F0",
  bdrS:    "#CBD5E1",
  txt:     "#1A2332",
  txt2:    "#475569",
  txt3:    "#94A3B8",
};

// ─── Seed Data ────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  users: [
    { id:"u1", empId:"MD001",   name:"Adithya Acharya",   role:"md",         email:"adithyaacharya@gmail.com", phone:"9900000001", active:true, managerId:null },
    { id:"u2", empId:"MGR001",  name:"Pinto Sir",         role:"manager",    email:"pinto@benaka.com",          phone:"9900000002", active:true, managerId:"u1" },
    { id:"u3", empId:"MGR002",  name:"Raghavendra Bhat",  role:"manager",    email:"raghu@benaka.com",          phone:"9900000003", active:true, managerId:"u1" },
    { id:"u4", empId:"SUP001",  name:"Suresh Kumar",      role:"supervisor", email:"suresh@benaka.com",         phone:"9900000004", active:true, managerId:"u2", counter:"Whitefield Motors" },
    { id:"u5", empId:"SUP002",  name:"Kavya Reddy",       role:"supervisor", email:"kavya@benaka.com",          phone:"9900000005", active:true, managerId:"u2", counter:"Koramangala Auto" },
    { id:"u6", empId:"SUP003",  name:"Rajan Pillai",      role:"supervisor", email:"rajan@benaka.com",          phone:"9900000006", active:true, managerId:"u3", counter:"HSR Motors" },
    { id:"u7", empId:"OFF001",  name:"Meena D'Souza",     role:"office",     email:"meena@benaka.com",          phone:"9900000007", active:true, managerId:"u2" },
    { id:"u8", empId:"IT001",   name:"Vikram Nair",       role:"it_admin",   email:"vikram@benaka.com",         phone:"9900000008", active:true, managerId:"u1" },
    { id:"u9", empId:"SF001",   name:"Ramesh B",          role:"field_staff",email:"",                          phone:"9900000009", active:true, managerId:"u4", counter:"Whitefield Motors" },
    { id:"u10",empId:"SF002",   name:"Anand K",           role:"field_staff",email:"",                          phone:"9900000010", active:true, managerId:"u4", counter:"Whitefield Motors" },
    { id:"u11",empId:"SF003",   name:"Priya S",           role:"field_staff",email:"",                          phone:"9900000011", active:true, managerId:"u5", counter:"Koramangala Auto" },
    { id:"u12",empId:"SF004",   name:"Gopal R",           role:"field_staff",email:"",                          phone:"9900000012", active:true, managerId:"u6", counter:"HSR Motors" },
  ],
  passwords: { MD001:"md@123", MGR001:"pinto@123", MGR002:"raghu@123", SUP001:"suresh@123", SUP002:"kavya@123", SUP003:"rajan@123", OFF001:"meena@123", IT001:"vikram@123", SF001:"ramesh@123", SF002:"anand@123", SF003:"priya@123", SF004:"gopal@123" },
  counters: [
    { id:"c1", name:"Whitefield Motors",  supervisorId:"u4", dealership:"Whitefield Toyota", city:"Bengaluru" },
    { id:"c2", name:"Koramangala Auto",   supervisorId:"u5", dealership:"Koramangala Honda", city:"Bengaluru" },
    { id:"c3", name:"HSR Motors",         supervisorId:"u6", dealership:"HSR Maruti",        city:"Bengaluru" },
  ],
  workTypes: [
    { id:"wt01", name:"WASH",               defaultRate:130  },
    { id:"wt02", name:"PDI.WASH",           defaultRate:100  },
    { id:"wt03", name:"PDI",                defaultRate:200  },
    { id:"wt04", name:"AC VENT",            defaultRate:200  },
    { id:"wt05", name:"GLASS CLEAN",        defaultRate:475  },
    { id:"wt06", name:"FULL BODY ANTIRUST", defaultRate:0    },
    { id:"wt07", name:"INTERNAL COAT",      defaultRate:1000 },
    { id:"wt08", name:"SERVICE+",           defaultRate:200  },
    { id:"wt09", name:"UNDERCOAT",          defaultRate:1209 },
    { id:"wt10", name:"DRYWASH",            defaultRate:250  },
    { id:"wt11", name:"AIRCON SPRAY",       defaultRate:295  },
    { id:"wt12", name:"VACCUM",             defaultRate:150  },
    { id:"wt13", name:"POLISH",             defaultRate:175  },
    { id:"wt14", name:"INTERIOR",           defaultRate:705  },
    { id:"wt15", name:"DECARBON",           defaultRate:275  },
    { id:"wt16", name:"MUFFLER",            defaultRate:220  },
    { id:"wt17", name:"ANTIRUST",           defaultRate:100  },
    { id:"wt18", name:"UNDECOAT",           defaultRate:300  },
    { id:"wt19", name:"WAX",                defaultRate:200  },
    { id:"wt20", name:"WINDSHIELD",         defaultRate:400  },
    { id:"wt21", name:"SILENCER COAT",      defaultRate:600  },
    { id:"wt22", name:"HANDPOLISH",         defaultRate:100  },
    { id:"wt23", name:"FULL GLASS",         defaultRate:1100 },
    // Sales products — editable
    { id:"wt24", name:"JOPASU",              defaultRate:500,  category:"sales" },
    { id:"wt25", name:"SHAMPOO",             defaultRate:200,  category:"sales" },
    { id:"wt26", name:"POLISH LIQUID",       defaultRate:350,  category:"sales" },
    { id:"wt27", name:"MICROFIBER CLOTH",    defaultRate:150,  category:"sales" },
    { id:"wt28", name:"AIR FRESHENER",       defaultRate:120,  category:"sales" },
    { id:"wt29", name:"TYRE SHINE",          defaultRate:180,  category:"sales" },
  ],
  attendance: [
    { id:"a1", date:"2025-07-01", supervisorId:"u4", staffId:"u9",  status:"present", reason:"", markedAt:"09:05" },
    { id:"a2", date:"2025-07-01", supervisorId:"u4", staffId:"u10", status:"absent",  reason:"Sick leave", markedAt:"09:05" },
    { id:"a3", date:"2025-07-01", supervisorId:"u5", staffId:"u11", status:"present", reason:"", markedAt:"09:10" },
    { id:"a4", date:"2025-07-01", supervisorId:"u6", staffId:"u12", status:"present", reason:"", markedAt:"09:15" },
  ],
  serviceReports: [
    { id:"sr1", date:"2025-07-01", supervisorId:"u4", submittedAt:"18:30", status:"submitted", notes:"Smooth day",
      counters:[
        { counterName:"Whitefield Motors", entries:[
          { workTypeId:"wt01", workTypeName:"WASH",        vehicles:23, rate:130, amount:2990 },
          { workTypeId:"wt02", workTypeName:"PDI.WASH",    vehicles:6,  rate:100, amount:600  },
          { workTypeId:"wt03", workTypeName:"PDI",         vehicles:6,  rate:200, amount:1200 },
          { workTypeId:"wt04", workTypeName:"AC VENT",     vehicles:7,  rate:300, amount:2100 },
          { workTypeId:"wt05", workTypeName:"GLASS CLEAN", vehicles:11, rate:475, amount:5225 },
          { workTypeId:"wt07", workTypeName:"INTERNAL COAT",vehicles:1, rate:1000,amount:1000 },
          { workTypeId:"wt08", workTypeName:"SERVICE+",    vehicles:8,  rate:200, amount:1600 },
          { workTypeId:"wt09", workTypeName:"UNDERCOAT",   vehicles:0,  rate:1209,amount:0    },
        ]},
      ], totalAmount:14715 },
    { id:"sr2", date:"2025-07-01", supervisorId:"u5", submittedAt:"18:45", status:"submitted", notes:"",
      counters:[
        { counterName:"Koramangala Auto", entries:[
          { workTypeId:"wt15", workTypeName:"DECARBON",    vehicles:4,  rate:275, amount:1100 },
          { workTypeId:"wt16", workTypeName:"MUFFLER",     vehicles:3,  rate:220, amount:660  },
          { workTypeId:"wt17", workTypeName:"ANTIRUST",    vehicles:1,  rate:100, amount:100  },
          { workTypeId:"wt13", workTypeName:"POLISH",      vehicles:3,  rate:175, amount:525  },
          { workTypeId:"wt18", workTypeName:"UNDECOAT",    vehicles:0,  rate:300, amount:0    },
        ]},
      ], totalAmount:2385 },
    { id:"sr3", date:"2025-06-30", supervisorId:"u4", submittedAt:"18:20", status:"submitted", notes:"",
      counters:[
        { counterName:"Whitefield Motors", entries:[
          { workTypeId:"wt01", workTypeName:"WASH",        vehicles:15, rate:182, amount:2730 },
          { workTypeId:"wt04", workTypeName:"AC VENT",     vehicles:5,  rate:300, amount:1500 },
          { workTypeId:"wt05", workTypeName:"GLASS CLEAN", vehicles:2,  rate:475, amount:950  },
          { workTypeId:"wt19", workTypeName:"WAX",         vehicles:2,  rate:200, amount:400  },
        ]},
      ], totalAmount:5580 },
  ],
  leaves: [
    { id:"l1", userId:"u4", role:"supervisor", date:"2025-07-05", toDate:"2025-07-05", type:"sick", reason:"Fever", status:"pending",  approverId:"u2" },
    { id:"l2", userId:"u2", role:"manager",    date:"2025-07-10", toDate:"2025-07-11", type:"personal", reason:"Family event", status:"pending", approverId:"u1" },
  ],
  targets: [
    { id:"t1", counterId:"c1", supervisorId:"u4", month:"2025-07", dailyTarget:12000, monthlyTarget:300000, setBy:"u2" },
    { id:"t2", counterId:"c2", supervisorId:"u5", month:"2025-07", dailyTarget:15000, monthlyTarget:375000, setBy:"u2" },
  ],
  feedback: [
    { id:"f1", counterId:"c1", counterName:"Whitefield Motors", date:"2025-07-01", submittedAt:"14:32",
      vehicleNo:"KA01AB1234", serviceType:"WASH", customerName:"Rajesh K", rating:5,
      comment:"Very good work, clean and quick", source:"public_form" },
    { id:"f2", counterId:"c2", counterName:"Koramangala Auto", date:"2025-07-01", submittedAt:"16:15",
      vehicleNo:"KA03CD5678", serviceType:"POLISH", customerName:"Meena R", rating:4,
      comment:"Good polish, small area was missed near door", source:"public_form" },
  ],
  // Salary records: { id, userId, month, basicSalary, allowances, deductions, netSalary, paidOn, paidBy, note }
  salaries: [
    { id:"sal1", userId:"u4", month:"2025-07", basicSalary:18000, allowances:2000, deductions:500, netSalary:19500, paidOn:"2025-07-01", paidBy:"u2", note:"" },
    { id:"sal2", userId:"u5", month:"2025-07", basicSalary:18000, allowances:2000, deductions:0,   netSalary:20000, paidOn:"2025-07-01", paidBy:"u2", note:"" },
    { id:"sal3", userId:"u6", month:"2025-07", basicSalary:18000, allowances:2000, deductions:0,   netSalary:20000, paidOn:"2025-07-01", paidBy:"u3", note:"" },
    { id:"sal4", userId:"u9", month:"2025-07", basicSalary:12000, allowances:1000, deductions:0,   netSalary:13000, paidOn:"2025-07-01", paidBy:"u4", note:"" },
    { id:"sal5", userId:"u10",month:"2025-07", basicSalary:12000, allowances:1000, deductions:500, netSalary:12500, paidOn:"2025-07-01", paidBy:"u4", note:"" },
  ],
  // Collection reports: { id, date, supervisorId, counterName, bankEntries:[{bank,description,amount}], expenses:[{description,sbiAmount,kblAmount}] }
  collectionReports: [],
  // Planned leaves (staff → executive approval flow)
  plannedLeaves: [
    { id:"pl1", userId:"u9", staffName:"Ramesh B", supervisorId:"u4", fromDate:"2025-07-10", toDate:"2025-07-10", reason:"Personal work", status:"pending", appliedOn:"2025-07-03" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABELS = { md:"MD", manager:"Manager", supervisor:"Executive", office:"Office Staff", it_admin:"IT Admin", field_staff:"Field Staff" };
const ROLE_COLORS = { md:"#6D28D9", manager:"#0369A1", supervisor:"#0F2B4A", office:"#15803D", it_admin:"#B87D18", field_staff:"#475569" };
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtCurr = n => "₹" + Number(n||0).toLocaleString("en-IN");


// ─── Report helpers for new counters[] structure ─────────────────────────────
const reportCounterNames = (r) => (r.counters||[]).map(c=>c.counterName).join(", ");
const reportAllEntries   = (r) => (r.counters||[]).flatMap(c=>c.entries||[]);
const reportVehicles     = (r) => reportAllEntries(r).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
const reportHasCounter   = (r, counterName) => (r.counters||[]).some(c=>c.counterName===counterName);
const reportHasCounterId = (r, cid, countersArr) => {
  const c = countersArr.find(x=>x.id===cid);
  return c ? reportHasCounter(r, c.name) : false;
};

function useLocalStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  const set = useCallback(v => {
    setVal(p => { const nv = typeof v === "function" ? v(p) : v; localStorage.setItem(key, JSON.stringify(nv)); return nv; });
  }, [key]);
  return [val, set];
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant="primary", size="md", disabled, style={} }) => {
  const base = { display:"inline-flex", alignItems:"center", gap:6, fontWeight:600, cursor:disabled?"not-allowed":"pointer", border:"none", borderRadius:8, transition:"all .15s", opacity:disabled?.5:1, fontFamily:"inherit", ...style };
  const sizes = { sm:{padding:"4px 12px",fontSize:12}, md:{padding:"8px 16px",fontSize:14}, lg:{padding:"11px 22px",fontSize:15} };
  const variants = {
    primary:  { background:T.navy, color:"#fff" },
    amber:    { background:T.amber, color:"#fff" },
    success:  { background:T.grn, color:"#fff" },
    danger:   { background:T.red, color:"#fff" },
    ghost:    { background:"transparent", color:T.txt2, border:`1px solid ${T.bdrS}` },
    outline:  { background:T.navyXL, color:T.navy, border:`1px solid ${T.navy}22` },
  };
  return <button style={{...base,...sizes[size],...variants[variant]}} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Badge = ({ children, color=T.navy, bg }) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, background: bg || color+"22", color }}>{children}</span>
);

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:T.card, border:`1px solid ${T.bdr}`, borderRadius:12, padding:20, ...style, cursor:onClick?"pointer":"default" }}>{children}</div>
);

const Input = ({ label, value, onChange, type="text", placeholder, required, style={} }) => (
  <div style={{ marginBottom:14 }}>
    {label && <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>{label}{required&&<span style={{color:T.red}}> *</span>}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", padding:"9px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", color:T.txt, background:"#fff", outline:"none", boxSizing:"border-box", ...style }}
    />
  </div>
);

const Select = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom:14 }}>
    {label && <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>{label}{required&&<span style={{color:T.red}}> *</span>}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:"100%", padding:"9px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", color:T.txt, background:"#fff", outline:"none", boxSizing:"border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Modal = ({ open, onClose, title, children, width=480 }) => {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:T.card, borderRadius:16, padding:28, width:"100%", maxWidth:width, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:800, color:T.txt }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:T.txt3 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, color=T.navy, icon, trend }) => (
  <Card style={{ padding:"18px 20px" }}>
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:T.txt3, textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:26, fontWeight:800, color, marginBottom:2 }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:T.txt3 }}>{sub}</div>}
        {trend && <div style={{ fontSize:12, color:trend>0?T.grn:T.red, fontWeight:600, marginTop:3 }}>{trend>0?"▲":"▼"} {Math.abs(trend)}% vs last month</div>}
      </div>
      {icon && <div style={{ fontSize:28, opacity:.6 }}>{icon}</div>}
    </div>
  </Card>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display:"flex", gap:4, borderBottom:`1px solid ${T.bdr}`, marginBottom:20 }}>
    {tabs.map(t => (
      <button key={t.id} onClick={()=>onChange(t.id)} style={{
        padding:"9px 16px", border:"none", background:"none", fontFamily:"inherit",
        fontSize:13, fontWeight:600, cursor:"pointer", borderBottom:`2px solid ${active===t.id?T.navy:"transparent"}`,
        color:active===t.id?T.navy:T.txt2, transition:"all .15s"
      }}>{t.label}</button>
    ))}
  </div>
);

const Table = ({ cols, rows, emptyMsg="No data" }) => (
  <div style={{ overflowX:"auto", border:`1px solid ${T.bdr}`, borderRadius:10 }}>
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
      <thead>
        <tr>{cols.map(c => <th key={c.key} style={{ background:T.surf, padding:"9px 13px", textAlign:"left", fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", letterSpacing:".04em", borderBottom:`1px solid ${T.bdr}`, whiteSpace:"nowrap" }}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={cols.length} style={{ textAlign:"center", padding:28, color:T.txt3, fontSize:13 }}>{emptyMsg}</td></tr>
          : rows.map((r,i) => <tr key={i}>{cols.map(c => <td key={c.key} style={{ padding:"10px 13px", borderBottom:`1px solid ${T.bdr}`, verticalAlign:"middle" }}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)
        }
      </tbody>
    </table>
  </div>
);

// ─── Auto-logout after 10 min inactivity ─────────────────────────────────────
function useAutoLogout(isLoggedIn, onLogout, minutes = 10) {
  const timer = useRef(null);
  const reset = useCallback(() => {
    clearTimeout(timer.current);
    if (isLoggedIn) {
      timer.current = setTimeout(() => {
        onLogout();
      }, minutes * 60 * 1000);
    }
  }, [isLoggedIn, onLogout, minutes]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const events = ['mousedown','mousemove','keydown','scroll','touchstart','click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start the timer
    return () => {
      clearTimeout(timer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isLoggedIn, reset]);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type="success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };
  const Toast = () => (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:t.type==="success"?T.grn:t.type==="error"?T.red:T.navy, color:"#fff", padding:"11px 18px", borderRadius:10, fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,.2)", maxWidth:320 }}>{t.msg}</div>
      ))}
    </div>
  );
  return { show, Toast };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, users, passwords }) {
  const [empId, setEmpId] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const doLogin = () => {
    const user = users.find(u => u.empId === empId.trim().toUpperCase() && u.active);
    if (!user) { setErr("Employee ID not found or account is inactive."); return; }
    if (passwords[empId.trim().toUpperCase()] !== pwd) { setErr("Incorrect password."); return; }
    onLogin(user);
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${T.navy} 0%, ${T.navyL} 60%, #1a4a6b 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, background:T.amber, borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:32, marginBottom:12 }}>✨</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#fff" }}>Benaka Enterprises</div>

        </div>

        <div style={{ background:T.card, borderRadius:20, padding:32 }}>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:4, color:T.txt }}>Sign in</div>
          <div style={{ fontSize:13, color:T.txt2, marginBottom:24 }}>Use your Employee ID and password</div>

          {err && <div style={{ background:T.redL, border:`1px solid ${T.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:T.red, marginBottom:16 }}>{err}</div>}

          <Input label="Employee ID" value={empId} onChange={v=>{setEmpId(v);setErr("")}} placeholder="e.g. SUP001" />
          <Input label="Password" type="password" value={pwd} onChange={v=>{setPwd(v);setErr("")}} placeholder="Your password" />

          <Btn onClick={doLogin} size="lg" style={{ width:"100%", justifyContent:"center" }}>Sign in →</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHELL / NAV
// ═══════════════════════════════════════════════════════════════════════════════
function Shell({ user, children, activePage, setActivePage, navItems, onLogout }) {
  const [sideOpen, setSideOpen] = useState(true);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:T.surf, fontFamily:"'Segoe UI', system-ui, sans-serif", color:T.txt }}>
      {/* Sidebar */}
      <div style={{ width:sideOpen?220:60, background:T.navy, flexShrink:0, display:"flex", flexDirection:"column", transition:"width .2s", overflow:"hidden" }}>
        {/* Brand */}
        <div style={{ padding:"20px 16px", borderBottom:`1px solid rgba(255,255,255,.1)` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, background:T.amber, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>✨</div>
            {sideOpen && <div><div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>Benaka Enterprises</div><div style={{ fontSize:10, color:"rgba(255,255,255,.5)" }}>BE</div></div>}
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={()=>setActivePage(item.id)} style={{
              display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 10px", borderRadius:8,
              border:"none", background:activePage===item.id?"rgba(232,160,32,.2)":"transparent",
              color:activePage===item.id?T.amber:"rgba(255,255,255,.7)",
              fontFamily:"inherit", fontSize:13, fontWeight:activePage===item.id?700:500,
              cursor:"pointer", marginBottom:2, transition:"all .15s", textAlign:"left"
            }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
              {sideOpen && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* User */}
        <div style={{ padding:"12px 10px", borderTop:`1px solid rgba(255,255,255,.1)` }}>
          {sideOpen && (
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.5)" }}>{ROLE_LABELS[user.role]} · {user.empId}</div>
            </div>
          )}
          <button onClick={onLogout} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.1)", border:"none", borderRadius:8, padding:"7px 10px", color:"rgba(255,255,255,.7)", fontSize:12, cursor:"pointer", width:"100%", fontFamily:"inherit" }}>
            <span>🚪</span>{sideOpen&&"Sign out"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Top bar */}
        <div style={{ background:T.card, borderBottom:`1px solid ${T.bdr}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={()=>setSideOpen(p=>!p)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:T.txt2 }}>☰</button>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:T.txt }}>{navItems.find(n=>n.id===activePage)?.label || "Dashboard"}</div>
              <div style={{ fontSize:11, color:T.txt3 }}>{fmtDate(today())}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Badge color={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
            <div style={{ width:32, height:32, background:T.navy, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:13, fontWeight:700 }}>{user.name[0]}</div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex:1, padding:24, overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPERVISOR PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function SupervisorPortal({ user, state, setState, toast }) {
  const [page, setPage] = useState("dashboard");
  const navItems = [
    { id:"dashboard",    icon:"🏠", label:"Dashboard" },
    { id:"attendance",   icon:"👥", label:"Mark Attendance" },
    { id:"report",       icon:"📋", label:"Daily Report" },
    { id:"collection",   icon:"📊", label:"Collection Report" },
    { id:"analysis",     icon:"📈", label:"Analysis" },
    { id:"staffleaves",  icon:"🗓️", label:"Staff Leaves" },
    { id:"feedback",     icon:"⭐", label:"Customer Feedback" },
    { id:"myleaves",     icon:"🌿", label:"My Leave" },
    { id:"history",      icon:"📁", label:"Report History" },
  ];

  const myStaff = state.users.filter(u => u.managerId === user.id && u.role === "field_staff" && u.active);
  const myCounter = state.counters.find(c => c.supervisorId === user.id);
  const todayReports = state.serviceReports.filter(r => r.supervisorId === user.id && r.date === today());
  const todayAtt = state.attendance.filter(a => a.supervisorId === user.id && a.date === today());
  const todayRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);

  return (
    <Shell user={user} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="dashboard" && <SupDashboard user={user} state={state} myStaff={myStaff} myCounter={myCounter} todayRevenue={todayRevenue} todayAtt={todayAtt} setPage={setPage}/>}
      {page==="attendance" && <SupAttendance user={user} state={state} setState={setState} myStaff={myStaff} toast={toast}/>}
      {page==="report" && <SupReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="myleaves" && <LeavePortal user={user} state={state} setState={setState} toast={toast} role="supervisor"/>}
      {page==="history"     && <SupHistory user={user} state={state}/>}
      {page==="feedback"    && <SupFeedback user={user} state={state}/>}
      {page==="collection"  && <SupCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"    && <CounterAnalysis user={user} state={state} counterFilter={myCounter?.name}/>}
      {page==="staffleaves" && <PlannedLeavePortal user={user} state={state} setState={setState} toast={toast} mode="executive"/>}
    </Shell>
  );
}

function SupDashboard({ user, state, myStaff, myCounter, todayRevenue, todayAtt, setPage }) {
  const presentToday = todayAtt.filter(a=>a.status==="present").length;
  const target = state.targets.find(t=>t.supervisorId===user.id && t.month===today().slice(0,7));
  const pct = target ? Math.min(100, Math.round(todayRevenue/target.dailyTarget*100)) : null;

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>Good morning, {user.name.split(" ")[0]} 👋</div>
        <div style={{ color:T.txt2, fontSize:14 }}>{myCounter?.name || "Your Counter"} · {fmtDate(today())}</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard label="Today's Revenue" value={fmtCurr(todayRevenue)} color={T.amber} icon="💰" sub={target?`Target: ${fmtCurr(target.dailyTarget)}`:"No target set"}/>
        <StatCard label="Staff Present" value={`${presentToday}/${myStaff.length}`} color={T.grn} icon="👥"/>
        <StatCard label="Reports Submitted" value={state.serviceReports.filter(r=>r.supervisorId===user.id&&r.date===today()).length} color={T.navy} icon="📋"/>
        {target && <StatCard label="Daily Target %" value={`${pct}%`} color={pct>=100?T.grn:pct>=70?T.amber:T.red} icon="🎯"/>}
      </div>

      {pct !== null && (
        <Card style={{ marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Today's Progress vs Target</div>
          <div style={{ height:10, background:T.surf, borderRadius:5, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:5, transition:"width .5s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12, color:T.txt2 }}>
            <span>{fmtCurr(todayRevenue)} earned</span><span>{fmtCurr(target.dailyTarget)} target</span>
          </div>
        </Card>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Staff Status Today</div>
          {myStaff.length === 0 ? <div style={{color:T.txt3,fontSize:13}}>No staff assigned</div> :
            myStaff.map(s => {
              const att = todayAtt.find(a=>a.staffId===s.id);
              return <div key={s.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${T.bdr}` }}>
                <span style={{fontSize:13}}>{s.name}</span>
                {att ? <Badge color={att.status==="present"?T.grn:T.red}>{att.status}</Badge> : <Badge color={T.txt3}>Not marked</Badge>}
              </div>;
            })
          }
          <Btn onClick={()=>setPage("attendance")} size="sm" variant="outline" style={{marginTop:10}}>Mark Attendance</Btn>
        </Card>
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Quick Actions</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <Btn onClick={()=>setPage("report")} style={{justifyContent:"center"}}>📋 Submit Daily Report</Btn>
            <Btn onClick={()=>setPage("attendance")} variant="outline" style={{justifyContent:"center"}}>👥 Mark Attendance</Btn>
            <Btn onClick={()=>setPage("myleaves")} variant="ghost" style={{justifyContent:"center"}}>🗓️ Request Leave</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SupCollectionReport({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const existing = state.collectionReports?.find(r=>r.supervisorId===user.id&&r.date===date);
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };
  return (
    <div>
      <Input label="Date" type="date" value={date} onChange={setDate} style={{maxWidth:200,marginBottom:16}}/>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={state.serviceReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

function SupFeedback({ user, state }) {
  const myCounter = state.counters.find(c => c.supervisorId === user.id);
  const fb = state.feedback
    .filter(f => f.counterId === myCounter?.id || f.counterName === myCounter?.name)
    .sort((a,b) => b.date.localeCompare(a.date));
  const avg = fb.length ? (fb.reduce((s,f)=>s+f.rating,0)/fb.length).toFixed(1) : "—";
  const feedbackLink = myCounter
    ? `${window.location.origin}${window.location.pathname}?feedback=${encodeURIComponent(myCounter.name)}`
    : "";

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Customer Feedback — {myCounter?.name}</div>

      {/* Link to share */}
      {myCounter && (
        <Card style={{ marginBottom:16, background:T.navyXL, border:`1px solid ${T.navy}22` }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.navy, marginBottom:8 }}>📎 Share this feedback link with customers</div>
          <div style={{ fontFamily:"monospace", fontSize:12, color:T.sky, background:"#fff", border:`1px solid ${T.bdr}`, borderRadius:8, padding:"10px 14px", wordBreak:"break-all", marginBottom:8 }}>
            {feedbackLink}
          </div>
          <div style={{ fontSize:12, color:T.txt2 }}>Send via WhatsApp · Print as QR code · Display at counter</div>
        </Card>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
        <div style={{ fontSize:32, fontWeight:800, color:T.amber }}>⭐ {avg}</div>
        <div style={{ fontSize:13, color:T.txt2 }}>{fb.length} feedback{fb.length!==1?"s":""} received</div>
      </div>

      {fb.length === 0
        ? <Card><div style={{ textAlign:"center", padding:24, color:T.txt3 }}>No feedback yet. Share the link above with customers after each service.</div></Card>
        : fb.map(f => (
          <Card key={f.id} style={{ marginBottom:10, borderLeft:`4px solid ${f.rating>=4?T.grn:f.rating===3?T.amber:T.red}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
              <div style={{ fontSize:16 }}>{"⭐".repeat(f.rating)}<span style={{ fontSize:12, color:T.txt2, marginLeft:6 }}>{fmtDate(f.date)} · {f.submittedAt||""}</span></div>
              <Badge color={f.rating>=4?T.grn:f.rating===3?T.amber:T.red}>{f.rating}/5</Badge>
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:6 }}>
              {f.vehicleNo && <span style={{ fontSize:12 }}><b>{f.vehicleNo}</b></span>}
              {f.serviceType && <span style={{ fontSize:12, color:T.txt2 }}>{f.serviceType}</span>}
              {f.customerName && <span style={{ fontSize:12, color:T.txt2 }}>{f.customerName}</span>}
            </div>
            {f.comment && <div style={{ fontSize:13, background:T.surf, padding:"7px 11px", borderRadius:7 }}>"{f.comment}"</div>}
          </Card>
        ))
      }
    </div>
  );
}

function SupAttendance({ user, state, setState, myStaff, toast }) {
  const [date, setDate] = useState(today());
  const [records, setRecords] = useState({});
  const [reasons, setReasons] = useState({});

  useEffect(() => {
    const existing = {};
    const existingR = {};
    state.attendance.filter(a=>a.supervisorId===user.id&&a.date===date).forEach(a=>{
      existing[a.staffId] = a.status;
      existingR[a.staffId] = a.reason||"";
    });
    setRecords(existing);
    setReasons(existingR);
  }, [date, state.attendance, user.id]);

  const save = () => {
    const newAtts = myStaff.map(s => ({
      id: `att_${user.id}_${s.id}_${date}`,
      date, supervisorId:user.id, staffId:s.id,
      status: records[s.id]||"present",
      reason: reasons[s.id]||"",
      markedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
    }));
    setState(p => ({
      ...p,
      attendance: [
        ...p.attendance.filter(a=>!(a.supervisorId===user.id&&a.date===date)),
        ...newAtts
      ]
    }));
    toast.show("Attendance saved for " + date);
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Mark Attendance</div>
      <Card style={{ maxWidth:600 }}>
        <Input label="Date" type="date" value={date} onChange={setDate}/>
        {myStaff.length === 0 ? <div style={{color:T.txt3}}>No field staff assigned to you.</div> :
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 160px 1fr", gap:8, padding:"8px 0", borderBottom:`1px solid ${T.bdr}`, marginBottom:8 }}>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Staff Member</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Status</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Reason (if absent)</div>
            </div>
            {myStaff.map(s => (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 160px 1fr", gap:8, alignItems:"center", marginBottom:10 }}>
                <div style={{fontSize:14,fontWeight:600}}>{s.name}</div>
                <div style={{ display:"flex", gap:8 }}>
                  {["present","absent","half_day"].map(st=>(
                    <button key={st} onClick={()=>setRecords(p=>({...p,[s.id]:st}))} style={{
                      padding:"5px 10px", borderRadius:6, border:`1px solid ${records[s.id]===st?(st==="present"?T.grn:st==="absent"?T.red:T.amber):T.bdrS}`,
                      background:records[s.id]===st?(st==="present"?T.grnL:st==="absent"?T.redL:T.amberL):"transparent",
                      color:records[s.id]===st?(st==="present"?T.grn:st==="absent"?T.red:T.amberD):T.txt2,
                      fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                    }}>{st==="half_day"?"½ Day":st.charAt(0).toUpperCase()+st.slice(1)}</button>
                  ))}
                </div>
                <input value={reasons[s.id]||""} onChange={e=>setReasons(p=>({...p,[s.id]:e.target.value}))}
                  placeholder={records[s.id]==="absent"?"Reason required":"Optional note"}
                  style={{ padding:"6px 10px", border:`1px solid ${T.bdrS}`, borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none", background:records[s.id]==="absent"?T.redL:"#fff" }}
                />
              </div>
            ))}
            <Btn onClick={save} style={{marginTop:12}}>Save Attendance</Btn>
          </div>
        }
      </Card>
    </div>
  );
}

function SupReport({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const [reportCounters, setReportCounters] = useState([]);
  const [notes, setNotes] = useState("");

  // All counters this supervisor manages
  const myCounters = state.counters.filter(c => c.supervisorId === user.id);
  // Also include any counter named in user profile
  const supervisorCounterNames = myCounters.map(c=>c.name);

  const existing = state.serviceReports.find(r => r.supervisorId === user.id && r.date === date);

  // Default work type rows — all from master list with 0 vehicles
  const blankRows = () => state.workTypes.map(wt => ({
    workTypeId: wt.id, workTypeName: wt.name, vehicles: 0, rate: wt.defaultRate, amount: 0
  }));

  useEffect(() => {
    if (existing) {
      setReportCounters(existing.counters || []);
      setNotes(existing.notes || "");
    } else {
      // Pre-load all assigned counters with blank rows
      const preloaded = myCounters.map(c => ({ counterName: c.name, entries: blankRows() }));
      setReportCounters(preloaded.length ? preloaded : [{ counterName: "", entries: blankRows() }]);
      setNotes("");
    }
  }, [date, state.workTypes.length]);

  const updateEntry = (ci, ei, field, val) => {
    setReportCounters(p => {
      const n = p.map((c,idx) => idx !== ci ? c : {
        ...c, entries: c.entries.map((e, eidx) => {
          if (eidx !== ei) return e;
          const updated = { ...e, [field]: field === "workTypeName" ? val : Number(val) };
          if (field === "vehicles" || field === "rate") updated.amount = (Number(updated.vehicles)||0) * (Number(updated.rate)||0);
          return updated;
        })
      });
      return n;
    });
  };

  const addCounterBlock = () => setReportCounters(p => [...p, { counterName: "", entries: blankRows() }]);
  const removeCounterBlock = (ci) => setReportCounters(p => p.filter((_,i)=>i!==ci));
  const setCounterName = (ci, name) => setReportCounters(p => p.map((c,i)=>i===ci?{...c,counterName:name}:c));

  const addRow = (ci) => setReportCounters(p => p.map((c,i)=>i===ci?{...c,entries:[...c.entries,{workTypeId:"",workTypeName:"",vehicles:0,rate:0,amount:0}]}:c));
  const removeRow = (ci, ei) => setReportCounters(p => p.map((c,i)=>i!==ci?c:{...c,entries:c.entries.filter((_,j)=>j!==ei)}));

  const grandTotal = reportCounters.reduce((s,c)=>s+c.entries.reduce((ss,e)=>ss+(Number(e.amount)||0),0),0);
  const counterTotal = (c) => c.entries.reduce((s,e)=>s+(Number(e.amount)||0),0);

  const submit = () => {
    if (reportCounters.some(c=>!c.counterName.trim())) { toast.show("All counter names must be filled","error"); return; }
    const report = {
      id: existing?.id || `sr_${Date.now()}`,
      date, supervisorId: user.id,
      submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      counters: reportCounters,
      totalAmount: grandTotal,
      notes, status: "submitted"
    };
    setState(p => ({ ...p, serviceReports: [...p.serviceReports.filter(r=>r.id!==report.id), report] }));
    toast.show(existing ? "Report updated" : "Vehicle report submitted successfully");
  };

  const printReport = () => {
    const w = window.open("","_blank");
    const rows = reportCounters.flatMap((c,ci) =>
      c.entries.map((e,ei) => `<tr>
        ${ei===0?`<td rowspan="${c.entries.length}" style="border:1px solid #000;padding:4px 8px;font-weight:700;vertical-align:top">${ci+1}</td>
                  <td rowspan="${c.entries.length}" style="border:1px solid #000;padding:4px 8px;font-weight:700;vertical-align:top">${c.counterName}</td>`:""}
        <td style="border:1px solid #000;padding:4px 8px">${e.workTypeName}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:center">${e.vehicles}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:center">${e.rate}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right">${e.amount}</td>
      </tr>`)
    ).join("");
    w.document.write(`<html><head><title>Vehicle Report - ${date}</title>
    <style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}h2,h3{text-align:center;margin:4px 0}</style></head>
    <body><h2>VEHICLE REPORT</h2><h3>Date: ${date.split("-").reverse().join("-")}</h3><br>
    <table><thead><tr>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">Sl.No</th>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">COUNTER'S NAME</th>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">WORK</th>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">No's of Veh</th>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">RATE</th>
      <th style="border:1px solid #000;padding:6px;background:#f0f0f0">AMOUNT</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5" style="border:1px solid #000;padding:6px;text-align:right;font-weight:700">GRAND TOTAL</td>
    <td style="border:1px solid #000;padding:6px;text-align:right;font-weight:700">₹${grandTotal.toLocaleString("en-IN")}</td></tr></tfoot>
    </table></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Vehicle Report</div>
          <div style={{ fontSize:13, color:T.txt2 }}>Daily service report — all counters</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {existing && <Badge color={T.grn}>Submitted — editing</Badge>}
          <Btn onClick={printReport} variant="ghost" size="sm">🖨 Print / PDF</Btn>
          <Btn onClick={submit} variant="amber">{existing ? "Update Report" : "Submit Report"}</Btn>
        </div>
      </div>

      {/* Work type legend */}
      <div style={{ display:"flex", gap:8, marginBottom:12, fontSize:12 }}>
        <Badge color={T.navy}>Service work types</Badge>
        <Badge color={T.grn}>Sales / Products</Badge>
        <span style={{color:T.txt3}}>— rates are editable per entry</span>
      </div>
      {/* Header row */}
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>
          <Input label="Date" type="date" value={date} onChange={setDate} style={{ maxWidth:180 }}/>
          <div style={{ flex:1 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>Notes / Remarks</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any notes for today..."
              style={{ width:"100%", padding:"9px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none" }}/>
          </div>
        </div>
      </Card>

      {/* Counter blocks */}
      {reportCounters.map((counter, ci) => (
        <Card key={ci} style={{ marginBottom:16, borderTop:`3px solid ${T.amber}` }}>
          {/* Counter header */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ width:28, height:28, background:T.navy, color:"#fff", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>{ci+1}</div>
            <div style={{ flex:1, minWidth:200 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Counter Name</label>
              <div style={{ display:"flex", gap:8 }}>
                <select value={counter.counterName} onChange={e=>setCounterName(ci,e.target.value)}
                  style={{ flex:1, padding:"7px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  <option value="">Select counter...</option>
                  {state.counters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <input value={counter.counterName} onChange={e=>setCounterName(ci,e.target.value)} placeholder="Or type name"
                  style={{ flex:1, padding:"7px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              </div>
            </div>
            <div style={{ marginLeft:"auto", textAlign:"right" }}>
              <div style={{ fontSize:11, color:T.txt2, fontWeight:700, textTransform:"uppercase" }}>Counter Total</div>
              <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>₹{counterTotal(counter).toLocaleString("en-IN")}</div>
            </div>
            {reportCounters.length > 1 && (
              <button onClick={()=>removeCounterBlock(ci)} style={{ background:"none", border:"none", cursor:"pointer", color:T.red, fontSize:18, padding:4, flexShrink:0 }}>🗑</button>
            )}
          </div>

          {/* Entries table */}
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:T.surf }}>
                  <th style={{ padding:"8px 10px", textAlign:"left", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", minWidth:180 }}>WORK TYPE</th>
                  <th style={{ padding:"8px 10px", textAlign:"center", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", width:90 }}>No. of Veh</th>
                  <th style={{ padding:"8px 10px", textAlign:"center", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", width:100 }}>Rate (₹)</th>
                  <th style={{ padding:"8px 10px", textAlign:"right", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", width:110 }}>Amount (₹)</th>
                  <th style={{ padding:"8px 10px", border:`1px solid ${T.bdr}`, width:36 }}></th>
                </tr>
              </thead>
              <tbody>
                {counter.entries.map((e, ei) => (
                  <tr key={ei} style={{ background: e.vehicles > 0 ? "#FFFDF7" : "#fff" }}>
                    <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <select value={e.workTypeId} onChange={ev=>{
                          const wt = state.workTypes.find(w=>w.id===ev.target.value);
                          if(wt) {
                            updateEntry(ci,ei,"workTypeName",wt.name);
                            setTimeout(()=>updateEntry(ci,ei,"workTypeId",ev.target.value),0);
                            // set rate too
                            setReportCounters(p=>p.map((c,ci2)=>ci2!==ci?c:{...c,entries:c.entries.map((row,ei2)=>ei2!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name,rate:wt.defaultRate,amount:(row.vehicles||0)*wt.defaultRate})}));
                          }
                        }}
                        style={{ flex:1, padding:"4px 6px", border:`1px solid ${T.bdrS}`, borderRadius:5, fontSize:12, fontFamily:"inherit", outline:"none" }}>
                          <option value="">Pick type...</option>
                          {state.workTypes.map(wt=><option key={wt.id} value={wt.id}>{wt.name}</option>)}
                        </select>
                        <input value={e.workTypeName} onChange={ev=>updateEntry(ci,ei,"workTypeName",ev.target.value)} placeholder="Custom"
                          style={{ flex:1, padding:"4px 6px", border:`1px solid ${T.bdrS}`, borderRadius:5, fontSize:12, fontFamily:"inherit", outline:"none", minWidth:80 }}/>
                      </div>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px", textAlign:"center" }}>
                      <input type="number" value={e.vehicles} onChange={ev=>updateEntry(ci,ei,"vehicles",ev.target.value)} min={0}
                        style={{ width:"100%", padding:"4px 6px", border:`1px solid ${e.vehicles>0?T.amber:T.bdrS}`, borderRadius:5, fontSize:13, fontFamily:"inherit", outline:"none", textAlign:"center", fontWeight:e.vehicles>0?700:400, background:e.vehicles>0?T.amberL:"#fff" }}/>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px", textAlign:"center" }}>
                      <input type="number" value={e.rate} onChange={ev=>updateEntry(ci,ei,"rate",ev.target.value)} min={0}
                        style={{ width:"100%", padding:"4px 6px", border:`1px solid ${T.bdrS}`, borderRadius:5, fontSize:13, fontFamily:"inherit", outline:"none", textAlign:"center" }}/>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 12px", textAlign:"right", fontWeight:700, color:e.amount>0?T.navy:T.txt3, fontSize:13 }}>
                      {e.amount > 0 ? e.amount.toLocaleString("en-IN") : "0"}
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`, padding:"4px", textAlign:"center" }}>
                      <button onClick={()=>removeRow(ci,ei)} style={{ background:"none", border:"none", cursor:"pointer", color:T.red, fontSize:14, lineHeight:1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:T.navyXL }}>
                  <td colSpan={3} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, fontSize:13, color:T.navy, textAlign:"right" }}>COUNTER TOTAL</td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 12px", fontWeight:800, fontSize:14, color:T.amber, textAlign:"right" }}>
                    {counterTotal(counter).toLocaleString("en-IN")}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}` }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ marginTop:10 }}>
            <Btn onClick={()=>addRow(ci)} size="sm" variant="ghost">+ Add Work Type Row</Btn>
          </div>
        </Card>
      ))}

      {/* Add counter + Grand total */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginTop:8 }}>
        <Btn onClick={addCounterBlock} variant="outline">+ Add Another Counter</Btn>
        <div style={{ background:T.navy, padding:"14px 24px", borderRadius:10, textAlign:"right", color:"#fff" }}>
          <div style={{ fontSize:11, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".05em" }}>Grand Total — All Counters</div>
          <div style={{ fontSize:26, fontWeight:800, color:T.amber, marginTop:2 }}>₹{grandTotal.toLocaleString("en-IN")}</div>
        </div>
      </div>
    </div>
  );
}


function SupHistory({ user, state }) {
  const myReports = state.serviceReports.filter(r=>r.supervisorId===user.id).sort((a,b)=>b.date.localeCompare(a.date));
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Report History</div>
      {myReports.length === 0 ? <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports submitted yet</div></Card> :
        myReports.map(r => (
          <Card key={r.id} style={{ marginBottom:12, cursor:"pointer" }} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontWeight:700 }}>{fmtDate(r.date)}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{(r.counters||[]).length} counter(s) · Submitted {r.submittedAt}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</div>
                <Badge color={T.grn}>Submitted</Badge>
              </div>
            </div>
            {expanded===r.id && (
              <div style={{ marginTop:14, borderTop:`1px solid ${T.bdr}`, paddingTop:14 }}>
                {(r.counters||[]).map((c,ci)=>(
                  <div key={ci} style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:T.navy }}>📍 {c.counterName}</div>
                    <Table cols={[
                      {key:"workTypeName",label:"Work"},
                      {key:"vehicles",label:"Vehicles"},
                      {key:"rate",label:"Rate",render:e=>fmtCurr(e.rate)},
                      {key:"amount",label:"Amount",render:e=><b>{fmtCurr(e.amount)}</b>},
                    ]} rows={c.entries.filter(e=>e.vehicles>0)}/>
                  </div>
                ))}
                {r.notes && <div style={{marginTop:8,fontSize:13,color:T.txt2}}>📝 {r.notes}</div>}
              </div>
            )}
          </Card>
        ))
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LEAVE PORTAL (shared)
// ═══════════════════════════════════════════════════════════════════════════════
function LeavePortal({ user, state, setState, toast }) {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [type, setType] = useState("sick");
  const [reason, setReason] = useState("");
  const myLeaves = state.leaves.filter(l=>l.userId===user.id).sort((a,b)=>b.date.localeCompare(a.date));
  const manager = state.users.find(u=>u.id===user.managerId);

  const submit = () => {
    if (!reason.trim()) { toast.show("Please provide a reason","error"); return; }
    if (!manager) { toast.show("No manager assigned","error"); return; }
    const leave = { id:`l_${Date.now()}`, userId:user.id, role:user.role, date:from, toDate:to, type, reason, status:"pending", approverId:manager.id, submittedAt:new Date().toISOString() };
    setState(p=>({...p, leaves:[...p.leaves, leave]}));
    toast.show("Leave request submitted to " + manager.name);
    setReason("");
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Leave Requests</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>New Request</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Input label="From" type="date" value={from} onChange={setFrom}/>
            <Input label="To" type="date" value={to} onChange={setTo}/>
          </div>
          <Select label="Type" value={type} onChange={setType} options={[{value:"sick",label:"Sick Leave"},{value:"personal",label:"Personal Leave"},{value:"casual",label:"Casual Leave"}]}/>
          <Input label="Reason" value={reason} onChange={setReason} placeholder="Reason for leave..." required/>
          {manager && <div style={{fontSize:12,color:T.txt2,marginBottom:12}}>Will be sent to: <b>{manager.name}</b></div>}
          <Btn onClick={submit}>Submit Request</Btn>
        </Card>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>My Leave History</div>
          {myLeaves.length===0 ? <div style={{color:T.txt3,fontSize:13}}>No requests yet</div> :
            myLeaves.map(l => (
              <div key={l.id} style={{ padding:"10px 0", borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700}}>{fmtDate(l.date)}{l.toDate!==l.date?` → ${fmtDate(l.toDate)}`:""}</div>
                    <div style={{fontSize:12,color:T.txt2}}>{l.type} · {l.reason}</div>
                  </div>
                  <Badge color={l.status==="approved"?T.grn:l.status==="rejected"?T.red:T.amber}>{l.status}</Badge>
                </div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MANAGER PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function ManagerPortal({ user, state, setState, toast }) {
  const [page, setPage] = useState("dashboard");
  const navItems = [
    { id:"dashboard",   icon:"🏠", label:"Dashboard" },
    { id:"collection",  icon:"📊", label:"Collection Report" },
    { id:"analysis",    icon:"📈", label:"Counter Analysis" },
    { id:"reports",     icon:"📋", label:"Reports" },
    { id:"leaves",      icon:"✅", label:"Leave Approvals" },
    { id:"people",      icon:"👥", label:"People & Counters" },
    { id:"salary",      icon:"💰", label:"Salary & P&L" },
    { id:"targets",     icon:"🎯", label:"Set Targets" },
    { id:"feedback",    icon:"💬", label:"Feedback" },
    { id:"myleaves",    icon:"🌿", label:"My Leave" },
  ];

  const mySupervisors = state.users.filter(u=>u.managerId===user.id&&u.role==="supervisor"&&u.active);
  const myCounters = state.counters.filter(c=>mySupervisors.some(s=>s.id===c.supervisorId));

  return (
    <Shell user={user} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="dashboard" && <MgrDashboard user={user} state={state} mySupervisors={mySupervisors} myCounters={myCounters} setPage={setPage}/>}
      {page==="reports"   && <MgrReports user={user} state={state} mySupervisors={mySupervisors} myCounters={myCounters}/>}
      {page==="leaves"    && <MgrLeaves user={user} state={state} setState={setState} toast={toast}/>}
      {page==="people"    && <MgrPeople user={user} state={state} setState={setState} toast={toast}/>}
      {page==="targets"    && <MgrTargets user={user} state={state} setState={setState} mySupervisors={mySupervisors} toast={toast}/>}
      {page==="feedback"   && <MgrFeedback user={user} state={state} myCounters={myCounters}/>}
      {page==="myleaves"   && <LeavePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="collection" && <MgrCollectionReport user={user} state={state} setState={setState} toast={toast} mySupervisors={mySupervisors}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state} counterFilter={null}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
    </Shell>
  );
}

function MgrCollectionReport({ user, state, setState, toast, mySupervisors }) {
  const [date, setDate] = useState(today());
  const existing = state.collectionReports?.find(r=>r.date===date&&mySupervisors.some(s=>s.id===r.supervisorId));
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };
  return (
    <div>
      <Input label="Date" type="date" value={date} onChange={setDate} style={{maxWidth:200,marginBottom:16}}/>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={state.serviceReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

function MgrDashboard({ user, state, mySupervisors, myCounters, setPage }) {
  const today_ = today();
  const todayReports = state.serviceReports.filter(r=>r.date===today_&&mySupervisors.some(s=>s.id===r.supervisorId));
  const totalRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);
  const pendingLeaves = state.leaves.filter(l=>l.approverId===user.id&&l.status==="pending").length;
  const month = today_.slice(0,7);
  const monthReports = state.serviceReports.filter(r=>r.date.startsWith(month)&&mySupervisors.some(s=>s.id===r.supervisorId));
  const monthRevenue = monthReports.reduce((s,r)=>s+r.totalAmount,0);

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>Operations Overview</div>
        <div style={{ color:T.txt2 }}>{mySupervisors.length} supervisors · {myCounters.length} counters</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard label="Today's Revenue" value={fmtCurr(totalRevenue)} color={T.amber} icon="💰" trend={8}/>
        <StatCard label="Month Revenue" value={fmtCurr(monthRevenue)} color={T.navy} icon="📅"/>
        <StatCard label="Active Counters" value={myCounters.length} color={T.grn} icon="🏪"/>
        <StatCard label="Pending Leaves" value={pendingLeaves} color={pendingLeaves>0?T.red:T.grn} icon="✅"/>
        <StatCard label="Reports Today" value={`${todayReports.length}/${mySupervisors.length}`} color={todayReports.length===mySupervisors.length?T.grn:T.amber} icon="📋"/>
      </div>

      {/* Counter Revenue Grid */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Counter Performance — Today</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
          {myCounters.map(c => {
            const rep = todayReports.find(r=>r.supervisorId===c.supervisorId);
            const sup = mySupervisors.find(s=>s.id===c.supervisorId);
            const tgt = state.targets.find(t=>t.counterId===c.id&&t.month===month);
            const pct = tgt ? Math.min(100,Math.round((rep?.totalAmount||0)/tgt.dailyTarget*100)) : null;
            return (
              <div key={c.id} style={{ border:`1px solid ${T.bdr}`, borderRadius:10, padding:14 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{c.name}</div>
                <div style={{ fontSize:11, color:T.txt2, marginBottom:8 }}>Sup: {sup?.name}</div>
                <div style={{ fontSize:20, fontWeight:800, color:T.amber }}>{fmtCurr(rep?.totalAmount||0)}</div>
                {tgt && <>
                  <div style={{ height:6, background:T.surf, borderRadius:3, margin:"8px 0 4px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:11, color:T.txt2 }}>{pct}% of {fmtCurr(tgt.dailyTarget)} target</div>
                </>}
                {!rep && <div style={{ fontSize:11, color:T.red, marginTop:4 }}>⚠ No report yet</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {pendingLeaves > 0 && (
        <div style={{ background:T.amberL, border:`1px solid ${T.amber}44`, borderRadius:10, padding:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, color:T.amberD, fontWeight:600 }}>⚠ {pendingLeaves} leave request(s) awaiting your approval</div>
          <Btn onClick={()=>setPage("leaves")} size="sm" variant="amber">Review Now</Btn>
        </div>
      )}
    </div>
  );
}

function MgrReports({ user, state, mySupervisors, myCounters }) {
  const [tab, setTab] = useState("daily");
  const [selDate, setSelDate] = useState(today());
  const [selMonth, setSelMonth] = useState(today().slice(0,7));

  const relevantReports = state.serviceReports.filter(r=>mySupervisors.some(s=>s.id===r.supervisorId));
  const dailyReports = relevantReports.filter(r=>r.date===selDate);
  const monthReports = relevantReports.filter(r=>r.date.startsWith(selMonth));

  const dailyTotal = dailyReports.reduce((s,r)=>s+r.totalAmount,0);
  const monthTotal = monthReports.reduce((s,r)=>s+r.totalAmount,0);

  // Revenue by work type
  const wtRevenue = {};
  relevantReports.forEach(r=>reportAllEntries(r).forEach(e=>{
    wtRevenue[e.workTypeName] = (wtRevenue[e.workTypeName]||0)+e.amount;
  }));
  const wtArr = Object.entries(wtRevenue).sort((a,b)=>b[1]-a[1]);
  const maxWt = wtArr[0]?.[1]||1;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Reports & Analytics</div>
      <Tabs tabs={[{id:"daily",label:"Daily View"},{id:"monthly",label:"Monthly"},{id:"analysis",label:"Analysis"}]} active={tab} onChange={setTab}/>

      {tab==="daily" && (
        <div>
          <Input label="Select Date" type="date" value={selDate} onChange={setSelDate} style={{ maxWidth:200 }}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
            <StatCard label="Total Revenue" value={fmtCurr(dailyTotal)} color={T.amber}/>
            <StatCard label="Reports In" value={`${dailyReports.length}/${myCounters.length}`} color={T.navy}/>
            <StatCard label="Vehicles Serviced" value={dailyReports.reduce((s,r)=>s+reportVehicles(r),0)} color={T.grn}/>
          </div>
          <Table cols={[
            {key:"counter",label:"Counters",render:r=>reportCounterNames(r)},
            {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name},
            {key:"vehicles",label:"Vehicles",render:r=>reportVehicles(r)},
            {key:"totalAmount",label:"Revenue",render:r=><b style={{color:T.amber}}>{fmtCurr(r.totalAmount)}</b>},
            {key:"submittedAt",label:"Submitted"},
            {key:"status",label:"Status",render:r=><Badge color={T.grn}>{r.status}</Badge>},
          ]} rows={dailyReports} emptyMsg="No reports for this date"/>
        </div>
      )}

      {tab==="monthly" && (
        <div>
          <Input label="Select Month" type="month" value={selMonth} onChange={setSelMonth} style={{ maxWidth:200 }}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
            <StatCard label="Month Revenue" value={fmtCurr(monthTotal)} color={T.amber}/>
            <StatCard label="Reports" value={monthReports.length} color={T.navy}/>
            <StatCard label="Working Days" value={new Set(monthReports.map(r=>r.date)).size} color={T.grn}/>
          </div>
          {/* Per-counter monthly breakdown */}
          <Card style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Revenue by Counter</div>
            {myCounters.map(c=>{
              const cr = monthReports.filter(r=>r.supervisorId===c.supervisorId).reduce((s,r)=>s+r.totalAmount,0);
              const tgt = state.targets.find(t=>t.counterId===c.id&&t.month===selMonth)||state.targets.find(t=>t.supervisorId===c.supervisorId&&t.month===selMonth);
              const pct = tgt ? Math.min(100,Math.round(cr/tgt.monthlyTarget*100)) : null;
              return (
                <div key={c.id} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{c.name}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:T.amber }}>{fmtCurr(cr)}{tgt?` / ${fmtCurr(tgt.monthlyTarget)}`:""}</span>
                  </div>
                  {tgt && <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:4 }}/>
                  </div>}
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab==="analysis" && (
        <div>
          <Card style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>Revenue by Work Type (All Time)</div>
            {wtArr.map(([name, rev]) => (
              <div key={name} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:13 }}>{name}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.navy }}>{fmtCurr(rev)}</span>
                </div>
                <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${rev/maxWt*100}%`, background:T.amber, borderRadius:4 }}/>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Attendance Summary (Today)</div>
            {mySupervisors.map(s=>{
              const staff = state.users.filter(u=>u.managerId===s.id&&u.role==="field_staff");
              const att = state.attendance.filter(a=>a.supervisorId===s.id&&a.date===today());
              const present = att.filter(a=>a.status==="present").length;
              return <div key={s.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
                <span style={{ fontSize:13 }}>{s.name} · {s.counter}</span>
                <span style={{ fontSize:13, fontWeight:600, color:present===staff.length?T.grn:T.amber }}>{present}/{staff.length} present</span>
              </div>;
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

function MgrLeaves({ user, state, setState, toast }) {
  const pending = state.leaves.filter(l=>l.approverId===user.id&&l.status==="pending");
  const all = state.leaves.filter(l=>l.approverId===user.id);

  const decide = (id, status) => {
    setState(p=>({ ...p, leaves: p.leaves.map(l=>l.id===id?{...l,status,decidedAt:new Date().toISOString()}:l) }));
    toast.show(status==="approved"?"Leave approved":"Leave rejected");
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Leave Approvals</div>
      {pending.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:T.red }}>⏳ Pending ({pending.length})</div>
          {pending.map(l => {
            const applicant = state.users.find(u=>u.id===l.userId);
            return (
              <Card key={l.id} style={{ marginBottom:12, borderLeft:`4px solid ${T.amber}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{applicant?.name}</div>
                    <div style={{ fontSize:12, color:T.txt2 }}>{ROLE_LABELS[applicant?.role]} · {l.type}</div>
                    <div style={{ fontSize:13, margin:"4px 0" }}>{fmtDate(l.date)}{l.toDate!==l.date?` → ${fmtDate(l.toDate)}`:""}</div>
                    <div style={{ fontSize:13, color:T.txt2 }}>"{l.reason}"</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn onClick={()=>decide(l.id,"approved")} variant="success" size="sm">✓ Approve</Btn>
                    <Btn onClick={()=>decide(l.id,"rejected")} variant="danger" size="sm">✗ Reject</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>All Requests</div>
      <Table cols={[
        {key:"name",label:"Staff",render:r=>state.users.find(u=>u.id===r.userId)?.name},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[state.users.find(u=>u.id===r.userId)?.role]||T.navy}>{ROLE_LABELS[state.users.find(u=>u.id===r.userId)?.role]}</Badge>},
        {key:"date",label:"Date",render:r=>fmtDate(r.date)},
        {key:"type",label:"Type",render:r=>r.type},
        {key:"reason",label:"Reason"},
        {key:"status",label:"Status",render:r=><Badge color={r.status==="approved"?T.grn:r.status==="rejected"?T.red:T.amber}>{r.status}</Badge>},
      ]} rows={all}/>
    </div>
  );
}

function MgrPeople({ user, state, setState, toast }) {
  const [tab, setTab] = useState("supervisors");
  const mySups = state.users.filter(u=>u.managerId===user.id&&u.role==="supervisor");

  const allStaff = mySups.flatMap(s=>
    state.users.filter(u=>u.managerId===s.id&&u.role==="field_staff").map(sf=>({...sf, supervisorName:s.name, counter:s.counter}))
  );

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>People & Counters</div>
      <Tabs tabs={[{id:"supervisors",label:"Supervisors"},{id:"fieldstaff",label:"Field Staff"},{id:"counters",label:"Counters"}]} active={tab} onChange={setTab}/>

      {tab==="supervisors" && (
        <Table cols={[
          {key:"empId",label:"ID"},
          {key:"name",label:"Name",render:r=><b>{r.name}</b>},
          {key:"counter",label:"Counter"},
          {key:"phone",label:"Phone"},
          {key:"staff",label:"Field Staff",render:r=>state.users.filter(u=>u.managerId===r.id&&u.role==="field_staff").length+" staff"},
          {key:"status",label:"Status",render:r=><Badge color={r.active?T.grn:T.red}>{r.active?"Active":"Inactive"}</Badge>},
        ]} rows={mySups}/>
      )}

      {tab==="fieldstaff" && (
        <Table cols={[
          {key:"empId",label:"ID"},
          {key:"name",label:"Name",render:r=><b>{r.name}</b>},
          {key:"supervisorName",label:"Executive"},
          {key:"counter",label:"Counter"},
          {key:"phone",label:"Phone"},
          {key:"status",label:"Status",render:r=><Badge color={r.active?T.grn:T.red}>{r.active?"Active":"Inactive"}</Badge>},
        ]} rows={allStaff}/>
      )}

      {tab==="counters" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
          {state.counters.filter(c=>mySups.some(s=>s.id===c.supervisorId)).map(c=>{
            const sup = state.users.find(u=>u.id===c.supervisorId);
            const staff = state.users.filter(u=>u.managerId===c.supervisorId&&u.role==="field_staff");
            return (
              <Card key={c.id}>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:6 }}>{c.name}</div>
                <div style={{ fontSize:12, color:T.txt2, marginBottom:10 }}>{c.dealership} · {c.city}</div>
                <div style={{ fontSize:13, marginBottom:4 }}>👤 Supervisor: <b>{sup?.name}</b></div>
                <div style={{ fontSize:13 }}>👥 Field Staff: <b>{staff.length}</b></div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MgrTargets({ user, state, setState, mySupervisors, toast }) {
  const [month, setMonth] = useState(today().slice(0,7));
  const [editing, setEditing] = useState(null);
  const [daily, setDaily] = useState("");
  const [monthly, setMonthly] = useState("");

  const startEdit = (sup) => {
    const existing = state.targets.find(t=>t.supervisorId===sup.id&&t.month===month);
    setEditing(sup.id);
    setDaily(existing?.dailyTarget||"");
    setMonthly(existing?.monthlyTarget||"");
  };

  const save = (sup) => {
    const counter = state.counters.find(c=>c.supervisorId===sup.id);
    const tgt = { id:`t_${sup.id}_${month}`, counterId:counter?.id, supervisorId:sup.id, month, dailyTarget:Number(daily), monthlyTarget:Number(monthly), setBy:user.id };
    setState(p=>({ ...p, targets:[...p.targets.filter(t=>!(t.supervisorId===sup.id&&t.month===month)), tgt] }));
    toast.show("Target saved for " + sup.name);
    setEditing(null);
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Set Targets</div>
      <Input label="Month" type="month" value={month} onChange={setMonth} style={{ maxWidth:200 }}/>
      {mySupervisors.map(s => {
        const existing = state.targets.find(t=>t.supervisorId===s.id&&t.month===month);
        return (
          <Card key={s.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontWeight:700 }}>{s.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{s.counter}</div>
              </div>
              {editing===s.id ? (
                <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:T.txt2,display:"block",marginBottom:3}}>DAILY TARGET (₹)</label>
                    <input value={daily} onChange={e=>setDaily(e.target.value)} type="number" style={{padding:"7px 10px",border:`1px solid ${T.bdrS}`,borderRadius:7,fontSize:13,fontFamily:"inherit",width:130}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:T.txt2,display:"block",marginBottom:3}}>MONTHLY TARGET (₹)</label>
                    <input value={monthly} onChange={e=>setMonthly(e.target.value)} type="number" style={{padding:"7px 10px",border:`1px solid ${T.bdrS}`,borderRadius:7,fontSize:13,fontFamily:"inherit",width:140}}/>
                  </div>
                  <Btn onClick={()=>save(s)} variant="success" size="sm">Save</Btn>
                  <Btn onClick={()=>setEditing(null)} variant="ghost" size="sm">Cancel</Btn>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  {existing ? (
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13 }}>Daily: <b>{fmtCurr(existing.dailyTarget)}</b></div>
                      <div style={{ fontSize:13 }}>Monthly: <b>{fmtCurr(existing.monthlyTarget)}</b></div>
                    </div>
                  ) : <div style={{ fontSize:12, color:T.txt3 }}>No target set</div>}
                  <Btn onClick={()=>startEdit(s)} size="sm" variant="outline">Edit</Btn>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MgrFeedback({ user, state, myCounters }) {
  const [selCounter, setSelCounter] = useState("all");
  const [selDate, setSelDate] = useState("");

  let fb = state.feedback.filter(f => myCounters.some(c => c.id === f.counterId || c.name === f.counterName));
  if (selCounter !== "all") fb = fb.filter(f => f.counterId === selCounter || f.counterName === state.counters.find(c=>c.id===selCounter)?.name);
  if (selDate) fb = fb.filter(f => f.date === selDate);
  fb = [...fb].sort((a,b) => b.date.localeCompare(a.date));

  const avg = fb.length ? (fb.reduce((s,f)=>s+f.rating,0)/fb.length).toFixed(1) : "—";
  const dist = [5,4,3,2,1].map(r => ({ r, count: fb.filter(f=>f.rating===r).length }));

  const feedbackLink = (counterId) => {
    const counter = state.counters.find(c=>c.id===counterId);
    if (!counter) return "#";
    return `?feedback=${encodeURIComponent(counter.name)}`;
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Customer Feedback</div>
          <div style={{ fontSize:13, color:T.txt2 }}>Submitted via public feedback forms</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:28, fontWeight:800, color:T.amber }}>⭐ {avg}</span>
          <span style={{ fontSize:12, color:T.txt2 }}>avg ({fb.length} reviews)</span>
        </div>
      </div>

      {/* Feedback links for counters */}
      <Card style={{ marginBottom:16, background:T.navyXL, border:`1px solid ${T.navy}22` }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.navy, marginBottom:10 }}>📎 Public Feedback Form Links — Share these with customers</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
          {myCounters.map(c => (
            <div key={c.id} style={{ background:"#fff", border:`1px solid ${T.bdr}`, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{c.name}</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:T.sky, background:T.skyL, padding:"4px 8px", borderRadius:5, wordBreak:"break-all" }}>
                {window.location.origin + feedbackLink(c.id)}
              </div>
              <div style={{ fontSize:11, color:T.txt3, marginTop:4 }}>Share via WhatsApp / QR / print</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Counter</label>
          <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
            style={{ padding:"7px 12px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}>
            <option value="all">All counters</option>
            {myCounters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Date</label>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
            style={{ padding:"7px 12px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
        </div>
        {selDate && <div style={{ display:"flex", alignItems:"flex-end" }}>
          <button onClick={()=>setSelDate("")} style={{ background:"none", border:"none", cursor:"pointer", color:T.txt2, fontSize:13 }}>✕ Clear</button>
        </div>}
      </div>

      {/* Rating distribution */}
      {fb.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Rating breakdown</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {dist.map(d => (
              <div key={d.r} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{"⭐".repeat(d.r)}</div>
                <div style={{ fontSize:22, fontWeight:800, color:d.count>0?T.amber:T.txt3 }}>{d.count}</div>
                <div style={{ height:6, background:T.surf, borderRadius:3, marginTop:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${fb.length?d.count/fb.length*100:0}%`, background:T.amber, borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Individual feedback cards */}
      {fb.length === 0
        ? <Card><div style={{ textAlign:"center", padding:24, color:T.txt3 }}>No feedback yet for selected filters</div></Card>
        : fb.map(f => (
          <Card key={f.id} style={{ marginBottom:12, borderLeft:`4px solid ${f.rating>=4?T.grn:f.rating===3?T.amber:T.red}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{f.counterName || state.counters.find(c=>c.id===f.counterId)?.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(f.date)} · {f.submittedAt || ""}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>{"⭐".repeat(f.rating)}</span>
                <Badge color={f.rating>=4?T.grn:f.rating===3?T.amber:T.red}>{f.rating}/5</Badge>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:8 }}>
              {f.vehicleNo && <div style={{ fontSize:12 }}><span style={{ color:T.txt2 }}>Vehicle: </span><b>{f.vehicleNo}</b></div>}
              {f.serviceType && <div style={{ fontSize:12 }}><span style={{ color:T.txt2 }}>Service: </span><b>{f.serviceType}</b></div>}
              {f.customerName && <div style={{ fontSize:12 }}><span style={{ color:T.txt2 }}>Customer: </span><b>{f.customerName}</b></div>}
            </div>
            {f.comment && <div style={{ fontSize:13, color:T.txt, background:T.surf, padding:"8px 12px", borderRadius:7 }}>"{f.comment}"</div>}
          </Card>
        ))
      }
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  MD PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function MDPortal({ user, state, setState, toast }) {
  const [page, setPage] = useState("dashboard");
  const navItems = [
    { id:"dashboard", icon:"🏆", label:"Executive Summary" },
    { id:"financial", icon:"💰", label:"Financial Trends" },
    { id:"operations",icon:"🏪", label:"Operations" },
    { id:"leaves",    icon:"✅", label:"Manager Leaves" },
    { id:"people",    icon:"👥", label:"Full Org" },
  ];

  return (
    <Shell user={user} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="dashboard"  && <MDDashboard user={user} state={state}/>}
      {page==="collection"  && <MDCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state} counterFilter={null}/>}
      {page==="financial"  && <MDFinancial state={state}/>}
      {page==="operations" && <MDOperations state={state}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="leaves"     && <MgrLeaves user={user} state={state} setState={setState} toast={toast}/>}
      {page==="people"     && <MDPeople state={state} setState={setState} toast={toast}/>}
    </Shell>
  );
}

function MDCollectionReport({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const existing = state.collectionReports?.find(r=>r.date===date);
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:"admin", bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };
  return (
    <div>
      <Input label="Date" type="date" value={date} onChange={setDate} style={{maxWidth:200,marginBottom:16}}/>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={state.serviceReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

function MDDashboard({ user, state }) {
  const allReports = state.serviceReports;
  const month = today().slice(0,7);
  const monthReports = allReports.filter(r=>r.date.startsWith(month));
  const monthRev = monthReports.reduce((s,r)=>s+r.totalAmount,0);
  const todayRev = allReports.filter(r=>r.date===today()).reduce((s,r)=>s+r.totalAmount,0);
  const totalAllTime = allReports.reduce((s,r)=>s+r.totalAmount,0);
  const pendingMgrLeaves = state.leaves.filter(l=>l.approverId===user.id&&l.status==="pending").length;
  const activeStaff = state.users.filter(u=>u.active).length;

  // Revenue by counter
  const counterRev = state.counters.map(c=>({
    name:c.name,
    rev:allReports.filter(r=>r.supervisorId===c.supervisorId).reduce((s,r)=>s+r.totalAmount,0),
  })).sort((a,b)=>b.rev-a.rev);
  const maxRev = counterRev[0]?.rev||1;

  return (
    <div>
      <div style={{ background:`linear-gradient(135deg, ${T.navy} 0%, ${T.navyL} 100%)`, borderRadius:16, padding:24, marginBottom:24, color:"#fff" }}>
        <div style={{ fontSize:12, opacity:.6, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>Executive Dashboard</div>
        <div style={{ fontSize:26, fontWeight:800 }}>Good day, {user.name.split(" ")[0]}</div>
        <div style={{ opacity:.7, marginTop:4 }}>{state.counters.length} counters · {activeStaff} active staff · {fmtDate(today())}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:16, marginTop:20 }}>
          {[
            { label:"Today's Revenue", value:fmtCurr(todayRev), icon:"📅" },
            { label:"This Month", value:fmtCurr(monthRev), icon:"💰" },
            { label:"All Time", value:fmtCurr(totalAllTime), icon:"🏆" },
            { label:"Pending Approvals", value:pendingMgrLeaves, icon:"✅" },
          ].map(s=>(
            <div key={s.label} style={{ background:"rgba(255,255,255,.1)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".04em" }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:800, marginTop:4 }}>{s.value}</div>
              <div style={{ fontSize:16, marginTop:2, opacity:.6 }}>{s.icon}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Counter Revenue (All Time)</div>
          {counterRev.map(c=>(
            <div key={c.name} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{fontSize:13}}>{c.name}</span>
                <b style={{fontSize:13,color:T.amber}}>{fmtCurr(c.rev)}</b>
              </div>
              <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${c.rev/maxRev*100}%`, background:T.amber, borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Organisation at a Glance</div>
          {Object.entries(ROLE_LABELS).map(([role,label])=>{
            const count = state.users.filter(u=>u.role===role&&u.active).length;
            if (!count) return null;
            return <div key={role} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.bdr}` }}>
              <Badge color={ROLE_COLORS[role]}>{label}</Badge>
              <span style={{ fontWeight:700 }}>{count}</span>
            </div>;
          })}
        </Card>
      </div>
    </div>
  );
}

function MDFinancial({ state }) {
  const allReports = state.serviceReports;
  // Monthly grouping
  const monthMap = {};
  allReports.forEach(r=>{
    const m = r.date.slice(0,7);
    monthMap[m] = (monthMap[m]||0)+r.totalAmount;
  });
  const months = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxM = months.reduce((s,[,v])=>Math.max(s,v),1);

  // Work type breakdown
  const wtMap = {};
  allReports.forEach(r=>reportAllEntries(r).forEach(e=>{
    wtMap[e.workTypeName]=(wtMap[e.workTypeName]||0)+e.amount;
  }));
  const wtArr = Object.entries(wtMap).sort((a,b)=>b[1]-a[1]);
  const totalWt = wtArr.reduce((s,[,v])=>s+v,0);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Financial Trends</div>
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>Monthly Revenue</div>
        {months.length===0 ? <div style={{color:T.txt3}}>No data yet</div> :
          months.map(([m,rev])=>(
            <div key={m} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{fontSize:13}}>{m}</span>
                <b style={{fontSize:13,color:T.navy}}>{fmtCurr(rev)}</b>
              </div>
              <div style={{ height:10, background:T.surf, borderRadius:5, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${rev/maxM*100}%`, background:T.navy, borderRadius:5 }}/>
              </div>
            </div>
          ))
        }
      </Card>
      <Card>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Revenue Split by Work Type</div>
        {wtArr.map(([name,rev])=>(
          <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
            <span style={{fontSize:13}}>{name}</span>
            <div style={{textAlign:"right"}}>
              <b style={{fontSize:13}}>{fmtCurr(rev)}</b>
              <span style={{fontSize:11,color:T.txt2,marginLeft:8}}>{Math.round(rev/totalWt*100)}%</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function MDOperations({ state }) {
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>All Operations</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16, marginBottom:20 }}>
        {state.counters.map(c=>{
          const sup = state.users.find(u=>u.id===c.supervisorId);
          const mgr = state.users.find(u=>u.id===sup?.managerId);
          const staff = state.users.filter(u=>u.managerId===c.supervisorId&&u.role==="field_staff");
          const reports = state.serviceReports.filter(r=>r.supervisorId===c.supervisorId);
          const totalRev = reports.reduce((s,r)=>s+r.totalAmount,0);
          return (
            <Card key={c.id} style={{ borderTop:`3px solid ${T.amber}` }}>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>{c.name}</div>
              <div style={{ fontSize:12, color:T.txt2, marginBottom:10 }}>{c.dealership}</div>
              <div style={{ fontSize:13, marginBottom:3 }}>👤 Supervisor: <b>{sup?.name||"—"}</b></div>
              <div style={{ fontSize:13, marginBottom:3 }}>🏢 Manager: <b>{mgr?.name||"—"}</b></div>
              <div style={{ fontSize:13, marginBottom:8 }}>👥 Staff: <b>{staff.length}</b></div>
              <div style={{ fontSize:16, fontWeight:800, color:T.amber }}>{fmtCurr(totalRev)}</div>
              <div style={{ fontSize:11, color:T.txt2 }}>Total Revenue · {reports.length} reports</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MDPeople({ state, setState, toast }) {
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Full Organisation</div>
      <Table cols={[
        {key:"empId",label:"ID"},
        {key:"name",label:"Name",render:r=><b>{r.name}</b>},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[r.role]}>{ROLE_LABELS[r.role]}</Badge>},
        {key:"manager",label:"Reports To",render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"phone",label:"Phone"},
        {key:"status",label:"Status",render:r=><Badge color={r.active?T.grn:T.red}>{r.active?"Active":"Inactive"}</Badge>},
      ]} rows={state.users}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OFFICE PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function OfficePortal({ user, state, setState, toast }) {
  const [page, setPage] = useState("reports");
  const navItems = [
    { id:"reports",    icon:"📋", label:"Service Reports" },
    { id:"attendance", icon:"👥", label:"Attendance" },
    { id:"export",     icon:"📥", label:"Export Data" },
  ];

  return (
    <Shell user={user} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="reports"    && <OfficeReports state={state}/>}
      {page==="attendance" && <OfficeAttendance state={state}/>}
      {page==="export"     && <OfficeExport state={state} toast={toast}/>}
    </Shell>
  );
}

function OfficeReports({ state }) {
  const [date, setDate] = useState(today());
  const reports = state.serviceReports.filter(r=>r.date===date);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Service Reports</div>
      <Input label="Select Date" type="date" value={date} onChange={setDate} style={{ maxWidth:200 }}/>
      {reports.map(r=>{
        const sup = state.users.find(u=>u.id===r.supervisorId);
        return (
          <Card key={r.id} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>Supervisor: {sup?.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{reportCounterNames(r)} · Submitted {r.submittedAt}</div>
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</div>
            </div>
            {(r.counters||[]).map((c,ci)=>(
              <div key={ci} style={{marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:T.navy,marginBottom:6}}>📍 {c.counterName}</div>
                <Table cols={[
                  {key:"workTypeName",label:"Work"},
                  {key:"vehicles",label:"Vehicles"},
                  {key:"rate",label:"Rate",render:e=>fmtCurr(e.rate)},
                  {key:"amount",label:"Amount",render:e=><b>{fmtCurr(e.amount)}</b>},
                ]} rows={c.entries.filter(e=>e.vehicles>0)}/>
              </div>
            ))}
            {r.notes && <div style={{marginTop:10,fontSize:13,color:T.txt2}}>📝 {r.notes}</div>}
          </Card>
        );
      })}
      {reports.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for {fmtDate(date)}</div></Card>}
    </div>
  );
}

function OfficeAttendance({ state }) {
  const [date, setDate] = useState(today());
  const att = state.attendance.filter(a=>a.date===date);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Attendance Records</div>
      <Input label="Select Date" type="date" value={date} onChange={setDate} style={{ maxWidth:200 }}/>
      <Table cols={[
        {key:"staff",label:"Staff",render:r=>state.users.find(u=>u.id===r.staffId)?.name||r.staffId},
        {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name},
        {key:"counter",label:"Counter",render:r=>state.users.find(u=>u.id===r.supervisorId)?.counter||"—"},
        {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.grn:r.status==="half_day"?T.amber:T.red}>{r.status}</Badge>},
        {key:"reason",label:"Reason",render:r=>r.reason||"—"},
        {key:"markedAt",label:"Marked At"},
      ]} rows={att} emptyMsg="No attendance records for this date"/>
    </div>
  );
}

function OfficeExport({ state, toast }) {
  const downloadCSV = (data, filename) => {
    if (!data.length) { toast.show("No data to export","error"); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(r=>headers.map(h=>`"${r[h]||""}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = filename;
    a.click();
    toast.show(`Exported ${filename}`);
  };

  const exportReports = () => downloadCSV(
    state.serviceReports.flatMap(r=>(r.counters||[]).flatMap(c=>c.entries.filter(e=>e.vehicles>0).map(e=>({Date:r.date, Counter:c.counterName, Supervisor:state.users.find(u=>u.id===r.supervisorId)?.name, WorkType:e.workTypeName, Vehicles:e.vehicles, Rate:e.rate, Amount:e.amount, ReportTotal:r.totalAmount, SubmittedAt:r.submittedAt})))),
    `service_reports_${today()}.csv`
  );

  const exportAttendance = () => downloadCSV(
    state.attendance.map(a=>({
      Date:a.date, Staff:state.users.find(u=>u.id===a.staffId)?.name, Supervisor:state.users.find(u=>u.id===a.supervisorId)?.name,
      Status:a.status, Reason:a.reason||"", MarkedAt:a.markedAt
    })),
    `attendance_${today()}.csv`
  );

  const exportStaff = () => downloadCSV(
    state.users.map(u=>({ EmpId:u.empId, Name:u.name, Role:ROLE_LABELS[u.role], ReportsTo:state.users.find(x=>x.id===u.managerId)?.name||"—", Phone:u.phone, Email:u.email, Active:u.active })),
    `staff_directory_${today()}.csv`
  );

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Export Data</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16 }}>
        {[
          { title:"Service Reports", desc:"All daily service reports with entries", icon:"📋", fn:exportReports },
          { title:"Attendance Records", desc:"All staff attendance records", icon:"👥", fn:exportAttendance },
          { title:"Staff Directory", desc:"Full list of all staff and roles", icon:"📂", fn:exportStaff },
        ].map(item=>(
          <Card key={item.title} style={{ textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>{item.icon}</div>
            <div style={{ fontWeight:700, marginBottom:4 }}>{item.title}</div>
            <div style={{ fontSize:12, color:T.txt2, marginBottom:16 }}>{item.desc}</div>
            <Btn onClick={item.fn} size="sm" style={{ width:"100%", justifyContent:"center" }}>📥 Export CSV</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  IT ADMIN PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function ITAdminPortal({ user, state, setState, toast }) {
  const [page, setPage] = useState("users");
  const navItems = [
    { id:"users",     icon:"👤", label:"User Management" },
    { id:"counters",  icon:"🏪", label:"Counters" },
    { id:"worktypes", icon:"🔧", label:"Work Types" },
    { id:"reports",   icon:"📋", label:"All Reports" },
    { id:"data",      icon:"🗄️", label:"Data Management" },
    { id:"export",    icon:"📥", label:"Export / Reports" },
  ];

  return (
    <Shell user={user} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="users"     && <UserMgmt state={state} setState={setState} toast={toast}/>}
      {page==="counters"  && <CounterMgmt state={state} setState={setState} toast={toast}/>}
      {page==="worktypes" && <WorkTypeMgmt state={state} setState={setState} toast={toast}/>}
      {page==="reports"   && <AllReports state={state}/>}
      {page==="data"      && <DataMgmt state={state} setState={setState} toast={toast}/>}
      {page==="export"    && <OfficeExport state={state} toast={toast}/>}
    </Shell>
  );
}

function UserMgmt({ state, setState, toast }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ empId:"", name:"", role:"field_staff", email:"", phone:"", managerId:"", counter:"" });
  const [newPwd, setNewPwd] = useState("");

  const openNew = () => { setEditing(null); setForm({ empId:"", name:"", role:"field_staff", email:"", phone:"", managerId:"", counter:"" }); setNewPwd(""); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ empId:u.empId, name:u.name, role:u.role, email:u.email||"", phone:u.phone||"", managerId:u.managerId||"", counter:u.counter||"" }); setNewPwd(""); setModal(true); };

  const save = () => {
    if (!form.empId||!form.name) { toast.show("ID and Name required","error"); return; }
    if (editing) {
      setState(p=>({ ...p,
        users: p.users.map(u=>u.id===editing.id?{...u,...form}:u),
        passwords: newPwd ? {...p.passwords,[form.empId]:newPwd} : p.passwords
      }));
      toast.show("User updated");
    } else {
      if (state.users.find(u=>u.empId===form.empId)) { toast.show("Employee ID already exists","error"); return; }
      const newUser = { id:`u_${Date.now()}`, ...form, active:true };
      setState(p=>({ ...p, users:[...p.users, newUser], passwords:{...p.passwords,[form.empId]:newPwd||"pass@123"} }));
      toast.show(`User created · Default password: ${newPwd||"pass@123"}`);
    }
    setModal(false);
  };

  const toggleActive = (u) => {
    setState(p=>({ ...p, users:p.users.map(x=>x.id===u.id?{...x,active:!x.active}:x) }));
    toast.show(u.active?"User deactivated":"User activated");
  };

  const deleteUser = (u) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setState(p=>({ ...p, users:p.users.filter(x=>x.id!==u.id) }));
    toast.show("User deleted");
  };

  const managers = state.users.filter(u=>["manager","md","supervisor"].includes(u.role)&&u.active);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>User Management</div>
        <Btn onClick={openNew} variant="amber">+ Add User</Btn>
      </div>

      <Table cols={[
        {key:"empId",label:"ID"},
        {key:"name",label:"Name",render:r=><b>{r.name}</b>},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[r.role]}>{ROLE_LABELS[r.role]}</Badge>},
        {key:"manager",label:"Reports To",render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"phone",label:"Phone"},
        {key:"status",label:"Status",render:r=><Badge color={r.active?T.grn:T.red}>{r.active?"Active":"Inactive"}</Badge>},
        {key:"actions",label:"Actions",render:r=>(
          <div style={{display:"flex",gap:6}}>
            <Btn onClick={()=>openEdit(r)} size="sm" variant="outline">Edit</Btn>
            <Btn onClick={()=>toggleActive(r)} size="sm" variant={r.active?"ghost":"success"}>{r.active?"Deactivate":"Activate"}</Btn>
            <Btn onClick={()=>deleteUser(r)} size="sm" variant="danger">Delete</Btn>
          </div>
        )},
      ]} rows={state.users}/>

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit User":"Add New User"}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Input label="Employee ID" value={form.empId} onChange={v=>setForm(p=>({...p,empId:v}))} required/>
          <Input label="Full Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} required/>
        </div>
        <Select label="Role" value={form.role} onChange={v=>setForm(p=>({...p,role:v}))} options={Object.entries(ROLE_LABELS).map(([v,l])=>({value:v,label:l}))}/>
        <Select label="Reports To" value={form.managerId} onChange={v=>setForm(p=>({...p,managerId:v}))} options={[{value:"",label:"— None —"},...managers.map(m=>({value:m.id,label:`${m.name} (${ROLE_LABELS[m.role]})`}))]}/>
        {["supervisor","field_staff"].includes(form.role) && <Input label="Counter / Location" value={form.counter} onChange={v=>setForm(p=>({...p,counter:v}))} placeholder="e.g. Whitefield Motors"/>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Input label="Email" value={form.email} onChange={v=>setForm(p=>({...p,email:v}))}/>
          <Input label="Phone" value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))}/>
        </div>
        <Input label={editing?"New Password (leave blank to keep)":"Password"} type="password" value={newPwd} onChange={setNewPwd} placeholder={editing?"Leave blank to keep current":"Default: pass@123"}/>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <Btn onClick={save} variant="primary">{editing?"Save Changes":"Create User"}</Btn>
          <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function CounterMgmt({ state, setState, toast }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", supervisorId:"", dealership:"", city:"" });

  const sups = state.users.filter(u=>u.role==="supervisor"&&u.active);

  const save = () => {
    if (!form.name) { toast.show("Counter name required","error"); return; }
    if (editing) {
      setState(p=>({ ...p, counters:p.counters.map(c=>c.id===editing.id?{...c,...form}:c) }));
      toast.show("Counter updated");
    } else {
      setState(p=>({ ...p, counters:[...p.counters,{ id:`c_${Date.now()}`,...form }] }));
      toast.show("Counter added");
    }
    setModal(false);
  };

  const del = (c) => {
    if (!confirm(`Delete counter "${c.name}"?`)) return;
    setState(p=>({ ...p, counters:p.counters.filter(x=>x.id!==c.id) }));
    toast.show("Counter deleted");
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Counter Management</div>
        <Btn onClick={()=>{setEditing(null);setForm({name:"",supervisorId:"",dealership:"",city:""});setModal(true)}} variant="amber">+ Add Counter</Btn>
      </div>
      <Table cols={[
        {key:"name",label:"Counter Name",render:r=><b>{r.name}</b>},
        {key:"dealership",label:"Dealership"},
        {key:"city",label:"City"},
        {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name||"—"},
        {key:"actions",label:"",render:r=>(
          <div style={{display:"flex",gap:6}}>
            <Btn onClick={()=>{setEditing(r);setForm({name:r.name,supervisorId:r.supervisorId||"",dealership:r.dealership||"",city:r.city||""});setModal(true)}} size="sm" variant="outline">Edit</Btn>
            <Btn onClick={()=>del(r)} size="sm" variant="danger">Delete</Btn>
          </div>
        )},
      ]} rows={state.counters}/>
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Counter":"Add Counter"}>
        <Input label="Counter Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} required/>
        <Input label="Dealership Name" value={form.dealership} onChange={v=>setForm(p=>({...p,dealership:v}))}/>
        <Input label="City" value={form.city} onChange={v=>setForm(p=>({...p,city:v}))}/>
        <Select label="Assigned Supervisor" value={form.supervisorId} onChange={v=>setForm(p=>({...p,supervisorId:v}))} options={[{value:"",label:"— None —"},...sups.map(s=>({value:s.id,label:s.name}))]}/>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn onClick={save}>{editing?"Save":"Add Counter"}</Btn>
          <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function WorkTypeMgmt({ state, setState, toast }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [editCat, setEditCat] = useState("service");

  const save = () => {
    if (!name) { toast.show("Name required","error"); return; }
    if (editing) {
      setState(p=>({ ...p, workTypes:p.workTypes.map(w=>w.id===editing.id?{...w,name,defaultRate:Number(rate),category:editCat}:w) }));
      toast.show("Work type updated");
    } else {
      setState(p=>({ ...p, workTypes:[...p.workTypes,{ id:`wt_${Date.now()}`, name, defaultRate:Number(rate), category:editCat||"service" }] }));
      toast.show("Work type added");
    }
    setModal(false);
  };

  const del = (w) => {
    if (!confirm(`Delete "${w.name}"?`)) return;
    setState(p=>({ ...p, workTypes:p.workTypes.filter(x=>x.id!==w.id) }));
    toast.show("Work type deleted");
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Work Types & Rates</div>
        <Btn onClick={()=>{setEditing(null);setName("");setRate("");setModal(true)}} variant="amber">+ Add Work Type</Btn>
      </div>
      <div style={{ fontSize:12, color:T.txt2, marginBottom:14 }}>These are the default rates. Supervisors can override per-report.</div>
      <Table cols={[
        {key:"name",label:"Work Type",render:r=><b>{r.name}</b>},
        {key:"category",label:"Type",render:r=><Badge color={r.category==="sales"?T.grn:T.navy}>{r.category==="sales"?"Sales":"Service"}</Badge>},
        {key:"defaultRate",label:"Default Rate",render:r=>fmtCurr(r.defaultRate)},
        {key:"actions",label:"",render:r=>(
          <div style={{display:"flex",gap:6}}>
            <Btn onClick={()=>{setEditing(r);setName(r.name);setRate(r.defaultRate);setEditCat(r.category||"service");setModal(true)}} size="sm" variant="outline">Edit</Btn>
            <Btn onClick={()=>del(r)} size="sm" variant="danger">Delete</Btn>
          </div>
        )},
      ]} rows={state.workTypes}/>
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?"Edit Work Type":"Add Work Type"}>
        <Input label="Work Type Name" value={name} onChange={setName} required/>
        <Input label="Default Rate (₹)" type="number" value={rate} onChange={setRate}/>
        <Select label="Category" value={editCat||"service"} onChange={v=>setEditCat(v)} options={[{value:"service",label:"Service"},{value:"sales",label:"Sales / Product"}]}/>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn onClick={save}>{editing?"Save":"Add"}</Btn>
          <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

function AllReports({ state }) {
  const [date, setDate] = useState(today());
  const reports = state.serviceReports.filter(r=>r.date===date);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>All Service Reports</div>
      <Input label="Date" type="date" value={date} onChange={setDate} style={{ maxWidth:200 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard label="Total Revenue" value={fmtCurr(reports.reduce((s,r)=>s+r.totalAmount,0))} color={T.amber}/>
        <StatCard label="Reports" value={reports.length} color={T.navy}/>
        <StatCard label="Counters Reporting" value={reports.length} color={T.grn}/>
      </div>
      {reports.map(r=>{
        const sup2 = state.users.find(u=>u.id===r.supervisorId);
        return (
          <Card key={r.id} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div><b style={{fontSize:15}}>{sup2?.name}</b><div style={{fontSize:12,color:T.txt2}}>{reportCounterNames(r)} · {r.submittedAt}</div></div>
              <b style={{fontSize:20,color:T.amber}}>{fmtCurr(r.totalAmount)}</b>
            </div>
            {(r.counters||[]).map((c,ci)=>(
              <div key={ci} style={{marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:12,color:T.navy,marginBottom:4}}>📍 {c.counterName}</div>
                <Table cols={[
                  {key:"workTypeName",label:"Work"},
                  {key:"vehicles",label:"Vehicles"},
                  {key:"rate",label:"Rate",render:e=>fmtCurr(e.rate)},
                  {key:"amount",label:"Amount",render:e=><b>{fmtCurr(e.amount)}</b>},
                ]} rows={c.entries.filter(e=>e.vehicles>0)}/>
              </div>
            ))}
          </Card>
        );
      })}
      {reports.length===0&&<Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for this date</div></Card>}
    </div>
  );
}

function DataMgmt({ state, setState, toast }) {
  const deleteReport = (id) => {
    if (!confirm("Delete this report?")) return;
    setState(p=>({ ...p, serviceReports:p.serviceReports.filter(r=>r.id!==id) }));
    toast.show("Report deleted");
  };
  const deleteAttendance = (date) => {
    if (!confirm(`Delete all attendance for ${date}?`)) return;
    setState(p=>({ ...p, attendance:p.attendance.filter(a=>a.date!==date) }));
    toast.show("Attendance records deleted");
  };

  const attDates = [...new Set(state.attendance.map(a=>a.date))].sort().reverse();

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Data Management</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:T.red }}>🗑 Delete Service Reports</div>
          {state.serviceReports.sort((a,b)=>b.date.localeCompare(a.date)).map(r=>(
            <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>{state.users.find(u=>u.id===r.supervisorId)?.name}</div>
                <div style={{fontSize:11,color:T.txt2}}>{fmtDate(r.date)} · {reportCounterNames(r)} · {fmtCurr(r.totalAmount)}</div>
              </div>
              <Btn onClick={()=>deleteReport(r.id)} size="sm" variant="danger">Delete</Btn>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:T.red }}>🗑 Delete Attendance Records</div>
          {attDates.map(d=>(
            <div key={d} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>{fmtDate(d)}</div>
                <div style={{fontSize:11,color:T.txt2}}>{state.attendance.filter(a=>a.date===d).length} records</div>
              </div>
              <Btn onClick={()=>deleteAttendance(d)} size="sm" variant="danger">Delete</Btn>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
//  COLLECTION REPORT (matches Image 1 format)
// ═══════════════════════════════════════════════════════════════════════════════
function CollectionReportView({ date, report, counters, allReports, attendance, users, onSave, readOnly }) {
  const [bankEntries, setBankEntries] = useState(report?.bankEntries || [
    { id:1, description:"", sbi:"", kbl:"" },
    { id:2, description:"", sbi:"", kbl:"" },
    { id:3, description:"", sbi:"", kbl:"" },
  ]);
  const [expenses, setExpenses] = useState(report?.expenses || [
    { id:1, description:"", sbi:"", kbl:"" },
    { id:2, description:"", sbi:"", kbl:"" },
    { id:3, description:"", sbi:"", kbl:"" },
  ]);

  const totalSBI = bankEntries.reduce((s,r)=>s+(Number(r.sbi)||0),0);
  const totalKBL = bankEntries.reduce((s,r)=>s+(Number(r.kbl)||0),0);
  const totalCollBank = totalSBI + totalKBL;
  const expSBI = expenses.reduce((s,r)=>s+(Number(r.sbi)||0),0);
  const expKBL = expenses.reduce((s,r)=>s+(Number(r.kbl)||0),0);
  const grandExpenses = expSBI + expKBL;

  // Service totals from daily reports for this date
  const dayReports = allReports.filter(r=>r.date===date);
  const serviceEntries = (r) => (r.counters||[]).flatMap(c=>c.entries||[]).filter(e=>!['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].some(s=>e.workTypeName===s));
  const salesEntries = (r) => (r.counters||[]).flatMap(c=>c.entries||[]).filter(e=>['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].some(s=>e.workTypeName===s));

  const absent = attendance.filter(a=>a.date===date&&a.status==='absent');

  const printReport = () => {
    const w = window.open('','_blank');
    const counterRows = dayReports.map((r,i) => {
      const cname = (r.counters||[])[0]?.counterName || users.find(u=>u.id===r.supervisorId)?.counter || '—';
      const svcTotal = serviceEntries(r).reduce((s,e)=>s+e.amount,0);
      const salesTotal = salesEntries(r).reduce((s,e)=>s+e.amount,0);
      return `<tr><td style="border:1px solid #ccc;padding:5px 10px">${cname}</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:right">${svcTotal.toLocaleString('en-IN')}</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:right">${salesTotal.toLocaleString('en-IN')}</td><td style="border:1px solid #ccc;padding:5px 10px;text-align:right">${(svcTotal+salesTotal).toLocaleString('en-IN')}</td></tr>`;
    }).join('');
    const absentList = absent.map(a=>users.find(u=>u.id===a.staffId)?.name||'').filter(Boolean).join(', ');
    w.document.write(`<!DOCTYPE html><html><head><title>Collection Report - ${date}</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;font-size:13px}table{border-collapse:collapse;width:100%;margin-bottom:16px}
    h2,h3{text-align:center;margin:4px 0}.section-title{background:#f0f0f0;font-weight:700;padding:6px 10px;text-align:center}</style></head>
    <body><h2>BENAKA ENTERPRISES</h2><h3>COLLECTION REPORT</h3><h3>Date: ${date.split('-').reverse().join('-')}</h3><br>
    <table><thead><tr><th style="border:1px solid #ccc;padding:6px;background:#e8e8e8">COUNTER</th>
    <th style="border:1px solid #ccc;padding:6px;background:#e8e8e8">SERVICE</th>
    <th style="border:1px solid #ccc;padding:6px;background:#e8e8e8">SALES</th>
    <th style="border:1px solid #ccc;padding:6px;background:#e8e8e8">TOTAL</th></tr></thead>
    <tbody>${counterRows}</tbody>
    <tfoot>
    <tr><td colspan="3" style="border:1px solid #ccc;padding:5px 10px;font-weight:700;text-align:right">TOTAL SERVICE</td>
    <td style="border:1px solid #ccc;padding:5px 10px;font-weight:700;text-align:right">${dayReports.reduce((s,r)=>s+serviceEntries(r).reduce((ss,e)=>ss+e.amount,0),0).toLocaleString('en-IN')}</td></tr>
    <tr><td colspan="3" style="border:1px solid #ccc;padding:5px 10px;font-weight:700;text-align:right">TOTAL SALES</td>
    <td style="border:1px solid #ccc;padding:5px 10px;font-weight:700;text-align:right">${dayReports.reduce((s,r)=>s+salesEntries(r).reduce((ss,e)=>ss+e.amount,0),0).toLocaleString('en-IN')}</td></tr>
    <tr><td colspan="3" style="border:1px solid #ccc;padding:5px 10px;font-weight:800;text-align:right;background:#f8f8f8">GRAND TOTAL</td>
    <td style="border:1px solid #ccc;padding:5px 10px;font-weight:800;text-align:right;background:#f8f8f8">${dayReports.reduce((s,r)=>s+r.totalAmount,0).toLocaleString('en-IN')}</td></tr>
    </tfoot></table>
    <table><thead><tr><th class="section-title" colspan="5">COLLECTION (BANK)</th></tr>
    <tr><th style="border:1px solid #ccc;padding:5px">COLLECTION</th><th style="border:1px solid #ccc;padding:5px">SBI</th><th style="border:1px solid #ccc;padding:5px">KBL</th><th style="border:1px solid #ccc;padding:5px">TOTAL SBI</th><th style="border:1px solid #ccc;padding:5px">TOTAL KBL</th></tr></thead>
    <tbody>${bankEntries.map(r=>`<tr><td style="border:1px solid #ccc;padding:5px">${r.description}</td><td style="border:1px solid #ccc;padding:5px;text-align:right">${r.sbi||''}</td><td style="border:1px solid #ccc;padding:5px;text-align:right">${r.kbl||''}</td><td style="border:1px solid #ccc;padding:5px"></td><td style="border:1px solid #ccc;padding:5px"></td></tr>`).join('')}</tbody>
    <tfoot><tr><td style="border:1px solid #ccc;padding:5px;font-weight:700">TOTAL</td><td style="border:1px solid #ccc;padding:5px;font-weight:700;text-align:right">${totalSBI.toLocaleString('en-IN')}</td><td style="border:1px solid #ccc;padding:5px;font-weight:700;text-align:right">${totalKBL.toLocaleString('en-IN')}</td><td colspan="2"></td></tr>
    <tr><td colspan="3" style="border:1px solid #ccc;padding:5px;font-weight:700">TOTAL COLLECTION BANK</td><td colspan="2" style="border:1px solid #ccc;padding:5px;font-weight:800;text-align:right">${totalCollBank.toLocaleString('en-IN')}</td></tr></tfoot></table>
    <table><thead><tr><th class="section-title" colspan="3">EXPENSES</th></tr>
    <tr><th style="border:1px solid #ccc;padding:5px">DESCRIPTION</th><th style="border:1px solid #ccc;padding:5px">SBI</th><th style="border:1px solid #ccc;padding:5px">KBL</th></tr></thead>
    <tbody>${expenses.map(r=>`<tr><td style="border:1px solid #ccc;padding:5px">${r.description}</td><td style="border:1px solid #ccc;padding:5px;text-align:right">${r.sbi||''}</td><td style="border:1px solid #ccc;padding:5px;text-align:right">${r.kbl||''}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td style="border:1px solid #ccc;padding:5px;font-weight:700">TOTAL</td><td colspan="2" style="border:1px solid #ccc;padding:5px;font-weight:700;text-align:right">${grandExpenses.toLocaleString('en-IN')}</td></tr>
    <tr><td colspan="2" style="border:1px solid #ccc;padding:5px;font-weight:800">GRAND TOTAL EXPENSES</td><td style="border:1px solid #ccc;padding:5px;font-weight:800;text-align:right">${grandExpenses.toLocaleString('en-IN')}</td></tr></tfoot></table>
    ${absentList ? `<p><strong>ABSENT: ${date.split('-').reverse().join('/')}</strong><br>${absentList}</p>` : ''}
    </body></html>`);
    w.document.close(); w.print();
  };

  const updateBank = (i,f,v) => setBankEntries(p=>p.map((r,j)=>j===i?{...r,[f]:v}:r));
  const updateExp  = (i,f,v) => setExpenses(p=>p.map((r,j)=>j===i?{...r,[f]:v}:v));

  const td = (content, align='left', bold=false, bg='') =>
    `style="border:1px solid ${T.bdr};padding:7px 10px;text-align:${align};font-weight:${bold?700:400};background:${bg||'transparent'};font-size:13px"`;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:800 }}>Collection Report — {date ? date.split('-').reverse().join('-') : ''}</div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={printReport} variant="ghost" size="sm">🖨 Print / PDF</Btn>
          {!readOnly && onSave && <Btn onClick={()=>onSave(bankEntries, expenses)} variant="amber" size="sm">Save Report</Btn>}
        </div>
      </div>

      {/* SERVICE SUMMARY */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.navy, marginBottom:10, textTransform:"uppercase", letterSpacing:".04em" }}>Service & Sales Summary</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"left" }}>Counter</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>Service (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>Sales (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {dayReports.map((r,i) => {
                const cname = (r.counters||[])[0]?.counterName || users.find(u=>u.id===r.supervisorId)?.counter || '—';
                const svcT = serviceEntries(r).reduce((s,e)=>s+e.amount,0);
                const salT = salesEntries(r).reduce((s,e)=>s+e.amount,0);
                return <tr key={i}>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:600 }}>{cname}</td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>{svcT.toLocaleString('en-IN')}</td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>{salT.toLocaleString('en-IN')}</td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right", fontWeight:700, color:T.amber }}>{(svcT+salT).toLocaleString('en-IN')}</td>
                </tr>;
              })}
            </tbody>
            <tfoot>
              {[
                ["TOTAL SERVICE", dayReports.reduce((s,r)=>s+serviceEntries(r).reduce((ss,e)=>ss+e.amount,0),0)],
                ["TOTAL SALES",   dayReports.reduce((s,r)=>s+salesEntries(r).reduce((ss,e)=>ss+e.amount,0),0)],
              ].map(([lbl,val])=>(
                <tr key={lbl} style={{ background:T.surf }}>
                  <td colSpan={3} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:700, textAlign:"right" }}>{lbl}</td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.navy, textAlign:"right" }}>{fmtCurr(val)}</td>
                </tr>
              ))}
              <tr style={{ background:T.navyXL }}>
                <td colSpan={3} style={{ border:`1px solid ${T.bdr}`, padding:"8px 10px", fontWeight:800, textAlign:"right", color:T.navy }}>GRAND TOTAL (SERVICE + SALES)</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"8px 10px", fontWeight:800, color:T.amber, textAlign:"right", fontSize:15 }}>{fmtCurr(dayReports.reduce((s,r)=>s+r.totalAmount,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Bar chart */}
        {dayReports.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.txt2, textTransform:"uppercase", marginBottom:8 }}>Visual breakdown</div>
            {dayReports.map((r,i) => {
              const cname = (r.counters||[])[0]?.counterName || '—';
              const max = Math.max(...dayReports.map(x=>x.totalAmount), 1);
              return <div key={i} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span style={{ fontWeight:600 }}>{cname}</span>
                  <span style={{ fontWeight:700, color:T.amber }}>{fmtCurr(r.totalAmount)}</span>
                </div>
                <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${r.totalAmount/max*100}%`, background:T.amber, borderRadius:4 }}/>
                </div>
              </div>;
            })}
          </div>
        )}
      </Card>

      {/* COLLECTION BANK */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.navy, marginBottom:10, textTransform:"uppercase" }}>Collection (Bank)</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"left", width:"40%" }}>COLLECTION</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>SBI (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>KBL (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>TOTAL SBI</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>TOTAL KBL</th>
              </tr>
            </thead>
            <tbody>
              {bankEntries.map((row,i) => (
                <tr key={i}>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.description : <input value={row.description} onChange={e=>updateBank(i,'description',e.target.value)} placeholder="Description" style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", background:"transparent" }}/>}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.sbi||'' : <input type="number" value={row.sbi} onChange={e=>updateBank(i,'sbi',e.target.value)} style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", textAlign:"right", background:"transparent" }}/>}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.kbl||'' : <input type="number" value={row.kbl} onChange={e=>updateBank(i,'kbl',e.target.value)} style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", textAlign:"right", background:"transparent" }}/>}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 10px", textAlign:"right", color:T.txt2 }}></td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 10px", textAlign:"right", color:T.txt2 }}></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:T.surf }}>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800 }}>TOTAL</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, textAlign:"right" }}>{totalSBI.toLocaleString('en-IN')}</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, textAlign:"right" }}>{totalKBL.toLocaleString('en-IN')}</td>
                <td colSpan={2} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px" }}></td>
              </tr>
              <tr style={{ background:T.navyXL }}>
                <td colSpan={4} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.navy }}>TOTAL COLLECTION BANK</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.amber, textAlign:"right" }}>{fmtCurr(totalCollBank)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!readOnly && <Btn onClick={()=>setBankEntries(p=>[...p,{id:Date.now(),description:'',sbi:'',kbl:''}])} size="sm" variant="ghost" style={{marginTop:8}}>+ Add row</Btn>}
      </Card>

      {/* EXPENSES */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.navy, marginBottom:10, textTransform:"uppercase" }}>Expenses</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"left", width:"50%" }}>DESCRIPTION</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>SBI (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", textAlign:"right" }}>KBL (₹)</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row,i) => (
                <tr key={i}>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.description : <input value={row.description} onChange={e=>setExpenses(p=>p.map((r,j)=>j===i?{...r,description:e.target.value}:r))} placeholder="Expense description" style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", background:"transparent" }}/>}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.sbi||'' : <input type="number" value={row.sbi} onChange={e=>setExpenses(p=>p.map((r,j)=>j===i?{...r,sbi:e.target.value}:r))} style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", textAlign:"right", background:"transparent" }}/>}
                  </td>
                  <td style={{ border:`1px solid ${T.bdr}`, padding:"5px 8px" }}>
                    {readOnly ? row.kbl||'' : <input type="number" value={row.kbl} onChange={e=>setExpenses(p=>p.map((r,j)=>j===i?{...r,kbl:e.target.value}:r))} style={{ width:"100%", border:"none", outline:"none", fontSize:13, fontFamily:"inherit", textAlign:"right", background:"transparent" }}/>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:T.surf }}>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800 }}>TOTAL</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, textAlign:"right" }}>{expSBI.toLocaleString('en-IN')}</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, textAlign:"right" }}>{expKBL.toLocaleString('en-IN')}</td>
              </tr>
              <tr style={{ background:T.navyXL }}>
                <td colSpan={2} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.navy }}>GRAND TOTAL EXPENSES</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.red, textAlign:"right" }}>{fmtCurr(grandExpenses)}</td>
              </tr>
              <tr style={{ background:T.grnL }}>
                <td colSpan={2} style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.grn }}>NET (Collection − Expenses)</td>
                <td style={{ border:`1px solid ${T.bdr}`, padding:"7px 10px", fontWeight:800, color:T.grn, textAlign:"right" }}>{fmtCurr(totalCollBank - grandExpenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!readOnly && <Btn onClick={()=>setExpenses(p=>[...p,{id:Date.now(),description:'',sbi:'',kbl:''}])} size="sm" variant="ghost" style={{marginTop:8}}>+ Add row</Btn>}
      </Card>

      {/* ABSENT */}
      {absent.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.red, marginBottom:8 }}>ABSENT — {date ? date.split('-').reverse().join('/') : ''}</div>
          {absent.map((a,i) => {
            const staff = users.find(u=>u.id===a.staffId);
            return <div key={i} style={{ fontSize:13, padding:"4px 0" }}>{i+1}. {staff?.name} {a.reason?`— ${a.reason}`:''}</div>;
          })}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SALARY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
function SalaryView({ user, state, setState, toast, viewScope }) {
  const [month, setMonth] = useState(today().slice(0,7));
  const [modal, setModal] = useState(false);
  const [editSal, setEditSal] = useState(null);
  const [form, setForm] = useState({ userId:"", basic:0, allowances:0, deductions:0, paidOn:"", note:"" });

  // Scope: 'all' for MD/manager, 'mine' for executive
  const staffInScope = viewScope === 'all'
    ? state.users.filter(u=>u.active && u.role !== 'md')
    : state.users.filter(u=>u.managerId === user.id && u.active);

  const monthSalaries = state.salaries.filter(s=>s.month===month);
  const totalPaid = monthSalaries.reduce((s,sal)=>s+(Number(sal.netSalary)||0),0);

  const openEdit = (s) => {
    setEditSal(s);
    setForm({ userId:s.userId, basic:s.basicSalary, allowances:s.allowances, deductions:s.deductions, paidOn:s.paidOn||'', note:s.note||'' });
    setModal(true);
  };
  const openNew = (uid) => {
    setEditSal(null);
    setForm({ userId:uid, basic:0, allowances:0, deductions:0, paidOn:today(), note:'' });
    setModal(true);
  };

  const save = () => {
    const net = (Number(form.basic)||0) + (Number(form.allowances)||0) - (Number(form.deductions)||0);
    const sal = {
      id: editSal?.id || `sal_${Date.now()}`,
      userId: form.userId, month,
      basicSalary: Number(form.basic), allowances: Number(form.allowances),
      deductions: Number(form.deductions), netSalary: net,
      paidOn: form.paidOn, paidBy: user.id, note: form.note
    };
    setState(p => ({ ...p, salaries: [...p.salaries.filter(s=>s.id!==sal.id), sal] }));
    toast.show('Salary record saved');
    setModal(false);
  };

  const exportCSV = () => {
    const rows = staffInScope.map(u => {
      const sal = monthSalaries.find(s=>s.userId===u.id);
      return { Name:u.name, Role:ROLE_LABELS[u.role], Month:month, Basic:sal?.basicSalary||0, Allowances:sal?.allowances||0, Deductions:sal?.deductions||0, NetSalary:sal?.netSalary||0, PaidOn:sal?.paidOn||'', Note:sal?.note||'' };
    });
    const h = Object.keys(rows[0]);
    const csv = [h.join(','),...rows.map(r=>h.map(k=>`"${r[k]}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `salaries_${month}.csv`; a.click();
    toast.show('Salary report exported');
  };

  // P&L calc
  const monthStr = month;
  const monthRevenue = state.serviceReports.filter(r=>r.date.startsWith(monthStr)).reduce((s,r)=>s+r.totalAmount,0);
  const monthExpenses = totalPaid; // salaries as main expense
  const profit = monthRevenue - monthExpenses;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Salary & Payroll</div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard label="Month Revenue" value={fmtCurr(monthRevenue)} color={T.amber}/>
        <StatCard label="Total Salaries" value={fmtCurr(totalPaid)} color={T.red}/>
        <StatCard label="Net Profit" value={fmtCurr(profit)} color={profit>=0?T.grn:T.red} sub={profit>=0?"Surplus":"Deficit"}/>
        <StatCard label="Staff Paid" value={`${monthSalaries.length}/${staffInScope.length}`} color={T.navy}/>
      </div>

      <Card style={{ marginBottom:16, background:profit>=0?T.grnL:T.redL, border:`1px solid ${profit>=0?T.grn:T.red}44` }}>
        <div style={{ fontSize:13, fontWeight:700, color:profit>=0?T.grn:T.red, marginBottom:8 }}>
          {profit>=0?'✅ Profitable month':'❌ Loss this month'} — {month}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[['Revenue',monthRevenue,T.navy],['Expenses (Salaries)',totalPaid,T.red],['Net P&L',profit,profit>=0?T.grn:T.red]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:T.txt2, fontWeight:700, textTransform:"uppercase" }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:800, color:c }}>{fmtCurr(v)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display:"flex", gap:12, marginBottom:16, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Month</label>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ padding:"7px 12px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/></div>
        <Btn onClick={exportCSV} variant="ghost" size="sm">📥 Export CSV</Btn>
      </div>

      <Table cols={[
        {key:"name",label:"Name",render:r=><b>{r.name}</b>},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[r.role]}>{ROLE_LABELS[r.role]}</Badge>},
        {key:"basic",label:"Basic",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id); return s?fmtCurr(s.basicSalary):<span style={{color:T.txt3}}>—</span>; }},
        {key:"allow",label:"Allowances",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id); return s?fmtCurr(s.allowances):'—'; }},
        {key:"ded",label:"Deductions",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id); return s?<span style={{color:T.red}}>{fmtCurr(s.deductions)}</span>:'—'; }},
        {key:"net",label:"Net Salary",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id); return s?<b style={{color:T.grn}}>{fmtCurr(s.netSalary)}</b>:<Badge color={T.red}>Unpaid</Badge>; }},
        {key:"paidOn",label:"Paid On",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id); return s?fmtDate(s.paidOn):'—'; }},
        {key:"action",label:"",render:r=>{ const s=monthSalaries.find(sal=>sal.userId===r.id);
          return <Btn onClick={()=>s?openEdit(s):openNew(r.id)} size="sm" variant={s?"outline":"amber"}>{s?"Edit":"Add"}</Btn>; }},
      ]} rows={staffInScope}/>

      <Modal open={modal} onClose={()=>setModal(false)} title="Salary Record">
        <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>{state.users.find(u=>u.id===form.userId)?.name} — {month}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          <Input label="Basic Salary" type="number" value={form.basic} onChange={v=>setForm(p=>({...p,basic:v}))}/>
          <Input label="Allowances" type="number" value={form.allowances} onChange={v=>setForm(p=>({...p,allowances:v}))}/>
          <Input label="Deductions" type="number" value={form.deductions} onChange={v=>setForm(p=>({...p,deductions:v}))}/>
        </div>
        <div style={{ background:T.navyXL, padding:"10px 14px", borderRadius:8, marginBottom:14, fontWeight:700 }}>
          Net Salary: {fmtCurr((Number(form.basic)||0)+(Number(form.allowances)||0)-(Number(form.deductions)||0))}
        </div>
        <Input label="Paid On" type="date" value={form.paidOn} onChange={v=>setForm(p=>({...p,paidOn:v}))}/>
        <Input label="Note" value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Optional note"/>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={save} variant="success">Save</Btn>
          <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COUNTER-WISE ANALYSIS (shared by Executive/Manager/MD)
// ═══════════════════════════════════════════════════════════════════════════════
function CounterAnalysis({ user, state, counterFilter }) {
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const getRangeLabel = () => ({ week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year", custom:"Custom Range" }[range]);

  const getDateRange = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    if (range === "week") {
      const day = now.getDay(), diff = now.getDate() - day + (day===0?-6:1);
      const mon = new Date(now.setDate(diff));
      const sun = new Date(now); sun.setDate(mon.getDate()+6);
      return [mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]];
    }
    if (range === "month") return [`${y}-${String(m+1).padStart(2,'0')}-01`, `${y}-${String(m+1).padStart(2,'0')}-31`];
    if (range === "quarter") {
      const q = Math.floor(m/3);
      return [`${y}-${String(q*3+1).padStart(2,'0')}-01`, `${y}-${String(Math.min(q*3+3,12)).padStart(2,'0')}-31`];
    }
    if (range === "year") return [`${y}-01-01`, `${y}-12-31`];
    return [customFrom, customTo];
  };

  const [from, to] = getDateRange();

  const filteredReports = state.serviceReports.filter(r => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (counterFilter) {
      const sup = state.users.find(u=>u.id===r.supervisorId);
      if (sup?.counter !== counterFilter && !(r.counters||[]).some(c=>c.counterName===counterFilter)) return false;
    }
    return true;
  });

  const serviceEntries = (r) => (r.counters||[]).flatMap(c=>c.entries||[]).filter(e=>{
    const wt = state.workTypes.find(w=>w.id===e.workTypeId);
    return wt?.category !== 'sales' && !['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].includes(e.workTypeName);
  });
  const salesEntries = (r) => (r.counters||[]).flatMap(c=>c.entries||[]).filter(e=>{
    const wt = state.workTypes.find(w=>w.id===e.workTypeId);
    return wt?.category === 'sales' || ['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].includes(e.workTypeName);
  });

  // Build per-counter stats
  const counterStats = state.counters.map(c => {
    const reps = filteredReports.filter(r=>r.supervisorId===c.supervisorId||(r.counters||[]).some(x=>x.counterName===c.name));
    const svcTotal = reps.reduce((s,r)=>s+serviceEntries(r).reduce((ss,e)=>ss+e.amount,0),0);
    const salTotal = reps.reduce((s,r)=>s+salesEntries(r).reduce((ss,e)=>ss+e.amount,0),0);
    const total = svcTotal + salTotal;
    const vehicles = reps.reduce((s,r)=>s+(r.counters||[]).flatMap(c=>c.entries||[]).reduce((ss,e)=>ss+(Number(e.vehicles)||0),0),0);
    const days = new Set(reps.map(r=>r.date)).size;
    const dailyAvg = days ? Math.round(total/days) : 0;
    return { ...c, svcTotal, salTotal, total, vehicles, days, dailyAvg };
  }).filter(c => !counterFilter || c.name === counterFilter);

  const grandTotal = counterStats.reduce((s,c)=>s+c.total,0);
  const maxTotal = Math.max(...counterStats.map(c=>c.total),1);

  // Work type breakdown
  const wtMap = {};
  filteredReports.forEach(r=>(r.counters||[]).flatMap(c=>c.entries||[]).forEach(e=>{
    if(e.vehicles>0) wtMap[e.workTypeName]=(wtMap[e.workTypeName]||0)+e.amount;
  }));
  const wtArr = Object.entries(wtMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxWt = wtArr[0]?.[1]||1;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Counter-wise Analysis</div>

      {/* Range selector */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {["week","month","quarter","year","custom"].map(r=>(
          <button key={r} onClick={()=>setRange(r)} style={{
            padding:"7px 16px", borderRadius:20, border:`1px solid ${range===r?T.navy:T.bdrS}`,
            background:range===r?T.navy:"transparent", color:range===r?"#fff":T.txt2,
            fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit"
          }}>{r==="week"?"Week":r==="month"?"Month":r==="quarter"?"Quarter":r==="year"?"Year":"Custom"}</button>
        ))}
        {range==="custom" && (
          <>
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ padding:"6px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ padding:"6px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
          </>
        )}
      </div>
      <div style={{ fontSize:12, color:T.txt2, marginBottom:16 }}>{getRangeLabel()} · {filteredReports.length} reports · Grand Total: <b style={{color:T.amber}}>{fmtCurr(grandTotal)}</b></div>

      {/* Counter cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14, marginBottom:20 }}>
        {counterStats.map(c=>(
          <Card key={c.id} style={{ borderTop:`3px solid ${T.amber}` }}>
            <div style={{ fontWeight:800, marginBottom:4 }}>{c.name}</div>
            <div style={{ fontSize:12, color:T.txt2, marginBottom:8 }}>{c.days} day(s) reported</div>
            <div style={{ fontSize:20, fontWeight:800, color:T.amber, marginBottom:4 }}>{fmtCurr(c.total)}</div>
            <div style={{ height:6, background:T.surf, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${c.total/maxTotal*100}%`, background:T.amber, borderRadius:3 }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, fontSize:11, color:T.txt2 }}>
              <div><div style={{fontWeight:700,color:T.navy}}>Service</div>{fmtCurr(c.svcTotal)}</div>
              <div><div style={{fontWeight:700,color:T.grn}}>Sales</div>{fmtCurr(c.salTotal)}</div>
              <div><div style={{fontWeight:700,color:T.txt2}}>Vehicles</div>{c.vehicles}</div>
            </div>
            <div style={{ marginTop:6, fontSize:11, color:T.txt2 }}>Daily avg: <b>{fmtCurr(c.dailyAvg)}</b></div>
          </Card>
        ))}
      </div>

      {/* Top work types */}
      {wtArr.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Top work types — {getRangeLabel()}</div>
          {wtArr.map(([name, rev]) => (
            <div key={name} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:13 }}>{name}</span>
                <b style={{ fontSize:13, color:T.navy }}>{fmtCurr(rev)}</b>
              </div>
              <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${rev/maxWt*100}%`, background:T.navy, borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLANNED LEAVE (Staff → Executive approval)
// ═══════════════════════════════════════════════════════════════════════════════
function PlannedLeavePortal({ user, state, setState, toast, mode }) {
  // mode: 'staff' = field staff submitting, 'executive' = executive approving
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [reason, setReason] = useState("");

  const myPlanned   = state.plannedLeaves.filter(l=>l.userId===user.id);
  const toApprove   = state.plannedLeaves.filter(l=>l.supervisorId===user.id);
  const pendingCount = toApprove.filter(l=>l.status==='pending').length;

  const submit = () => {
    if (!from || !reason.trim()) { toast.show("Fill from date and reason","error"); return; }
    const sup = state.users.find(u=>u.id===user.managerId);
    const pl = { id:`pl_${Date.now()}`, userId:user.id, staffName:user.name, supervisorId:user.managerId, fromDate:from, toDate:to||from, reason, status:"pending", appliedOn:today() };
    setState(p=>({...p, plannedLeaves:[...(p.plannedLeaves||[]), pl]}));
    toast.show("Leave request submitted to " + (sup?.name||"Executive"));
    setFrom(""); setTo(""); setReason("");
  };

  const decide = (id, status) => {
    setState(p=>({...p, plannedLeaves:p.plannedLeaves.map(l=>l.id===id?{...l,status,decidedOn:today()}:l)}));
    toast.show(status==="approved"?"Leave approved":"Leave rejected");
  };

  if (mode === 'executive') return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Staff Leave Approvals {pendingCount>0&&<Badge color={T.red} style={{marginLeft:8}}>{pendingCount} pending</Badge>}</div>
      {toApprove.filter(l=>l.status==='pending').map(l=>(
        <Card key={l.id} style={{ marginBottom:12, borderLeft:`4px solid ${T.amb}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>{l.staffName}</div>
              <div style={{ fontSize:13, color:T.txt2 }}>{fmtDate(l.fromDate)}{l.toDate!==l.fromDate?` → ${fmtDate(l.toDate)}`:''}</div>
              <div style={{ fontSize:13, marginTop:4 }}>"{l.reason}"</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>decide(l.id,'approved')} variant="success" size="sm">✓ Approve</Btn>
              <Btn onClick={()=>decide(l.id,'rejected')} variant="danger"  size="sm">✗ Reject</Btn>
            </div>
          </div>
        </Card>
      ))}
      {toApprove.filter(l=>l.status==='pending').length===0 && <Card><div style={{textAlign:"center",padding:20,color:T.txt3}}>No pending leave requests</div></Card>}
      {toApprove.filter(l=>l.status!=='pending').length > 0 && <>
        <div style={{ fontSize:14, fontWeight:700, marginTop:20, marginBottom:12 }}>Reviewed</div>
        <Table cols={[
          {key:"staffName",label:"Staff"},
          {key:"fromDate",label:"From",render:r=>fmtDate(r.fromDate)},
          {key:"reason",label:"Reason"},
          {key:"status",label:"Status",render:r=><Badge color={r.status==="approved"?T.grn:T.red}>{r.status}</Badge>},
        ]} rows={toApprove.filter(l=>l.status!=='pending')}/>
      </>}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Plan a Leave</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>New Leave Request</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Input label="From" type="date" value={from} onChange={setFrom}/>
            <Input label="To"   type="date" value={to}   onChange={setTo}/>
          </div>
          <Input label="Reason" value={reason} onChange={setReason} placeholder="Reason for leave..." required/>
          <Btn onClick={submit}>Submit Request</Btn>
        </Card>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>My Requests</div>
          {myPlanned.length===0 ? <div style={{color:T.txt3,fontSize:13}}>No requests yet</div> :
            myPlanned.sort((a,b)=>b.appliedOn.localeCompare(a.appliedOn)).map(l=>(
              <div key={l.id} style={{ padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{fmtDate(l.fromDate)}{l.toDate!==l.fromDate?` → ${fmtDate(l.toDate)}`:''}</div>
                    <div style={{fontSize:12,color:T.txt2}}>{l.reason}</div>
                  </div>
                  <Badge color={l.status==="approved"?T.grn:l.status==="rejected"?T.red:T.amber}>{l.status}</Badge>
                </div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC FEEDBACK FORM  (no login required)
// ═══════════════════════════════════════════════════════════════════════════════
function PublicFeedbackForm({ counterName, counters, onSubmit }) {
  const counter = counters.find(c => c.name === counterName);
  const [vehicleNo, setVehicleNo]     = useState("");
  const [customerName, setCustomerName] = useState("");
  const [serviceType, setServiceType]   = useState("");
  const [rating, setRating]             = useState(0);
  const [comment, setComment]           = useState("");
  const [submitted, setSubmitted]       = useState(false);
  const [hovered, setHovered]           = useState(0);
  const [err, setErr]                   = useState("");

  const serviceOptions = [
    "WASH","PDI.WASH","PDI","AC VENT","GLASS CLEAN","FULL BODY ANTIRUST",
    "INTERNAL COAT","SERVICE+","UNDERCOAT","DRYWASH","AIRCON SPRAY","VACCUM",
    "POLISH","INTERIOR","DECARBON","MUFFLER","ANTIRUST","UNDECOAT",
    "WAX","WINDSHIELD","SILENCER COAT","HANDPOLISH","FULL GLASS","OTHER"
  ];

  const ratingLabels = { 1:"Poor", 2:"Below average", 3:"Average", 4:"Good", 5:"Excellent" };

  const handleSubmit = () => {
    if (!rating)       { setErr("Please select a star rating"); return; }
    if (!vehicleNo.trim()) { setErr("Please enter your vehicle number"); return; }
    if (!serviceType)  { setErr("Please select the service received"); return; }
    setErr("");
    const fb = {
      id: `f_${Date.now()}`,
      counterId: counter?.id || "",
      counterName,
      date: today(),
      submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      vehicleNo: vehicleNo.trim().toUpperCase(),
      customerName: customerName.trim(),
      serviceType,
      rating,
      comment: comment.trim(),
      source: "public_form"
    };
    onSubmit(fb);
    setSubmitted(true);
  };

  if (!counter) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${T.navy},${T.navyL})`, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:32, maxWidth:400, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>❌</div>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Invalid feedback link</div>
        <div style={{ color:T.txt2, fontSize:13 }}>This feedback link is not valid. Please ask the service staff for the correct link.</div>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${T.navy},${T.navyL})`, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, maxWidth:420, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🙏</div>
        <div style={{ fontSize:22, fontWeight:800, color:T.grn, marginBottom:8 }}>Thank you!</div>
        <div style={{ fontSize:14, color:T.txt2, lineHeight:1.7, marginBottom:24 }}>
          Your feedback for <b>{counterName}</b> has been recorded.<br/>
          It helps us serve you better.
        </div>
        <div style={{ background:T.grnL, border:`1px solid ${T.grn}44`, borderRadius:12, padding:"12px 16px", fontSize:13, color:T.grn, fontWeight:600 }}>
          {"⭐".repeat(rating)} {ratingLabels[rating]}
        </div>
        <div style={{ marginTop:20, fontSize:12, color:T.txt3 }}>Benaka Enterprises · Auto Polish Services</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${T.navy} 0%,${T.navyL} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:460 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ width:56, height:56, background:T.amber, borderRadius:14, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:12 }}>✨</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fff" }}>Benaka Enterprises</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.65)", marginTop:3 }}>Customer Feedback</div>
        </div>

        <div style={{ background:"#fff", borderRadius:20, padding:28 }}>
          {/* Counter name */}
          <div style={{ background:T.navyXL, border:`1px solid ${T.navy}22`, borderRadius:10, padding:"10px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>🏪</span>
            <div>
              <div style={{ fontSize:11, color:T.txt2, fontWeight:700, textTransform:"uppercase", letterSpacing:".04em" }}>Service Counter</div>
              <div style={{ fontSize:15, fontWeight:800, color:T.navy }}>{counterName}</div>
            </div>
          </div>

          {/* Star rating — big and prominent */}
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.txt2, textTransform:"uppercase", letterSpacing:".04em", marginBottom:12 }}>
              How was the service? <span style={{ color:T.red }}>*</span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
              {[1,2,3,4,5].map(r => (
                <button key={r}
                  onClick={() => setRating(r)}
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(0)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:40, transition:"transform .1s",
                    transform: r <= (hovered||rating) ? "scale(1.15)" : "scale(1)",
                    filter: r <= (hovered||rating) ? "none" : "grayscale(1) opacity(.35)" }}>
                  ⭐
                </button>
              ))}
            </div>
            {(hovered||rating) > 0 && (
              <div style={{ marginTop:8, fontSize:14, fontWeight:700, color:T.amber }}>
                {ratingLabels[hovered||rating]}
              </div>
            )}
          </div>

          {/* Vehicle number */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>
              Vehicle Number <span style={{ color:T.red }}>*</span>
            </label>
            <input value={vehicleNo} onChange={e=>setVehicleNo(e.target.value.toUpperCase())} placeholder="e.g. KA01AB1234"
              style={{ width:"100%", padding:"10px 14px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:15, fontFamily:"inherit", outline:"none",
                textTransform:"uppercase", letterSpacing:1, fontWeight:600, boxSizing:"border-box" }}/>
          </div>

          {/* Service type */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>
              Service Received <span style={{ color:T.red }}>*</span>
            </label>
            <select value={serviceType} onChange={e=>setServiceType(e.target.value)}
              style={{ width:"100%", padding:"10px 14px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff" }}>
              <option value="">Select service type...</option>
              {serviceOptions.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Customer name (optional) */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>
              Your Name <span style={{ fontSize:11, fontWeight:400, color:T.txt3 }}>(optional)</span>
            </label>
            <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Your name"
              style={{ width:"100%", padding:"10px 14px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
          </div>

          {/* Comments */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase", letterSpacing:".04em" }}>
              Comments <span style={{ fontSize:11, fontWeight:400, color:T.txt3 }}>(optional)</span>
            </label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="Tell us what we did well or how we can improve..."
              rows={3}
              style={{ width:"100%", padding:"10px 14px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
          </div>

          {err && <div style={{ background:T.redL, border:`1px solid ${T.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:T.red, marginBottom:14 }}>{err}</div>}

          <button onClick={handleSubmit}
            style={{ width:"100%", padding:"13px", background:T.navy, color:"#fff", border:"none", borderRadius:10, fontSize:16, fontWeight:800, cursor:"pointer", transition:"background .15s" }}
            onMouseEnter={e=>e.target.style.background=T.navyL}
            onMouseLeave={e=>e.target.style.background=T.navy}>
            Submit Feedback →
          </button>

          <div style={{ textAlign:"center", fontSize:11, color:T.txt3, marginTop:14 }}>
            Benaka Enterprises · Auto Polish Services
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldStaffPortal({ user, state, setState, logout, toast }) {
  const [page, setPage] = useState("home");
  return (
    <div style={{ minHeight:"100vh", background:T.surf, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:T.navy, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:16 }}>✨ Benaka Enterprises</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ color:"rgba(255,255,255,.7)", fontSize:12 }}>{user.name}</span>
          <Btn onClick={logout} variant="ghost" size="sm" style={{ color:"rgba(255,255,255,.7)", border:"1px solid rgba(255,255,255,.2)" }}>Sign out</Btn>
        </div>
      </div>
      <div style={{ padding:24, maxWidth:520, margin:"0 auto" }}>
        {page==="home" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>👋</div>
            <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>Hello, {user.name}</div>
            <div style={{ color:T.txt2, marginBottom:24 }}>Your attendance is marked by your Executive</div>
            <Btn onClick={()=>setPage("leave")} variant="amber" size="lg" style={{ width:"100%", justifyContent:"center", marginBottom:12 }}>🗓️ Request Planned Leave</Btn>
          </div>
        )}
        {page==="leave" && (
          <div>
            <Btn onClick={()=>setPage("home")} variant="ghost" size="sm" style={{marginBottom:16}}>← Back</Btn>
            <PlannedLeavePortal user={user} state={state} setState={setState} toast={toast} mode="staff"/>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useLocalStorage("benaka_state", { ...INITIAL_STATE, currentUser: null });
  const { show, Toast } = useToast();

  // Ensure passwords persist
  useEffect(() => {
    setState(p => ({ ...p, passwords: p.passwords || INITIAL_STATE.passwords }));
  }, []);

  const login  = (user) => setState(p => ({ ...p, currentUser: user }));
  const logout = useCallback(() => setState(p => ({ ...p, currentUser: null })), []);

  // Auto-logout after 10 minutes of inactivity
  useAutoLogout(!!state.currentUser, logout, 10);

  // ── Public feedback form detection ─────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const fbCounter  = params.get("feedback");
  if (fbCounter) {
    const handleFbSubmit = (fb) => setState(p => ({ ...p, feedback: [...(p.feedback||[]), fb] }));
    return <PublicFeedbackForm counterName={decodeURIComponent(fbCounter)} counters={state.counters} onSubmit={handleFbSubmit}/>;
  }
  // ───────────────────────────────────────────────────────────────────────────

  if (!state.currentUser) {
    return <>
      <LoginScreen onLogin={login} users={state.users} passwords={state.passwords || INITIAL_STATE.passwords}/>
      <Toast/>
    </>;
  }

  const props = { user: state.currentUser, state, setState, toast: { show } };

  return (
    <>
      {state.currentUser.role === "supervisor"  && <SupervisorPortal {...props}/>}
      {state.currentUser.role === "manager"     && <ManagerPortal {...props}/>}
      {state.currentUser.role === "md"          && <MDPortal {...props}/>}
      {state.currentUser.role === "office"      && <OfficePortal {...props}/>}
      {state.currentUser.role === "it_admin"    && <ITAdminPortal {...props}/>}
      {state.currentUser.role === "field_staff" && (
        <FieldStaffPortal user={state.currentUser} state={state} setState={setState} logout={logout} toast={{show}}/>
      )}
      <Toast/>
    </>
  );
}
