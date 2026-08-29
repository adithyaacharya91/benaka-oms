import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Supabase client ──────────────────────────────────────────────────────────
// Supabase credentials — configured for benakaoms project
const SUPABASE_URL = "https://hrqyuxwpxiffyqolpgdo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXl1eHdweGlmZnlxb2xwZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTYzOTMsImV4cCI6MjEwMzU5MjM5M30.EOMujy8n-pHPaBcYj8UZe_u2Bfa3IQ02dRPT_ZioKAs";

const supabase = (() => {
  const headers = { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" };
  const rpc  = (path, body) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method:"POST", headers, body:JSON.stringify(body) }).then(r=>r.json());
  const get  = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }).then(r=>r.json());
  const post = (table, data) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:"POST", headers, body:JSON.stringify(data) }).then(r=>r.json());
  const patch = (table, filter, data) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"PATCH", headers:{ ...headers, "Prefer":"return=representation"}, body:JSON.stringify(data) }).then(r=>r.json());
  const del  = (table, filter) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"DELETE", headers }).then(r=>r.json());
  const from = (table) => ({
    select: (cols="*") => ({ 
      eq: (col,val) => get(`${table}?select=${cols}&${col}=eq.${val}`),
      gte: (col,val) => ({ lte: (c2,v2) => get(`${table}?select=${cols}&${col}=gte.${val}&${c2}=lte.${v2}`) }),
      order: (col,{ascending=true}={}) => get(`${table}?select=${cols}&order=${col}.${ascending?"asc":"desc"}`),
      then: (fn) => get(`${table}?select=${cols}`).then(fn)
    }),
    insert: (data) => post(table, data),
    update: (data) => ({ eq: (col,val) => patch(table, `${col}=eq.${val}`, data) }),
    delete: () => ({ eq: (col,val) => del(table, `${col}=eq.${val}`) }),
    upsert: (data, opts) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:"POST", headers:{ ...headers, "Prefer":"resolution=merge-duplicates,return=representation"}, body:JSON.stringify(data) }).then(r=>r.json()),
  });
  // Real-time via polling (works without WebSocket setup)
  const subscriptions = {};
  const subscribe = (table, cb, intervalMs=5000) => {
    if (subscriptions[table]) clearInterval(subscriptions[table]);
    subscriptions[table] = setInterval(() => get(`${table}?select=*&order=created_at.desc&limit=1`).then(cb), intervalMs);
    return () => clearInterval(subscriptions[table]);
  };
  return { from, subscribe };
})();

// ─── DB helpers ───────────────────────────────────────────────────────────────
const DB = {
  // Service Reports
  async getReports(filter={}) {
    let url = `${SUPABASE_URL}/rest/v1/service_reports?select=*`;
    if (filter.date) url += `&date=eq.${filter.date}`;
    if (filter.supervisorId) url += `&supervisor_id=eq.${filter.supervisorId}`;
    if (filter.fromDate) url += `&date=gte.${filter.fromDate}&date=lte.${filter.toDate||filter.fromDate}`;
    const r = await fetch(url, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertReport(report) {
    const row = {
      id: report.id,
      date: report.date,
      supervisor_id: report.supervisorId,
      counter_id: report.counterId || null,
      counter_name: report.counterName || null,
      submitted_at: report.submittedAt,
      counters: report.counters || [],
      entries: report.entries || [],
      total_amount: report.totalAmount,
      notes: report.notes,
      status: report.status
    };
    return supabase.from("service_reports").upsert(row);
  },
  // Attendance
  async getAttendance(filter={}) {
    let url = `${SUPABASE_URL}/rest/v1/attendance?select=*`;
    if (filter.date) url += `&date=eq.${filter.date}`;
    if (filter.supervisorId) url += `&supervisor_id=eq.${filter.supervisorId}`;
    const r = await fetch(url, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertAttendance(records) {
    const rows = records.map(a => ({ id: a.id, date: a.date, supervisor_id: a.supervisorId, staff_id: a.staffId, status: a.status, reason: a.reason, marked_at: a.markedAt }));
    return supabase.from("attendance").upsert(rows);
  },
  // Leaves
  async getLeaves() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leaves?select=*&order=created_at.desc`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertLeave(leave) {
    return supabase.from("leaves").upsert(leave);
  },
  // Feedback
  async getFeedback() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/feedback?select=*&order=created_at.desc`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async insertFeedback(fb) {
    return supabase.from("feedback").insert(fb);
  },
  // Collection Reports
  async getCollectionReports(filter={}) {
    let url = `${SUPABASE_URL}/rest/v1/collection_reports?select=*`;
    if (filter.date) url += `&date=eq.${filter.date}`;
    const r = await fetch(url, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertCollectionReport(rep) {
    return supabase.from("collection_reports").upsert(rep);
  },
  // Salaries
  async getSalaries(month) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/salaries?select=*${month?`&month=eq.${month}`:""}`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertSalary(sal) {
    return supabase.from("salaries").upsert(sal);
  },
};

// ─── Sync hook — loads all data from Supabase, falls back to localStorage ─────
function useSupabaseSync(localState, setLocalState) {
  const [synced, setSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error | offline

  const isConfigured = true; // Supabase is configured

  const syncFromCloud = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const [reports, attendance, leaves, feedback, salaries, collReports] = await Promise.all([
        DB.getReports(), DB.getAttendance(), DB.getLeaves(), DB.getFeedback(), DB.getSalaries(), DB.getCollectionReports()
      ]);

      // Check if tables exist — Supabase returns {code:"42P01"} if table missing
      const tablesExist = Array.isArray(reports);
      if (!tablesExist) {
        console.warn("Supabase tables not yet created. Run supabase-setup.sql first.", reports);
        setSyncStatus("setup_needed");
        setSynced(true);
        return;
      }

      const mapReport = r => ({
        id: r.id, date: r.date, supervisorId: r.supervisor_id,
        submittedAt: r.submitted_at, counters: r.counters||[],
        counterId: r.counter_id, counterName: r.counter_name,
        entries: r.entries||[], totalAmount: r.total_amount,
        notes: r.notes, status: r.status
      });
      const mapAtt = a => ({
        id: a.id, date: a.date, supervisorId: a.supervisor_id,
        staffId: a.staff_id, status: a.status,
        reason: a.reason, markedAt: a.marked_at
      });

      setLocalState(p => ({
        ...p,
        serviceReports:    reports.map(mapReport),
        attendance:        attendance.map ? attendance.map(mapAtt) : p.attendance,
        leaves:            Array.isArray(leaves)     ? leaves     : p.leaves,
        feedback:          Array.isArray(feedback)   ? feedback   : p.feedback,
        salaries:          Array.isArray(salaries)   ? salaries   : p.salaries,
        collectionReports: Array.isArray(collReports)? collReports: p.collectionReports,
      }));
      setSyncStatus("ok");
    } catch(e) {
      console.error("Sync error:", e);
      setSyncStatus("error");
    }
    setSynced(true);
  }, []);

  useEffect(() => { syncFromCloud(); }, []);

  // Poll every 30 seconds for real-time updates
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(syncFromCloud, 30000);
    return () => clearInterval(interval);
  }, [isConfigured, syncFromCloud]);

  return { synced, syncStatus, syncFromCloud, isConfigured };
}


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
    { id:"u_md", empId:"MD001", name:"Adithya Acharya", role:"md", email:"adithyaacharya@gmail.com", phone:"", dob:"", joining:"", weddingAnniversary:"", active:true, managerId:null, counter:"OFFICE" },
    { id:"u1", empId:"MGR001", name:"Cyril Pinto", role:"manager", email:"cyril.pinto@benaka.com", phone:"", dob:"1977-04-01", joining:"2003-08-10", weddingAnniversary:"2001-04-13", active:true, managerId:"u_md", counter:"OFFICE" },
    { id:"u2", empId:"EXE002", name:"Gururaj", role:"supervisor", email:"gururaj@benaka.com", phone:"", dob:"1978-06-24", joining:"2009-05-04", weddingAnniversary:"2008-09-04", active:true, managerId:"u1", counter:"OFFICE" },
    { id:"u3", empId:"OFF003", name:"Geetha Pinto", role:"office", email:"geetha.pinto@benaka.com", phone:"", dob:"1982-08-07", joining:"2009-04-01", weddingAnniversary:"2001-04-13", active:true, managerId:"u1", counter:"OFFICE" },
    { id:"u4", empId:"OFF004", name:"Prathima M", role:"office", email:"prathima.m@benaka.com", phone:"", dob:"1992-07-22", joining:"2014-06-19", weddingAnniversary:"2015-04-06", active:true, managerId:"u1", counter:"OFFICE" },
    { id:"u5", empId:"OFF005", name:"Jayashri B", role:"office", email:"jayashri.b@benaka.com", phone:"", dob:"1983-03-15", joining:"2024-02-05", weddingAnniversary:"2011-10-16", active:true, managerId:"u1", counter:"OFFICE" },
    { id:"u6", empId:"EXE006", name:"Shekhar", role:"supervisor", email:"shekhar@benaka.com", phone:"", dob:"1990-05-25", joining:"2010-02-15", weddingAnniversary:"", active:true, managerId:"u1", counter:"PAI SALES MANGALORE" },
    { id:"u7", empId:"WRK007", name:"Ragavendra Acharya", role:"field_staff", email:"", phone:"", dob:"1979-08-15", joining:"2016-10-14", weddingAnniversary:"2010-11-14", active:true, managerId:"u6", counter:"PAI SALES MANGALORE" },
    { id:"u8", empId:"WRK008", name:"Shiva (Akash)", role:"field_staff", email:"", phone:"", dob:"2005-01-06", joining:"2023-03-16", weddingAnniversary:"", active:true, managerId:"u6", counter:"PAI SALES MANGALORE" },
    { id:"u9", empId:"WRK009", name:"Manvith", role:"field_staff", email:"", phone:"", dob:"2009-07-24", joining:"2026-06-02", weddingAnniversary:"", active:true, managerId:"u6", counter:"PAI SALES MANGALORE" },
    { id:"u10", empId:"EXE010", name:"Roopesh", role:"supervisor", email:"roopesh@benaka.com", phone:"", dob:"1981-09-04", joining:"2010-06-02", weddingAnniversary:"2014-12-01", active:true, managerId:"u1", counter:"PAI SALES UDUPI" },
    { id:"u11", empId:"EXE011", name:"Vijesh Sagar", role:"supervisor", email:"vijesh.sagar@benaka.com", phone:"", dob:"1990-04-13", joining:"2009-03-01", weddingAnniversary:"2024-12-22", active:true, managerId:"u1", counter:"BHARATH AUTO CARS" },
    { id:"u12", empId:"WRK012", name:"Balakrishnan", role:"field_staff", email:"", phone:"", dob:"1961-03-17", joining:"2015-04-01", weddingAnniversary:"1983-09-17", active:true, managerId:"u1", counter:"HONDA PVS" },
    { id:"u13", empId:"WRK013", name:"Prashanth", role:"field_staff", email:"", phone:"", dob:"1989-05-10", joining:"2026-02-04", weddingAnniversary:"", active:true, managerId:"u1", counter:"HONDA PVS" },
    { id:"u14", empId:"WRK014", name:"Vinod", role:"field_staff", email:"", phone:"", dob:"2005-07-28", joining:"2026-01-12", weddingAnniversary:"", active:true, managerId:"u1", counter:"PAI SALES NISSAN" },
    { id:"u15", empId:"WRK015", name:"Shashanth", role:"field_staff", email:"", phone:"", dob:"2006-04-11", joining:"2025-03-15", weddingAnniversary:"", active:true, managerId:"u1", counter:"PAI SALES NISSAN" },
    { id:"u16", empId:"EXE016", name:"Dinesh Acharya", role:"supervisor", email:"dinesh.acharya@benaka.com", phone:"", dob:"1980-10-17", joining:"2018-05-14", weddingAnniversary:"2014-12-03", active:true, managerId:"u1", counter:"HONDA BELTHANGADY" },
    { id:"u17", empId:"EXE017", name:"Abhishek", role:"supervisor", email:"abhishek@benaka.com", phone:"", dob:"1990-10-16", joining:"2020-12-01", weddingAnniversary:"2024-04-28", active:true, managerId:"u1", counter:"AUTOMATRIX MANGALORE" },
    { id:"u18", empId:"WRK018", name:"Keshava", role:"field_staff", email:"", phone:"", dob:"1962-01-01", joining:"2023-01-11", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u19", empId:"WRK019", name:"Ramakrishna", role:"field_staff", email:"", phone:"", dob:"1977-10-19", joining:"2017-07-01", weddingAnniversary:"2000-05-13", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u20", empId:"WRK020", name:"Sukumar", role:"field_staff", email:"", phone:"", dob:"1960-10-21", joining:"2013-10-16", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u21", empId:"WRK021", name:"Mohini", role:"field_staff", email:"", phone:"", dob:"1985-03-08", joining:"2023-11-01", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u22", empId:"WRK022", name:"Bharath", role:"field_staff", email:"", phone:"", dob:"2006-10-28", joining:"2025-09-02", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u23", empId:"WRK023", name:"Gangadhar", role:"field_staff", email:"", phone:"", dob:"1966-05-10", joining:"2010-04-02", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u24", empId:"WRK024", name:"Rakesh", role:"field_staff", email:"", phone:"", dob:"1989-06-13", joining:"2025-02-05", weddingAnniversary:"", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u25", empId:"WRK025", name:"Latha", role:"field_staff", email:"", phone:"", dob:"1979-07-26", joining:"2025-10-07", weddingAnniversary:"2000-03-13", active:true, managerId:"u17", counter:"AUTOMATRIX MANGALORE" },
    { id:"u26", empId:"EXE026", name:"Dhanush D V", role:"supervisor", email:"dhanush.d.v@benaka.com", phone:"", dob:"1998-09-28", joining:"2017-09-01", weddingAnniversary:"", active:true, managerId:"u1", counter:"AUTOMATRIX PUTTUR" },
    { id:"u27", empId:"WRK027", name:"Sathish", role:"field_staff", email:"", phone:"", dob:"1978-07-15", joining:"2024-05-21", weddingAnniversary:"2009-12-02", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u28", empId:"WRK028", name:"Vijayalakshmi", role:"field_staff", email:"", phone:"", dob:"1986-09-27", joining:"2023-04-01", weddingAnniversary:"2004-02-25", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u29", empId:"WRK029", name:"Priya", role:"field_staff", email:"", phone:"", dob:"1986-09-03", joining:"2025-01-01", weddingAnniversary:"2012-11-08", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u30", empId:"WRK030", name:"Dinesh", role:"field_staff", email:"", phone:"", dob:"1974-07-25", joining:"2025-05-19", weddingAnniversary:"", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u31", empId:"WRK031", name:"Vasanth", role:"field_staff", email:"", phone:"", dob:"1973-01-01", joining:"2025-12-01", weddingAnniversary:"2007-02-21", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u32", empId:"WRK032", name:"Sunil", role:"field_staff", email:"", phone:"", dob:"1980-05-09", joining:"2025-05-19", weddingAnniversary:"", active:true, managerId:"u26", counter:"AUTOMATRIX PUTTUR" },
    { id:"u33", empId:"WRK033", name:"Hemanth", role:"field_staff", email:"", phone:"", dob:"2003-06-15", joining:"2025-03-03", weddingAnniversary:"", active:true, managerId:"u1", counter:"OFFICE/COUNTER" },
    { id:"u_it", empId:"IT001", name:"Vikram Nair", role:"it_admin", email:"vikram@benaka.com", phone:"", dob:"", joining:"", weddingAnniversary:"", active:true, managerId:"u_md", counter:"OFFICE" },
  ],
  passwords: { "MD001":"md@123", "MGR001":"cyril@123", "EXE002":"gururaj@123", "OFF003":"geetha@123", "OFF004":"prathima@123", "OFF005":"jayashri@123", "EXE006":"shekhar@123", "WRK007":"ragavendra@123", "WRK008":"shiva@123", "WRK009":"manvith@123", "EXE010":"roopesh@123", "EXE011":"vijesh@123", "WRK012":"balakrishnan@123", "WRK013":"prashanth@123", "WRK014":"vinod@123", "WRK015":"shashanth@123", "EXE016":"dinesh@123", "EXE017":"abhishek@123", "WRK018":"keshava@123", "WRK019":"ramakrishna@123", "WRK020":"sukumar@123", "WRK021":"mohini@123", "WRK022":"bharath@123", "WRK023":"gangadhar@123", "WRK024":"rakesh@123", "WRK025":"latha@123", "EXE026":"dhanush@123", "WRK027":"sathish@123", "WRK028":"vijayalakshmi@123", "WRK029":"priya@123", "WRK030":"dinesh@123", "WRK031":"vasanth@123", "WRK032":"sunil@123", "WRK033":"hemanth@123", "IT001":"vikram@123" },
  counters: [
    { id:"c1", name:"OFFICE", supervisorId:"u1", dealership:"OFFICE", city:"Karnataka" },
    { id:"c2", name:"PAI SALES MANGALORE", supervisorId:"u6", dealership:"PAI SALES MANGALORE", city:"Karnataka" },
    { id:"c3", name:"PAI SALES UDUPI", supervisorId:"u10", dealership:"PAI SALES UDUPI", city:"Karnataka" },
    { id:"c4", name:"BHARATH AUTO CARS", supervisorId:"u11", dealership:"BHARATH AUTO CARS", city:"Karnataka" },
    { id:"c5", name:"HONDA PVS", supervisorId:"", dealership:"HONDA PVS", city:"Karnataka" },
    { id:"c6", name:"PAI SALES NISSAN", supervisorId:"", dealership:"PAI SALES NISSAN", city:"Karnataka" },
    { id:"c7", name:"HONDA BELTHANGADY", supervisorId:"u16", dealership:"HONDA BELTHANGADY", city:"Karnataka" },
    { id:"c8", name:"AUTOMATRIX MANGALORE", supervisorId:"u17", dealership:"AUTOMATRIX MANGALORE", city:"Karnataka" },
    { id:"c9", name:"AUTOMATRIX PUTTUR", supervisorId:"u26", dealership:"AUTOMATRIX PUTTUR", city:"Karnataka" },
    { id:"c10", name:"OFFICE/COUNTER", supervisorId:"u1", dealership:"OFFICE/COUNTER", city:"Karnataka" },
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
  attendance: [],
  serviceReports: [],
  leaves: [],
  targets: [],
  feedback: [],
  // Salary records: { id, userId, month, basicSalary, allowances, deductions, netSalary, paidOn, paidBy, note }
  salaries: [],
  // Collection reports: { id, date, supervisorId, counterName, bankEntries:[{bank,description,amount}], expenses:[{description,sbiAmount,kblAmount}] }
  collectionReports: [],
  // Planned leaves (staff → executive approval flow)
  plannedLeaves: [],
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

// ─── DateRangePicker — shared across all portals ──────────────────────────────
function DateRangePicker({ range, setRange, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const options = [
    { id:"today",   label:"Today" },
    { id:"week",    label:"This Week" },
    { id:"month",   label:"This Month" },
    { id:"quarter", label:"Quarter" },
    { id:"year",    label:"This Year" },
    { id:"custom",  label:"Custom" },
  ];
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:16 }}>
      {options.map(o=>(
        <button key={o.id} onClick={()=>setRange(o.id)} style={{
          padding:"5px 14px", borderRadius:20, border:`1px solid ${range===o.id?T.navy:T.bdrS}`,
          background:range===o.id?T.navy:"transparent", color:range===o.id?"#fff":T.txt2,
          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all .15s"
        }}>{o.label}</button>
      ))}
      {range==="custom" && <>
        <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
          style={{ padding:"5px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
        <span style={{ fontSize:12, color:T.txt2 }}>→</span>
        <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
          style={{ padding:"5px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
      </>}
    </div>
  );
}

// ─── useDateRange — shared date range logic ───────────────────────────────────
function useDateRange(defaultRange="today") {
  const [range, setRange] = useState(defaultRange);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  const getFromTo = () => {
    const now = new Date(), y=now.getFullYear(), m=now.getMonth();
    const pad = n => String(n).padStart(2,"0");
    if (range==="today")   return [today(), today()];
    if (range==="week") {
      const d=now.getDay(), diff=now.getDate()-d+(d===0?-6:1);
      const mon=new Date(now); mon.setDate(diff);
      const sun=new Date(mon); sun.setDate(mon.getDate()+6);
      return [mon.toISOString().split("T")[0], sun.toISOString().split("T")[0]];
    }
    if (range==="month")   return [`${y}-${pad(m+1)}-01`, `${y}-${pad(m+1)}-31`];
    if (range==="quarter") { const q=Math.floor(m/3); return [`${y}-${pad(q*3+1)}-01`,`${y}-${pad(Math.min(q*3+3,12))}-31`]; }
    if (range==="year")    return [`${y}-01-01`, `${y}-12-31`];
    return [customFrom||today(), customTo||today()];
  };

  const [from, to] = getFromTo();
  const label = { today:"Today", week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year", custom:`${customFrom} → ${customTo}` }[range] || "";

  return { range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, from, to, label };
}


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


// ─── Birthday notification system ────────────────────────────────────────────
function useBirthdayNotifications(state, currentUser) {
  useEffect(() => {
    if (!currentUser) return;
    if (!['md','manager','supervisor'].includes(currentUser.role)) return;

    const todayStr = today();
    const mm_dd = todayStr.slice(5); // MM-DD

    const birthdayPeople = state.users.filter(u => {
      if (!u.dob) return false;
      return u.dob.slice(5) === mm_dd; // matches MM-DD
    });

    if (birthdayPeople.length === 0) return;

    // Show in-app notification
    const names = birthdayPeople.map(u => u.name).join(', ');
    const key = `bday_notified_${todayStr}`;
    if (localStorage.getItem(key)) return; // already notified today
    localStorage.setItem(key, '1');

    // Slight delay so app has rendered
    setTimeout(() => {
      alert(`🎂 Birthday Today!

${names}

Wishing them a Happy Birthday! 🎉`);
    }, 1500);
  }, [currentUser?.id]);
}

// ─── Birthday banner component ────────────────────────────────────────────────
function BirthdayBanner({ state }) {
  const todayMD = today().slice(5);
  const bdays = state.users.filter(u => u.dob && u.dob.slice(5) === todayMD);
  if (bdays.length === 0) return null;
  return (
    <div style={{ background:"linear-gradient(90deg,#FF6B6B,#FF8E53,#FFC107)", padding:"8px 20px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
      <span style={{ fontSize:18 }}>🎂</span>
      <span style={{ color:"#fff", fontWeight:700, fontSize:13 }}>
        Birthday today: {bdays.map(u=>u.name).join(', ')} — Wish them well!
      </span>
    </div>
  );
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

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("App crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F7F9FC", fontFamily:"system-ui, sans-serif", padding:24 }}>
          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:16, padding:32, maxWidth:520, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#0F2B4A", marginBottom:8 }}>Something went wrong</div>
            <div style={{ fontSize:13, color:"#475569", marginBottom:20, lineHeight:1.7 }}>
              The app encountered an error. Please refresh the page.<br/>
              If it keeps happening, contact IT Admin.
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:8, padding:"10px 14px", fontSize:11, fontFamily:"monospace", color:"#DC2626", textAlign:"left", marginBottom:20, wordBreak:"break-all" }}>
              {this.state.error?.message || "Unknown error"}
            </div>
            <button onClick={()=>window.location.reload()} style={{ background:"#0F2B4A", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              🔄 Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
function Shell({ user, children, activePage, setActivePage, navItems, onLogout, state, syncStatus }) {
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

        {/* Sync status bar */}
        {syncStatus && syncStatus !== "idle" && (
          <div style={{ background: syncStatus==="ok"?T.grnL : syncStatus==="syncing"?"#EFF6FF" : syncStatus==="setup_needed"?"#FEF3DC" : syncStatus==="offline"?"#FEF3DC" : T.redL,
            padding:"5px 20px", fontSize:11, fontWeight:700, color: syncStatus==="ok"?T.grn : syncStatus==="syncing"?"#0369A1" : syncStatus==="setup_needed"?T.amberD : syncStatus==="offline"?T.amberD : T.red,
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
            <span>
              {syncStatus==="ok"           && "✅ All devices in sync — data saved to cloud"}
              {syncStatus==="syncing"      && "🔄 Syncing with database..."}
              {syncStatus==="setup_needed" && "⚠️ Database tables not set up — run supabase-setup.sql in Supabase SQL Editor"}
              {syncStatus==="offline"      && "⚠️ Offline mode — changes saved locally only"}
              {syncStatus==="error"        && "❌ Could not reach database — working offline"}
            </span>
          </div>
        )}
        {/* Birthday banner */}
        <BirthdayBanner state={state}/>
        {/* Page content */}
        <div style={{ flex:1, padding:24, overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPERVISOR PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function SupervisorPortal({ user, state, setState, toast, syncStatus="" }) {
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
    { id:"directory",    icon:"👤", label:"Staff Directory" },
  ];

  const myStaff = state.users.filter(u => u.managerId === user.id && u.role === "field_staff" && u.active);
  const myCounter = state.counters.find(c => c.supervisorId === user.id);
  const todayReports = state.serviceReports.filter(r => r.supervisorId === user.id && r.date === today());
  const todayAtt = state.attendance.filter(a => a.supervisorId === user.id && a.date === today());
  const todayRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="dashboard" && <SupDashboard user={user} state={state} myStaff={myStaff} myCounter={myCounter} todayRevenue={todayRevenue} todayAtt={todayAtt} setPage={setPage}/>}
      {page==="attendance" && <SupAttendance user={user} state={state} setState={setState} myStaff={myStaff} toast={toast}/>}
      {page==="report" && <SupReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="myleaves" && <LeavePortal user={user} state={state} setState={setState} toast={toast} role="supervisor"/>}
      {page==="history"     && <SupHistory user={user} state={state}/>}
      {page==="feedback"    && <SupFeedback user={user} state={state}/>}
      {page==="collection"  && <SupCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"    && <CounterAnalysis user={user} state={state} myCounterIds={state.counters.filter(c=>c.supervisorId===user.id).map(c=>c.id)}/>}
      {page==="staffleaves" && <PlannedLeavePortal user={user} state={state} setState={setState} toast={toast} mode="executive"/>}
      {page==="directory"   && <StaffDirectory state={state}/>}
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
  const dr = useDateRange("today");
  const myCounters = state.counters.filter(c => c.supervisorId === user.id);
  const [selCounter, setSelCounter] = useState("all");

  // For collection report saving, use single date (from)
  const date = dr.from;
  const existing = state.collectionReports?.find(r=>r.supervisorId===user.id&&r.date===date);

  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };

  // Filter reports by date range and counter
  const filteredReports = state.serviceReports.filter(r => {
    if (r.date < dr.from || r.date > dr.to) return false;
    if (selCounter !== "all" && r.counterId !== selCounter && r.counterName !== myCounters.find(c=>c.id===selCounter)?.name) return false;
    // Only show this executive's counters
    return myCounters.some(c=>c.id===r.counterId||c.name===r.counterName);
  });

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Collection Report</div>
      <div style={{ display:"flex", gap:10, alignItems:"flex-start", flexWrap:"wrap", marginBottom:8 }}>
        <div style={{ flex:1 }}>
          <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
        </div>
        {myCounters.length > 1 && (
          <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
            style={{ padding:"6px 12px",border:`1px solid ${T.bdrS}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none" }}>
            <option value="all">All My Counters</option>
            {myCounters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
      <CollectionReportView date={date} report={existing} counters={myCounters} allReports={filteredReports} attendance={state.attendance} users={state.users} onSave={save}/>
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
  const [tab, setTab] = useState("mark");
  const [date, setDate] = useState(today());
  const [histDate, setHistDate] = useState(today());
  const [records, setRecords] = useState({});
  const [reasons, setReasons] = useState({});

  // All staff to mark = own user + field staff
  const allToMark = [user, ...myStaff];

  useEffect(() => {
    const existing = {}; const existingR = {};
    state.attendance.filter(a=>a.supervisorId===user.id&&a.date===date).forEach(a=>{
      existing[a.staffId] = a.status; existingR[a.staffId] = a.reason||"";
    });
    setRecords(existing); setReasons(existingR);
  }, [date, state.attendance, user.id]);

  const save = () => {
    const newAtts = allToMark.map(s => ({
      id: `att_${user.id}_${s.id}_${date}`,
      date, supervisorId:user.id, staffId:s.id,
      status: records[s.id]||"present",
      reason: reasons[s.id]||"",
      markedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
    }));
    setState(p => ({ ...p, attendance:[...p.attendance.filter(a=>!(a.supervisorId===user.id&&a.date===date)),...newAtts] }));
    toast.show("Attendance saved for " + date);
  };

  const histAtt = state.attendance.filter(a=>a.supervisorId===user.id&&a.date===histDate);

  const statusBtn = (id, st) => (
    <button onClick={()=>setRecords(p=>({...p,[id]:st}))} style={{
      padding:"5px 10px", borderRadius:6, border:`1px solid ${records[id]===st?(st==="present"?T.grn:st==="absent"?T.red:T.amber):T.bdrS}`,
      background:records[id]===st?(st==="present"?T.grnL:st==="absent"?T.redL:T.amberL):"transparent",
      color:records[id]===st?(st==="present"?T.grn:st==="absent"?T.red:T.amberD):T.txt2,
      fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
    }}>{st==="half_day"?"½":st.charAt(0).toUpperCase()+st.slice(1)}</button>
  );

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Attendance</div>
      <Tabs tabs={[{id:"mark",label:"Mark Attendance"},{id:"history",label:"View Past Records"}]} active={tab} onChange={setTab}/>

      {tab==="mark" && (
        <Card style={{ maxWidth:680 }}>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 200px 1fr", gap:8, padding:"6px 0", borderBottom:`1px solid ${T.bdr}`, marginBottom:8 }}>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Staff Member</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Status</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Reason</div>
            </div>
            {allToMark.map(s => (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 200px 1fr", gap:8, alignItems:"center", marginBottom:10, background:s.id===user.id?T.navyXL:"transparent", padding:s.id===user.id?"6px 8px":"0 8px", borderRadius:6 }}>
                <div style={{fontSize:14,fontWeight:700}}>{s.name}{s.id===user.id&&<Badge color={T.navy} style={{marginLeft:6}}>You</Badge>}</div>
                <div style={{ display:"flex", gap:4 }}>
                  {["present","absent","half_day"].map(st=>statusBtn(s.id,st))}
                </div>
                <input value={reasons[s.id]||""} onChange={e=>setReasons(p=>({...p,[s.id]:e.target.value}))}
                  placeholder={records[s.id]==="absent"?"Reason required":"Optional"}
                  style={{ padding:"6px 10px", border:`1px solid ${T.bdrS}`, borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none", background:records[s.id]==="absent"?T.redL:"#fff" }}/>
              </div>
            ))}
          </div>
          <Btn onClick={save}>Save Attendance</Btn>
        </Card>
      )}

      {tab==="history" && (
        <div>
          <Input label="Select Date" type="date" value={histDate} onChange={setHistDate} style={{maxWidth:200,marginBottom:16}}/>
          {histAtt.length===0
            ? <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No attendance records for {fmtDate(histDate)}</div></Card>
            : <Table cols={[
                {key:"staff",label:"Staff",render:r=>{ const u=state.users.find(u=>u.id===r.staffId); return <b>{u?.name||r.staffId}{r.staffId===user.id?" (You)":""}</b>; }},
                {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.grn:r.status==="half_day"?T.amber:T.red}>{r.status}</Badge>},
                {key:"reason",label:"Reason",render:r=>r.reason||"—"},
                {key:"markedAt",label:"Marked At"},
              ]} rows={histAtt}/>
          }
        </div>
      )}
    </div>
  );
}

function SupReport({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  // Each counter gets its own tab
  const myCounters = state.counters.filter(c => c.supervisorId === user.id);
  const [activeCounter, setActiveCounter] = useState(myCounters[0]?.id || "");

  const serviceWTs = state.workTypes.filter(w => w.category !== "sales");
  const salesWTs   = state.workTypes.filter(w => w.category === "sales");
  const blankServiceRows = () => serviceWTs.map(wt => ({ workTypeId:wt.id, workTypeName:wt.name, vehicles:0, rate:wt.defaultRate, amount:0, type:"service" }));
  const blankSalesRows   = () => salesWTs.map(wt => ({ workTypeId:wt.id, workTypeName:wt.name, amount:0, type:"sales" }));

  // Per-counter local state: { [counterId]: { entries, salesEntries } }
  const [counterData, setCounterData] = useState({});

  // Load existing report data for each counter when date changes
  useEffect(() => {
    const newData = {};
    myCounters.forEach(c => {
      const existing = state.serviceReports.find(r =>
        r.counterId === c.id && r.supervisorId === user.id && r.date === date
      );
      if (existing) {
        newData[c.id] = {
          entries: (existing.entries||[]).filter(e => e.type !== "sales" && !salesWTs.some(w=>w.name===e.workTypeName)),
          salesEntries: (existing.entries||[]).filter(e => e.type === "sales" || salesWTs.some(w=>w.name===e.workTypeName)),
          notes: existing.notes || "",
          submitted: true,
        };
      } else {
        newData[c.id] = { entries: blankServiceRows(), salesEntries: blankSalesRows(), notes: "", submitted: false };
      }
    });
    setCounterData(newData);
    if (myCounters.length > 0 && !activeCounter) setActiveCounter(myCounters[0].id);
  }, [date, state.serviceReports.length]);

  const getData = (cid) => counterData[cid] || { entries: blankServiceRows(), salesEntries: blankSalesRows(), notes: "" };

  const updateServiceEntry = (cid, ei, field, val) => {
    setCounterData(p => {
      const d = { ...getData(cid) };
      d.entries = d.entries.map((e,i) => {
        if (i !== ei) return e;
        const u = { ...e, [field]: field==="workTypeName"?val:Number(val) };
        if (field==="vehicles"||field==="rate") u.amount = (Number(u.vehicles)||0)*(Number(u.rate)||0);
        return u;
      });
      return { ...p, [cid]: d };
    });
  };

  const updateSalesEntry = (cid, ei, field, val) => {
    setCounterData(p => {
      const d = { ...getData(cid) };
      d.salesEntries = d.salesEntries.map((e,i) => i!==ei ? e : { ...e, [field]: field==="amount"?Number(val):val });
      return { ...p, [cid]: d };
    });
  };

  const setNotes = (cid, val) => setCounterData(p => ({ ...p, [cid]: { ...getData(cid), notes: val } }));

  const submitCounter = (counter) => {
    const d = getData(counter.id);
    const allEntries = [
      ...d.entries,
      ...d.salesEntries.map(e => ({ ...e, vehicles:0, rate:0 }))
    ];
    const total = allEntries.reduce((s,e)=>s+(Number(e.amount)||0), 0);
    const report = {
      id: `sr_${user.id}_${counter.id}_${date}`,
      date,
      counterId: counter.id,
      counterName: counter.name,
      supervisorId: user.id,
      submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      entries: allEntries,
      // Keep counters[] for backward compat with manager/MD views
      counters: [{ counterName: counter.name, entries: allEntries }],
      totalAmount: total,
      notes: d.notes,
      status: "submitted"
    };
    setState(p => ({ ...p, serviceReports: [...p.serviceReports.filter(r=>r.id!==report.id), report] }));
    setCounterData(p => ({ ...p, [counter.id]: { ...getData(counter.id), submitted: true } }));
    toast.show(`${counter.name} report submitted`);
  };

  const printCounter = (counter) => {
    const d = getData(counter.id);
    const w = window.open("","_blank");
    const svcRows = d.entries.filter(e=>e.vehicles>0).map(e=>
      `<tr><td style="border:1px solid #000;padding:5px 8px">${e.workTypeName}</td><td style="border:1px solid #000;padding:5px 8px;text-align:center">${e.vehicles}</td><td style="border:1px solid #000;padding:5px 8px;text-align:center">${e.rate}</td><td style="border:1px solid #000;padding:5px 8px;text-align:right">${e.amount}</td></tr>`
    ).join("");
    const salRows = d.salesEntries.filter(e=>e.amount>0).map(e=>
      `<tr><td style="border:1px solid #000;padding:5px 8px" colspan="3">${e.workTypeName}</td><td style="border:1px solid #000;padding:5px 8px;text-align:right">${e.amount}</td></tr>`
    ).join("");
    const total = [...d.entries,...d.salesEntries].reduce((s,e)=>s+(Number(e.amount)||0),0);
    w.document.write(`<html><head><title>${counter.name} - ${date}</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;font-size:13px}table{border-collapse:collapse;width:100%;margin-bottom:12px}h2,h3{text-align:center;margin:3px 0}</style></head>
    <body><h2>BENAKA ENTERPRISES</h2><h3>VEHICLE REPORT — ${counter.name.toUpperCase()}</h3><h3>Date: ${date.split("-").reverse().join("-")}</h3><br>
    <table><thead><tr>
      <th style="border:1px solid #000;padding:5px;background:#f0f0f0">WORK TYPE</th>
      <th style="border:1px solid #000;padding:5px;background:#f0f0f0">VEHICLES</th>
      <th style="border:1px solid #000;padding:5px;background:#f0f0f0">RATE</th>
      <th style="border:1px solid #000;padding:5px;background:#f0f0f0">AMOUNT</th>
    </tr></thead><tbody>${svcRows}${salRows}</tbody>
    <tfoot><tr><td colspan="3" style="border:1px solid #000;padding:5px;text-align:right;font-weight:700">TOTAL</td>
    <td style="border:1px solid #000;padding:5px;text-align:right;font-weight:700">₹${total.toLocaleString("en-IN")}</td></tr></tfoot>
    </table></body></html>`);
    w.document.close(); w.print();
  };

  if (myCounters.length === 0) return (
    <Card><div style={{color:T.txt3,textAlign:"center",padding:24}}>No counters assigned to you. Contact IT Admin.</div></Card>
  );

  const activeC = myCounters.find(c=>c.id===activeCounter) || myCounters[0];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Daily Vehicle Report</div>
          <div style={{ fontSize:13, color:T.txt2 }}>Submit one report per counter</div>
        </div>
        <Input label="Date" type="date" value={date} onChange={setDate} style={{maxWidth:180}}/>
      </div>

      {/* Counter tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {myCounters.map(c => {
          const d = getData(c.id);
          const total = [...(d.entries||[]),...(d.salesEntries||[])].reduce((s,e)=>s+(Number(e.amount)||0),0);
          const isSubmitted = !!state.serviceReports.find(r=>r.counterId===c.id&&r.supervisorId===user.id&&r.date===date);
          return (
            <button key={c.id} onClick={()=>setActiveCounter(c.id)} style={{
              padding:"8px 16px", borderRadius:8, border:`2px solid ${activeCounter===c.id?T.navy:T.bdrS}`,
              background:activeCounter===c.id?T.navy:"#fff", color:activeCounter===c.id?"#fff":T.txt,
              fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer", position:"relative"
            }}>
              {c.name}
              {isSubmitted
                ? <span style={{ marginLeft:6, fontSize:10, background:T.grn, color:"#fff", padding:"1px 5px", borderRadius:10 }}>✓</span>
                : total>0 ? <span style={{ marginLeft:6, fontSize:10, background:T.amber, color:"#fff", padding:"1px 5px", borderRadius:10 }}>₹{Math.round(total/1000)}k</span>
                : null
              }
            </button>
          );
        })}
      </div>

      {/* Active counter form */}
      {activeC && (() => {
        const d = getData(activeC.id);
        const isSubmitted = !!state.serviceReports.find(r=>r.counterId===activeC.id&&r.supervisorId===user.id&&r.date===date);
        const svcTotal = (d.entries||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        const salTotal = (d.salesEntries||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        return (
          <Card style={{ borderTop:`3px solid ${T.amber}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800 }}>{activeC.name}</div>
                {isSubmitted && <Badge color={T.grn} style={{marginTop:4}}>✓ Submitted for {fmtDate(date)}</Badge>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>printCounter(activeC)} variant="ghost" size="sm">🖨 Print</Btn>
                <Btn onClick={()=>submitCounter(activeC)} variant="amber">{isSubmitted?"Update Report":"Submit Report"}</Btn>
              </div>
            </div>

            {/* SERVICE entries */}
            <div style={{ fontSize:12,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:8,letterSpacing:".04em" }}>🔧 Services</div>
            <div style={{ overflowX:"auto", marginBottom:16 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr style={{ background:T.surf }}>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Work Type</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"center",width:80,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Vehicles</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"center",width:100,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Rate (₹)</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"right",width:110,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Amount (₹)</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",width:30 }}></th>
                </tr></thead>
                <tbody>
                  {(d.entries||[]).map((e,ei)=>(
                    <tr key={ei} style={{ background:e.vehicles>0?"#FFFDF7":"#fff" }}>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                        <div style={{ display:"flex",gap:5 }}>
                          <select value={e.workTypeId||""} onChange={ev=>{ const wt=serviceWTs.find(w=>w.id===ev.target.value); if(wt) setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),entries:getData(activeC.id).entries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name,rate:wt.defaultRate,amount:(row.vehicles||0)*wt.defaultRate})}})); }}
                            style={{ flex:1,padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none" }}>
                            <option value="">Select...</option>
                            {serviceWTs.map(wt=><option key={wt.id} value={wt.id}>{wt.name}</option>)}
                          </select>
                          <input value={e.workTypeName||""} onChange={ev=>updateServiceEntry(activeC.id,ei,"workTypeName",ev.target.value)}
                            placeholder="Custom" style={{ flex:1,padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",minWidth:70 }}/>
                        </div>
                      </td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                        <input type="number" value={e.vehicles||0} onChange={ev=>updateServiceEntry(activeC.id,ei,"vehicles",ev.target.value)} min={0}
                          style={{ width:"100%",padding:"4px 6px",border:`1px solid ${e.vehicles>0?T.amber:T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center",background:e.vehicles>0?T.amberL:"#fff",fontWeight:e.vehicles>0?700:400 }}/>
                      </td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                        <input type="number" value={e.rate||0} onChange={ev=>updateServiceEntry(activeC.id,ei,"rate",ev.target.value)} min={0}
                          style={{ width:"100%",padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center" }}/>
                      </td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 12px",textAlign:"right",fontWeight:700,color:e.amount>0?T.navy:T.txt3 }}>{e.amount>0?e.amount.toLocaleString("en-IN"):"0"}</td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"4px",textAlign:"center" }}>
                        <button onClick={()=>setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),entries:getData(activeC.id).entries.filter((_,j)=>j!==ei)}}))} style={{ background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:14 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:T.navyXL }}>
                  <td colSpan={3} style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",fontWeight:800,textAlign:"right",color:T.navy,fontSize:12 }}>SERVICE TOTAL</td>
                  <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 12px",fontWeight:800,color:T.navy,textAlign:"right" }}>{svcTotal.toLocaleString("en-IN")}</td>
                  <td style={{ border:`1px solid ${T.bdr}` }}></td>
                </tr></tfoot>
              </table>
            </div>
            <Btn onClick={()=>setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),entries:[...getData(activeC.id).entries,{workTypeId:"",workTypeName:"",vehicles:0,rate:0,amount:0,type:"service"}]}}))} size="sm" variant="ghost" style={{marginBottom:16}}>+ Add Service Row</Btn>

            {/* SALES entries */}
            <div style={{ fontSize:12,fontWeight:800,color:T.grn,textTransform:"uppercase",marginBottom:8,letterSpacing:".04em" }}>🛒 Sales — Amount only</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr style={{ background:T.grnL }}>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:800,color:T.grn,textTransform:"uppercase" }}>Product</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"right",width:160,fontSize:11,fontWeight:800,color:T.grn,textTransform:"uppercase" }}>Amount (₹)</th>
                  <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",width:30 }}></th>
                </tr></thead>
                <tbody>
                  {(d.salesEntries||[]).map((e,ei)=>(
                    <tr key={ei} style={{ background:e.amount>0?"#F0FDF4":"#fff" }}>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                        <div style={{ display:"flex",gap:5 }}>
                          <select value={e.workTypeId||""} onChange={ev=>{ const wt=salesWTs.find(w=>w.id===ev.target.value); if(wt) setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),salesEntries:getData(activeC.id).salesEntries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name})}})); }}
                            style={{ flex:1,padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none" }}>
                            <option value="">Select product...</option>
                            {salesWTs.map(wt=><option key={wt.id} value={wt.id}>{wt.name}</option>)}
                          </select>
                          <input value={e.workTypeName||""} onChange={ev=>updateSalesEntry(activeC.id,ei,"workTypeName",ev.target.value)}
                            placeholder="Custom" style={{ flex:1,padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",minWidth:70 }}/>
                        </div>
                      </td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                        <input type="number" value={e.amount||0} onChange={ev=>updateSalesEntry(activeC.id,ei,"amount",ev.target.value)} min={0}
                          style={{ width:"100%",padding:"4px 8px",border:`1px solid ${e.amount>0?T.grn:T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"right",background:e.amount>0?T.grnL:"#fff",fontWeight:e.amount>0?700:400 }}/>
                      </td>
                      <td style={{ border:`1px solid ${T.bdr}`,padding:"4px",textAlign:"center" }}>
                        <button onClick={()=>setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),salesEntries:getData(activeC.id).salesEntries.filter((_,j)=>j!==ei)}}))} style={{ background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:14 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:T.grnL }}>
                  <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",fontWeight:800,color:T.grn }}>SALES TOTAL</td>
                  <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 12px",fontWeight:800,color:T.grn,textAlign:"right" }}>{salTotal.toLocaleString("en-IN")}</td>
                  <td style={{ border:`1px solid ${T.bdr}` }}></td>
                </tr></tfoot>
              </table>
            </div>
            <Btn onClick={()=>setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),salesEntries:[...getData(activeC.id).salesEntries,{workTypeId:"",workTypeName:"",amount:0,type:"sales"}]}}))} size="sm" variant="ghost" style={{marginTop:8,marginBottom:16}}>+ Add Sales Row</Btn>

            {/* Notes + grand total */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:12, flexWrap:"wrap", marginTop:8 }}>
              <div style={{ flex:1, minWidth:200 }}>
                <label style={{ display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase" }}>Notes</label>
                <input value={d.notes||""} onChange={e=>setNotes(activeC.id,e.target.value)} placeholder="Any notes for today..."
                  style={{ width:"100%",padding:"8px 12px",border:`1px solid ${T.bdrS}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }}/>
              </div>
              <div style={{ background:T.navy,padding:"12px 20px",borderRadius:10,color:"#fff",textAlign:"right" }}>
                <div style={{ fontSize:11,opacity:.6,textTransform:"uppercase" }}>Counter Total</div>
                <div style={{ fontSize:22,fontWeight:800,color:T.amber }}>₹{(svcTotal+salTotal).toLocaleString("en-IN")}</div>
              </div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}


function SupHistory({ user, state }) {
  const [selCounter, setSelCounter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const myCounters = state.counters.filter(c => c.supervisorId === user.id);

  const myReports = state.serviceReports
    .filter(r => r.supervisorId === user.id)
    .filter(r => selCounter === "all" || r.counterId === selCounter || r.counterName === myCounters.find(c=>c.id===selCounter)?.name)
    .sort((a,b) => b.date.localeCompare(a.date) || (a.counterName||"").localeCompare(b.counterName||""));

  const salesWTNames = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"];

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Report History</div>
      {myCounters.length > 1 && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          <button onClick={()=>setSelCounter("all")} style={{ padding:"6px 14px",borderRadius:20,border:`1px solid ${selCounter==="all"?T.navy:T.bdrS}`,background:selCounter==="all"?T.navy:"transparent",color:selCounter==="all"?"#fff":T.txt2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>All Counters</button>
          {myCounters.map(c=>(
            <button key={c.id} onClick={()=>setSelCounter(c.id)} style={{ padding:"6px 14px",borderRadius:20,border:`1px solid ${selCounter===c.id?T.amber:T.bdrS}`,background:selCounter===c.id?T.amber:"transparent",color:selCounter===c.id?"#fff":T.txt2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>{c.name}</button>
          ))}
        </div>
      )}
      {myReports.length === 0
        ? <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports submitted yet</div></Card>
        : myReports.map(r => {
          const svcTotal = (r.entries||[]).filter(e=>!salesWTNames.includes(e.workTypeName)&&e.type!=="sales").reduce((s,e)=>s+(Number(e.amount)||0),0);
          const salTotal = (r.entries||[]).filter(e=>salesWTNames.includes(e.workTypeName)||e.type==="sales").reduce((s,e)=>s+(Number(e.amount)||0),0);
          return (
            <Card key={r.id} style={{ marginBottom:10, cursor:"pointer" }} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{r.counterName || r.counters?.[0]?.counterName || "—"}</div>
                  <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(r.date)} · Submitted {r.submittedAt}</div>
                  <div style={{ display:"flex", gap:8, marginTop:5 }}>
                    <span style={{ background:T.navyXL,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,color:T.navy }}>Svc: {fmtCurr(svcTotal)}</span>
                    {salTotal>0 && <span style={{ background:T.grnL,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,color:T.grn }}>Sales: {fmtCurr(salTotal)}</span>}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</div>
                  <Badge color={T.grn}>Submitted</Badge>
                  <div style={{ fontSize:10, color:T.txt3, marginTop:2 }}>{expanded===r.id?"▲":"▼"}</div>
                </div>
              </div>
              {expanded===r.id && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.bdr}` }}>
                  {(() => {
                    const svcEntries = (r.entries||[]).filter(e=>!salesWTNames.includes(e.workTypeName)&&e.type!=="sales"&&e.vehicles>0);
                    const salEntries = (r.entries||[]).filter(e=>(salesWTNames.includes(e.workTypeName)||e.type==="sales")&&e.amount>0);
                    return <>
                      {svcEntries.length>0 && <>
                        <div style={{fontSize:11,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:6}}>Services</div>
                        <Table cols={[
                          {key:"workTypeName",label:"Work"},
                          {key:"vehicles",label:"Veh"},
                          {key:"rate",label:"Rate",render:e=>fmtCurr(e.rate)},
                          {key:"amount",label:"Amount",render:e=><b style={{color:T.navy}}>{fmtCurr(e.amount)}</b>},
                        ]} rows={svcEntries}/>
                      </>}
                      {salEntries.length>0 && <>
                        <div style={{fontSize:11,fontWeight:800,color:T.grn,textTransform:"uppercase",marginTop:10,marginBottom:6}}>Sales</div>
                        <Table cols={[
                          {key:"workTypeName",label:"Product"},
                          {key:"amount",label:"Amount",render:e=><b style={{color:T.grn}}>{fmtCurr(e.amount)}</b>},
                        ]} rows={salEntries}/>
                      </>}
                      {r.notes && <div style={{marginTop:8,fontSize:13,color:T.txt2}}>📝 {r.notes}</div>}
                    </>;
                  })()}
                </div>
              )}
            </Card>
          );
        })
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
function ManagerPortal({ user, state, setState, toast, syncStatus="" }) {
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
    { id:"directory",   icon:"👤", label:"Staff Directory" },
  ];

  const mySupervisors = state.users.filter(u=>u.managerId===user.id&&u.role==="supervisor"&&u.active);
  const myCounters = state.counters.filter(c=>mySupervisors.some(s=>s.id===c.supervisorId));

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
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
      {page==="directory"   && <StaffDirectory state={state}/>}
    </Shell>
  );
}

function MgrCollectionReport({ user, state, setState, toast, mySupervisors }) {
  const dr = useDateRange("today");
  const date = dr.from;
  const existing = state.collectionReports?.find(r=>r.date===date&&mySupervisors.some(s=>s.id===r.supervisorId));
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };
  const filteredReports = state.serviceReports.filter(r => r.date >= dr.from && r.date <= dr.to && mySupervisors.some(s=>s.id===r.supervisorId));
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Collection Report</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={filteredReports} attendance={state.attendance} users={state.users} onSave={save}/>
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
            const rep = todayReports.find(r=>r.counterId===c.id||r.counterName===c.name);
            const sup = mySupervisors.find(s=>s.id===c.supervisorId);
            const tgt = state.targets.find(t=>t.counterId===c.id&&t.month===month);
            const pct = tgt ? Math.min(100,Math.round((rep?.totalAmount||0)/tgt.dailyTarget*100)) : null;
            return (
              <div key={c.id} style={{ border:`1px solid ${T.bdr}`, borderRadius:10, padding:14 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{c.name}</div>
                <div style={{ fontSize:11, color:T.txt2, marginBottom:8 }}>{sup?.name||"—"}</div>
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
  const dr = useDateRange("today");
  const [selMonth, setSelMonth] = useState(today().slice(0,7));

  const relevantReports = state.serviceReports.filter(r=>mySupervisors.some(s=>s.id===r.supervisorId)||myCounters.some(c=>c.id===r.counterId||c.name===r.counterName));
  const dailyReports = relevantReports.filter(r=>r.date>=dr.from&&r.date<=dr.to);
  const monthReports = relevantReports.filter(r=>r.date.startsWith(selMonth));

  const dailyTotal = dailyReports.reduce((s,r)=>s+r.totalAmount,0);
  const monthTotal = monthReports.reduce((s,r)=>s+r.totalAmount,0);

  // Revenue by work type
  const wtRevenue = {};
  relevantReports.forEach(r=>{
    const allE = r.entries && r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);
    allE.forEach(e=>{ wtRevenue[e.workTypeName]=(wtRevenue[e.workTypeName]||0)+(Number(e.amount)||0); });
  });
  const wtArr = Object.entries(wtRevenue).sort((a,b)=>b[1]-a[1]);
  const maxWt = wtArr[0]?.[1]||1;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Reports & Analytics</div>
      <Tabs tabs={[{id:"daily",label:"Daily View"},{id:"monthly",label:"Monthly"},{id:"analysis",label:"Analysis"}]} active={tab} onChange={setTab}/>

      {tab==="daily" && (
        <div>
          <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
            <StatCard label="Total Revenue" value={fmtCurr(dailyTotal)} color={T.amber}/>
            <StatCard label="Reports In" value={`${dailyReports.length}/${myCounters.length}`} color={T.navy}/>
            <StatCard label="Vehicles Serviced" value={dailyReports.reduce((s,r)=>s+reportVehicles(r),0)} color={T.grn}/>
          </div>
          <Table cols={[
            {key:"counter",label:"Counters",render:r=>reportCounterNames(r)},
            {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name},
            {key:"vehicles",label:"Vehicles",render:r=>{ const allE=r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]); return allE.reduce((s,e)=>s+(Number(e.vehicles)||0),0); }},
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
              const cr = monthReports.filter(r=>r.counterId===c.id||r.counterName===c.name).reduce((s,r)=>s+r.totalAmount,0);
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
function MDPortal({ user, state, setState, toast, syncFromCloud, syncStatus="" }) {
  const [page, setPage] = useState("dashboard");
  const navItems = [
    { id:"dashboard",   icon:"🏆", label:"Live Dashboard" },
    { id:"collection",  icon:"📊", label:"Collection Report" },
    { id:"analysis",    icon:"📈", label:"Counter Analysis" },
    { id:"reports",     icon:"📋", label:"All Reports" },
    { id:"financial",   icon:"💰", label:"Financial Trends" },
    { id:"operations",  icon:"🏪", label:"Operations" },
    { id:"salary",      icon:"💳", label:"Salary & P&L" },
    { id:"attendance",  icon:"🗓️", label:"All Attendance" },
    { id:"leaves",      icon:"✅", label:"Leave Approvals" },
    { id:"feedback",    icon:"💬", label:"All Feedback" },
    { id:"people",      icon:"👥", label:"Full Org" },
    { id:"directory",   icon:"👤", label:"Staff Directory" },
  ];

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="dashboard"  && <MDDashboard user={user} state={state} syncFromCloud={syncFromCloud}/>}
      {page==="collection"  && <MDCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state} counterFilter={null}/>}
      {page==="financial"  && <MDFinancial state={state}/>}
      {page==="operations" && <MDOperations state={state}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="directory"   && <StaffDirectory state={state}/>}
      {page==="leaves"     && <MgrLeaves user={user} state={state} setState={setState} toast={toast}/>}
      {page==="people"     && <MDPeople state={state} setState={setState} toast={toast}/>}
      {page==="reports"     && <AllReports state={state}/>}
      {page==="feedback"    && <MDFeedbackAll state={state}/>}
      {page==="attendance"  && <MDAttendance state={state}/>}
    </Shell>
  );
}

function MDCollectionReport({ user, state, setState, toast }) {
  const dr = useDateRange("today");
  const date = dr.from;
  const existing = state.collectionReports?.find(r=>r.date===date);
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:"admin", bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    toast.show("Collection report saved");
  };
  const filteredReports = state.serviceReports.filter(r => r.date >= dr.from && r.date <= dr.to);
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Collection Report</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={filteredReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

function MDDashboard({ user, state, syncFromCloud }) {
  const [dateRange, setDateRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const getRange = () => {
    const now = new Date(), y=now.getFullYear(), m=now.getMonth();
    if (dateRange==="today") return [today(), today()];
    if (dateRange==="week") {
      const d = now.getDay(), diff = now.getDate()-d+(d===0?-6:1);
      const mon = new Date(now); mon.setDate(diff);
      const sun = new Date(mon); sun.setDate(mon.getDate()+6);
      return [mon.toISOString().split("T")[0], sun.toISOString().split("T")[0]];
    }
    if (dateRange==="month") return [`${y}-${String(m+1).padStart(2,"0")}-01`, `${y}-${String(m+1).padStart(2,"0")}-31`];
    if (dateRange==="quarter") { const q=Math.floor(m/3); return [`${y}-${String(q*3+1).padStart(2,"0")}-01`,`${y}-${String(Math.min(q*3+3,12)).padStart(2,"0")}-31`]; }
    if (dateRange==="year") return [`${y}-01-01`, `${y}-12-31`];
    return [customFrom||today(), customTo||today()];
  };
  const [from, to] = getRange();

  const reports = state.serviceReports.filter(r => r.date >= from && r.date <= to);
  const totalRevenue = reports.reduce((s,r)=>s+r.totalAmount,0);
  const todayReports = state.serviceReports.filter(r=>r.date===today());
  const todayRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);

  // Counter stats
  // Helper for MD dashboard
  const mdGetEntries = (r) => r.entries && r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(x=>x.entries||[]);
  const mdIsSales = (e) => e.type==="sales"||["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"].includes(e.workTypeName);

  const counterStats = state.counters.map(c => {
    // Match reports to THIS specific counter (not all of supervisor's counters)
    const reps = reports.filter(r => r.counterId===c.id || r.counterName===c.name);
    const allE = reps.flatMap(r => mdGetEntries(r));
    const svcTotal = allE.filter(e=>!mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const salTotal = allE.filter(e=>mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const total = svcTotal + salTotal;
    const vehicles = allE.filter(e=>!mdIsSales(e)).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
    const days = new Set(reps.map(r=>r.date)).size;
    const sup = state.users.find(u=>u.id===c.supervisorId);
    const todayRep = todayReports.find(r=>r.counterId===c.id||r.counterName===c.name);
    return { ...c, total, svcTotal, salTotal, vehicles, days, sup, todayRep, dailyAvg:days?Math.round(total/days):0 };
  });

  const maxTotal = Math.max(...counterStats.map(c=>c.total),1);

  // Month-over-month growth
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthD = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth()+1).padStart(2,"0")}`;
  const thisMonthRev = state.serviceReports.filter(r=>r.date.startsWith(thisMonth)).reduce((s,r)=>s+r.totalAmount,0);
  const lastMonthRev = state.serviceReports.filter(r=>r.date.startsWith(lastMonth)).reduce((s,r)=>s+r.totalAmount,0);
  const growth = lastMonthRev > 0 ? Math.round((thisMonthRev-lastMonthRev)/lastMonthRev*100) : 0;

  // Daily revenue for bar chart (last 14 days)
  const last14 = Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-13+i); return d.toISOString().split("T")[0]; });
  const dailyRevs = last14.map(d => ({ date:d, rev:state.serviceReports.filter(r=>r.date===d).reduce((s,r)=>s+r.totalAmount,0) }));
  const maxDailyRev = Math.max(...dailyRevs.map(d=>d.rev),1);

  // Absent today
  const absentToday = state.attendance.filter(a=>a.date===today()&&a.status==="absent");

  // Pending leaves
  const pendingLeaves = state.leaves.filter(l=>l.approverId===user.id&&l.status==="pending");

  const refresh = () => { syncFromCloud && syncFromCloud(); setLastRefresh(new Date()); };

  return (
    <div>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${T.navy} 0%,${T.navyL} 100%)`, borderRadius:16, padding:24, marginBottom:20, color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:11, opacity:.6, fontWeight:700, textTransform:"uppercase", letterSpacing:".05em" }}>Live Dashboard</div>
            <div style={{ fontSize:24, fontWeight:800, marginTop:4 }}>Good day, {user.name.split(" ")[0]} 👋</div>
            <div style={{ opacity:.65, fontSize:13, marginTop:4 }}>{state.counters.length} counters · Last refreshed {lastRefresh.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={refresh} style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", borderRadius:8, padding:"7px 14px", color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>🔄 Refresh</button>
          </div>
        </div>
        {/* Key metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginTop:20 }}>
          {[
            { l:"Today's Revenue", v:fmtCurr(todayRevenue), i:"📅" },
            { l:"Period Revenue", v:fmtCurr(totalRevenue), i:"💰" },
            { l:"Month Growth", v:`${growth>=0?"+":""}${growth}%`, i:"📈", c:growth>=0?"#86EFAC":"#FCA5A5" },
            { l:"Reports Today", v:`${todayReports.length}/${state.counters.length}`, i:"📋" },
            { l:"Pending Leaves", v:pendingLeaves.length, i:"✅", c:pendingLeaves.length>0?"#FCA5A5":"#86EFAC" },
            { l:"Absent Today", v:absentToday.length, i:"👥" },
          ].map(s=>(
            <div key={s.l} style={{ background:"rgba(255,255,255,.12)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".04em" }}>{s.l}</div>
              <div style={{ fontSize:22, fontWeight:800, marginTop:4, color:s.c||"#fff" }}>{s.v}</div>
              <div style={{ fontSize:16, opacity:.6, marginTop:2 }}>{s.i}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Date range selector */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {["today","week","month","quarter","year","custom"].map(r=>(
          <button key={r} onClick={()=>setDateRange(r)} style={{
            padding:"6px 14px", borderRadius:20, border:`1px solid ${dateRange===r?T.navy:T.bdrS}`,
            background:dateRange===r?T.navy:"transparent", color:dateRange===r?"#fff":T.txt2,
            fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit"
          }}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>
        ))}
        {dateRange==="custom" && <>
          <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ padding:"5px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
          <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ padding:"5px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
        </>}
      </div>

      {/* Revenue trend (last 14 days) */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Revenue trend — last 14 days</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80, overflowX:"auto" }}>
          {dailyRevs.map((d,i) => (
            <div key={d.date} style={{ flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:36 }}>
              <div style={{ fontSize:9, color:T.txt3, transform:"rotate(-45deg)", whiteSpace:"nowrap", marginBottom:2 }}>{d.date.slice(5)}</div>
              <div title={fmtCurr(d.rev)} style={{ width:28, background:d.date===today()?T.amber:d.rev>0?T.navy:T.bdr, borderRadius:"3px 3px 0 0", height:`${Math.max(4,Math.round(d.rev/maxDailyRev*60))}px`, cursor:"pointer", transition:"opacity .15s" }}/>
              {d.rev>0 && <div style={{ fontSize:9, color:T.txt3 }}>₹{Math.round(d.rev/1000)}k</div>}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:8, fontSize:11, color:T.txt2 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:12, background:T.amber, borderRadius:2, display:"inline-block" }}/> Today</span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><span style={{ width:12, height:12, background:T.navy, borderRadius:2, display:"inline-block" }}/> Other days</span>
        </div>
      </Card>

      {/* Counter live status grid */}
      <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Counter Status — {dateRange==="today"?"Today":from===to?fmtDate(from):`${fmtDate(from)} → ${fmtDate(to)}`}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:14, marginBottom:20 }}>
        {counterStats.map(c => (
          <Card key={c.id} style={{ borderTop:`3px solid ${c.todayRep?T.grn:c.total>0?T.amber:T.bdr}`, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, color:T.txt2 }}>{c.sup?.name}{c.sup?" ("+ROLE_LABELS[c.sup.role]+")":""}</div>
              </div>
              <Badge color={c.todayRep?T.grn:T.red}>{c.todayRep?"✓ Reported":"⏳ Pending"}</Badge>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:T.amber, marginBottom:6 }}>{fmtCurr(c.total)}</div>
            <div style={{ height:5, background:T.surf, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${c.total/maxTotal*100}%`, background:T.amber, borderRadius:3 }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, fontSize:11, color:T.txt2 }}>
              <div><div style={{ fontWeight:700, color:T.navy, fontSize:12 }}>{c.vehicles}</div>Vehicles</div>
              <div><div style={{ fontWeight:700, color:T.grn, fontSize:12 }}>{fmtCurr(c.salTotal)}</div>Sales</div>
              <div><div style={{ fontWeight:700, color:T.txt2, fontSize:12 }}>{c.days}d</div>Days</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Growth chart — month over month */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Month-over-month revenue</div>
          {(() => {
            const months = [];
            for (let i=5; i>=0; i--) {
              const d = new Date(); d.setMonth(d.getMonth()-i);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
              const rev = state.serviceReports.filter(r=>r.date.startsWith(key)).reduce((s,r)=>s+r.totalAmount,0);
              months.push({ key, label:`${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear().toString().slice(-2)}`, rev });
            }
            const maxR = Math.max(...months.map(m=>m.rev),1);
            return months.map((m,i) => {
              const g = i>0&&months[i-1].rev>0 ? Math.round((m.rev-months[i-1].rev)/months[i-1].rev*100) : null;
              return <div key={m.key} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:12 }}>{m.label}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <b style={{ fontSize:12 }}>{fmtCurr(m.rev)}</b>
                    {g!==null && <span style={{ fontSize:10, fontWeight:700, color:g>=0?T.grn:T.red }}>{g>=0?"+":""}{g}%</span>}
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${m.rev/maxR*100}%`, background:m.key===thisMonth?T.amber:T.navy, borderRadius:3 }}/>
                </div>
              </div>;
            });
          })()}
        </Card>

        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Today's absent staff</div>
          {absentToday.length===0
            ? <div style={{ color:T.grn, fontSize:13, fontWeight:600 }}>✅ All staff present today</div>
            : absentToday.map(a => {
              const staff = state.users.find(u=>u.id===a.staffId);
              const sup = state.users.find(u=>u.id===a.supervisorId);
              return <div key={a.id} style={{ padding:"8px 0", borderBottom:`1px solid ${T.bdr}` }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{staff?.name}</div>
                <div style={{ fontSize:11, color:T.txt2 }}>{sup?.counter} · {a.reason||"No reason given"}</div>
              </div>;
            })
          }
          <hr style={{ border:`none`, borderTop:`1px solid ${T.bdr}`, margin:"12px 0" }}/>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>Pending approvals</div>
          {pendingLeaves.length===0
            ? <div style={{ color:T.txt3, fontSize:13 }}>No pending leaves</div>
            : pendingLeaves.slice(0,3).map(l => {
              const u = state.users.find(x=>x.id===l.userId);
              return <div key={l.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${T.bdr}`, fontSize:12 }}>
                <span><b>{u?.name}</b> — {l.type}</span>
                <Badge color={T.amber}>{l.status}</Badge>
              </div>;
            })
          }
        </Card>
      </div>

      {/* Today's collection summary */}
      {todayReports.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Today's collection — all counters</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:T.surf }}>
                <th style={{ padding:"8px 12px", textAlign:"left", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase" }}>Counter</th>
                <th style={{ padding:"8px 12px", textAlign:"right", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase" }}>Service</th>
                <th style={{ padding:"8px 12px", textAlign:"right", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase" }}>Sales</th>
                <th style={{ padding:"8px 12px", textAlign:"right", border:`1px solid ${T.bdr}`, fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase" }}>Total</th>
              </tr></thead>
              <tbody>
                {todayReports.map((r,i) => {
                  const cname = r.counterName || (r.counters||[])[0]?.counterName || state.users.find(u=>u.id===r.supervisorId)?.counter||"—";
                  const allE = mdGetEntries(r);
                  const svcT = allE.filter(e=>!mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
                  const salT = allE.filter(e=>mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
                  return <tr key={r.id}>
                    <td style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, fontWeight:600 }}>{cname}</td>
                    <td style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, textAlign:"right" }}>{fmtCurr(svcT)}</td>
                    <td style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, textAlign:"right" }}>{fmtCurr(salT)}</td>
                    <td style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, textAlign:"right", fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</td>
                  </tr>;
                })}
              </tbody>
              <tfoot><tr style={{ background:T.navyXL }}>
                <td colSpan={3} style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, fontWeight:800, color:T.navy, textAlign:"right" }}>GRAND TOTAL</td>
                <td style={{ padding:"8px 12px", border:`1px solid ${T.bdr}`, fontWeight:800, color:T.amber, textAlign:"right", fontSize:15 }}>{fmtCurr(todayRevenue)}</td>
              </tr></tfoot>
            </table>
          </div>
        </Card>
      )}
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
          const reports = state.serviceReports.filter(r=>r.counterId===c.id||r.counterName===c.name);
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
function OfficePortal({ user, state, setState, toast, syncStatus="" }) {
  const [page, setPage] = useState("reports");
  const navItems = [
    { id:"reports",    icon:"📋", label:"View Reports" },
    { id:"enter",      icon:"✏️", label:"Enter Report" },
    { id:"attendance", icon:"👥", label:"View Attendance" },
    { id:"export",     icon:"📥", label:"Export Data" },
    { id:"directory",  icon:"👤", label:"Staff Directory" },
  ];

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
      {page==="reports"    && <OfficeReports state={state}/>}
      {page==="enter"      && <OfficeEnterReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="attendance" && <OfficeAttendance state={state}/>}
      {page==="export"     && <OfficeExport state={state} toast={toast}/>}
      {page==="directory"  && <StaffDirectory state={state}/>}
    </Shell>
  );
}


// ─── Office: Enter Report (mirrors SupReport but for office staff) ─────────────
function OfficeEnterReport({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const [selSupervisor, setSelSupervisor] = useState("");
  const [reportCounters, setReportCounters] = useState([]);
  const [notes, setNotes] = useState("");

  const executives = state.users.filter(u => u.role === "supervisor" && u.active);
  const serviceWTs = state.workTypes.filter(w => w.category !== "sales");
  const salesWTs   = state.workTypes.filter(w => w.category === "sales");

  const blankServiceRows = () => serviceWTs.map(wt => ({ workTypeId:wt.id, workTypeName:wt.name, vehicles:0, rate:wt.defaultRate, amount:0, type:"service" }));
  const blankSalesRows   = () => salesWTs.map(wt => ({ workTypeId:wt.id, workTypeName:wt.name, qty:0, amount:0, type:"sales" }));

  useEffect(() => {
    if (!selSupervisor) return;
    const existing = state.serviceReports.find(r => r.supervisorId === selSupervisor && r.date === date);
    if (existing) {
      // Restore existing report — ensure salesEntries are split out
      const restoredCounters = (existing.counters || []).map(c => ({
        ...c,
        entries: (c.entries||[]).filter(e => !["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"].includes(e.workTypeName) && e.type!=="sales"),
        salesEntries: (c.entries||[]).filter(e => ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"].includes(e.workTypeName) || e.type==="sales"),
      }));
      setReportCounters(restoredCounters);
      setNotes(existing.notes || "");
    } else {
      const myCtrs = state.counters.filter(c => c.supervisorId === selSupervisor);
      setReportCounters(myCtrs.length ? myCtrs.map(c => ({ counterName:c.name, entries:blankServiceRows(), salesEntries:blankSalesRows() })) : [{ counterName:"", entries:blankServiceRows(), salesEntries:blankSalesRows() }]);
      setNotes("");
    }
  }, [date, selSupervisor]);

  const updateEntry = (ci, ei, field, val, isSales=false) => {
    setReportCounters(p => p.map((c, cidx) => cidx !== ci ? c : {
      ...c,
      [isSales?"salesEntries":"entries"]: (isSales?c.salesEntries:c.entries).map((e, eidx) => {
        if (eidx !== ei) return e;
        const u = { ...e, [field]: field==="workTypeName" ? val : Number(val) };
        if (!isSales && (field==="vehicles"||field==="rate")) u.amount = (Number(u.vehicles)||0)*(Number(u.rate)||0);
        if (isSales && field==="amount") u.amount = Number(val);
        return u;
      })
    }));
  };

  const counterServiceTotal = (c) => (c.entries||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const counterSalesTotal   = (c) => (c.salesEntries||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const grandTotal = reportCounters.reduce((s,c)=>s+counterServiceTotal(c)+counterSalesTotal(c),0);

  const submit = () => {
    if (!selSupervisor) { toast.show("Select an executive first","error"); return; }
    const report = {
      id: `sr_${selSupervisor}_${date}`,
      date, supervisorId:selSupervisor,
      submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      counters: reportCounters.map(c => ({ ...c, entries:[...(c.entries||[]),...(c.salesEntries||[])] })),
      totalAmount: grandTotal, notes, status:"submitted"
    };
    setState(p=>({ ...p, serviceReports:[...p.serviceReports.filter(r=>r.id!==report.id), report] }));
    toast.show("Report submitted for " + executives.find(u=>u.id===selSupervisor)?.name);
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Enter Counter Report</div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>Executive / Counter</label>
            <select value={selSupervisor} onChange={e=>setSelSupervisor(e.target.value)}
              style={{ width:"100%", padding:"9px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none" }}>
              <option value="">Select executive...</option>
              {executives.map(u=><option key={u.id} value={u.id}>{u.name} — {u.counter}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {selSupervisor && reportCounters.map((counter, ci) => (
        <Card key={ci} style={{ marginBottom:16, borderTop:`3px solid ${T.amber}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:26,height:26,background:T.navy,color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800 }}>{ci+1}</div>
            <div style={{ flex:1 }}>
              <select value={counter.counterName} onChange={e=>setReportCounters(p=>p.map((c,i)=>i===ci?{...c,counterName:e.target.value}:c))}
                style={{ padding:"7px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none", marginRight:8 }}>
                <option value="">Select counter...</option>
                {state.counters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <input value={counter.counterName} onChange={e=>setReportCounters(p=>p.map((c,i)=>i===ci?{...c,counterName:e.target.value}:c))}
                placeholder="Or type counter name" style={{ padding:"7px 10px", border:`1px solid ${T.bdrS}`, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none", width:180 }}/>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11,color:T.txt2,fontWeight:700,textTransform:"uppercase" }}>Counter Total</div>
              <div style={{ fontSize:18,fontWeight:800,color:T.amber }}>₹{(counterServiceTotal(counter)+counterSalesTotal(counter)).toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* SERVICE rows */}
          <div style={{ fontSize:12,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:8,letterSpacing:".04em" }}>🔧 Services</div>
          <div style={{ overflowX:"auto", marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:T.surf }}>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Work Type</th>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"center",width:80,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Vehicles</th>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"center",width:100,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Rate (₹)</th>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"right",width:110,fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase" }}>Amount (₹)</th>
              </tr></thead>
              <tbody>
                {(counter.entries||[]).map((e,ei)=>(
                  <tr key={ei} style={{ background:e.vehicles>0?"#FFFDF7":"#fff" }}>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                      <select value={e.workTypeId} onChange={ev=>{ const wt=state.workTypes.find(w=>w.id===ev.target.value); if(wt) setReportCounters(p=>p.map((c,ci2)=>ci2!==ci?c:{...c,entries:c.entries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name,rate:wt.defaultRate,amount:(row.vehicles||0)*wt.defaultRate})})); }}
                        style={{ flex:1,padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",width:"100%" }}>
                        <option value="">Select...</option>
                        {serviceWTs.map(wt=><option key={wt.id} value={wt.id}>{wt.name}</option>)}
                      </select>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                      <input type="number" value={e.vehicles} onChange={ev=>updateEntry(ci,ei,"vehicles",ev.target.value)} min={0}
                        style={{ width:"100%",padding:"4px 6px",border:`1px solid ${e.vehicles>0?T.amber:T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center",background:e.vehicles>0?T.amberL:"#fff",fontWeight:e.vehicles>0?700:400 }}/>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                      <input type="number" value={e.rate} onChange={ev=>updateEntry(ci,ei,"rate",ev.target.value)} min={0}
                        style={{ width:"100%",padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center" }}/>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 12px",textAlign:"right",fontWeight:700,color:e.amount>0?T.navy:T.txt3 }}>{e.amount>0?e.amount.toLocaleString("en-IN"):"0"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ background:T.navyXL }}>
                <td colSpan={3} style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",fontWeight:800,textAlign:"right",color:T.navy }}>SERVICE TOTAL</td>
                <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 12px",fontWeight:800,color:T.navy,textAlign:"right" }}>{counterServiceTotal(counter).toLocaleString("en-IN")}</td>
              </tr></tfoot>
            </table>
          </div>

          {/* SALES rows */}
          <div style={{ fontSize:12,fontWeight:800,color:T.grn,textTransform:"uppercase",marginBottom:8,letterSpacing:".04em" }}>🛒 Sales (Amount only — no rate card)</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:T.grnL }}>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:800,color:T.grn,textTransform:"uppercase" }}>Product</th>
                <th style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",textAlign:"right",width:140,fontSize:11,fontWeight:800,color:T.grn,textTransform:"uppercase" }}>Amount (₹)</th>
              </tr></thead>
              <tbody>
                {(counter.salesEntries||[]).map((e,ei)=>(
                  <tr key={ei} style={{ background:e.amount>0?"#F0FDF4":"#fff" }}>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                      <select value={e.workTypeId} onChange={ev=>{ const wt=state.workTypes.find(w=>w.id===ev.target.value); if(wt) setReportCounters(p=>p.map((c,ci2)=>ci2!==ci?c:{...c,salesEntries:c.salesEntries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name})})); }}
                        style={{ padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",marginRight:6 }}>
                        <option value="">Select product...</option>
                        {salesWTs.map(wt=><option key={wt.id} value={wt.id}>{wt.name}</option>)}
                      </select>
                      <input value={e.workTypeName} onChange={ev=>setReportCounters(p=>p.map((c,ci2)=>ci2!==ci?c:{...c,salesEntries:c.salesEntries.map((row,ri)=>ri!==ei?row:{...row,workTypeName:ev.target.value})}))}
                        placeholder="Or type product name" style={{ padding:"4px 6px",border:`1px solid ${T.bdrS}`,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",width:140 }}/>
                    </td>
                    <td style={{ border:`1px solid ${T.bdr}`,padding:"5px 8px" }}>
                      <input type="number" value={e.amount} onChange={ev=>updateEntry(ci,ei,"amount",ev.target.value,true)} min={0}
                        style={{ width:"100%",padding:"4px 8px",border:`1px solid ${e.amount>0?T.grn:T.bdrS}`,borderRadius:5,fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"right",background:e.amount>0?T.grnL:"#fff",fontWeight:e.amount>0?700:400 }}/>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ background:T.grnL }}>
                <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",fontWeight:800,color:T.grn }}>SALES TOTAL</td>
                <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 12px",fontWeight:800,color:T.grn,textAlign:"right" }}>{counterSalesTotal(counter).toLocaleString("en-IN")}</td>
              </tr></tfoot>
            </table>
          </div>
        </Card>
      ))}

      {selSupervisor && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <Btn onClick={()=>setReportCounters(p=>[...p,{counterName:"",entries:blankServiceRows(),salesEntries:blankSalesRows()}])} variant="outline">+ Add Counter</Btn>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ background:T.navy,padding:"12px 20px",borderRadius:10,color:"#fff",textAlign:"right" }}>
              <div style={{ fontSize:11,opacity:.6,textTransform:"uppercase" }}>Grand Total</div>
              <div style={{ fontSize:22,fontWeight:800,color:T.amber }}>₹{grandTotal.toLocaleString("en-IN")}</div>
            </div>
            <Btn onClick={submit} variant="amber" size="lg">Submit Report</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function OfficeReports({ state }) {
  const dr = useDateRange("today");
  const reports = state.serviceReports.filter(r=>r.date>=dr.from&&r.date<=dr.to).sort((a,b)=>b.date.localeCompare(a.date));
  const totalRev = reports.reduce((s,r)=>s+r.totalAmount,0);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Service Reports</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      {reports.length>0 && <div style={{marginBottom:16}}><StatCard label={`Reports (${dr.label})`} value={`${reports.length} reports`} sub={`Total: ${fmtCurr(totalRev)}`} color={T.amber}/></div>}
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
            {(() => {
              const allE = r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
              const svcE = allE.filter(e=>e.type!=="sales"&&!["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"].includes(e.workTypeName)&&e.vehicles>0);
              const salE = allE.filter(e=>(e.type==="sales"||["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE"].includes(e.workTypeName))&&e.amount>0);
              return <>
                {svcE.length>0&&<Table cols={[{key:"workTypeName",label:"Work"},{key:"vehicles",label:"Veh"},{key:"rate",label:"Rate",render:e=>fmtCurr(e.rate)},{key:"amount",label:"Amount",render:e=><b>{fmtCurr(e.amount)}</b>}]} rows={svcE}/>}
                {salE.length>0&&<><div style={{fontSize:11,fontWeight:700,color:T.grn,margin:"8px 0 4px",textTransform:"uppercase"}}>Sales</div><Table cols={[{key:"workTypeName",label:"Product"},{key:"amount",label:"Amount",render:e=><b style={{color:T.grn}}>{fmtCurr(e.amount)}</b>}]} rows={salE}/></>}
              </>;
            })()}
            {r.notes && <div style={{marginTop:10,fontSize:13,color:T.txt2}}>📝 {r.notes}</div>}
          </Card>
        );
      })}
      {reports.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for {dr.label}</div></Card>}
    </div>
  );
}

function OfficeAttendance({ state }) {
  const dr = useDateRange("today");
  const att = state.attendance.filter(a=>a.date>=dr.from&&a.date<=dr.to).sort((a,b)=>b.date.localeCompare(a.date));
  const presentC = att.filter(a=>a.status==="present").length;
  const absentC  = att.filter(a=>a.status==="absent").length;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Attendance Records</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      {att.length>0 && (
        <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          <StatCard label="Present" value={presentC} color={T.grn}/>
          <StatCard label="Absent" value={absentC} color={T.red}/>
          <StatCard label="Records" value={att.length} color={T.navy}/>
        </div>
      )}
      <Table cols={[
        {key:"date",label:"Date",render:r=>fmtDate(r.date)},
        {key:"staff",label:"Staff",render:r=>state.users.find(u=>u.id===r.staffId)?.name||r.staffId},
        {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name},
        {key:"counter",label:"Counter",render:r=>state.users.find(u=>u.id===r.supervisorId)?.counter||"—"},
        {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.grn:r.status==="half_day"?T.amber:T.red}>{r.status}</Badge>},
        {key:"reason",label:"Reason",render:r=>r.reason||"—"},
      ]} rows={att} emptyMsg={`No attendance records for ${dr.label}`}/>
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
function ITAdminPortal({ user, state, setState, toast, syncStatus="" }) {
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
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={setPage} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))}>
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

  const openNew = () => { setEditing(null); setForm({ empId:"", name:"", role:"field_staff", email:"", phone:"", managerId:"", counter:"", dob:"", joining:"", weddingAnniversary:"" }); setNewPwd(""); setModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ empId:u.empId, name:u.name, role:u.role, email:u.email||"", phone:u.phone||"", managerId:u.managerId||"", counter:u.counter||"", dob:u.dob||"", joining:u.joining||"", weddingAnniversary:u.weddingAnniversary||"" }); setNewPwd(""); setModal(true); };

  const save = () => {
    if (!form.empId||!form.name) { toast.show("ID and Name required","error"); return; }
    if (editing) {
      setState(p=>({ ...p,
        users: p.users.map(u=>u.id===editing.id?{...u,...form}:u),
        passwords: newPwd ? {...p.passwords,[form.empId]:newPwd} : p.passwords,
        _configVersion: (p._configVersion||0) + 1,
      }));
      toast.show("User updated");
    } else {
      if (state.users.find(u=>u.empId===form.empId)) { toast.show("Employee ID already exists","error"); return; }
      const newUser = { id:`u_${Date.now()}`, ...form, dob:form.dob||"", joining:form.joining||"", weddingAnniversary:form.weddingAnniversary||"", active:true };
      setState(p=>({ ...p, users:[...p.users, newUser], passwords:{...p.passwords,[form.empId]:newPwd||"pass@123"}, _configVersion: (p._configVersion||0) + 1 }));
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>User Management</div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={()=>{ if(confirm("Reset ALL users to the default staff list? Any locally added users will be removed.")) { setState(p=>({...p, users:INITIAL_STATE.users, passwords:INITIAL_STATE.passwords, _configVersion:0})); toast.show("User list reset to default"); }}} variant="ghost" size="sm">↺ Reset to Default</Btn>
          <Btn onClick={openNew} variant="amber">+ Add User</Btn>
        </div>
      </div>

      <Table cols={[
        {key:"empId",label:"ID"},
        {key:"name",label:"Name",render:r=><b>{r.name}</b>},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[r.role]}>{ROLE_LABELS[r.role]}</Badge>},
        {key:"manager",label:"Reports To",render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"dob",label:"D.O.B",render:r=>r.dob?r.dob.split("-").reverse().join("."):"—"},
        {key:"joining",label:"Joining",render:r=>r.joining?r.joining.split("-").reverse().join("."):"—"},
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          <Input label="Date of Birth" type="date" value={form.dob||""} onChange={v=>setForm(p=>({...p,dob:v}))}/>
          <Input label="Date of Joining" type="date" value={form.joining||""} onChange={v=>setForm(p=>({...p,joining:v}))}/>
          <Input label="Wedding Anniversary" type="date" value={form.weddingAnniversary||""} onChange={v=>setForm(p=>({...p,weddingAnniversary:v}))}/>
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
      setState(p=>({ ...p, counters:p.counters.map(c=>c.id===editing.id?{...c,...form}:c), _configVersion:(p._configVersion||0)+1 }));
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
      setState(p=>({ ...p, workTypes:p.workTypes.map(w=>w.id===editing.id?{...w,name,defaultRate:Number(rate),category:editCat}:w), _configVersion:(p._configVersion||0)+1 }));
      toast.show("Work type updated");
    } else {
      setState(p=>({ ...p, workTypes:[...p.workTypes,{ id:`wt_${Date.now()}`, name, defaultRate:Number(rate), category:editCat||"service" }], _configVersion:(p._configVersion||0)+1 }));
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
  const dr = useDateRange("today");
  const reports = state.serviceReports.filter(r=>r.date>=dr.from&&r.date<=dr.to).sort((a,b)=>b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>All Service Reports</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard label="Total Revenue" value={fmtCurr(reports.reduce((s,r)=>s+r.totalAmount,0))} color={T.amber}/>
        <StatCard label="Reports" value={reports.length} color={T.navy}/>
        <StatCard label="Counters" value={new Set(reports.map(r=>r.counterName||r.counterId)).size} color={T.grn}/>
      </div>
      {reports.map(r=>{
        const sup2 = state.users.find(u=>u.id===r.supervisorId);
        return (
          <Card key={r.id} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div><b style={{fontSize:15}}>{sup2?.name}</b><div style={{fontSize:12,color:T.txt2}}>{reportCounterNames(r)} · {r.submittedAt}</div></div>
              <b style={{fontSize:20,color:T.amber}}>{fmtCurr(r.totalAmount)}</b>
            </div>
            {(() => {
              const allE = r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
              return <Table cols={[
                {key:"workTypeName",label:"Work"},
                {key:"vehicles",label:"Veh",render:e=>e.vehicles||"—"},
                {key:"amount",label:"Amount",render:e=><b style={{color:e.type==="sales"?T.grn:T.navy}}>{fmtCurr(e.amount)}</b>},
              ]} rows={allE.filter(e=>(e.vehicles>0||e.amount>0))}/>;
            })()}
          </Card>
        );
      })}
      {reports.length===0&&<Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for {dr.label}</div></Card>}
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
  const allRptEntries = (r) => r.entries && r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);
  const serviceEntries = (r) => allRptEntries(r).filter(e=>e.type!=="sales"&&!['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].includes(e.workTypeName));
  const salesEntries   = (r) => allRptEntries(r).filter(e=>e.type==="sales"||['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].includes(e.workTypeName));

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
  const updateExp  = (i,f,v) => setExpenses(p=>p.map((r,j)=>j===i?{...r,[f]:v}:r));

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
function CounterAnalysis({ user, state, counterFilter, myCounterIds }) {
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

  // Helper: get all entries from a report (supports both old counters[] and new entries[])
  const getAllEntries = (r) => {
    if (r.entries && r.entries.length > 0) return r.entries;
    return (r.counters||[]).flatMap(c=>c.entries||[]);
  };
  const isSalesEntry = (e) => e.type==="sales" || ['JOPASU','SHAMPOO','POLISH LIQUID','MICROFIBER CLOTH','AIR FRESHENER','TYRE SHINE'].includes(e.workTypeName);

  const filteredReports = state.serviceReports.filter(r => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    // Executive: filter to only their counters (by ID array)
    if (myCounterIds && myCounterIds.length > 0) {
      if (!myCounterIds.includes(r.counterId)) return false;
    }
    // Single counter filter (for viewing one specific counter)
    if (counterFilter && !myCounterIds) {
      if (r.counterId !== state.counters.find(c=>c.name===counterFilter)?.id && r.counterName !== counterFilter) return false;
    }
    return true;
  });

  // Build per-counter stats — each report is now ONE counter
  const visibleCounters = myCounterIds
    ? state.counters.filter(c => myCounterIds.includes(c.id))
    : counterFilter
      ? state.counters.filter(c => c.name === counterFilter)
      : state.counters;

  const counterStats = visibleCounters.map(c => {
    const reps = filteredReports.filter(r => r.counterId===c.id || r.counterName===c.name);
    const allE = reps.flatMap(r => getAllEntries(r));
    const svcTotal = allE.filter(e=>!isSalesEntry(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const salTotal = allE.filter(e=>isSalesEntry(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const total = svcTotal + salTotal;
    const vehicles = allE.filter(e=>!isSalesEntry(e)).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
    const days = new Set(reps.map(r=>r.date)).size;
    const dailyAvg = days ? Math.round(total/days) : 0;
    return { ...c, svcTotal, salTotal, total, vehicles, days, dailyAvg, repCount: reps.length };
  });

  const grandTotal = counterStats.reduce((s,c)=>s+c.total,0);
  const maxTotal = Math.max(...counterStats.map(c=>c.total),1);

  // Work type breakdown
  const wtMap = {};
  filteredReports.forEach(r=>getAllEntries(r).forEach(e=>{
    if((e.vehicles>0||e.amount>0) && !isSalesEntry(e)) wtMap[e.workTypeName]=(wtMap[e.workTypeName]||0)+(Number(e.amount)||0);
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
//  STAFF DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════════
function StaffDirectory({ state }) {
  const [search, setSearch] = useState("");
  const [filterCounter, setFilterCounter] = useState("all");
  const todayMD = today().slice(5);

  const filtered = state.users.filter(u => {
    if (!u.name) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCounter !== "all" && u.counter !== filterCounter) return false;
    return true;
  });

  const counters = ["all", ...new Set(state.users.map(u=>u.counter).filter(Boolean))];
  const isBdayToday = (u) => u.dob && u.dob.slice(5) === todayMD;
  const yearsOfService = (joining) => {
    if (!joining) return "";
    const j = new Date(joining);
    const now = new Date();
    const yrs = Math.floor((now - j) / (365.25*24*3600*1000));
    return yrs > 0 ? `${yrs} yr${yrs>1?'s':''}` : "< 1 yr";
  };

  // Upcoming birthdays (next 7 days)
  const upcoming = state.users.filter(u => {
    if (!u.dob) return false;
    const bday = new Date(new Date().getFullYear() + "-" + u.dob.slice(5));
    const diff = Math.ceil((bday - new Date()) / (24*3600*1000));
    return diff >= 0 && diff <= 7;
  }).sort((a,b) => a.dob.slice(5).localeCompare(b.dob.slice(5)));

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>Staff Directory</div>
      <div style={{ fontSize:13, color:T.txt2, marginBottom:20 }}>{state.users.filter(u=>u.active).length} active staff</div>

      {/* Upcoming birthdays */}
      {upcoming.length > 0 && (
        <div style={{ background:"linear-gradient(135deg,#FF6B6B,#FF8E53)", borderRadius:12, padding:16, marginBottom:20, color:"#fff" }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:10 }}>🎂 Upcoming birthdays (next 7 days)</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {upcoming.map(u => (
              <div key={u.id} style={{ background:"rgba(255,255,255,.2)", borderRadius:8, padding:"8px 14px" }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{u.name}</div>
                <div style={{ fontSize:11, opacity:.85 }}>{u.dob?.split("-").reverse().join(".")} · {u.counter}</div>
                {isBdayToday(u) && <div style={{ fontSize:11, fontWeight:800, marginTop:2 }}>🎉 TODAY!</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name..."
          style={{ padding:"8px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", width:200 }}/>
        <select value={filterCounter} onChange={e=>setFilterCounter(e.target.value)}
          style={{ padding:"8px 12px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}>
          {counters.map(c=><option key={c} value={c}>{c==="all"?"All Counters":c}</option>)}
        </select>
      </div>

      <div style={{ overflowX:"auto", border:`1px solid ${T.bdr}`, borderRadius:10 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:T.surf }}>
              {["Sl","Name","Designation","Counter","D.O.B","Joining","Service","Wedding Anniv."].map(h=>(
                <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:800, color:T.txt2, textTransform:"uppercase", borderBottom:`1px solid ${T.bdr}`, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} style={{ background: isBdayToday(u) ? "#FFF3CD" : i%2===0?T.card:T.surf }}>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}`, color:T.txt3 }}>{i+1}</td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}`, fontWeight:700 }}>
                  {u.name} {isBdayToday(u) && "🎂"}
                </td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}` }}>
                  <Badge color={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}`, color:T.txt2 }}>{u.counter||"—"}</td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}` }}>{u.dob?u.dob.split("-").reverse().join("."):"—"}</td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}` }}>{u.joining?u.joining.split("-").reverse().join("."):"—"}</td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}`, color:T.txt2 }}>{yearsOfService(u.joining)}</td>
                <td style={{ padding:"9px 12px", borderBottom:`1px solid ${T.bdr}` }}>{u.weddingAnniversary?u.weddingAnniversary.split("-").reverse().join("."):"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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


function MDFeedbackAll({ state }) {
  const avg = state.feedback.length ? (state.feedback.reduce((s,f)=>s+f.rating,0)/state.feedback.length).toFixed(1) : "—";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>All Customer Feedback</div>
        <div style={{ fontSize:28, fontWeight:800, color:T.amber }}>⭐ {avg}</div>
      </div>
      {[...state.feedback].sort((a,b)=>b.date?.localeCompare(a.date)).map(f=>(
        <Card key={f.id} style={{ marginBottom:10, borderLeft:`4px solid ${f.rating>=4?T.grn:f.rating===3?T.amber:T.red}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
            <div><b style={{ fontSize:14 }}>{f.counterName}</b><span style={{ fontSize:12, color:T.txt2, marginLeft:8 }}>{fmtDate(f.date)} · {f.submittedAt}</span></div>
            <Badge color={f.rating>=4?T.grn:f.rating===3?T.amber:T.red}>{f.rating}/5 ⭐</Badge>
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:4 }}>
            {f.vehicleNo && <span style={{ fontSize:12 }}><b>{f.vehicleNo}</b></span>}
            {f.serviceType && <span style={{ fontSize:12, color:T.txt2 }}>{f.serviceType}</span>}
            {f.customerName && <span style={{ fontSize:12, color:T.txt2 }}>{f.customerName}</span>}
          </div>
          {f.comment && <div style={{ fontSize:13, background:T.surf, padding:"7px 11px", borderRadius:7 }}>"{f.comment}"</div>}
        </Card>
      ))}
      {state.feedback.length===0 && <Card><div style={{ textAlign:"center", padding:24, color:T.txt3 }}>No feedback yet</div></Card>}
    </div>
  );
}


// ─── MD: All Attendance view ──────────────────────────────────────────────────
function MDAttendance({ state }) {
  const dr = useDateRange("today");
  const [filterCounter, setFilterCounter] = useState("all");

  const att = state.attendance.filter(a => {
    if (a.date < dr.from || a.date > dr.to) return false;
    if (filterCounter !== "all") {
      const sup = state.users.find(u=>u.id===a.supervisorId);
      return sup?.counter === filterCounter;
    }
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  const counters = ["all", ...new Set(state.users.filter(u=>u.role==="supervisor").map(u=>u.counter).filter(Boolean))];
  const presentCount = att.filter(a=>a.status==="present").length;
  const absentCount  = att.filter(a=>a.status==="absent").length;
  const halfCount    = att.filter(a=>a.status==="half_day").length;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>All Attendance</div>
      <div style={{ display:"flex", gap:10, alignItems:"flex-start", flexWrap:"wrap", marginBottom:8 }}>
        <div style={{ flex:1 }}>
          <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
        </div>
        <div>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>Counter</label>
          <select value={filterCounter} onChange={e=>setFilterCounter(e.target.value)}
            style={{ padding:"7px 12px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}>
            {counters.map(c=><option key={c} value={c}>{c==="all"?"All Counters":c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
        <StatCard label="Present" value={presentCount} color={T.grn} icon="✅"/>
        <StatCard label="Absent"  value={absentCount}  color={T.red} icon="❌"/>
        <StatCard label="Half Day" value={halfCount}   color={T.amber} icon="½"/>
        <StatCard label="Total"   value={att.length}   color={T.navy} icon="👥"/>
      </div>

      <Table cols={[
        {key:"date",      label:"Date",      render:r=>fmtDate(r.date)},
        {key:"staff",     label:"Staff",     render:r=><b>{state.users.find(u=>u.id===r.staffId)?.name||r.staffId}</b>},
        {key:"counter",   label:"Counter",   render:r=>state.users.find(u=>u.id===r.supervisorId)?.counter||"—"},
        {key:"supervisor",label:"Executive", render:r=>state.users.find(u=>u.id===r.supervisorId)?.name||"—"},
        {key:"status",    label:"Status",    render:r=><Badge color={r.status==="present"?T.grn:r.status==="half_day"?T.amber:T.red}>{r.status}</Badge>},
        {key:"reason",    label:"Reason",    render:r=>r.reason||"—"},
        {key:"markedAt",  label:"Marked At"},
      ]} rows={att} emptyMsg="No attendance records for this date"/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useLocalStorage("benaka_state", { ...INITIAL_STATE, currentUser: null });
  const { show, Toast } = useToast();

  // Supabase real-time sync
  const { synced, syncStatus, syncFromCloud, isConfigured } = useSupabaseSync(state, setState);

  // ── ALWAYS sync structural data from INITIAL_STATE on every load ──────────
  // This ensures users/passwords/counters/workTypes are consistent across ALL
  // devices. If IT Admin makes changes, those are stored separately and merged.
  useEffect(() => {
    setState(p => {
      // Check if IT Admin has made local edits (tracked by version stamp)
      const hasLocalEdits = p._configVersion && p._configVersion > 0;
      if (hasLocalEdits) return p; // respect local IT Admin edits
      // Otherwise always use INITIAL_STATE structural data
      return {
        ...p,
        users:      INITIAL_STATE.users,
        passwords:  INITIAL_STATE.passwords,
        counters:   INITIAL_STATE.counters,
        workTypes:  INITIAL_STATE.workTypes,
      };
    });
  }, []);

  const login  = (user) => setState(p => ({ ...p, currentUser: user }));
  const logout = useCallback(() => setState(p => ({ ...p, currentUser: null })), []);

  // Auto-logout after 10 minutes of inactivity
  useAutoLogout(!!state.currentUser, logout, 10);

  // Birthday notifications for MD, Manager, Executive
  useBirthdayNotifications(state, state.currentUser);

  // DB-aware setState: writes to Supabase AND local state
  const dbSetState = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Detect what changed and sync to DB
      if (isConfigured) {
        if (next.serviceReports !== prev.serviceReports) {
          const newReports = next.serviceReports.filter(r => !prev.serviceReports.find(p=>p.id===r.id) || prev.serviceReports.find(p=>p.id===r.id)?.submittedAt !== r.submittedAt);
          newReports.forEach(r => DB.upsertReport(r).catch(console.error));
        }
        if (next.attendance !== prev.attendance) {
          const newAtts = next.attendance.filter(a => !prev.attendance.find(p=>p.id===a.id));
          if (newAtts.length) DB.upsertAttendance(newAtts).catch(console.error);
        }
        if (next.leaves !== prev.leaves) {
          const changedLeaves = next.leaves.filter(l => {
            const old = prev.leaves.find(p=>p.id===l.id);
            return !old || old.status !== l.status || !old.id;
          });
          changedLeaves.forEach(l => DB.upsertLeave(l).catch(console.error));
        }
        if (next.feedback !== prev.feedback) {
          const newFb = next.feedback.filter(f => !prev.feedback.find(p=>p.id===f.id));
          newFb.forEach(f => DB.insertFeedback(f).catch(console.error));
        }
        if (next.salaries !== prev.salaries) {
          const newSal = next.salaries.filter(s => !prev.salaries.find(p=>p.id===s.id) || prev.salaries.find(p=>p.id===s.id)?.netSalary !== s.netSalary);
          newSal.forEach(s => DB.upsertSalary(s).catch(console.error));
        }
        if (next.collectionReports !== prev.collectionReports) {
          const newCR = next.collectionReports.filter(r => !prev.collectionReports.find(p=>p.id===r.id));
          newCR.forEach(r => DB.upsertCollectionReport(r).catch(console.error));
        }
      }
      return next;
    });
  }, [isConfigured]);

  // ── Public feedback form detection ─────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const fbCounter  = params.get("feedback");
  if (fbCounter) {
    const handleFbSubmit = (fb) => setState(p => ({ ...p, feedback: [...(p.feedback||[]), fb] }));
    return <ErrorBoundary><PublicFeedbackForm counterName={decodeURIComponent(fbCounter)} counters={state.counters} onSubmit={handleFbSubmit}/></ErrorBoundary>;
  }
  // ───────────────────────────────────────────────────────────────────────────

  if (!state.currentUser) {
    return <ErrorBoundary>
      <LoginScreen onLogin={login} users={state.users} passwords={state.passwords || INITIAL_STATE.passwords}/>
      <Toast/>
    </ErrorBoundary>;
  }

  const props = { user: state.currentUser, state, setState: dbSetState, toast: { show }, syncFromCloud, syncStatus };

  return (
    <ErrorBoundary>
      {state.currentUser.role === "supervisor"  && <SupervisorPortal {...props}/>}
      {state.currentUser.role === "manager"     && <ManagerPortal {...props}/>}
      {state.currentUser.role === "md"          && <MDPortal {...props}/>}
      {state.currentUser.role === "office"      && <OfficePortal {...props}/>}
      {state.currentUser.role === "it_admin"    && <ITAdminPortal {...props}/>}
      {state.currentUser.role === "field_staff" && (
        <FieldStaffPortal user={state.currentUser} state={state} setState={dbSetState} logout={logout} toast={{show}}/>
      )}
      <Toast/>
    </ErrorBoundary>
  );
}
