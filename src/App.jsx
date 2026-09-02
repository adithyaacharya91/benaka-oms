// Benaka OMS v2.1 — 2026-08-30 14:47
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
  // Users & Config
  async getConfig() {
    const [users, passwords] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/app_users?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }).then(r=>r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/app_passwords?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }).then(r=>r.json()),
    ]);
    return { users, passwords };
  },
  async upsertUsers(users) {
    const rows = users.map(u => ({
      id: u.id,
      emp_id: u.empId || u.emp_id,
      name: u.name,
      role: u.role,
      email: u.email||"",
      phone: u.phone||"",
      dob: u.dob||"",
      joining: u.joining||"",
      wedding_anniversary: u.weddingAnniversary||"",
      active: u.active !== false,
      manager_id: u.managerId||null,
      counter: u.counter||""
    }));
    return supabase.from("app_users").upsert(rows);
  },
  async getCounters() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_counters?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertCounters(counters) {
    const rows = counters.map(c => ({
      id: c.id, name: c.name,
      supervisor_id: c.supervisorId||null,
      dealership: c.dealership||"",
      city: c.city||""
    }));
    return supabase.from("app_counters").upsert(rows);
  },
  async getWorkTypes() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_work_types?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    return r.json();
  },
  async upsertWorkTypes(workTypes) {
    const rows = workTypes.map(w => ({
      id: w.id, name: w.name,
      default_rate: w.defaultRate||0,
      category: w.category||"service"
    }));
    return supabase.from("app_work_types").upsert(rows);
  },
  async getPlannedLeaves() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/planned_leaves?select=*&order=created_at.desc`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map(l => ({
      id: l.id, userId: l.user_id, staffName: l.staff_name,
      supervisorId: l.supervisor_id, fromDate: l.from_date,
      toDate: l.to_date, reason: l.reason, status: l.status,
      appliedOn: l.applied_on, decidedOn: l.decided_on
    }));
  },
  async upsertPlannedLeave(leave) {
    const row = {
      id: leave.id, user_id: leave.userId, staff_name: leave.staffName,
      supervisor_id: leave.supervisorId, from_date: leave.fromDate,
      to_date: leave.toDate, reason: leave.reason, status: leave.status,
      applied_on: leave.appliedOn, decided_on: leave.decidedOn||null
    };
    return supabase.from("planned_leaves").upsert(row);
  },
  async seedConfigIfEmpty() {
    // Seed counters if empty
    const ec = await fetch(`${SUPABASE_URL}/rest/v1/app_counters?select=id&limit=1`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }).then(r=>r.json());
    if (Array.isArray(ec) && ec.length === 0) await DB.upsertCounters(INITIAL_STATE.counters);
    // Seed work types if empty
    const ew = await fetch(`${SUPABASE_URL}/rest/v1/app_work_types?select=id&limit=1`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }).then(r=>r.json());
    if (Array.isArray(ew) && ew.length === 0) await DB.upsertWorkTypes(INITIAL_STATE.workTypes);
  },
  async upsertPasswords(passwords) {
    // passwords is an object {empId: pwd} — convert to rows
    const rows = Object.entries(passwords).map(([emp_id, pwd]) => ({ emp_id, pwd }));
    return supabase.from("app_passwords").upsert(rows);
  },
  async seedUsersIfEmpty(users, passwords) {
    // Only seed if table is empty
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/app_users?select=id&limit=1`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }).then(r=>r.json());
    if (Array.isArray(existing) && existing.length === 0) {
      await DB.upsertUsers(users);
      await DB.upsertPasswords(passwords);
    }
  },
  async deleteTable(table) {
    const H = { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer "+SUPABASE_ANON_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" };
    const r = await fetch(SUPABASE_URL+"/rest/v1/"+table+"?id=like.*", { method:"DELETE", headers:H });
    if (!r.ok) return fetch(SUPABASE_URL+"/rest/v1/"+table+"?date=gte.2000-01-01", { method:"DELETE", headers:H });
    return r;
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
      const [reports, attendance, leaves, feedback, salaries, collReports, config, dbCounters, dbWorkTypes, plannedLeaves] = await Promise.all([
        DB.getReports(), DB.getAttendance(), DB.getLeaves(), DB.getFeedback(),
        DB.getSalaries(), DB.getCollectionReports(), DB.getConfig(),
        DB.getCounters(), DB.getWorkTypes(), DB.getPlannedLeaves()
      ]);

      // Check if tables exist — Supabase returns {code:"42P01"} if table missing
      const tablesExist = Array.isArray(reports);
      if (!tablesExist) {
        console.warn("Supabase tables not yet created. Run supabase-setup.sql first.", reports);
        setSyncStatus("setup_needed");
        setSynced(true);
        return;
      }

      // If tables are empty, seed from INITIAL_STATE
      // Only seed users if DB is empty AND we don't have local users
      if (Array.isArray(config.users) && config.users.length === 0) {
        // Double-check: only seed if truly empty (avoid race conditions)
        await DB.seedUsersIfEmpty(INITIAL_STATE.users, INITIAL_STATE.passwords);
      }
      await DB.seedConfigIfEmpty();

      const mapReport = r => {
        let counterId = r.counter_id;
        let counterName = r.counter_name;
        // Resolve missing counterId/counterName from supervisorId (legacy reports)
        if ((!counterId || !counterName) && r.supervisor_id) {
          const allCtrs = mappedCounters || INITIAL_STATE.counters;
          const supCtrs = allCtrs.filter(c => (c.supervisorId||c.supervisor_id) === r.supervisor_id);
          if (supCtrs.length === 1) {
            counterId = counterId || supCtrs[0].id;
            counterName = counterName || supCtrs[0].name;
          }
        }
        return {
          id: r.id, date: r.date, supervisorId: r.supervisor_id,
          submittedAt: r.submitted_at, counters: r.counters||[],
          counterId, counterName,
          entries: r.entries||[], totalAmount: r.total_amount,
          notes: r.notes, status: r.status
        };
      };
      const mapAtt = a => ({
        id: a.id, date: a.date, supervisorId: a.supervisor_id,
        staffId: a.staff_id, status: a.status,
        reason: a.reason, markedAt: a.marked_at
      });

      // Build passwords object from rows
      const pwdObj = Array.isArray(config.passwords)
        ? Object.fromEntries(config.passwords.map(r => [r.emp_id, r.pwd]))
        : null;

      // Map DB snake_case → camelCase
      const mappedUsers = Array.isArray(config.users) && config.users.length > 0
        ? config.users.map(u => ({
            id: u.id, empId: u.emp_id||u.empId, name: u.name, role: u.role,
            email: u.email||"", phone: u.phone||"", dob: u.dob||"",
            joining: u.joining||"",
            weddingAnniversary: u.wedding_anniversary||u.weddingAnniversary||"",
            active: u.active !== false,
            managerId: u.manager_id||u.managerId||null, counter: u.counter||""
          }))
        : null;

      // Map counters from DB
      const mappedCounters = Array.isArray(dbCounters) && dbCounters.length > 0
        ? dbCounters.map(c => ({
            id: c.id, name: c.name,
            supervisorId: c.supervisor_id||c.supervisorId||null,
            dealership: c.dealership||"", city: c.city||""
          }))
        : null;

      // Map work types from DB
      const mappedWorkTypes = Array.isArray(dbWorkTypes) && dbWorkTypes.length > 0
        ? dbWorkTypes.map(w => ({
            id: w.id, name: w.name,
            defaultRate: w.default_rate||w.defaultRate||0,
            category: w.category||"service"
          }))
        : null;

      setLocalState(p => ({
        ...p,
        users:     mappedUsers    || p.users,
        passwords: pwdObj && Object.keys(pwdObj).length > 0 ? pwdObj : p.passwords,
        counters:  mappedCounters  || p.counters,
        workTypes: mappedWorkTypes || p.workTypes,
        plannedLeaves:     Array.isArray(plannedLeaves) ? plannedLeaves : p.plannedLeaves,
        serviceReports:    reports.map(mapReport),
        attendance:        Array.isArray(attendance) ? attendance.map(mapAtt) : p.attendance,
        leaves:            Array.isArray(leaves)      ? leaves      : p.leaves,
        feedback:          Array.isArray(feedback)    ? feedback    : p.feedback,
        salaries:          Array.isArray(salaries)    ? salaries    : p.salaries,
        collectionReports: Array.isArray(collReports) ? collReports : p.collectionReports,
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
const today = () => {
  const now = new Date();
  // IST = UTC+5:30 = +330 minutes
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().split("T")[0];
};
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
    try {
      const s = localStorage.getItem(key);
      if (!s) return init;
      const cached = JSON.parse(s);
      // Start with INITIAL_STATE users/passwords as fallback until DB syncs
      // DB sync will overwrite these with the live values within seconds of load
      return {
        ...cached,
        users:     cached.users?.length     ? cached.users     : INITIAL_STATE.users,
        passwords: Object.keys(cached.passwords||{}).length ? cached.passwords : INITIAL_STATE.passwords,
        counters:  cached.counters?.length  ? cached.counters  : INITIAL_STATE.counters,
        workTypes: cached.workTypes?.length ? cached.workTypes : INITIAL_STATE.workTypes,
      };
    }
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
    { id:"today",     label:"Today" },
    { id:"yesterday", label:"Yesterday" },
    { id:"week",      label:"This Week" },
    { id:"month",     label:"This Month" },
    { id:"year",      label:"Financial Year" },
    { id:"custom",    label:"Custom" },
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
    // Use IST-adjusted date
    const now = new Date(new Date().getTime() + (330 + new Date().getTimezoneOffset()) * 60000);
    const y=now.getFullYear(), m=now.getMonth();
    const pad = n => String(n).padStart(2,"0");
    const fmt = d => d.toISOString().split("T")[0];
    if (range==="today") return [today(), today()];
    if (range==="yesterday") {
      const d = new Date(now); d.setDate(d.getDate()-1);
      return [fmt(d), fmt(d)];
    }
    if (range==="week") {
      const dow = now.getDay(); // 0=Sun
      const mon = new Date(now); mon.setDate(now.getDate() - (dow===0?6:dow-1));
      const sun = new Date(mon); sun.setDate(mon.getDate()+6);
      return [fmt(mon), fmt(sun)];
    }
    if (range==="month")   return [`${y}-${pad(m+1)}-01`, `${y}-${pad(m+1)}-31`];
    if (range==="quarter") {
      const q=Math.floor(m/3);
      return [`${y}-${pad(q*3+1)}-01`, `${y}-${pad(Math.min(q*3+3,12))}-31`];
    }
    // Financial year: Apr 1 – Mar 31
    if (range==="year") {
      const fy = m >= 3 ? y : y-1; // FY starts April
      return [`${fy}-04-01`, `${fy+1}-03-31`];
    }
    return [customFrom||today(), customTo||today()];
  };

  const [from, to] = getFromTo();
  const label = {
    today:"Today", yesterday:"Yesterday", week:"This Week",
    month:"This Month", quarter:"This Quarter",
    year:"Financial Year", custom:`${customFrom} → ${customTo}`
  }[range] || "";

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

function LoginScreen({ onLogin, users, passwords, onUsersLoaded }) {
  const [empId, setEmpId] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    const id = empId.trim().toUpperCase();
    if (!id || !pwd) { setErr("Please enter your Employee ID and password."); return; }
    setLoading(true);
    setErr("");

    // Step 1: Always fetch latest users/passwords directly from Supabase
    let liveUsers = users;
    let livePwds  = passwords;
    try {
      const config = await DB.getConfig();
      if (Array.isArray(config.users) && config.users.length > 0) {
        // Map snake_case DB columns → camelCase for the app
        liveUsers = config.users.map(u => ({
          id: u.id, empId: u.emp_id || u.empId, name: u.name,
          role: u.role, email: u.email||"", phone: u.phone||"",
          dob: u.dob||"", joining: u.joining||"",
          weddingAnniversary: u.wedding_anniversary||u.weddingAnniversary||"",
          active: u.active !== false, managerId: u.manager_id||u.managerId||null,
          counter: u.counter||""
        }));
        livePwds = Array.isArray(config.passwords)
          ? Object.fromEntries(config.passwords.map(r => [r.emp_id, r.pwd]))
          : passwords;
        // Notify parent to update its state with fresh mapped users
        if (onUsersLoaded) onUsersLoaded(liveUsers, livePwds);
      } else if (Array.isArray(config.users) && config.users.length === 0) {
        // Table empty — seed it
        await DB.seedUsersIfEmpty(INITIAL_STATE.users, INITIAL_STATE.passwords);
      }
    } catch(e) {
      console.warn("Could not fetch from DB, using local users:", e);
    }

    // Step 2: Check credentials against live (or local) data
    const user = liveUsers.find(u => u.empId === id && u.active);
    if (!user) {
      setErr("Employee ID not found or account is inactive.");
      setLoading(false); return;
    }
    if (livePwds[id] !== pwd) {
      setErr("Incorrect password.");
      setLoading(false); return;
    }
    setLoading(false);
    onLogin(user);
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${T.navy} 0%, ${T.navyL} 60%, #1a4a6b 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, background:T.amber, borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:32, marginBottom:12 }}>✨</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#fff" }}>Benaka Enterprises</div>
        </div>

        <div style={{ background:T.card, borderRadius:20, padding:32 }}>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:4, color:T.txt }}>Sign in</div>
          <div style={{ fontSize:13, color:T.txt2, marginBottom:24 }}>Use your Employee ID and password</div>

          {err && <div style={{ background:T.redL, border:`1px solid ${T.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:T.red, marginBottom:16 }}>{err}</div>}

          <Input label="Employee ID" value={empId} onChange={v=>{setEmpId(v);setErr("")}} placeholder="e.g. MGR001" />
          <Input label="Password" type="password" value={pwd} onChange={v=>{setPwd(v);setErr("")}} placeholder="Your password" />

          <Btn onClick={doLogin} disabled={loading} size="lg" style={{ width:"100%", justifyContent:"center" }}>
            {loading ? "Checking..." : "Sign in →"}
          </Btn>
          <div style={{ textAlign:"center", marginTop:14 }}>
            <button onClick={()=>{ localStorage.clear(); window.location.reload(); }}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:T.txt3, textDecoration:"underline" }}>
              Having trouble? Clear cache & reload
            </button>
          </div>
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
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
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

  const myStaff = state.users.filter(u => u.managerId === user.id && u.role === "field_staff" && u.active !== false);
  const myCounter = state.counters.find(c => c.supervisorId === user.id);
  const todayReports = state.serviceReports.filter(r => r.supervisorId === user.id && r.date === today());
  const todayAtt = state.attendance.filter(a => a.supervisorId === user.id && a.date === today());
  const todayRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
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
  const pct = target&&target.dailyTarget>0 ? Math.min(100, Math.round(todayRevenue*100/(target.dailyTarget+0.001))) : null;

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
            <div style={{ height:"100%", width:pct+"%", background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:5, transition:"width .5s" }}/>
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
    DB.upsertCollectionReport(rep).catch(e => console.error("Collection save:", e));
    toast.show("Collection report saved ✅");
  };

  // Filter reports by date range and counter
  const filteredReports = state.serviceReports.filter(r => {
    if (r.date < dr.from || r.date > dr.to) return false;
    if (selCounter !== "all" && r.counterId !== selCounter && r.counterName !== myCounters.find(c=>c.id===selCounter)?.name) return false;
    // Only show this executive's counters
    return myCounters.some(c=>c.id===r.counterId||c.name===r.counterName) || r.supervisorId===user.id;
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
  const totalRating = fb.reduce((s,f) => s + f.rating, 0);
  const avg = fb.length ? (totalRating / fb.length).toFixed(1) : "—";
  const feedbackLink = myCounter
    ? window.location.origin + window.location.pathname + "?feedback=" + encodeURIComponent(myCounter.name)
    : "";

  const ratingColor = (r) => r >= 4 ? T.grn : r === 3 ? T.amber : T.red;
  const stars = (r) => Array(r).fill("\u2B50").join("");

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Customer Feedback</div>

      {myCounter && (
        <Card style={{ marginBottom:16, background:T.navyXL }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.navy, marginBottom:8 }}>📎 Share feedback link with customers</div>
          <div style={{ fontFamily:"monospace", fontSize:12, color:T.sky, background:"#fff", borderRadius:8, padding:"10px 14px", wordBreak:"break-all", marginBottom:8 }}>
            {feedbackLink}
          </div>
          <div style={{ fontSize:12, color:T.txt2 }}>Send via WhatsApp or display at counter</div>
        </Card>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
        <div style={{ fontSize:32, fontWeight:800, color:T.amber }}>⭐ {avg}</div>
        <div style={{ fontSize:13, color:T.txt2 }}>{fb.length} feedback(s) received</div>
      </div>

      {fb.length === 0
        ? <Card><div style={{ textAlign:"center", padding:24, color:T.txt3 }}>No feedback yet.</div></Card>
        : fb.map(f => {
          const bdrColor = ratingColor(f.rating);
          return (
            <Card key={f.id} style={{ marginBottom:10, borderLeft:"4px solid " + bdrColor }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
                <div style={{ fontSize:14 }}>{stars(f.rating)} <span style={{ fontSize:12, color:T.txt2 }}>{fmtDate(f.date)} · {f.submittedAt || ""}</span></div>
                <Badge color={bdrColor}>{f.rating} ⭐</Badge>
              </div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:6, fontSize:12 }}>
                {f.vehicleNo && <span><b>{f.vehicleNo}</b></span>}
                {f.serviceType && <span style={{ color:T.txt2 }}>{f.serviceType}</span>}
                {f.customerName && <span style={{ color:T.txt2 }}>{f.customerName}</span>}
              </div>
              {f.comment && <div style={{ fontSize:13, background:T.surf, padding:"8px 12px", borderRadius:7 }}>{f.comment}</div>}
            </Card>
          );
        })
      }
    </div>
  );
}

function SupAttendance({ user, state, setState, myStaff, toast }) {
  const [tab, setTab] = useState("mark");
  const [histDate, setHistDate] = useState(today());
  const [displayDate, setDisplayDate] = useState(today());

  // Store selections in refs so 30s Supabase sync re-renders NEVER wipe them
  const recordsRef = useRef({});
  const reasonsRef = useRef({});
  const workingDate = useRef(today());
  const [formTick, setFormTick] = useState(0); // increment to force button re-render
  const [dirty, setDirty] = useState(false);
  const initialLoadDone = useRef(false);

  const allToMark = [user, ...myStaff];

  const loadDate = (date, attendanceData) => {
    const src = attendanceData || state.attendance;
    const r = {}; const rs = {};
    src.filter(a => a.supervisorId===user.id && a.date===date).forEach(a => {
      r[a.staffId] = a.status; rs[a.staffId] = a.reason||"";
    });
    recordsRef.current = r;
    reasonsRef.current = rs;
    workingDate.current = date;
    setDisplayDate(date);
    setFormTick(t => t+1);
    setDirty(false);
  };

  // Load once on mount only — the ref guard prevents re-runs on every sync
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadDate(today());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = (staffId, status) => {
    recordsRef.current = { ...recordsRef.current, [staffId]: status };
    setFormTick(t => t+1);
    setDirty(true);
  };

  const save = () => {
    const d = workingDate.current;
    const newAtts = allToMark.map(s => ({
      id: `att_${user.id}_${s.id}_${d}`,
      date: d, supervisorId: user.id, staffId: s.id,
      status: recordsRef.current[s.id] || "present",
      reason: reasonsRef.current[s.id] || "",
      markedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
    }));
    setState(p => ({ ...p, attendance:[...p.attendance.filter(a=>!(a.supervisorId===user.id&&a.date===d)),...newAtts] }));
    DB.upsertAttendance(newAtts).catch(e => console.error("Att save:", e));
    setDirty(false);
    toast.show("Attendance saved ✅");
  };

  const histAtt = state.attendance.filter(a => a.supervisorId===user.id && a.date===histDate);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Attendance</div>
      <Tabs tabs={[{id:"mark",label:"Mark Attendance"},{id:"history",label:"View Past Records"}]} active={tab} onChange={setTab}/>

      {tab==="mark" && (
        <Card style={{ maxWidth:700 }}>
          <Input label="Date" type="date" value={displayDate} onChange={d=>loadDate(d)}/>
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 250px 1fr", gap:8, padding:"6px 0", borderBottom:`1px solid ${T.bdr}`, marginBottom:8 }}>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Staff Member</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Status</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Reason</div>
            </div>
            {allToMark.map(s => {
              const curStatus = recordsRef.current[s.id];
              return (
                <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 250px 1fr", gap:8, alignItems:"center", marginBottom:10,
                  background:s.id===user.id?T.navyXL:"transparent", padding:"4px 8px", borderRadius:6 }}>
                  <div style={{fontSize:14,fontWeight:700}}>
                    {s.name}{s.id===user.id&&<Badge color={T.navy} style={{marginLeft:6}}>You</Badge>}
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {["present","absent","half_day"].map(status => {
                      const active = curStatus===status || (!curStatus && status==="present");
                      return (
                        <button key={status} onClick={()=>setStatus(s.id, status)} style={{
                          padding:"5px 10px", borderRadius:6,
                          border:`1px solid ${active?(status==="present"?T.grn:status==="absent"?T.red:T.amber):T.bdrS}`,
                          background:active?(status==="present"?T.grnL:status==="absent"?T.redL:T.amberL):"transparent",
                          color:active?(status==="present"?T.grn:status==="absent"?T.red:T.amberD):T.txt2,
                          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                        }}>{status==="half_day"?"½ Day":status==="absent"?"Absent":"Present"}</button>
                      );
                    })}
                  </div>
                  <input
                    key={`reason_${s.id}_${formTick}`}
                    defaultValue={reasonsRef.current[s.id]||""}
                    onChange={e=>{ reasonsRef.current={...reasonsRef.current,[s.id]:e.target.value}; setDirty(true); }}
                    placeholder={curStatus==="absent"?"Reason required":"Optional"}
                    style={{ padding:"6px 10px",
                      border:`1px solid ${curStatus==="absent"?T.red:T.bdrS}`,
                      borderRadius:6, fontSize:13, fontFamily:"inherit", outline:"none",
                      background:curStatus==="absent"?T.redL:curStatus==="half_day"?T.amberL:"#fff" }}/>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginTop:4}}>
            <div style={{fontSize:12,color:T.txt2}}>
              Date: <b>{fmtDate(displayDate)}</b>
              {dirty&&<span style={{color:T.amber,marginLeft:8,fontWeight:700}}>● Unsaved</span>}
            </div>
            <Btn onClick={save} variant={dirty?"amber":"primary"}>
              {dirty?"⚠️ Save Changes":"✅ Save Attendance"}
            </Btn>
          </div>
        </Card>
      )}

      {tab==="history" && (
        <div>
          <Input label="Select Date" type="date" value={histDate} onChange={setHistDate} style={{maxWidth:200,marginBottom:16}}/>
          {histAtt.length===0
            ? <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No records for {fmtDate(histDate)}</div></Card>
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

  const allWTs = [...state.workTypes];
  INITIAL_STATE.workTypes.forEach(iwt => { if(!allWTs.find(w=>w.id===iwt.id||w.name===iwt.name)) allWTs.push(iwt); });
  const serviceWTs = allWTs.filter(w => w.category !== "sales");
  const salesWTs   = allWTs.filter(w => w.category === "sales");
  const blankServiceRows = () => [
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
  ];
  const blankSalesRows   = () => salesWTs.map(wt => ({ workTypeId:wt.id, workTypeName:wt.name, amount:0, type:"sales" }));

  // Per-counter local state: { [counterId]: { entries, salesEntries } }
  const [counterData, setCounterData] = useState({});

  // Load existing report data for each counter when date changes
  useEffect(() => {
    const newData = {};
    const SALES_WTS_SET = new Set(["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"]);
    myCounters.forEach(c => {
      // Match by counterId OR counterName to catch office-submitted reports
      const existing = state.serviceReports.find(r =>
        (r.counterId === c.id || r.counterName === c.name) &&
        r.supervisorId === user.id && r.date === date
      );
      if (existing) {
        const svcEntries = (existing.entries||[]).filter(e => e.type !== "sales" && !SALES_WTS_SET.has(e.workTypeName));
        newData[c.id] = {
          // Pre-fill blank rows if no service entries (office may have submitted sales-only)
          entries: svcEntries.length > 0 ? svcEntries : blankServiceRows(),
          notes: existing.notes || "",
          // Only mark submitted if there are actual service entries
          submitted: svcEntries.length > 0,
        };
      } else {
        newData[c.id] = { entries: blankServiceRows(), notes: "", submitted: false };
      }
    });
    setCounterData(newData);
    if (myCounters.length > 0 && !activeCounter) setActiveCounter(myCounters[0].id);
  }, [date, state.serviceReports.length]);

  const getData = (cid) => counterData[cid] || { entries: blankServiceRows(), notes: "" };

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
      ...(d.entries||[]).filter(e => e.workTypeName && (e.vehicles>0||e.amount>0)),
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
    DB.upsertReport(report).catch(e => console.error("Report save failed:", e));
    toast.show(counter.name + " report submitted ✅");
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
                : total>0 ? <span style={{ marginLeft:6, fontSize:10, background:T.amber, color:"#fff", padding:"1px 5px", borderRadius:10 }}>₹{(total >= 1000 ? Math.floor(total * 0.001) + "k" : total)}</span>
                : null
              }
            </button>
          );
        })}
      </div>

      {/* Active counter form */}
      {activeC && (() => {
        const d = getData(activeC.id);
        const isSubmitted = !!state.serviceReports.find(r=>(r.counterId===activeC.id||r.counterName===activeC.name)&&r.supervisorId===user.id&&r.date===date);
        const svcTotal = (d.entries||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        return (
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800 }}>{activeC.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{isSubmitted?"✅ Submitted":"Enter vehicle service data"}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>printCounter(activeC)} size="sm" variant="ghost">🖨 Print</Btn>
                {!isSubmitted && <Btn onClick={()=>submitCounter(activeC)} variant="amber">Submit Report</Btn>}
                {isSubmitted  && <Btn onClick={()=>{ const recallId = "sr_"+user.id+"_"+activeC.id+"_"+date;
                  setState(p=>({...p,serviceReports:p.serviceReports.filter(r=>!((r.counterId===activeC.id||r.counterName===activeC.name)&&r.supervisorId===user.id&&r.date===date))}));
                  setCounterData(p=>({...p,[activeC.id]:{entries:blankServiceRows(),notes:"",submitted:false}}));
                  supabase.from("service_reports").delete().eq("id",recallId).catch(e=>console.error("Recall delete:",e));
                  toast.show("Report recalled ✅"); }} size="sm" variant="ghost">↩ Recall</Btn>}
              </div>
            </div>

            {/* Service Entries */}
            <div style={{ fontSize:12, fontWeight:800, color:T.navy, textTransform:"uppercase", marginBottom:10 }}>Vehicle Service</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 100px", gap:8, marginBottom:6, padding:"0 4px" }}>
              {["Work Type","Vehicles","Rate (₹)","Amount (₹)"].map(h=>(
                <div key={h} style={{ fontSize:10, fontWeight:800, color:T.txt2, textTransform:"uppercase" }}>{h}</div>
              ))}
            </div>
            <datalist id="sup-wt-list">
                {serviceWTs.map(w=><option key={w.id} value={w.name}/>)}
              </datalist>
              {(d.entries||[]).map((e, ei) => (
              <div key={ei} style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 100px", gap:8, marginBottom:8, alignItems:"center" }}>
                <input list="sup-wt-list" value={e.workTypeName||""} placeholder="Type work type..."
                  onChange={ev=>{
                    const val=ev.target.value;
                    const wt=allWTs.find(w=>w.name===val);
                    if(wt) setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),entries:getData(activeC.id).entries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name,rate:wt.defaultRate||row.rate,amount:(row.vehicles||0)*(wt.defaultRate||row.rate||0)})}}));
                    else updateServiceEntry(activeC.id,ei,"workTypeName",val);
                  }}
                  style={{padding:"7px 8px",border:"1px solid "+(e.workTypeName?T.navy:T.bdrS),borderRadius:7,fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",background:e.workTypeName?"#EFF6FF":"#fff"}}/>
                <input type="number" value={e.vehicles||""} onChange={ev=>updateServiceEntry(activeC.id,ei,"vehicles",ev.target.value)} min={0} placeholder="0"
                  style={{ padding:"7px 8px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none", textAlign:"center" }}/>
                <input type="number" value={e.rate||""} onChange={ev=>updateServiceEntry(activeC.id,ei,"rate",ev.target.value)} min={0} placeholder="0"
                  style={{ padding:"7px 8px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:12, fontFamily:"inherit", outline:"none" }}/>
                <div style={{ padding:"7px 8px", background:e.amount>0?T.navyXL:"transparent", borderRadius:7, fontSize:12, fontWeight:e.amount>0?700:400, color:e.amount>0?T.navy:T.txt3, textAlign:"right" }}>
                  {e.amount>0 ? fmtCurr(e.amount) : "—"}
                </div>
              </div>
            ))}
            <button onClick={()=>setCounterData(p=>({...p,[activeC.id]:{...getData(activeC.id),entries:[...(getData(activeC.id).entries||[]),{workTypeId:"",workTypeName:"",vehicles:0,rate:0,amount:0,type:"service"}]}}))}
              style={{background:"none",border:"none",color:T.navy,cursor:"pointer",fontSize:12,fontWeight:700,padding:"4px 0",fontFamily:"inherit"}}>+ Add Row</button>
            <div style={{ marginTop:8, padding:"10px 12px", background:T.navyXL, borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.navy }}>Service Total</span>
              <span style={{ fontSize:16, fontWeight:800, color:T.navy }}>{fmtCurr(svcTotal)}</span>
            </div>

            <div style={{ marginTop:14 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>Notes</label>
              <textarea value={d.notes||""} onChange={e=>setNotes(activeC.id, e.target.value)} rows={2} placeholder="Optional notes..."
                style={{ width:"100%", padding:"8px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>

            {!isSubmitted && (
              <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
                <Btn onClick={()=>submitCounter(activeC)} variant="amber">Submit Report</Btn>
              </div>
            )}
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
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
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

  const mySupervisors = state.users.filter(u=>u.managerId===user.id&&u.role==="supervisor"&&u.active!==false);
  const myCounters = state.counters.filter(c=>mySupervisors.some(s=>s.id===c.supervisorId));
  // All counter names belonging to this manager's supervisors (for reliable report matching)
  const _myCounterNames = myCounters.map(c=>c.name);
  const _mySupIds = mySupervisors.map(s=>s.id);

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="dashboard" && <MgrDashboard user={user} state={state} mySupervisors={mySupervisors} myCounters={myCounters} setPage={setPage}/>}
      {page==="reports"   && <MgrReports user={user} state={state} mySupervisors={mySupervisors} myCounters={myCounters}/>}
      {page==="leaves"    && <MgrLeaves user={user} state={state} setState={setState} toast={toast}/>}
      {page==="people"    && <MgrPeople user={user} state={state} setState={setState} toast={toast}/>}
      {page==="targets"    && <MgrTargets user={user} state={state} setState={setState} mySupervisors={mySupervisors} toast={toast}/>}
      {page==="feedback"   && <MgrFeedback user={user} state={state} myCounters={myCounters}/>}
      {page==="myleaves"   && <LeavePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="execreport" && <ExecutiveReportGenerator state={state}/>}
      {page==="collection" && <MgrCollectionReport user={user} state={state} setState={setState} toast={toast} mySupervisors={mySupervisors} myCounters={myCounters}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="directory"   && <StaffDirectory state={state}/>}
    </Shell>
  );
}

function MgrCollectionReport({ user, state, setState, toast, mySupervisors, myCounters }) {
  const dr = useDateRange("today");
  const date = dr.from;
  const [selCounter, setSelCounter] = useState("all");
  const existing = state.collectionReports?.find(r=>r.date===date);
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL"];
  const getE = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);

  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    DB.upsertCollectionReport(rep).catch(e => console.error("Collection save:", e));
    toast.show("Collection report saved ✅");
  };

  const filteredReports = state.serviceReports.filter(r => {
    if(r.date<dr.from||r.date>dr.to) return false;
    const inScope = mySupervisors.some(s=>s.id===r.supervisorId) ||
      myCounters.some(c=>c.id===r.counterId||c.name===r.counterName||c.supervisorId===r.supervisorId);
    if(!inScope) return false;
    if(selCounter!=="all" && r.counterId!==selCounter && r.counterName!==myCounters.find(c=>c.id===selCounter)?.name) return false;
    return true;
  });

  const execTotals = mySupervisors.map(exec => {
    const cIds = state.counters.filter(c=>c.supervisorId===exec.id).map(c=>c.id);
    const cNames = state.counters.filter(c=>c.supervisorId===exec.id).map(c=>c.name);
    const reps = filteredReports.filter(r=>cIds.includes(r.counterId)||cNames.includes(r.counterName));
    if(!reps.length) return null;
    const allE = reps.flatMap(r=>getE(r));
    const svc = allE.filter(e=>e.type!=="sales"&&!SALES_WTS.includes(e.workTypeName)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const sal = allE.filter(e=>e.type==="sales"||SALES_WTS.includes(e.workTypeName)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    return {exec, svc, sal, total:svc+sal};
  }).filter(Boolean);

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Collection Report</div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:8}}>
        <div style={{flex:1}}>
          <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
        </div>
        <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
          style={{padding:"6px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
          <option value="all">All Counters</option>
          {myCounters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {execTotals.length>0 && (
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:10}}>Executive Summary — {dr.label}</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:T.surf}}>
              {["Executive","Service","Sales","Total"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:h==="Executive"?"left":"right",fontSize:11,fontWeight:800,color:T.txt2}}>{h}</th>)}
            </tr></thead>
            <tbody>{execTotals.map(e=>(
              <tr key={e.exec.id} style={{borderBottom:"1px solid "+T.bdr}}>
                <td style={{padding:"6px 10px",fontWeight:600}}>{e.exec.name}</td>
                <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtCurr(e.svc)}</td>
                <td style={{padding:"6px 10px",textAlign:"right",color:T.grn}}>{fmtCurr(e.sal)}</td>
                <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.amber}}>{fmtCurr(e.total)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{background:T.amberL}}>
              <td style={{padding:"6px 10px",fontWeight:800}}>TOTAL</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.svc,0))}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.grn}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.sal,0))}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.amber}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.total,0))}</td>
            </tr></tfoot>
          </table>
        </Card>
      )}
      <CollectionReportView date={date} report={existing} counters={myCounters} allReports={filteredReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

function MgrDashboard({ user, state, mySupervisors, myCounters, setPage }) {
  const today_ = today();
  const myCounterIds   = myCounters.map(c=>c.id);
  const myCounterNames = myCounters.map(c=>c.name);
  // Match by supervisorId OR counterId OR counterName (office reports use counterId+counterName)
  const isMyReport = r =>
    mySupervisors.some(s=>s.id===r.supervisorId) ||
    (r.counterId && myCounterIds.includes(r.counterId)) ||
    (r.counterName && myCounterNames.includes(r.counterName)) ||
    // Also check supervisor field against counter's supervisorId
    myCounters.some(c=>c.supervisorId===r.supervisorId);
  const todayReports = state.serviceReports.filter(r=>r.date===today_&&isMyReport(r));
  const totalRevenue = todayReports.reduce((s,r)=>s+r.totalAmount,0);
  const pendingLeaves = (state.leaves||[]).filter(l=>l.approverId===user.id&&l.status==="pending").length;
  const month = today_.slice(0,7);
  const monthReports = state.serviceReports.filter(r=>r.date.startsWith(month)&&isMyReport(r));
  const monthRevenue = monthReports.reduce((s,r)=>s+r.totalAmount,0);

  // Pre-assign each todayReport to exactly ONE counter (most specific match wins)
  const reportToCounter = {};
  todayReports.forEach(r => {
    // Try counterId match first
    let matched = myCounters.find(c => r.counterId && r.counterId===c.id);
    // Try counterName match
    if (!matched && r.counterName) {
      const rn = r.counterName.trim().toUpperCase();
      matched = myCounters.find(c => c.name.trim().toUpperCase()===rn);
    }
    // Try supervisorId for single-counter execs
    if (!matched && r.supervisorId) {
      const supCtrs = myCounters.filter(c=>c.supervisorId===r.supervisorId);
      if (supCtrs.length===1) matched = supCtrs[0];
    }
    if (matched) reportToCounter[r.id] = matched.id;
  });

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
        <StatCard label="Reports Today" value={todayReports.length+"/"+myCounters.length} color={todayReports.length>=myCounters.length?T.grn:T.amber} icon="📋"/>
      </div>

      {/* Counter Revenue Grid */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Counter Performance — Today</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
          {myCounters.map(c => {
            const sup = mySupervisors.find(s=>s.id===c.supervisorId);
            // Sum reports for this counter
            const reps = todayReports.filter(r => reportToCounter[r.id]===c.id);
            const amt = reps.reduce((s,r)=>s+r.totalAmount,0);
            const tgt = state.targets.find(t=>t.counterId===c.id&&t.month===month)||state.targets.find(t=>t.supervisorId===c.supervisorId&&t.month===month);
            const pct = tgt&&tgt.dailyTarget>0 ? Math.min(100, Math.round(amt*100/(tgt.dailyTarget+0.001))) : null;
            const reported = reps.length > 0;
            return (
              <div key={c.id} style={{ border:"1px solid "+(reported?T.grn+"66":T.bdr), borderRadius:10, padding:14 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{c.name==="OFFICE"?"SALES":c.name}</div>
                <div style={{ fontSize:11, color:T.txt2, marginBottom:8 }}>{sup?.name||"—"}</div>
                <div style={{ fontSize:20, fontWeight:800, color:amt>0?T.amber:T.txt3 }}>{fmtCurr(amt)}</div>
                {reported && reps.length>1 && <div style={{ fontSize:10, color:T.txt2 }}>{reps.length} submissions</div>}
                {tgt && pct!==null && <>
                  <div style={{ height:6, background:T.surf, borderRadius:3, margin:"8px 0 4px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:pct+"%", background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:11, color:T.txt2 }}>{pct}% of {fmtCurr(tgt.dailyTarget)} target</div>
                </>}
                {!reported && <div style={{ fontSize:11, color:T.red, marginTop:4 }}>⚠ No report yet</div>}
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
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL"];

  const getEntries = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);
  const isSales = e => e.type==="sales"||SALES_WTS.includes(e.workTypeName);
  const getCounterName = r => r.counterName || (r.counters||[])[0]?.counterName || state.users.find(u=>u.id===r.supervisorId)?.counter || "—";
  const getVehicles = r => getEntries(r).filter(e=>!isSales(e)).reduce((s,e)=>s+(Number(e.vehicles)||0),0);

  const relevantReports = state.serviceReports.filter(r =>
    mySupervisors.some(s=>s.id===r.supervisorId) ||
    myCounters.some(c=>c.id===r.counterId||c.name===r.counterName||c.supervisorId===r.supervisorId)
  );
  const dailyReports = relevantReports.filter(r=>r.date>=dr.from&&r.date<=dr.to);
  const monthReports = relevantReports.filter(r=>r.date.startsWith(selMonth));

  const dailyTotal = dailyReports.reduce((s,r)=>s+r.totalAmount,0);
  const monthTotal = monthReports.reduce((s,r)=>s+r.totalAmount,0);

  // Revenue by work type
  const wtRevenue = {};
  relevantReports.forEach(r=>{
    getEntries(r).forEach(e=>{
      if(!isSales(e)&&e.workTypeName) wtRevenue[e.workTypeName]=(wtRevenue[e.workTypeName]||0)+(Number(e.amount)||0);
    });
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
            <StatCard label="Reports In" value={dailyReports.length + "/" + myCounters.length} color={T.navy}/>
            <StatCard label="Vehicles" value={dailyReports.reduce((s,r)=>s+getVehicles(r),0)} color={T.grn}/>
          </div>
          <Table cols={[
            {key:"counter",label:"Counter",render:r=><b>{getCounterName(r)}</b>},
            {key:"supervisor",label:"Executive",render:r=>state.users.find(u=>u.id===r.supervisorId)?.name||"—"},
            {key:"vehicles",label:"Vehicles",render:r=>getVehicles(r)},
            {key:"totalAmount",label:"Revenue",render:r=><b style={{color:T.amber}}>{fmtCurr(r.totalAmount)}</b>},
            {key:"submittedAt",label:"Submitted"},
            {key:"status",label:"Status",render:r=><Badge color={T.grn}>{r.status||"submitted"}</Badge>},
          ]} rows={dailyReports} emptyMsg="No reports for selected range"/>
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
          <Card style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Revenue by Counter</div>
            {myCounters.map(c=>{
              const cr = monthReports.filter(r=>r.counterId===c.id||r.counterName===c.name).reduce((s,r)=>s+r.totalAmount,0);
              const tgt = state.targets.find(t=>t.counterId===c.id&&t.month===selMonth);
              const pct = tgt&&tgt.monthlyTarget>0 ? Math.min(100, Math.round(cr * 100 / tgt.monthlyTarget)) : null;
              return (
                <div key={c.id} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{c.name}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:T.amber }}>{fmtCurr(cr)}{tgt ? " / " + fmtCurr(tgt.monthlyTarget) : ""}</span>
                  </div>
                  {pct !== null && <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:pct + "%", background:pct>=100?T.grn:pct>=70?T.amber:T.red, borderRadius:4 }}/>
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
            {wtArr.map(([name, rev]) => {
              const barW = Math.round(rev * 100 / maxWt);
              return (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:13 }}>{name}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:T.navy }}>{fmtCurr(rev)}</span>
                  </div>
                  <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:barW + "%", background:T.amber, borderRadius:4 }}/>
                  </div>
                </div>
              );
            })}
          </Card>
          <Card>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Attendance Summary (Today)</div>
            {mySupervisors.map(s=>{
              const staff = state.users.filter(u=>u.managerId===s.id&&u.role==="field_staff");
              const att = state.attendance.filter(a=>a.supervisorId===s.id&&a.date===today());
              const present = att.filter(a=>a.status==="present").length;
              const total = staff.length;
              return (
                <div key={s.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid " + T.bdr }}>
                  <span style={{ fontSize:13 }}>{s.name} · {s.counter}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:present===total?T.grn:T.amber }}>{present + " / " + total + " present"}</span>
                </div>
              );
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
              <Card key={l.id} style={{ marginBottom:12, borderLeft:"4px solid " + (T.amber) }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{applicant?.name}</div>
                    <div style={{ fontSize:12, color:T.txt2 }}>{ROLE_LABELS[applicant?.role]} · {l.type}</div>
                    <div style={{ fontSize:13, margin:"4px 0" }}>{fmtDate(l.date)}{l.toDate!==l.date?` → ${fmtDate(l.toDate)}`:""}</div>
                    <div style={{ fontSize:13, color:T.txt2 }}>{l.reason}</div>
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
  const [selPeriod, setSelPeriod] = useState("monthly");
  const [selRef, setSelRef] = useState(today().slice(0,7)); // month or week or year
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ daily:"", weekly:"", monthly:"", quarterly:"", yearly:"" });

  const periods = [
    { id:"daily",     label:"Daily",     inputType:"date",  placeholder:"YYYY-MM-DD" },
    { id:"weekly",    label:"Weekly",    inputType:"week",  placeholder:"YYYY-Www" },
    { id:"monthly",   label:"Monthly",   inputType:"month", placeholder:"YYYY-MM" },
    { id:"quarterly", label:"Quarterly", inputType:"month", placeholder:"YYYY-MM (start of quarter)" },
    { id:"yearly",    label:"Yearly",    inputType:"month", placeholder:"YYYY-04 (financial year start)" },
  ];

  const getTargetKey = (supId) => `tgt_${supId}_${selPeriod}_${selRef}`;

  const startEdit = (sup) => {
    const existing = (state.targets||[]).find(t=>t.id===getTargetKey(sup.id));
    setEditing(sup.id);
    setForm({
      daily:     existing?.daily     || "",
      weekly:    existing?.weekly    || "",
      monthly:   existing?.monthly   || "",
      quarterly: existing?.quarterly || "",
      yearly:    existing?.yearly    || "",
      [selPeriod]: existing?.[selPeriod] || "",
    });
  };

  const save = (sup) => {
    const counter = state.counters.find(c=>c.supervisorId===sup.id);
    const tgt = {
      id:          getTargetKey(sup.id),
      counterId:   counter?.id,
      supervisorId: sup.id,
      period:      selPeriod,
      periodRef:   selRef,
      month:       selPeriod==="monthly" ? selRef : selRef.slice(0,7),
      daily:       Number(form.daily)||0,
      weekly:      Number(form.weekly)||0,
      monthly:     Number(form.monthly)||0,
      quarterly:   Number(form.quarterly)||0,
      yearly:      Number(form.yearly)||0,
      // Legacy fields for compatibility
      dailyTarget:   Number(form.daily)||0,
      monthlyTarget: Number(form.monthly)||0,
      setBy: user.id,
      setAt: new Date().toISOString(),
    };
    setState(p=>({
      ...p,
      targets:[...(p.targets||[]).filter(t=>t.id!==tgt.id), tgt]
    }));
    toast.show("Target saved for " + sup.name + " ✅");
    setEditing(null);
  };

  const getPct = (actual, target) => target > 0 ? Math.min(100, Math.round(actual * 100 / (target + 0.001))) : null;

  // Get actual revenue for a supervisor in selected period
  const getActual = (sup) => {
    const myCounterIds = state.counters.filter(c=>c.supervisorId===sup.id).map(c=>c.id);
    const myCounterNames = state.counters.filter(c=>c.supervisorId===sup.id).map(c=>c.name);
    let reps = state.serviceReports.filter(r=>
      r.supervisorId===sup.id ||
      myCounterIds.includes(r.counterId) ||
      myCounterNames.includes(r.counterName)
    );
    if (selPeriod==="daily")     reps = reps.filter(r=>r.date===selRef);
    if (selPeriod==="weekly")    reps = reps.filter(r=>{ const d=new Date(r.date); return d>=new Date(selRef.replace(/W/g,"-").replace(/-(\d\d)$/,"-W$1").slice(0,10)); });
    if (selPeriod==="monthly")   reps = reps.filter(r=>r.date.startsWith(selRef));
    if (selPeriod==="quarterly") reps = reps.filter(r=>r.date.startsWith(selRef.slice(0,4)));
    if (selPeriod==="yearly")    reps = reps.filter(r=>r.date.startsWith(selRef.slice(0,4)));
    return reps.reduce((s,r)=>s+r.totalAmount, 0);
  };

  const curPeriod = periods.find(p=>p.id===selPeriod);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Set Targets</div>

      {/* Period selector */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {periods.map(p=>(
          <button key={p.id} onClick={()=>setSelPeriod(p.id)} style={{
            padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            border:"1px solid "+(selPeriod===p.id?T.navy:T.bdrS),
            background:selPeriod===p.id?T.navy:"transparent",
            color:selPeriod===p.id?"#fff":T.txt2
          }}>{p.label}</button>
        ))}
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>{curPeriod.label} Reference Period</label>
        <input type={curPeriod.inputType} value={selRef} onChange={e=>setSelRef(e.target.value)}
          style={{ padding:"8px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
      </div>

      {mySupervisors.map(s => {
        const existing = (state.targets||[]).find(t=>t.id===getTargetKey(s.id));
        const targetVal = existing?.[selPeriod] || existing?.monthly || 0;
        const actual = getActual(s);
        const pct = getPct(actual, targetVal);
        const isEditing = editing===s.id;

        return (
          <Card key={s.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:isEditing?16:0 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{s.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{s.counter || state.counters.find(c=>c.supervisorId===s.id)?.name || "—"}</div>
              </div>
              {!isEditing && (
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  {targetVal > 0 ? (
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, color:T.txt2 }}>{curPeriod.label} target</div>
                      <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{fmtCurr(targetVal)}</div>
                      <div style={{ fontSize:12, color:T.txt2 }}>Actual: {fmtCurr(actual)}</div>
                    </div>
                  ) : <div style={{ fontSize:12, color:T.txt3 }}>No target set</div>}
                  <Btn onClick={()=>startEdit(s)} size="sm" variant="outline">{targetVal>0?"Edit":"Set Target"}</Btn>
                </div>
              )}
            </div>

            {pct !== null && !isEditing && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.txt2, marginBottom:3 }}>
                  <span>{pct}% achieved</span>
                  <span>{fmtCurr(actual)} of {fmtCurr(targetVal)}</span>
                </div>
                <div style={{ height:8, background:T.surf, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", borderRadius:4,
                    background:pct>=100?T.grn:pct>=70?T.amber:T.red }}/>
                </div>
              </div>
            )}

            {isEditing && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:14 }}>
                  {[
                    {key:"daily",    label:"Daily Target (₹)"},
                    {key:"weekly",   label:"Weekly Target (₹)"},
                    {key:"monthly",  label:"Monthly Target (₹)"},
                    {key:"quarterly",label:"Quarterly Target (₹)"},
                    {key:"yearly",   label:"Yearly Target (₹)"},
                  ].map(f=>(
                    <div key={f.key}>
                      <label style={{ display:"block", fontSize:11, fontWeight:700, color:f.key===selPeriod?T.navy:T.txt2, marginBottom:4, textTransform:"uppercase" }}>
                        {f.label}{f.key===selPeriod?" ◀":""}
                      </label>
                      <input type="number" value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                        placeholder="0"
                        style={{ width:"100%", padding:"8px 10px", border:"1px solid "+(f.key===selPeriod?T.navy:T.bdrS),
                          borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none",
                          background:f.key===selPeriod?T.navyXL:"#fff", boxSizing:"border-box" }}/>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <Btn onClick={()=>save(s)} variant="amber">Save Targets</Btn>
                  <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      {mySupervisors.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:24}}>No executives assigned to you.</div></Card>}
    </div>
  );
}


function MgrFeedback({ user, state, myCounters }) {
  const [selCounter, setSelCounter] = useState("all");
  const [selDate, setSelDate] = useState("");

  let fb = state.feedback.filter(f => myCounters.some(c => c.id===f.counterId||c.name===f.counterName));
  if (selCounter !== "all") fb = fb.filter(f => f.counterId===selCounter || f.counterName===state.counters.find(c=>c.id===selCounter)?.name);
  if (selDate) fb = fb.filter(f => f.date===selDate);
  fb = [...fb].sort((a,b) => b.date.localeCompare(a.date));

  const totalRating = fb.reduce((s,f) => s+f.rating, 0);
  const avg = fb.length ? (totalRating / fb.length).toFixed(1) : "—";
  const dist = [5,4,3,2,1].map(r => ({
    r,
    count: fb.filter(f=>f.rating===r).length,
    pct: fb.length ? Math.round(fb.filter(f=>f.rating===r).length * 100 / (fb.length + 0.0001)) : 0
  }));

  const feedbackLink = (counterId) => {
    const c = state.counters.find(x=>x.id===counterId);
    return c ? "?feedback=" + encodeURIComponent(c.name) : "#";
  };
  const ratingColor = (r) => r>=4 ? T.grn : r===3 ? T.amber : T.red;
  const stars = (n) => Array(Math.max(0,n)).fill("⭐").join("");

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Customer Feedback</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:28, fontWeight:800, color:T.amber }}>⭐ {avg}</span>
          <span style={{ fontSize:12, color:T.txt2 }}>{fb.length} reviews</span>
        </div>
      </div>

      <Card style={{ marginBottom:16, background:T.navyXL }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.navy, marginBottom:10 }}>📎 Feedback Form Links</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
          {myCounters.map(c => (
            <div key={c.id} style={{ background:"#fff", border:"1px solid " + T.bdr, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{c.name}</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:T.sky, background:T.skyL, padding:"4px 8px", borderRadius:5, wordBreak:"break-all" }}>
                {window.location.origin + feedbackLink(c.id)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Counter</label>
          <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
            style={{ padding:"7px 12px", border:"1px solid " + T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}>
            <option value="all">All counters</option>
            {myCounters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>Date</label>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
            style={{ padding:"7px 12px", border:"1px solid " + T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
        </div>
        {selDate && <button onClick={()=>setSelDate("")} style={{ background:"none", border:"none", cursor:"pointer", color:T.txt2, fontSize:13, alignSelf:"flex-end", paddingBottom:8 }}>✕ Clear</button>}
      </div>

      {fb.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Rating breakdown</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {dist.map(d => (
              <div key={d.r} style={{ textAlign:"center" }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{stars(d.r)}</div>
                <div style={{ fontSize:22, fontWeight:800, color:d.count>0?T.amber:T.txt3 }}>{d.count}</div>
                <div style={{ height:6, background:T.surf, borderRadius:3, marginTop:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:d.pct + "%", background:T.amber, borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fb.length === 0
        ? <Card><div style={{ textAlign:"center", padding:24, color:T.txt3 }}>No feedback yet</div></Card>
        : fb.map(f => {
          const bc = ratingColor(f.rating);
          return (
            <Card key={f.id} style={{ marginBottom:12, borderLeft:"4px solid " + bc }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{f.counterName || state.counters.find(c=>c.id===f.counterId)?.name}</div>
                  <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(f.date)} · {f.submittedAt || ""}</div>
                </div>
                <Badge color={bc}>{stars(f.rating)} {f.rating}</Badge>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:6, fontSize:12 }}>
                {f.vehicleNo && <span><b>{f.vehicleNo}</b></span>}
                {f.serviceType && <span style={{ color:T.txt2 }}>{f.serviceType}</span>}
                {f.customerName && <span style={{ color:T.txt2 }}>{f.customerName}</span>}
              </div>
              {f.comment && <div style={{ fontSize:13, background:T.surf, padding:"8px 12px", borderRadius:7 }}>{f.comment}</div>}
            </Card>
          );
        })
      }
    </div>
  );
}


function MDPortal({ user, state, setState, toast, syncFromCloud, syncStatus="" }) {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"dashboard",   icon:"🏆", label:"Live Dashboard" },
    { id:"collection",  icon:"📊", label:"Collection Report" },
    { id:"analysis",    icon:"📈", label:"Counter Analysis" },
    { id:"reports",     icon:"📋", label:"All Reports" },
    { id:"execreport",  icon:"📄", label:"MD Report" },
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
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="dashboard"  && <MDDashboard user={user} state={state} syncFromCloud={syncFromCloud}/>}
      {page==="collection"  && <MDCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state}/>}
      {page==="financial"  && <MDFinancial state={state}/>}
      {page==="operations" && <MDOperations state={state}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="directory"   && <StaffDirectory state={state}/>}
      {page==="leaves"     && <MgrLeaves user={user} state={state} setState={setState} toast={toast}/>}
      {page==="people"     && <MDPeople state={state} setState={setState} toast={toast}/>}
      {page==="reports"     && <AllReports state={state}/>}
      {page==="execreport"  && <ExecutiveReportGenerator state={state}/>}
      {page==="feedback"    && <MDFeedbackAll state={state}/>}
      {page==="attendance"  && <MDAttendance state={state}/>}
    </Shell>
  );
}

function MDCollectionReport({ user, state, setState, toast }) {
  const dr = useDateRange("today");
  const date = dr.from;
  const [selCounter, setSelCounter] = useState("all");
  const existing = state.collectionReports?.find(r=>r.date===date);
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:"admin", bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    DB.upsertCollectionReport(rep).catch(e => console.error("Collection save:", e));
    toast.show("Collection report saved ✅");
  };
  const filteredReports = state.serviceReports.filter(r => {
    if(r.date<dr.from||r.date>dr.to) return false;
    if(selCounter!=="all"&&r.counterId!==selCounter&&r.counterName!==state.counters.find(c=>c.id===selCounter)?.name) return false;
    return true;
  });
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL"];
  const getE = r => r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
  const execTotals = state.users.filter(u=>u.role==="supervisor").map(exec=>{
    const cIds=state.counters.filter(c=>c.supervisorId===exec.id).map(c=>c.id);
    const cNames=state.counters.filter(c=>c.supervisorId===exec.id).map(c=>c.name);
    const reps=filteredReports.filter(r=>cIds.includes(r.counterId)||cNames.includes(r.counterName));
    if(!reps.length) return null;
    const allE=reps.flatMap(r=>getE(r));
    const svc=allE.filter(e=>e.type!=="sales"&&!SALES_WTS.includes(e.workTypeName)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const sal=allE.filter(e=>e.type==="sales"||SALES_WTS.includes(e.workTypeName)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    return {exec, svc, sal, total:svc+sal};
  }).filter(Boolean);

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Collection Report</div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:8}}>
        <div style={{flex:1}}><DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/></div>
        <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
          style={{padding:"6px 12px",border:`1px solid ${T.bdrS}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
          <option value="all">All Counters</option>
          {state.counters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {execTotals.length>0&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:10}}>Executive Summary — {dr.label}</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:T.surf}}>
              {["Executive","Service","Sales","Total"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:h==="Executive"?"left":"right",fontSize:11,fontWeight:800,color:T.txt2}}>{h}</th>)}
            </tr></thead>
            <tbody>{execTotals.map(e=>(
              <tr key={e.exec.id} style={{borderBottom:`1px solid ${T.bdr}`}}>
                <td style={{padding:"6px 10px",fontWeight:600}}>{e.exec.name}</td>
                <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtCurr(e.svc)}</td>
                <td style={{padding:"6px 10px",textAlign:"right",color:T.grn}}>{fmtCurr(e.sal)}</td>
                <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.amber}}>{fmtCurr(e.total)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{background:T.amberL}}>
              <td style={{padding:"6px 10px",fontWeight:800}}>GRAND TOTAL</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.svc,0))}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.grn}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.sal,0))}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:800,color:T.amber}}>{fmtCurr(execTotals.reduce((s,e)=>s+e.total,0))}</td>
            </tr></tfoot>
          </table>
        </Card>
      )}
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

  // Pre-assign each report to exactly one counter (most specific match)
  const assignReport = (r, counters) => {
    let m = counters.find(c => r.counterId && r.counterId===c.id);
    if (!m && r.counterName) { const rn=r.counterName.trim().toUpperCase(); m=counters.find(c=>c.name.trim().toUpperCase()===rn); }
    if (!m && r.supervisorId) { const sc=counters.filter(c=>c.supervisorId===r.supervisorId); if(sc.length===1) m=sc[0]; }
    return m?.id;
  };
  const reportAssign = {};
  reports.forEach(r => { const cid=assignReport(r,state.counters); if(cid) reportAssign[r.id]=cid; });
  const todayAssign = {};
  todayReports.forEach(r => { const cid=assignReport(r,state.counters); if(cid) todayAssign[r.id]=cid; });

  const counterStats = state.counters.map(c => {
    const sup = state.users.find(u=>u.id===c.supervisorId);
    const reps = reports.filter(r => reportAssign[r.id]===c.id);
    const allE = reps.flatMap(r => mdGetEntries(r));
    const svcTotal  = allE.filter(e=>!mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const salTotal  = allE.filter(e=>mdIsSales(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const bardahl   = allE.filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
    const otherSal  = allE.filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
    const total     = svcTotal + salTotal;
    const vehicles  = allE.filter(e=>!mdIsSales(e)).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
    const days      = new Set(reps.map(r=>r.date)).size;
    // Match today reports specifically by counterId or counterName
    // Don't use supervisorId alone - it would double-count multi-counter executives
    const todayReps = todayReports.filter(r => todayAssign[r.id]===c.id);
    const todayAmt  = todayReps.reduce((s,r)=>s+r.totalAmount,0);
    const todayRep  = todayReps[0]; // for backward compat check
    return { ...c, total, svcTotal, salTotal, bardahl, otherSal, vehicles, days, sup, todayRep, dailyAvg:days?Math.round(total/days):0, todayAmt };
  });

  const maxTotal = Math.max(...counterStats.map(c=>c.total),1);

  // Month-over-month growth
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthD = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth()+1).padStart(2,"0")}`;
  const thisMonthRev = state.serviceReports.filter(r=>r.date.startsWith(thisMonth)).reduce((s,r)=>s+r.totalAmount,0);
  const lastMonthRev = state.serviceReports.filter(r=>r.date.startsWith(lastMonth)).reduce((s,r)=>s+r.totalAmount,0);
  const growth = lastMonthRev > 0 ? Math.round((thisMonthRev-lastMonthRev) * 100 / lastMonthRev) : 0;

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
              {d.rev>0 && <div style={{ fontSize:9, color:T.txt3 }}>₹{Math.floor(d.rev * 0.001)}k</div>}
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
          <Card key={c.id} style={{ borderTop:"3px solid "+(c.todayAmt>0||c.todayRep?T.grn:c.total>0?T.amber:T.bdr), padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, color:T.txt2 }}>{c.sup?.name}{c.sup?" ("+ROLE_LABELS[c.sup.role]+")":""}</div>
              </div>
              <Badge color={c.todayAmt>0||c.todayRep?T.grn:T.red}>{c.todayAmt>0||c.todayRep?"✓ Reported":"⏳ Pending"}</Badge>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:T.amber, marginBottom:6 }}>{fmtCurr(c.total)}</div>
            <div style={{ height:5, background:T.surf, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:Math.round(c.total*100/(maxTotal+0.001))+"%", background:T.amber, borderRadius:3 }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, fontSize:11, color:T.txt2 }}>
              {c.name==="OFFICE" ? (<>
                <div><div style={{ fontWeight:700, color:"#15803D", fontSize:12 }}>{fmtCurr(c.bardahl||0)}</div>Bardahl</div>
                <div><div style={{ fontWeight:700, color:"#0369A1", fontSize:12 }}>{fmtCurr(c.otherSal||0)}</div>Other Sales</div>
                <div><div style={{ fontWeight:700, color:T.txt2, fontSize:12 }}>{c.days}d</div>Days</div>
              </>) : (<>
                <div><div style={{ fontWeight:700, color:T.navy, fontSize:12 }}>{c.vehicles}</div>Vehicles</div>
                <div><div style={{ fontWeight:700, color:T.grn, fontSize:12 }}>{fmtCurr(c.salTotal||0)}</div>Sales</div>
                <div><div style={{ fontWeight:700, color:T.txt2, fontSize:12 }}>{c.days}d</div>Days</div>
              </>)}
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
              const g = i>0&&months[i-1].rev>0 ? Math.round((m.rev-months[i-1].rev) * 100 / months[i-1].rev) : null;
              return <div key={m.key} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:12 }}>{m.label}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <b style={{ fontSize:12 }}>{fmtCurr(m.rev)}</b>
                    {g!==null && <span style={{ fontSize:10, fontWeight:700, color:g>=0?T.grn:T.red }}>{g>=0?"+":""}{g}%</span>}
                  </div>
                </div>
                <div style={{ height:7, background:T.surf, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:Math.round(m.rev*100/(maxR+0.001))+"%", background:m.key===thisMonth?T.amber:T.navy, borderRadius:3 }}/>
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
          months.map(([m,rev])=>{
            const barW = maxM > 0 ? Math.round(rev * 100 / (maxM + 0.001)) : 0;
            return (
            <div key={m} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{fontSize:13}}>{m}</span>
                <b style={{fontSize:13,color:T.navy}}>{fmtCurr(rev)}</b>
              </div>
              <div style={{ height:10, background:T.surf, borderRadius:5, overflow:"hidden" }}>
                <div style={{ height:"100%", width:barW + "%", background:T.navy, borderRadius:5 }}/>
              </div>
            </div>
            );
          })
        }
      </Card>
      <Card>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Revenue Split by Work Type</div>
        {wtArr.map(([name,rev])=>{
          const pctWt = totalWt > 0 ? Math.round(rev * 100 / (totalWt + 0.001)) : 0;
          return (
          <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid " + T.bdr }}>
            <span style={{fontSize:13}}>{name}</span>
            <div style={{textAlign:"right"}}>
              <b style={{fontSize:13}}>{fmtCurr(rev)}</b>
              <span style={{fontSize:11,color:T.txt2,marginLeft:8}}>{pctWt}%</span>
            </div>
          </div>
          );
        })}
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
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"enter",        icon:"✏️",  label:"Enter Report" },
    { id:"sales",        icon:"🛒",  label:"Sales Entry" },
    { id:"collection",   icon:"📊",  label:"Collection Report" },
    { id:"attendance",   icon:"👥",  label:"Mark Attendance" },
    { id:"reports",      icon:"📋",  label:"View Reports" },
    { id:"viewatt",      icon:"📅",  label:"All Attendance" },
    { id:"execreport",   icon:"📄",  label:"Executive Report" },
    { id:"export",       icon:"📥",  label:"Export Data" },
    { id:"directory",    icon:"👤",  label:"Staff Directory" },
  ];

  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="enter"        && <OfficeEnterReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="sales"        && <OfficeSalesEntry user={user} state={state} setState={setState} toast={toast}/>}
      {page==="collection"   && <OfficeCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="attendance"   && <OfficeCombinedAttendance user={user} state={state} setState={setState} toast={toast}/>}
      {page==="reports"      && <OfficeReports state={state}/>}
      {page==="viewatt"      && <OfficeAttendanceView state={state}/>}
      {page==="execreport"   && <ExecutiveReportGenerator state={state}/>}
      {page==="export"       && <OfficeExport state={state} toast={toast}/>}
      {page==="directory"    && <StaffDirectory state={state}/>}
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
  // Merge DB work types with defaults so all work types always available
  const allWTs = [...state.workTypes];
  INITIAL_STATE.workTypes.forEach(iwt => { if(!allWTs.find(w=>w.id===iwt.id||w.name===iwt.name)) allWTs.push(iwt); });
  const serviceWTs = allWTs.filter(w => w.category !== "sales");
  const salesWTs   = allWTs.filter(w => w.category === "sales");

  const blankServiceRows = () => [
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
    { workTypeId:"", workTypeName:"", vehicles:0, rate:0, amount:0, type:"service" },
  ];
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
      setReportCounters(myCtrs.length ? myCtrs.map(c => ({ counterName:c.name, entries:blankServiceRows() })) : [{ counterName:"", entries:blankServiceRows() }]);
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
    // Submit ONE report per counter (matching SupReport architecture)
    const newReports = reportCounters
      .filter(c => c.counterName)
      .map(c => {
        const counter = state.counters.find(x=>x.name===c.counterName)||{id:"c_"+c.counterName,name:c.counterName};
        const allEntries = (c.entries||[]).filter(e=>e.workTypeName&&(e.vehicles>0||e.amount>0));
        const total = allEntries.reduce((s,e)=>s+(Number(e.amount)||0),0);
        return {
          id: "sr_" + selSupervisor + "_" + counter.id + "_" + date,
          date, supervisorId:selSupervisor,
          counterId: counter.id,
          counterName: counter.name,
          submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
          entries: allEntries,
          counters: [{ counterName:counter.name, entries:allEntries }],
          totalAmount: total, notes, status:"submitted",
          submittedBy: user.id, // track office staff submission
        };
      });
    if (!newReports.length) { toast.show("Add at least one counter","error"); return; }
    const newIds = newReports.map(r=>r.id);
    setState(p=>({ ...p, serviceReports:[...p.serviceReports.filter(r=>!newIds.includes(r.id)), ...newReports] }));
    newReports.forEach(r => DB.upsertReport(r).catch(e => console.error("Report save:", e)));
    toast.show("Report submitted for " + newReports.length + " counter(s) ✅");
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>Enter Counter Report</div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:T.txt2, marginBottom:5, textTransform:"uppercase" }}>Executive · Counter</label>
            <select value={selSupervisor} onChange={e=>setSelSupervisor(e.target.value)}
              style={{ width:"100%", padding:"9px 13px", border:`1px solid ${T.bdrS}`, borderRadius:8, fontSize:14, fontFamily:"inherit", outline:"none" }}>
              <option value="">Select executive...</option>
              {executives.map(u=><option key={u.id} value={u.id}>{u.name} — {u.counter}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <datalist id="off-wt-list">
        {serviceWTs.map(wt=><option key={wt.id} value={wt.name}/>)}
      </datalist>
      {reportCounters.map((counter, ci) => (
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
                      <input list="off-wt-list" value={e.workTypeName||""} placeholder="Type work type..."
                        onChange={ev=>{
                          const val=ev.target.value;
                          const wt=allWTs.find(w=>w.name===val);
                          if(wt){
                            setReportCounters(p=>p.map((c2,ci2)=>ci2!==ci?c2:{...c2,entries:c2.entries.map((row,ri)=>ri!==ei?row:{...row,workTypeId:wt.id,workTypeName:wt.name,rate:wt.defaultRate,amount:(row.vehicles||0)*wt.defaultRate})}));
                          } else {
                            updateEntry(ci,ei,"workTypeName",val);
                          }
                        }}
                        style={{ width:"100%",padding:"4px 6px",border:"1px solid "+(e.workTypeName?T.navy:T.bdrS),borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none",background:e.workTypeName?"#EFF6FF":"#fff" }}/>
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
              <tbody>
                <tr>
                  <td colSpan={4} style={{ padding:"4px 8px", border:`1px solid ${T.bdr}` }}>
                    <button onClick={()=>setReportCounters(p=>p.map((c2,ci2)=>ci2!==ci?c2:{...c2,entries:[...c2.entries,{workTypeId:"",workTypeName:"",vehicles:0,rate:0,amount:0,type:"service"}]}))}
                      style={{ background:"none", border:"none", color:T.navy, cursor:"pointer", fontSize:12, fontWeight:700, padding:"2px 4px", fontFamily:"inherit" }}>+ Add Row</button>
                  </td>
                </tr>
              </tbody>
              <tfoot><tr style={{ background:T.navyXL }}>
                <td colSpan={3} style={{ border:`1px solid ${T.bdr}`,padding:"6px 10px",fontWeight:800,textAlign:"right",color:T.navy }}>SERVICE TOTAL</td>
                <td style={{ border:`1px solid ${T.bdr}`,padding:"6px 12px",fontWeight:800,color:T.navy,textAlign:"right" }}>{counterServiceTotal(counter).toLocaleString("en-IN")}</td>
              </tr></tfoot>
            </table>
          </div>
        </Card>
      ))}

      {selSupervisor && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <Btn onClick={()=>setReportCounters(p=>[...p,{counterName:"",entries:blankServiceRows()}])} variant="outline">+ Add Counter</Btn>
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


// ─── Office: Collection Report (same as executive/manager) ────────────────────
function OfficeCollectionReport({ user, state, setState, toast }) {
  const dr = useDateRange("today");
  const date = dr.from;
  const [selCounter, setSelCounter] = useState("all");
  const existing = state.collectionReports?.find(r=>r.date===date);
  const save = (bankEntries, expenses) => {
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    DB.upsertCollectionReport(rep).catch(e => console.error("Collection save:", e));
    toast.show("Collection report saved ✅");
  };
  const filteredReports = state.serviceReports.filter(r => {
    if(r.date<dr.from||r.date>dr.to) return false;
    if(selCounter!=="all"&&r.counterId!==selCounter&&r.counterName!==state.counters.find(c=>c.id===selCounter)?.name) return false;
    return true;
  });
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Collection Report</div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:8}}>
        <div style={{flex:1}}><DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/></div>
        <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
          style={{padding:"6px 12px",border:`1px solid ${T.bdrS}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
          <option value="all">All Counters</option>
          {state.counters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <CollectionReportView date={date} report={existing} counters={state.counters} allReports={filteredReports} attendance={state.attendance} users={state.users} onSave={save}/>
    </div>
  );
}

// ─── Office: Mark Attendance for any executive/counter ────────────────────────
function OfficeMarkAttendance({ user, state, setState, toast }) {
  const [selExec, setSelExec] = useState("");
  const [displayDate, setDisplayDate] = useState(today());
  const recordsRef = useRef({});
  const reasonsRef = useRef({});
  const [formTick, setFormTick] = useState(0);
  const [dirty, setDirty] = useState(false);
  const initialLoad = useRef(false);

  const executives = state.users.filter(u=>u.role==="supervisor"&&u.active!==false);

  const allToMark = selExec ? [
    state.users.find(u=>u.id===selExec),
    ...state.users.filter(u=>u.role==="field_staff"&&u.active&&
      state.attendance.some(a=>a.supervisorId===selExec&&a.staffId===u.id) ||
      state.users.find(u2=>u2.id===selExec)?.managerId===u.managerId
    )
  ].filter(Boolean) : [];

  // Actually get staff under this executive
  const getStaffForExec = (execId) => {
    const exec = state.users.find(u=>u.id===execId);
    if(!exec) return [];
    return [exec, ...state.users.filter(u=>u.role==="field_staff"&&u.active!==false&&u.managerId===execId)];
  };

  const staffList = selExec ? getStaffForExec(selExec) : [];

  const loadDate = (date, execId) => {
    const eid = execId||selExec;
    const r={}, rs={};
    state.attendance.filter(a=>a.supervisorId===eid&&a.date===date).forEach(a=>{
      r[a.staffId]=a.status; rs[a.staffId]=a.reason||"";
    });
    recordsRef.current=r; reasonsRef.current=rs;
    setDisplayDate(date); setFormTick(t=>t+1); setDirty(false);
  };

  const setStatus = (staffId, status) => {
    recordsRef.current={...recordsRef.current,[staffId]:status};
    setFormTick(t=>t+1); setDirty(true);
  };

  const save = () => {
    if(!selExec){toast.show("Select an executive first","error");return;}
    const newAtts = staffList.map(s=>({
      id:`att_${selExec}_${s.id}_${displayDate}`,
      date:displayDate, supervisorId:selExec, staffId:s.id,
      status:recordsRef.current[s.id]||"present",
      reason:reasonsRef.current[s.id]||"",
      markedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
    }));
    setState(p=>({...p,attendance:[...p.attendance.filter(a=>!(a.supervisorId===selExec&&a.date===displayDate)),...newAtts]}));
    DB.upsertAttendance(newAtts).catch(e => console.error("Attendance save:", e));
    setDirty(false);
    toast.show("Attendance saved ✅");
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Mark Attendance</div>
      <Card style={{maxWidth:720}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Executive · Counter</label>
            <select value={selExec} onChange={e=>{setSelExec(e.target.value);loadDate(displayDate,e.target.value);}}
              style={{width:"100%",padding:"8px 12px",border:`1px solid ${T.bdrS}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="">Select executive...</option>
              {executives.map(u=><option key={u.id} value={u.id}>{u.name} — {u.counter||state.counters.find(c=>c.supervisorId===u.id)?.name||""}</option>)}
            </select>
          </div>
          <Input label="Date" type="date" value={displayDate} onChange={d=>loadDate(d,selExec)}/>
        </div>
        {selExec && staffList.length>0 && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 250px 1fr",gap:8,padding:"6px 0",borderBottom:`1px solid ${T.bdr}`,marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Staff</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Status</div>
              <div style={{fontSize:11,fontWeight:800,color:T.txt2,textTransform:"uppercase"}}>Reason</div>
            </div>
            {staffList.map(s=>{
              const st=recordsRef.current[s.id];
              const isExec=s.id===selExec;
              return (
                <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 250px 1fr",gap:8,alignItems:"center",marginBottom:10,
                  background:isExec?T.navyXL:"transparent",padding:"4px 8px",borderRadius:6}}>
                  <div style={{fontSize:14,fontWeight:700}}>{s.name}{isExec&&<Badge color={T.navy} style={{marginLeft:6}}>Executive</Badge>}</div>
                  <div style={{display:"flex",gap:4}}>
                    {["present","absent","half_day"].map(status=>{
                      const active=st===status||(!st&&status==="present");
                      return <button key={status} onClick={()=>setStatus(s.id,status)} style={{
                        padding:"5px 8px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                        border:`1px solid ${active?(status==="present"?T.grn:status==="absent"?T.red:T.amber):T.bdrS}`,
                        background:active?(status==="present"?T.grnL:status==="absent"?T.redL:T.amberL):"transparent",
                        color:active?(status==="present"?T.grn:status==="absent"?T.red:T.amberD):T.txt2
                      }}>{status==="half_day"?"½":status==="absent"?"Absent":"Present"}</button>;
                    })}
                  </div>
                  <input key={`r_${s.id}_${formTick}`} defaultValue={reasonsRef.current[s.id]||""}
                    onChange={e=>{reasonsRef.current={...reasonsRef.current,[s.id]:e.target.value};setDirty(true);}}
                    placeholder={st==="absent"?"Reason required":"Optional"}
                    style={{padding:"6px 10px",border:`1px solid ${st==="absent"?T.red:T.bdrS}`,borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none",background:st==="absent"?T.redL:"#fff"}}/>
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <div style={{fontSize:12,color:T.txt2}}>{fmtDate(displayDate)}{dirty&&<span style={{color:T.amber,marginLeft:8}}>● Unsaved</span>}</div>
              <Btn onClick={save} variant={dirty?"amber":"primary"}>{dirty?"⚠️ Save Changes":"✅ Save Attendance"}</Btn>
            </div>
          </>
        )}
        {selExec && staffList.length===0 && <div style={{color:T.txt3,padding:16,textAlign:"center"}}>No staff found for this executive. Check counter assignments.</div>}
      </Card>
    </div>
  );
}

// ─── Executive Report Generator (daily summary like physical format) ──────────
function ExecutiveReportGenerator({ state }) {
  const [selDate, setSelDate] = useState(today());
  const [selExec, setSelExec] = useState("all");
  const [expanded, setExpanded] = useState({});

  const executives   = state.users.filter(u=>u.role==="supervisor"&&u.active!==false);
  // Service entries only — Bardahl/Other are COMPANY sales, not counter services
  const SALES_WTS    = new Set(["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"]);
  const isSvc        = e => !SALES_WTS.has(e.workTypeName) && e.type!=="sales";
  const getE         = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);

  const monthStart   = selDate.slice(0,7)+"-01";
  const monthEnd     = selDate.slice(0,7)+"-31";

  // Company-level sales (OFFICE counter only)
  const OFFICE_ID    = state.counters.find(c=>c.name==="OFFICE")?.id||"c1";
  const officeSalesDay   = state.serviceReports.filter(r=>r.date===selDate&&(r.counterId===OFFICE_ID||r.counterName==="OFFICE"));
  const officeSalesMo    = state.serviceReports.filter(r=>r.date>=monthStart&&r.date<=monthEnd&&(r.counterId===OFFICE_ID||r.counterName==="OFFICE"));
  const calcSales = (reps, wt) => reps.flatMap(r=>getE(r)).filter(e=>e.workTypeName===wt).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const dayBardahlCo  = calcSales(officeSalesDay,"BARDAHL");
  const dayOtherCo    = calcSales(officeSalesDay,"OTHER SALES");
  const moBardahlCo   = calcSales(officeSalesMo,"BARDAHL");
  const moOtherCo     = calcSales(officeSalesMo,"OTHER SALES");

  const buildSummary = (exec) => {
    const myCounters = state.counters.filter(c=>c.supervisorId===exec.id);
    // Only service reports for this exec's counters — exclude OFFICE counter
    const matchesExec = r =>
      r.counterId!==OFFICE_ID && r.counterName!=="OFFICE" && (
        myCounters.some(c=>c.id===r.counterId||c.name===r.counterName) ||
        r.supervisorId===exec.id
      );
    const dayReps   = state.serviceReports.filter(r=>r.date===selDate&&matchesExec(r));
    const monthReps = state.serviceReports.filter(r=>r.date>=monthStart&&r.date<=monthEnd&&matchesExec(r));
    const dayAtt    = state.attendance.filter(a=>a.date===selDate&&a.supervisorId===exec.id);

    // Per-counter service breakdown (service only, no sales)
    const counterRows = myCounters.map(c=>{
      const reps = dayReps.filter(r=>r.counterId===c.id||r.counterName===c.name||(myCounters.length===1&&r.supervisorId===exec.id&&!r.counterId&&!r.counterName));
      const allE = reps.flatMap(r=>getE(r)).filter(isSvc);
      return {
        name:     c.name,
        svc:      allE.reduce((s,e)=>s+(Number(e.amount)||0),0),
        vehicles: allE.reduce((s,e)=>s+(Number(e.vehicles)||0),0),
        reported: reps.length>0,
      };
    });

    // Day/month SERVICE totals (no sales)
    const daySvc  = dayReps.flatMap(r=>getE(r)).filter(isSvc).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const dayVeh  = dayReps.flatMap(r=>getE(r)).filter(isSvc).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
    const moSvc   = monthReps.flatMap(r=>getE(r)).filter(isSvc).reduce((s,e)=>s+(Number(e.amount)||0),0);

    // Absent/half-day staff
    const absentList = dayAtt.filter(a=>a.status==="absent").map(a=>state.users.find(u=>u.id===a.staffId)?.name).filter(Boolean);
    const halfList   = dayAtt.filter(a=>a.status==="half_day").map(a=>state.users.find(u=>u.id===a.staffId)?.name).filter(Boolean);

    return { exec, myCounters, counterRows, daySvc, dayVeh, moSvc, absentList, halfList, reported:dayReps.length>0 };
  };

  const visibleExecs = selExec==="all" ? executives : executives.filter(u=>u.id===selExec);
  const summaries    = visibleExecs.map(buildSummary).filter(s=>s.reported||selExec!=="all"||s.absentList.length>0);

  // Grand totals
  const gDaySvc  = summaries.reduce((s,x)=>s+x.daySvc,0);
  const gMoSvc   = summaries.reduce((s,x)=>s+x.moSvc,0);
  const gDayTotal = gDaySvc + dayBardahlCo + dayOtherCo;
  const gMoTotal  = gMoSvc  + moBardahlCo  + moOtherCo;

  const printReport = () => {
    const rows = summaries.map(s=>`
      <tr style="background:#f0f4ff">
        <td colspan="5" style="padding:8px 10px;font-weight:800;font-size:13px;border:1px solid #ccc">${s.exec.name} — ${s.myCounters.map(c=>c.name).join(", ")}
          ${s.absentList.length?`<span style="color:#dc2626;margin-left:8px;font-size:11px">Absent: ${s.absentList.join(", ")}</span>`:""}
          ${s.halfList.length?`<span style="color:#d97706;margin-left:8px;font-size:11px">Half Day: ${s.halfList.join(", ")}</span>`:""}
        </td>
      </tr>
      ${s.counterRows.map(c=>`<tr>
        <td style="padding:6px 10px;border:1px solid #ccc">${c.name}${!c.reported?` <span style="color:#dc2626;font-size:10px">(no report)</span>`:""}</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">${c.vehicles}</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">₹${c.svc.toLocaleString("en-IN")}</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">—</td>
        <td style="padding:6px 10px;text-align:right;font-weight:700;border:1px solid #ccc">₹${c.svc.toLocaleString("en-IN")}</td>
      </tr>`).join("")}
      <tr style="background:#fef9ec;font-weight:700">
        <td style="padding:6px 10px;border:1px solid #ccc;text-align:right">Subtotal</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">${s.dayVeh}</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">₹${s.daySvc.toLocaleString("en-IN")}</td>
        <td style="padding:6px 10px;text-align:right;border:1px solid #ccc">Mo Svc: ₹${s.moSvc.toLocaleString("en-IN")}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:800;border:1px solid #ccc">₹${s.daySvc.toLocaleString("en-IN")}</td>
      </tr>
    `).join("");

    const salesRow = (dayBardahlCo+dayOtherCo)>0 ? `
      <tr style="background:#f0fdf4">
        <td colspan="2" style="padding:8px 10px;font-weight:800;border:1px solid #ccc;color:#15803D">COMPANY SALES (Office)</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;border:1px solid #ccc;color:#15803D">Bardahl: ₹${dayBardahlCo.toLocaleString("en-IN")}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;border:1px solid #ccc;color:#0369A1">Other: ₹${dayOtherCo.toLocaleString("en-IN")}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:800;border:1px solid #ccc;color:#15803D">₹${(dayBardahlCo+dayOtherCo).toLocaleString("en-IN")}</td>
      </tr>
      <tr style="background:#fef9ec;font-size:11px">
        <td colspan="2" style="padding:4px 10px;border:1px solid #ccc;color:#666">Monthly Sales</td>
        <td style="padding:4px 10px;text-align:right;border:1px solid #ccc;color:#666">Bardahl: ₹${moBardahlCo.toLocaleString("en-IN")}</td>
        <td style="padding:4px 10px;text-align:right;border:1px solid #ccc;color:#666">Other: ₹${moOtherCo.toLocaleString("en-IN")}</td>
        <td style="padding:4px 10px;text-align:right;font-weight:700;border:1px solid #ccc">₹${(moBardahlCo+moOtherCo).toLocaleString("en-IN")}</td>
      </tr>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>MD Report ${selDate}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{color:#0f2b4a}table{width:100%;border-collapse:collapse}@media print{body{padding:8px}}</style>
    </head><body>
    <h2>Benaka Enterprises — MD Report</h2>
    <p style="color:#666">${selDate} · Generated ${new Date().toLocaleString("en-IN")}</p>
    <table>
      <thead><tr style="background:#0f2b4a;color:#fff">
        <th style="padding:7px 10px;text-align:left">Counter / Executive</th>
        <th style="padding:7px 10px;text-align:right">Vehicles</th>
        <th style="padding:7px 10px;text-align:right">Day Service</th>
        <th style="padding:7px 10px;text-align:right">Month Service</th>
        <th style="padding:7px 10px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${rows}${salesRow}</tbody>
      <tfoot>
        <tr style="background:#e8a020;color:#000;font-weight:800;font-size:14px">
          <td colspan="2" style="padding:8px 10px;border:1px solid #ccc">GRAND TOTAL</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc">₹${gDaySvc.toLocaleString("en-IN")} (Svc)</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc">Mo: ₹${gMoSvc.toLocaleString("en-IN")}</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc">₹${gDayTotal.toLocaleString("en-IN")}</td>
        </tr>
      </tfoot>
    </table>
    </body></html>`;
    const w = window.open("","_blank","width=900,height=700");
    w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>MD Report</div>
          <div style={{fontSize:12,color:T.txt2}}>Counter-wise service revenue · Company sales shown separately</div>
        </div>
        <Btn onClick={printReport} variant="amber">🖨 Print / PDF</Btn>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <Input label="Date" type="date" value={selDate} onChange={setSelDate} style={{maxWidth:180}}/>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Filter Executive</label>
          <select value={selExec} onChange={e=>setSelExec(e.target.value)}
            style={{padding:"8px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
            <option value="all">All Executives</option>
            {executives.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Grand summary bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
        <StatCard label="Today Service" value={fmtCurr(gDaySvc)} color={T.navy} icon="🔧"/>
        <StatCard label="Today Bardahl" value={fmtCurr(dayBardahlCo)} color="#15803D" icon="🛢"/>
        <StatCard label="Today Other Sales" value={fmtCurr(dayOtherCo)} color="#0369A1" icon="🛒"/>
        <StatCard label="Today Grand Total" value={fmtCurr(gDayTotal)} color={T.amber} icon="💰"/>
        <StatCard label="Month Service" value={fmtCurr(gMoSvc)} color={T.navy} icon="📅"/>
        <StatCard label="Month Total" value={fmtCurr(gMoTotal)} color={T.amber} icon="📊"/>
      </div>

      {summaries.length===0 && (
        <Card><div style={{textAlign:"center",padding:24,color:T.txt3}}>No data for {fmtDate(selDate)}</div></Card>
      )}

      {/* Per-executive cards */}
      {summaries.map(s=>(
        <Card key={s.exec.id} style={{marginBottom:12,borderTop:"3px solid "+T.navy}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:10,cursor:"pointer"}}
               onClick={()=>setExpanded(p=>({...p,[s.exec.id]:!p[s.exec.id]}))}>
            <div>
              <div style={{fontSize:15,fontWeight:800}}>{s.exec.name}</div>
              <div style={{fontSize:12,color:T.txt2}}>{s.myCounters.map(c=>c.name).join(" · ")}</div>
              {s.absentList.length>0 && <div style={{fontSize:12,color:T.red,marginTop:3}}>❌ Absent: {s.absentList.join(", ")}</div>}
              {s.halfList.length>0   && <div style={{fontSize:12,color:T.amber,marginTop:2}}>⚡ Half Day: {s.halfList.join(", ")}</div>}
              {s.absentList.length===0&&s.halfList.length===0&&s.reported&&<div style={{fontSize:12,color:T.grn,marginTop:2}}>✅ All present</div>}
              {!s.reported && <div style={{fontSize:12,color:T.red,marginTop:2}}>⚠ No report submitted</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:T.txt2}}>Today Service</div>
              <div style={{fontSize:20,fontWeight:800,color:T.navy}}>{fmtCurr(s.daySvc)}</div>
              <div style={{fontSize:11,color:T.txt2,marginTop:2}}>Month: {fmtCurr(s.moSvc)}</div>
              <div style={{fontSize:10,color:T.txt3,marginTop:2}}>{expanded[s.exec.id]?"▲ collapse":"▼ expand"}</div>
            </div>
          </div>

          {/* Counter breakdown */}
          {expanded[s.exec.id] && (
            <div style={{borderTop:"1px solid "+T.bdr,paddingTop:10}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:T.navyXL}}>
                  {["Counter","Vehicles","Day Service","Month Service"].map(h=>(
                    <th key={h} style={{padding:"5px 10px",textAlign:h==="Counter"?"left":"right",fontSize:11,fontWeight:700,color:T.navy}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {s.counterRows.map(c=>(
                    <tr key={c.name} style={{borderBottom:"1px solid "+T.bdr,background:c.reported?"#fff":T.redL}}>
                      <td style={{padding:"6px 10px",fontWeight:600}}>
                        {c.name}{!c.reported&&<span style={{fontSize:10,color:T.red,marginLeft:6}}>no report</span>}
                      </td>
                      <td style={{padding:"6px 10px",textAlign:"right"}}>{c.vehicles}</td>
                      <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:T.navy}}>{fmtCurr(c.svc)}</td>
                      <td style={{padding:"6px 10px",textAlign:"right",color:T.txt2}}>—</td>
                    </tr>
                  ))}
                  <tr style={{background:T.amberL,fontWeight:800}}>
                    <td style={{padding:"6px 10px"}}>Subtotal</td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>{s.dayVeh}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",color:T.amber}}>{fmtCurr(s.daySvc)}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",color:T.grn}}>Mo: {fmtCurr(s.moSvc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}

      {/* Company Sales — separate section at bottom */}
      {(dayBardahlCo+dayOtherCo)>0 && (
        <Card style={{borderTop:"3px solid #15803D",marginTop:8}}>
          <div style={{fontSize:14,fontWeight:800,color:"#15803D",marginBottom:12}}>🛢 Company Sales (Office)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:12}}>
            <div style={{background:"#F0FDF4",borderRadius:8,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:"#15803D",textTransform:"uppercase",fontWeight:700}}>Today Bardahl</div>
              <div style={{fontSize:20,fontWeight:800,color:"#15803D"}}>{fmtCurr(dayBardahlCo)}</div>
              <div style={{fontSize:11,color:T.txt2}}>Month: {fmtCurr(moBardahlCo)}</div>
            </div>
            <div style={{background:"#EFF6FF",borderRadius:8,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:"#0369A1",textTransform:"uppercase",fontWeight:700}}>Today Other Sales</div>
              <div style={{fontSize:20,fontWeight:800,color:"#0369A1"}}>{fmtCurr(dayOtherCo)}</div>
              <div style={{fontSize:11,color:T.txt2}}>Month: {fmtCurr(moOtherCo)}</div>
            </div>
            <div style={{background:T.amberL,borderRadius:8,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:T.amberD,textTransform:"uppercase",fontWeight:700}}>Today Sales Total</div>
              <div style={{fontSize:20,fontWeight:800,color:T.amber}}>{fmtCurr(dayBardahlCo+dayOtherCo)}</div>
              <div style={{fontSize:11,color:T.txt2}}>Month: {fmtCurr(moBardahlCo+moOtherCo)}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Grand Total — Services + Sales combined */}
      {(gDaySvc+dayBardahlCo+dayOtherCo)>0 && (
        <div style={{background:T.navy,borderRadius:12,padding:"16px 20px",marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>Today Service</div>
            <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{fmtCurr(gDaySvc)}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>Today Sales</div>
            <div style={{fontSize:20,fontWeight:800,color:"#4ade80"}}>{fmtCurr(dayBardahlCo+dayOtherCo)}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>Today Grand Total</div>
            <div style={{fontSize:24,fontWeight:800,color:"#fbbf24"}}>{fmtCurr(gDayTotal)}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>Month Grand Total</div>
            <div style={{fontSize:20,fontWeight:800,color:"#fbbf24"}}>{fmtCurr(gMoTotal)}</div>
          </div>
        </div>
      )}
    </div>
  );
}


function FieldStaffPortal({ user, state, setState, logout, toast }) {
  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:T.navy,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{user.name}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>Field Staff · {user.empId}</div>
        </div>
        <button onClick={logout} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:13}}>Sign Out</button>
      </div>
      <div style={{padding:20}}>
        <PlannedLeavePortal user={user} state={state} setState={setState} toast={toast} mode="staff"/>
      </div>
    </div>
  );
}

// ─── IT Admin Portal ────────────────────────────────────────────────────────────
function ITAdminPortal({ user, state, setState, toast, syncStatus="" }) {
  const [page, setPage] = useState("users");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = p => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"users",    icon:"👥", label:"User Management" },
    { id:"counters", icon:"🏪", label:"Counters" },
    { id:"worktypes",icon:"🔧", label:"Work Types" },
    { id:"reports",  icon:"📋", label:"All Reports" },
    { id:"data",     icon:"🗑️", label:"Data Management" },
    { id:"export",   icon:"📥", label:"Export" },
    { id:"debug",    icon:"🔍", label:"Debug Reports" },
  ];
  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems}
      onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="users"     && <UserMgmt     user={user} state={state} setState={setState} toast={toast}/>}
      {page==="counters"  && <CounterMgmt  user={user} state={state} setState={setState} toast={toast}/>}
      {page==="worktypes" && <WorkTypeMgmt user={user} state={state} setState={setState} toast={toast}/>}
      {page==="reports"   && <AllReports   state={state}/>}
      {page==="data"      && <DataMgmt     user={user} state={state} setState={setState} toast={toast}/>}
      {page==="export"    && <OfficeExport state={state} toast={toast}/>}
      {page==="debug"     && <DebugReports state={state}/>}
      {page==="debug"     && <DebugReports state={state}/>}
    </Shell>
  );
}

// ─── IT Admin: User Management ─────────────────────────────────────────────────
function UserMgmt({ user, state, setState, toast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({});
  const [newPwd, setNewPwd]   = useState("");
  const openEdit = u => { setEditing(u); setForm({...u}); setNewPwd(""); };
  const openNew  = ()  => { setEditing({}); setForm({ role:"field_staff", active:true }); setNewPwd(""); };

  const save = () => {
    if (!form.empId||!form.name) { toast.show("ID and Name required","error"); return; }
    if (editing?.id) {
      const updated = state.users.map(u=>u.id===editing.id?{...u,...form}:u);
      const pwds    = newPwd ? {...state.passwords,[form.empId]:newPwd} : state.passwords;
      DB.upsertUsers(updated).catch(console.error);
      DB.upsertPasswords(pwds).catch(console.error);
      setState(p=>({...p,users:updated,passwords:pwds,_configVersion:(p._configVersion||0)+1}));
      toast.show("User updated — synced ✅");
    } else {
      if (state.users.find(u=>u.empId===form.empId)) { toast.show("ID exists","error"); return; }
      const nu = { id:"u_"+Date.now(), ...form, dob:form.dob||"", joining:form.joining||"", weddingAnniversary:"", active:true };
      const newUsers = [...state.users, nu];
      const newPwds  = {...state.passwords,[form.empId]:newPwd||"pass@123"};
      DB.upsertUsers(newUsers).catch(console.error);
      DB.upsertPasswords(newPwds).catch(console.error);
      setState(p=>({...p,users:newUsers,passwords:newPwds,_configVersion:(p._configVersion||0)+1}));
      toast.show("User created · pwd: "+(newPwd||"pass@123")+" ✅");
    }
    setEditing(null);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:18,fontWeight:800}}>User Management</div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>{ if(confirm("Reset to default staff list?")){ setState(p=>({...p,users:INITIAL_STATE.users,passwords:INITIAL_STATE.passwords,_configVersion:0})); toast.show("Reset done"); }}} variant="ghost" size="sm">↺ Reset</Btn>
          <Btn onClick={openNew} variant="amber">+ Add User</Btn>
        </div>
      </div>
      {editing!==null && (
        <Card style={{marginBottom:20,borderTop:"3px solid "+T.amber}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editing?.id?"Edit User":"New User"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
            {[["empId","Employee ID"],["name","Full Name"],["phone","Phone"]].map(([k,l])=>(
              <div key={k}><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{l}</label>
              <input value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
            ))}
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Role</label>
            <select value={form.role||"field_staff"} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              {Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select></div>
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Reports To</label>
            <select value={form.managerId||""} onChange={e=>setForm(p=>({...p,managerId:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="">None</option>
              {state.users.filter(u=>["md","manager","supervisor"].includes(u.role)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select></div>
            {[["dob","Date of Birth","date"],["joining","Joining Date","date"]].map(([k,l,t])=>(
              <div key={k}><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{l}</label>
              <input type={t} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
            ))}
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>New Password</label>
            <input value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder={editing?.id?"Leave blank to keep":"Required"}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={save} variant="amber">Save</Btn>
            <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      <Table cols={[
        {key:"empId",label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.empId}</span>},
        {key:"name",label:"Name",render:r=><b>{r.name}</b>},
        {key:"role",label:"Role",render:r=><Badge color={ROLE_COLORS[r.role]||T.navy}>{ROLE_LABELS[r.role]||r.role}</Badge>},
        {key:"mgr",label:"Reports To",render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"dob",label:"D.O.B",render:r=>r.dob?r.dob.split("-").reverse().join("/"):"—"},
        {key:"joining",label:"Joining",render:r=>r.joining?r.joining.split("-").reverse().join("/"):"—"},
        {key:"status",label:"Status",render:r=><Badge color={r.active!==false?T.grn:T.red}>{r.active!==false?"Active":"Inactive"}</Badge>},
        {key:"actions",label:"",render:r=><div style={{display:"flex",gap:4}}>
          <Btn onClick={()=>openEdit(r)} size="sm" variant="outline">Edit</Btn>
          <Btn onClick={()=>{ setState(p=>({...p,users:p.users.map(u=>u.id===r.id?{...u,active:!u.active}:u)})); }} size="sm" variant="ghost">{r.active!==false?"Deactivate":"Activate"}</Btn>
        </div>},
      ]} rows={state.users}/>
    </div>
  );
}

// ─── IT Admin: Counter Management ─────────────────────────────────────────────
function CounterMgmt({ user, state, setState, toast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const open = c => { setEditing(c); setForm(c?{...c}:{name:"",supervisorId:"",dealership:"",city:""}); };
  const save = () => {
    if (!form.name) { toast.show("Name required","error"); return; }
    let newCounters;
    if (editing?.id) {
      newCounters = state.counters.map(c=>c.id===editing.id?{...c,...form}:c);
    } else {
      newCounters = [...state.counters,{id:"c_"+Date.now(),...form}];
    }
    DB.upsertCounters(newCounters).catch(console.error);
    setState(p=>({...p,counters:newCounters,_configVersion:(p._configVersion||0)+1}));
    toast.show("Counter saved ✅"); setEditing(null);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:800}}>Counters</div>
        <Btn onClick={()=>open(null)} variant="amber">+ Add Counter</Btn>
      </div>
      {editing!==null && (
        <Card style={{marginBottom:20,borderTop:"3px solid "+T.amber}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
            {[["name","Counter Name"],["dealership","Dealership"],["city","City"]].map(([k,l])=>(
              <div key={k}><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{l}</label>
              <input value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
            ))}
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Assigned Executive</label>
            <select value={form.supervisorId||""} onChange={e=>setForm(p=>({...p,supervisorId:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="">None</option>
              {state.users.filter(u=>u.role==="supervisor").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select></div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={save} variant="amber">Save</Btn>
            <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {state.counters.map(c=>{
          const sup=state.users.find(u=>u.id===c.supervisorId);
          return (
            <Card key={c.id}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:6}}>{c.name}</div>
              {c.dealership&&<div style={{fontSize:12,color:T.txt2,marginBottom:4}}>{c.dealership}{c.city?" · "+c.city:""}</div>}
              <div style={{fontSize:13,marginBottom:10}}>👤 {sup?.name||"Unassigned"}</div>
              <div style={{display:"flex",gap:6}}>
                <Btn onClick={()=>open(c)} size="sm" variant="outline">Edit</Btn>
                <Btn onClick={()=>{ if(confirm("Delete counter "+c.name+"? This cannot be undone.")){
                  const newCounters=state.counters.filter(x=>x.id!==c.id);
                  supabase.from("app_counters").delete().eq("id",c.id).catch(console.error);
                  setState(p=>({...p,counters:newCounters,_configVersion:(p._configVersion||0)+1}));
                  toast.show(c.name+" deleted ✅");
                }}} size="sm" variant="danger">Delete</Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── IT Admin: Work Type Management ───────────────────────────────────────────
function WorkTypeMgmt({ user, state, setState, toast }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [editCat, setEditCat] = useState("service");
  const open = w => { setEditing(w||null); setName(w?.name||""); setRate(w?.defaultRate||""); setEditCat(w?.category||"service"); };
  const save = () => {
    if (!name) { toast.show("Name required","error"); return; }
    let newWts;
    if (editing?.id) {
      newWts = state.workTypes.map(w=>w.id===editing.id?{...w,name,defaultRate:Number(rate),category:editCat}:w);
    } else {
      newWts = [...state.workTypes,{id:"wt_"+Date.now(),name,defaultRate:Number(rate),category:editCat||"service"}];
    }
    DB.upsertWorkTypes(newWts).catch(console.error);
    setState(p=>({...p,workTypes:newWts,_configVersion:(p._configVersion||0)+1}));
    toast.show("Work type saved ✅"); setEditing(null); setName(""); setRate("");
  };
  const svc  = state.workTypes.filter(w=>w.category!=="sales");
  const sales = state.workTypes.filter(w=>w.category==="sales");
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:800}}>Work Types & Rates</div>
        <Btn onClick={()=>open(null)} variant="amber">+ Add</Btn>
      </div>
      {editing!==null && (
        <Card style={{marginBottom:20,borderTop:"3px solid "+T.amber}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:12}}>
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Name</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Default Rate (₹)</label>
            <input type="number" value={rate} onChange={e=>setRate(e.target.value)}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/></div>
            <div><label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Category</label>
            <select value={editCat} onChange={e=>setEditCat(e.target.value)}
              style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="service">Service</option>
              <option value="sales">Sales</option>
            </select></div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={save} variant="amber">Save</Btn>
            <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      {[["Service Work Types",svc,T.navy],["Sales Products",sales,T.grn]].map(([title,list,color])=>(
        <div key={title} style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:800,color,textTransform:"uppercase",marginBottom:10}}>{title}</div>
          <Table cols={[
            {key:"name",label:"Name",render:r=><b>{r.name}</b>},
            {key:"defaultRate",label:"Default Rate",render:r=>r.defaultRate?fmtCurr(r.defaultRate):"—"},
            {key:"category",label:"Category",render:r=><Badge color={r.category==="sales"?T.grn:T.navy}>{r.category}</Badge>},
            {key:"act",label:"",render:r=><Btn onClick={()=>open(r)} size="sm" variant="outline">Edit</Btn>},
          ]} rows={list}/>
        </div>
      ))}
    </div>
  );
}

// ─── IT Admin: Data Management ─────────────────────────────────────────────────
function DataMgmt({ user, state, setState, toast }) {
  const [confirm_, setConfirm] = useState("");

  const del = async (type) => {
    if (confirm_ !== "DELETE") { toast.show("Type DELETE to confirm","error"); return; }
    const clearTable = async (table) => {
      try { await DB.deleteTable(table); } catch(e) { console.warn("DB clear:", e); }
    };
    toast.show("Clearing from database...");
    if (type==="reports")    { await clearTable("service_reports"); setState(p=>({...p,serviceReports:[]})); }
    if (type==="attendance") { await clearTable("attendance");      setState(p=>({...p,attendance:[]})); }
    if (type==="both")       { await Promise.all([clearTable("service_reports"),clearTable("attendance")]); setState(p=>({...p,serviceReports:[],attendance:[]})); }
    toast.show("Cleared from database ✅"); setConfirm("");
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:20}}>Data Management</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:20}}>
        <Card style={{textAlign:"center",padding:14}}>
          <div style={{fontSize:22,fontWeight:800,color:T.navy}}>{state.serviceReports?.length||0}</div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Service Reports</div>
        </Card>
        <Card style={{textAlign:"center",padding:14}}>
          <div style={{fontSize:22,fontWeight:800,color:T.navy}}>{state.attendance?.length||0}</div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Attendance Records</div>
        </Card>
      </div>
      <Card style={{marginBottom:16,background:T.redL,border:"1px solid "+T.red}}>
        <div style={{fontSize:13,fontWeight:700,color:T.red,marginBottom:8}}>⚠️ Type DELETE to enable buttons</div>
        <input value={confirm_} onChange={e=>setConfirm(e.target.value)} placeholder="DELETE"
          style={{padding:"10px 14px",border:"2px solid "+(confirm_==="DELETE"?T.red:T.bdrS),borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%",background:"#fff",boxSizing:"border-box"}}/>
        {confirm_==="DELETE"&&<div style={{color:T.red,fontSize:12,marginTop:6}}>✓ Ready to clear</div>}
      </Card>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <Btn onClick={()=>del("reports")}    variant="danger" style={{opacity:confirm_==="DELETE"?1:.4}}>🗑 Clear Reports</Btn>
        <Btn onClick={()=>del("attendance")} variant="danger" style={{opacity:confirm_==="DELETE"?1:.4}}>🗑 Clear Attendance</Btn>
        <Btn onClick={()=>del("both")}       variant="danger" style={{opacity:confirm_==="DELETE"?1:.4,background:"#7f1d1d",color:"#fff"}}>☢️ Clear Both</Btn>
      </div>
      <div style={{fontSize:12,color:T.txt2,marginTop:12}}>Deletes permanently from database — will not return on refresh.</div>
    </div>
  );
}



// ─── Collection Report View ────────────────────────────────────────────────────
function CollectionReportView({ date, report, counters, allReports, attendance, users, onSave, readOnly }) {
  const [bankEntries, setBankEntries] = useState(report?.bankEntries || [{ bank:"SBI", amount:"" }, { bank:"KBL", amount:"" }]);
  const [expenses,    setExpenses]    = useState(report?.expenses    || [{ desc:"", amount:"" }]);

  useEffect(() => {
    setBankEntries(report?.bankEntries || [{ bank:"SBI", amount:"" }, { bank:"KBL", amount:"" }]);
    setExpenses(report?.expenses || [{ desc:"", amount:"" }]);
  }, [report?.id]);

  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"];
  const getE   = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);
  const isSale = e => e.type==="sales" || SALES_WTS.includes(e.workTypeName);

  const svcReports = allReports.filter(r => r.date >= (date||"") && r.date <= (date||"9"));
  const allEntries = svcReports.flatMap(r => getE(r));
  const totalSvc   = allEntries.filter(e => !isSale(e)).reduce((s,e) => s+(Number(e.amount)||0), 0);
  const totalSales = allEntries.filter(e =>  isSale(e)).reduce((s,e) => s+(Number(e.amount)||0), 0);
  const totalBardahl = allEntries.filter(e => e.workTypeName==="BARDAHL").reduce((s,e) => s+(Number(e.amount)||0), 0);
  const grandTotal = totalSvc + totalSales;

  const totalBank = bankEntries.reduce((s,b) => s+(Number(b.amount)||0), 0);
  const totalExp  = expenses.reduce((s,e) => s+(Number(e.amount)||0), 0);
  const netCollection = totalBank - totalExp;

  // Counter-wise service summary
  const counterSummary = counters.map(c => {
    const reps = svcReports.filter(r => r.counterId===c.id||r.counterName===c.name);
    const cE   = reps.flatMap(r => getE(r));
    const svc  = cE.filter(e=>!isSale(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const sal  = cE.filter(e=>isSale(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    return { name:c.name, svc, sal, total:svc+sal };
  }).filter(c => c.total > 0);

  return (
    <div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.navy, textTransform:"uppercase", marginBottom:12 }}>Service & Sales Summary</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:T.surf }}>
            <th style={{ padding:"6px 10px", textAlign:"left", fontSize:11, fontWeight:800, color:T.txt2 }}>Counter</th>
            <th style={{ padding:"6px 10px", textAlign:"right", fontSize:11, fontWeight:800, color:T.txt2 }}>Service (₹)</th>
            <th style={{ padding:"6px 10px", textAlign:"right", fontSize:11, fontWeight:800, color:T.txt2 }}>Sales (₹)</th>
            <th style={{ padding:"6px 10px", textAlign:"right", fontSize:11, fontWeight:800, color:T.amber }}>Total (₹)</th>
          </tr></thead>
          <tbody>
            {counterSummary.map(c => (
              <tr key={c.name} style={{ borderBottom:"1px solid "+T.bdr }}>
                <td style={{ padding:"6px 10px" }}>{c.name}</td>
                <td style={{ padding:"6px 10px", textAlign:"right" }}>{c.svc.toLocaleString("en-IN")}</td>
                <td style={{ padding:"6px 10px", textAlign:"right", color:T.grn }}>{c.sal.toLocaleString("en-IN")}</td>
                <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700, color:T.amber }}>{c.total.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {counterSummary.length===0 && <tr><td colSpan={4} style={{ padding:12, textAlign:"center", color:T.txt3 }}>No reports for this period</td></tr>}
          </tbody>
          <tfoot>
            <tr style={{ background:T.surf }}>
              <td style={{ padding:"6px 10px", fontWeight:700, textAlign:"right" }}>TOTAL SERVICE</td>
              <td></td><td></td>
              <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:800 }}>{fmtCurr(totalSvc)}</td>
            </tr>
            <tr style={{ background:T.grnL }}>
              <td style={{ padding:"6px 10px", fontWeight:700, color:T.grn, textAlign:"right" }}>TOTAL SALES</td>
              <td></td><td></td>
              <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:800, color:T.grn }}>{fmtCurr(totalSales)}</td>
            </tr>
            <tr style={{ background:T.amberL }}>
              <td style={{ padding:"6px 10px", fontWeight:800, color:T.amber, textAlign:"right" }}>GRAND TOTAL (SERVICE + SALES)</td>
              <td></td><td></td>
              <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:800, color:T.amber, fontSize:15 }}>{fmtCurr(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
        {totalBardahl > 0 && (
          <div style={{ marginTop:8, fontSize:12, color:T.txt2 }}>
            Bardahl: <b style={{ color:"#15803D" }}>{fmtCurr(totalBardahl)}</b>
          </div>
        )}
        <div style={{ marginTop:8, display:"flex", gap:16 }}>
          <div style={{ height:6, background:T.surf, borderRadius:3, flex:1, overflow:"hidden" }}>
            <div style={{ height:"100%", width:(grandTotal>0 ? Math.round(totalSvc*100/(grandTotal+0.001)) : 0)+"%", background:T.navy, borderRadius:3 }}/>
          </div>
        </div>
        <div style={{ fontSize:11, color:T.txt2, marginTop:4 }}>
          Service: {grandTotal>0 ? Math.round(totalSvc*100/(grandTotal+0.001)) : 0}% &nbsp; Sales: {grandTotal>0 ? Math.round(totalSales*100/(grandTotal+0.001)) : 0}%
        </div>
      </Card>

      {!readOnly && onSave && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.navy, textTransform:"uppercase", marginBottom:12 }}>Bank Collection</div>
          {bankEntries.map((b,i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"center" }}>
              <input value={b.bank} onChange={e=>setBankEntries(p=>p.map((x,j)=>j===i?{...x,bank:e.target.value}:x))}
                placeholder="Bank name" style={{ flex:1, padding:"7px 10px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              <input type="number" value={b.amount} onChange={e=>setBankEntries(p=>p.map((x,j)=>j===i?{...x,amount:e.target.value}:x))}
                placeholder="Amount" style={{ width:140, padding:"7px 10px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              <button onClick={()=>setBankEntries(p=>p.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:T.red, fontSize:16 }}>×</button>
            </div>
          ))}
          <Btn onClick={()=>setBankEntries(p=>[...p,{bank:"",amount:""}])} size="sm" variant="ghost">+ Add Bank</Btn>
          <div style={{ marginTop:10, fontWeight:700, color:T.navy }}>Bank Total: {fmtCurr(totalBank)}</div>

          <div style={{ fontSize:13, fontWeight:800, color:T.navy, textTransform:"uppercase", margin:"16px 0 8px" }}>Expenses</div>
          {expenses.map((e,i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"center" }}>
              <input value={e.desc} onChange={ev=>setExpenses(p=>p.map((x,j)=>j===i?{...x,desc:ev.target.value}:x))}
                placeholder="Description" style={{ flex:1, padding:"7px 10px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              <input type="number" value={e.amount} onChange={ev=>setExpenses(p=>p.map((x,j)=>j===i?{...x,amount:ev.target.value}:x))}
                placeholder="Amount" style={{ width:140, padding:"7px 10px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              <button onClick={()=>setExpenses(p=>p.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:T.red, fontSize:16 }}>×</button>
            </div>
          ))}
          <Btn onClick={()=>setExpenses(p=>[...p,{desc:"",amount:""}])} size="sm" variant="ghost">+ Add Expense</Btn>
          <div style={{ marginTop:10, fontWeight:700, color:T.red }}>Total Expenses: {fmtCurr(totalExp)}</div>

          <div style={{ marginTop:14, padding:"12px 16px", background:T.navyXL, borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, color:T.txt2 }}>Net Collection (Bank - Expenses)</div>
              <div style={{ fontSize:20, fontWeight:800, color:netCollection>=0?T.grn:T.red }}>{fmtCurr(netCollection)}</div>
            </div>
            <Btn onClick={()=>onSave(bankEntries,expenses)} variant="amber">Save Report</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Counter Analysis ──────────────────────────────────────────────────────────
function CounterAnalysis({ user, state, counterFilter, myCounterIds }) {
  const dr = useDateRange("month");
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"];
  const getE    = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);
  const isSale  = e => e.type==="sales" || SALES_WTS.includes(e.workTypeName);

  const visibleCounters = myCounterIds
    ? state.counters.filter(c => myCounterIds.includes(c.id))
    : counterFilter
      ? state.counters.filter(c => c.name===counterFilter)
      : state.counters;

  const filteredReports = state.serviceReports.filter(r => {
    if (r.date < dr.from || r.date > dr.to) return false;
    if (myCounterIds) return myCounterIds.includes(r.counterId);
    if (counterFilter) return r.counterName===counterFilter;
    return true;
  });

  const counterStats = visibleCounters.map(c => {
    const reps = filteredReports.filter(r => r.counterId===c.id||r.counterName===c.name);
    const allE = reps.flatMap(r => getE(r));
    const svc  = allE.filter(e=>!isSale(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const sal  = allE.filter(e=>isSale(e)).reduce((s,e)=>s+(Number(e.amount)||0),0);
    const veh  = allE.filter(e=>!isSale(e)).reduce((s,e)=>s+(Number(e.vehicles)||0),0);
    const days = new Set(reps.map(r=>r.date)).size;
    const avg  = days > 0 ? Math.round((svc+sal)/days) : 0;
    return { ...c, svc, sal, total:svc+sal, veh, days, avg, repCount:reps.length };
  });
  const maxTotal = Math.max(...counterStats.map(c=>c.total), 1);

  const wtMap = {};
  filteredReports.forEach(r => getE(r).forEach(e => {
    if (!isSale(e) && e.workTypeName) wtMap[e.workTypeName]=(wtMap[e.workTypeName]||0)+(Number(e.amount)||0);
  }));
  const wtArr = Object.entries(wtMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const maxWt = wtArr[0]?.[1]||1;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Counter Analysis</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14, marginBottom:20 }}>
        {counterStats.map(c => {
          const barW = maxTotal > 0 ? Math.round(c.total*100/(maxTotal+0.001)) : 0;
          return (
            <Card key={c.id}>
              <div style={{ fontSize:14, fontWeight:800, marginBottom:4 }}>{c.name}</div>
              <div style={{ fontSize:12, color:T.txt2, marginBottom:10 }}>
                {state.users.find(u=>u.id===c.supervisorId)?.name||"—"} · {c.days} days · {c.repCount} reports
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                <div style={{ background:T.navyXL, borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ fontSize:10, color:T.txt2, textTransform:"uppercase" }}>Service</div>
                  <div style={{ fontSize:16, fontWeight:800, color:T.navy }}>{fmtCurr(c.svc)}</div>
                </div>
                <div style={{ background:T.grnL, borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ fontSize:10, color:T.grn, textTransform:"uppercase" }}>Sales</div>
                  <div style={{ fontSize:16, fontWeight:800, color:T.grn }}>{fmtCurr(c.sal)}</div>
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:T.txt2 }}>Total Revenue</span>
                <span style={{ fontSize:14, fontWeight:800, color:T.amber }}>{fmtCurr(c.total)}</span>
              </div>
              <div style={{ height:6, background:T.surf, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:barW+"%", background:T.amber, borderRadius:3 }}/>
              </div>
              <div style={{ marginTop:6, fontSize:11, color:T.txt2 }}>
                Vehicles: {c.veh} · Daily avg: {fmtCurr(c.avg)}
              </div>
            </Card>
          );
        })}
      </div>
      {wtArr.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Top Work Types</div>
          {wtArr.map(([name,rev]) => {
            const barW2 = Math.round(rev*100/(maxWt+0.001));
            return (
              <div key={name} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:13 }}>{name}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.navy }}>{fmtCurr(rev)}</span>
                </div>
                <div style={{ height:6, background:T.surf, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:barW2+"%", background:T.navy, borderRadius:3 }}/>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── All Reports (MD + IT Admin) ───────────────────────────────────────────────
function AllReports({ state }) {
  const dr = useDateRange("today");
  const [expanded, setExpanded] = useState(null);
  const reports = state.serviceReports
    .filter(r => r.date>=dr.from && r.date<=dr.to)
    .sort((a,b) => b.date.localeCompare(a.date));
  const totalRev = reports.reduce((s,r)=>s+r.totalAmount,0);
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"];
  const getE = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>All Service Reports</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard label="Total Revenue" value={fmtCurr(totalRev)} color={T.amber}/>
        <StatCard label="Reports" value={reports.length} color={T.navy}/>
        <StatCard label="Counters" value={new Set(reports.map(r=>r.counterName||r.counterId)).size} color={T.grn}/>
      </div>
      {reports.map(r => (
        <Card key={r.id} style={{ marginBottom:10, cursor:"pointer" }} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontWeight:700 }}>{r.counterName || (r.counters||[])[0]?.counterName || "—"}</div>
              <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(r.date)} · {state.users.find(u=>u.id===r.supervisorId)?.name||"—"} · {r.submittedAt||""}</div>
              {r.submittedBy && <div style={{ fontSize:11, color:T.txt2 }}>Entered by: {state.users.find(u=>u.id===r.submittedBy)?.name||"Office"}</div>}
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</div>
              <Badge color={T.grn}>submitted</Badge>
            </div>
          </div>
          {expanded===r.id && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid "+T.bdr }}>
              {(() => {
                const allE = getE(r);
                const svcE = allE.filter(e=>!SALES_WTS.includes(e.workTypeName)&&e.type!=="sales"&&(e.vehicles>0||e.amount>0));
                const salE = allE.filter(e=>(SALES_WTS.includes(e.workTypeName)||e.type==="sales")&&e.amount>0);
                return <>
                  {svcE.length>0 && <Table cols={[
                    {key:"workTypeName",label:"Work"},
                    {key:"vehicles",label:"Veh"},
                    {key:"amount",label:"Amount",render:e=><b style={{color:T.navy}}>{fmtCurr(e.amount)}</b>},
                  ]} rows={svcE}/>}
                  {salE.length>0 && <>
                    <div style={{fontSize:11,fontWeight:700,color:T.grn,margin:"8px 0 4px"}}>SALES</div>
                    <Table cols={[
                      {key:"workTypeName",label:"Product"},
                      {key:"amount",label:"Amount",render:e=><b style={{color:T.grn}}>{fmtCurr(e.amount)}</b>},
                    ]} rows={salE}/>
                  </>}
                </>;
              })()}
            </div>
          )}
        </Card>
      ))}
      {reports.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for {dr.label}</div></Card>}
    </div>
  );
}

// ─── Staff Directory ───────────────────────────────────────────────────────────
function StaffDirectory({ state }) {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const users = state.users.filter(u => u.active !== false).filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.empId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const today_ = today();
  const upcomingBdays = state.users.filter(u => {
    if (!u.dob) return false;
    const bday = u.dob.slice(5);
    const todayMD = today_.slice(5);
    const in7 = new Date(today_);
    in7.setDate(in7.getDate()+7);
    const in7MD = in7.toISOString().split("T")[0].slice(5);
    return bday >= todayMD && bday <= in7MD;
  });

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Staff Directory</div>
      {upcomingBdays.length > 0 && (
        <Card style={{ marginBottom:16, background:"#FFF7ED", border:"1px solid #FED7AA" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#C2410C", marginBottom:8 }}>🎂 Upcoming Birthdays (next 7 days)</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {upcomingBdays.map(u => (
              <div key={u.id} style={{ background:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12 }}>
                <b>{u.name}</b> — {u.dob?.slice(5).split("-").reverse().join("/")}
              </div>
            ))}
          </div>
        </Card>
      )}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or ID..."
          style={{ flex:1, minWidth:200, padding:"8px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}/>
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
          style={{ padding:"8px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}>
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Table cols={[
        {key:"empId",   label:"ID",     render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.empId}</span>},
        {key:"name",    label:"Name",   render:r=><b>{r.name}</b>},
        {key:"role",    label:"Role",   render:r=><Badge color={ROLE_COLORS[r.role]||T.navy}>{ROLE_LABELS[r.role]||r.role}</Badge>},
        {key:"manager", label:"Reports To", render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"dob",     label:"D.O.B",  render:r=>r.dob?r.dob.split("-").reverse().join("/"):"—"},
        {key:"joining", label:"Joining",render:r=>r.joining?r.joining.split("-").reverse().join("/"):"—"},
        {key:"phone",   label:"Phone"},
      ]} rows={users} emptyMsg="No staff found"/>
    </div>
  );
}

// ─── Salary View ───────────────────────────────────────────────────────────────
function SalaryView({ user, state, setState, toast, viewScope }) {
  const [selMonth, setSelMonth] = useState(today().slice(0,7));
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ basic:"", allowances:"", deductions:"", note:"" });

  const relevantUsers = viewScope==="all"
    ? state.users.filter(u=>u.active!==false)
    : state.users.filter(u=>u.managerId===user.id||u.id===user.id);

  const getSalary = (uid) => (state.salaries||[]).find(s=>s.userId===uid&&s.month===selMonth);

  const save = (uid) => {
    const basic=Number(form.basic)||0, allow=Number(form.allowances)||0, deduct=Number(form.deductions)||0;
    const sal = { id:"sal_"+uid+"_"+selMonth, userId:uid, month:selMonth, basic_salary:basic, allowances:allow, deductions:deduct, net_salary:basic+allow-deduct, note:form.note, paid_by:user.id, paid_on:today() };
    setState(p=>({...p, salaries:[...(p.salaries||[]).filter(s=>s.id!==sal.id), sal]}));
    toast.show("Salary saved ✅");
    setEditing(null);
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Salary & Payroll</div>
      <Input label="Month" type="month" value={selMonth} onChange={setSelMonth} style={{ maxWidth:200, marginBottom:16 }}/>
      {relevantUsers.map(u => {
        const sal = getSalary(u.id);
        const isEdit = editing===u.id;
        return (
          <Card key={u.id} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontWeight:700 }}>{u.name}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{ROLE_LABELS[u.role]||u.role} · {u.empId}</div>
              </div>
              {!isEdit && (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {sal ? (
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:16, fontWeight:800, color:T.grn }}>{fmtCurr(sal.net_salary||sal.netSalary||0)}</div>
                      <div style={{ fontSize:11, color:T.txt2 }}>Basic: {fmtCurr(sal.basic_salary||sal.basic||0)}</div>
                    </div>
                  ) : <div style={{ fontSize:12, color:T.txt3 }}>Not set</div>}
                  <Btn onClick={()=>{ setEditing(u.id); setForm({ basic:sal?.basic_salary||sal?.basic||"", allowances:sal?.allowances||"", deductions:sal?.deductions||"", note:sal?.note||"" }); }} size="sm" variant="outline">{sal?"Edit":"Set"}</Btn>
                </div>
              )}
            </div>
            {isEdit && (
              <div style={{ marginTop:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:12 }}>
                  {[["basic","Basic Salary"],["allowances","Allowances"],["deductions","Deductions"]].map(([k,l])=>(
                    <div key={k}>
                      <label style={{ display:"block", fontSize:11, fontWeight:700, color:T.txt2, marginBottom:4, textTransform:"uppercase" }}>{l} (₹)</label>
                      <input type="number" value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder="0"
                        style={{ width:"100%", padding:"8px 10px", border:"1px solid "+T.bdrS, borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                    </div>
                  ))}
                </div>
                <div style={{ background:T.navyXL, borderRadius:8, padding:10, marginBottom:12, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13 }}>Net Salary</span>
                  <span style={{ fontSize:16, fontWeight:800, color:T.grn }}>{fmtCurr((Number(form.basic)||0)+(Number(form.allowances)||0)-(Number(form.deductions)||0))}</span>
                </div>
                <Input label="Note" value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Optional note"/>
                <div style={{ display:"flex", gap:10, marginTop:10 }}>
                  <Btn onClick={()=>save(u.id)} variant="amber">Save</Btn>
                  <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── MD Feedback All ───────────────────────────────────────────────────────────
function MDFeedbackAll({ state }) {
  const [filterCounter, setFilterCounter] = useState("all");
  const [filterRating,  setFilterRating]  = useState(0);
  const dr = useDateRange("month");

  const fb = state.feedback
    .filter(f => f.date>=dr.from && f.date<=dr.to)
    .filter(f => filterCounter==="all" || f.counterId===filterCounter || f.counterName===state.counters.find(c=>c.id===filterCounter)?.name)
    .filter(f => filterRating===0 || f.rating===filterRating)
    .sort((a,b) => b.date.localeCompare(a.date));

  const total = state.feedback.reduce((s,f)=>s+f.rating,0);
  const avg   = state.feedback.length ? (total / state.feedback.length).toFixed(1) : "—";
  const ratingColor = r => r>=4?T.grn:r===3?T.amber:T.red;

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>All Customer Feedback</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <div style={{ fontSize:28, fontWeight:800, color:T.amber }}>⭐ {avg}</div>
        <div style={{ fontSize:13, color:T.txt2 }}>{state.feedback.length} total reviews</div>
        <select value={filterCounter} onChange={e=>setFilterCounter(e.target.value)}
          style={{ padding:"7px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}>
          <option value="all">All Counters</option>
          {state.counters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterRating} onChange={e=>setFilterRating(Number(e.target.value))}
          style={{ padding:"7px 12px", border:"1px solid "+T.bdrS, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}>
          <option value={0}>All Ratings</option>
          {[5,4,3,2,1].map(r=><option key={r} value={r}>{r} Star{r!==1?"s":""}</option>)}
        </select>
      </div>
      {fb.map(f => {
        const bc = ratingColor(f.rating);
        return (
          <Card key={f.id} style={{ marginBottom:10, borderLeft:"4px solid "+bc }}>
            <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:6 }}>
              <div>
                <div style={{ fontWeight:700 }}>{f.counterName || state.counters.find(c=>c.id===f.counterId)?.name || "—"}</div>
                <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(f.date)} · {f.submittedAt||""}</div>
              </div>
              <Badge color={bc}>{Array(f.rating).fill("⭐").join("")} {f.rating}</Badge>
            </div>
            <div style={{ display:"flex", gap:12, fontSize:12, marginBottom:6, flexWrap:"wrap" }}>
              {f.vehicleNo && <span><b>{f.vehicleNo}</b></span>}
              {f.serviceType && <span style={{ color:T.txt2 }}>{f.serviceType}</span>}
              {f.customerName && <span style={{ color:T.txt2 }}>{f.customerName}</span>}
            </div>
            {f.comment && <div style={{ fontSize:13, background:T.surf, padding:"8px 12px", borderRadius:7 }}>{f.comment}</div>}
          </Card>
        );
      })}
      {fb.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No feedback for {dr.label}</div></Card>}
    </div>
  );
}

// ─── Office: View Reports ──────────────────────────────────────────────────────
function OfficeReports({ state }) {
  const dr = useDateRange("today");
  const [expanded, setExpanded] = useState(null);
  const reports = state.serviceReports
    .filter(r => r.date>=dr.from && r.date<=dr.to)
    .sort((a,b) => b.date.localeCompare(a.date));
  const totalRev = reports.reduce((s,r)=>s+r.totalAmount,0);
  const SALES_WTS = ["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"];
  const getE = r => r.entries&&r.entries.length>0 ? r.entries : (r.counters||[]).flatMap(c=>c.entries||[]);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>View Reports</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      {reports.length>0 && (
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <StatCard label={"Reports ("+dr.label+")"} value={reports.length+" reports"} sub={"Total: "+fmtCurr(totalRev)} color={T.amber}/>
        </div>
      )}
      {reports.map(r => (
        <Card key={r.id} style={{ marginBottom:10, cursor:"pointer" }} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontWeight:700 }}>{r.counterName||(r.counters||[])[0]?.counterName||"—"}</div>
              <div style={{ fontSize:12, color:T.txt2 }}>{fmtDate(r.date)} · {state.users.find(u=>u.id===r.supervisorId)?.name||"—"}</div>
              {r.submittedBy && <div style={{ fontSize:11, color:T.txt2 }}>By: {state.users.find(u=>u.id===r.submittedBy)?.name||"Office"}</div>}
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:18, fontWeight:800, color:T.amber }}>{fmtCurr(r.totalAmount)}</div>
              <Badge color={T.grn}>submitted</Badge>
            </div>
          </div>
          {expanded===r.id && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid "+T.bdr }}>
              {(() => {
                const allE = getE(r);
                const svcE = allE.filter(e=>!SALES_WTS.includes(e.workTypeName)&&e.type!=="sales"&&e.vehicles>0);
                const salE = allE.filter(e=>(SALES_WTS.includes(e.workTypeName)||e.type==="sales")&&e.amount>0);
                return <>
                  {svcE.length>0 && <Table cols={[{key:"workTypeName",label:"Work"},{key:"vehicles",label:"Veh"},{key:"amount",label:"Amt",render:e=>fmtCurr(e.amount)}]} rows={svcE}/>}
                  {salE.length>0 && <><div style={{fontSize:11,fontWeight:700,color:T.grn,margin:"6px 0 3px"}}>SALES</div><Table cols={[{key:"workTypeName",label:"Product"},{key:"amount",label:"Amt",render:e=><b style={{color:T.grn}}>{fmtCurr(e.amount)}</b>}]} rows={salE}/></>}
                </>;
              })()}
            </div>
          )}
        </Card>
      ))}
      {reports.length===0 && <Card><div style={{color:T.txt3,textAlign:"center",padding:20}}>No reports for {dr.label}</div></Card>}
    </div>
  );
}

// ─── Office: View Attendance with status filter ────────────────────────────────
function OfficeAttendanceView({ state }) {
  const dr = useDateRange("today");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const att = state.attendance
    .filter(a=>a.date>=dr.from&&a.date<=dr.to)
    .filter(a=>filterStatus==="all"||a.status===filterStatus)
    .filter(a=>!search||state.users.find(u=>u.id===a.staffId)?.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.status.localeCompare(b.status));
  const counts = { present:att.filter(a=>a.status==="present").length, absent:att.filter(a=>a.status==="absent").length, half:att.filter(a=>a.status==="half_day").length };
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>Attendance Records</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
        {["all","present","absent","half_day"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{
            padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            border:"1px solid "+(filterStatus===s?(s==="present"?T.grn:s==="absent"?T.red:s==="half_day"?T.amber:T.navy):T.bdrS),
            background:filterStatus===s?(s==="present"?T.grnL:s==="absent"?T.redL:s==="half_day"?T.amberL:T.navy):"transparent",
            color:filterStatus===s?(s==="all"?"#fff":s==="present"?T.grn:s==="absent"?T.red:T.amberD):T.txt2
          }}>{s==="half_day"?"Half Day":s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}{s!=="all"?" ("+att.filter(a=>a.status===s).length+")":""}</button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..."
          style={{ padding:"5px 12px", border:"1px solid "+T.bdrS, borderRadius:20, fontSize:12, fontFamily:"inherit", outline:"none", flex:1, minWidth:120 }}/>
      </div>
      {att.length>0 && <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}><StatCard label="Present" value={counts.present} color={T.grn}/><StatCard label="Absent" value={counts.absent} color={T.red}/><StatCard label="Half Day" value={counts.half} color={T.amber}/></div>}
      <Table cols={[
        {key:"date",label:"Date",render:r=>fmtDate(r.date)},
        {key:"staff",label:"Staff",render:r=><b>{state.users.find(u=>u.id===r.staffId)?.name||r.staffId}</b>},
        {key:"counter",label:"Counter",render:r=>state.counters.find(c=>c.supervisorId===r.supervisorId)?.name||"—"},
        {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.grn:r.status==="half_day"?T.amber:T.red}>{r.status==="half_day"?"Half Day":r.status.charAt(0).toUpperCase()+r.status.slice(1)}</Badge>},
        {key:"reason",label:"Reason",render:r=>r.reason||"—"},
      ]} rows={att} emptyMsg="No records"/>
    </div>
  );
}

// ─── Office: Sales Entry ────────────────────────────────────────────────────────
function OfficeSalesEntry({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const [selSupervisor, setSelSupervisor] = useState("");
  const [selCounter, setSelCounter] = useState("");
  const [bardahl, setBardahl] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");
  const executives = state.users.filter(u=>u.role==="supervisor"&&u.active!==false);
  const myCounters = selSupervisor ? state.counters.filter(c=>c.supervisorId===selSupervisor) : [];

  const submit = () => {
    if (!selSupervisor||!selCounter) { toast.show("Select executive and counter","error"); return; }
    if (!bardahl&&!other) { toast.show("Enter at least one sales amount","error"); return; }
    const counter = state.counters.find(c=>c.id===selCounter)||{id:selCounter,name:selCounter};
    const entries = [];
    if (Number(bardahl)>0) entries.push({workTypeId:"wt_bardahl",workTypeName:"BARDAHL",amount:Number(bardahl),type:"sales",vehicles:0,rate:0});
    if (Number(other)>0)   entries.push({workTypeId:"wt_other",workTypeName:"OTHER SALES",amount:Number(other),type:"sales",vehicles:0,rate:0});
    const reportId = "sr_"+selSupervisor+"_"+counter.id+"_"+date;
    const existing = state.serviceReports.find(r=>r.id===reportId);
    const prevE = existing ? (existing.entries||[]).filter(e=>!["BARDAHL","OTHER SALES"].includes(e.workTypeName)) : [];
    const allE  = [...prevE, ...entries];
    const report = { id:reportId, date, supervisorId:selSupervisor, counterId:counter.id, counterName:counter.name,
      submittedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      entries:allE, counters:[{counterName:counter.name,entries:allE}],
      totalAmount:allE.reduce((s,e)=>s+(Number(e.amount)||0),0), notes, status:"submitted", submittedBy:user.id };
    setState(p=>({...p,serviceReports:[...p.serviceReports.filter(r=>r.id!==report.id),report]}));
    toast.show("Sales entry saved ✅");
    setBardahl(""); setOther(""); setNotes("");
  };
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Sales Entry</div>
      <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>Enter Bardahl and other product sales (separate from service revenue)</div>
      <Card style={{maxWidth:540}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Executive</label>
            <select value={selSupervisor} onChange={e=>{setSelSupervisor(e.target.value);setSelCounter("");}}
              style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="">Select...</option>
              {executives.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        {myCounters.length>0 && (
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:6,textTransform:"uppercase"}}>Counter</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {myCounters.map(c=>(
                <button key={c.id} onClick={()=>setSelCounter(c.id)} style={{
                  padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  border:"1px solid "+(selCounter===c.id?T.navy:T.bdrS),
                  background:selCounter===c.id?T.navy:"transparent",color:selCounter===c.id?"#fff":T.txt
                }}>{c.name}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{background:T.navyXL,borderRadius:10,padding:16,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:800,color:T.navy,textTransform:"uppercase",marginBottom:12}}>Sales Amounts</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Bardahl Sales (₹)</label>
              <input type="number" value={bardahl} onChange={e=>setBardahl(e.target.value)} min={0} placeholder="0"
                style={{width:"100%",padding:"9px 12px",border:"1px solid "+(bardahl?"#0369A1":T.bdrS),borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:bardahl?"#EFF6FF":"#fff"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Other Sales (₹)</label>
              <input type="number" value={other} onChange={e=>setOther(e.target.value)} min={0} placeholder="0"
                style={{width:"100%",padding:"9px 12px",border:"1px solid "+(other?T.grn:T.bdrS),borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:other?T.grnL:"#fff"}}/>
            </div>
          </div>
          {(Number(bardahl)+Number(other))>0 && (
            <div style={{marginTop:12,padding:"8px 12px",background:T.amberL,borderRadius:8,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:13,fontWeight:700}}>Total Sales</span>
              <span style={{fontSize:18,fontWeight:800,color:T.amber}}>{fmtCurr(Number(bardahl)+Number(other))}</span>
            </div>
          )}
        </div>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)"
          style={{width:"100%",padding:"8px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:14,boxSizing:"border-box"}}/>
        <Btn onClick={submit} variant="amber">Save Sales Entry</Btn>
      </Card>
    </div>
  );
}

// ─── Office: Own Attendance ────────────────────────────────────────────────────
function OfficeOwnAttendance({ user, state, setState, toast }) {
  const [displayDate, setDisplayDate] = useState(today());
  const recordsRef = useRef({});
  const reasonsRef = useRef({});
  const [formTick, setFormTick] = useState(0);
  const [dirty, setDirty] = useState(false);
  const mounted = useRef(false);
  const officeStaff = state.users.filter(u=>(u.role==="office"||u.id===user.id)&&u.active!==false);

  const loadDate = (date) => {
    const r={}, rs={};
    state.attendance.filter(a=>a.supervisorId===user.id&&a.date===date).forEach(a=>{ r[a.staffId]=a.status; rs[a.staffId]=a.reason||""; });
    recordsRef.current=r; reasonsRef.current=rs;
    setDisplayDate(date); setFormTick(t=>t+1); setDirty(false);
  };
  useEffect(()=>{ if(mounted.current)return; mounted.current=true; loadDate(today()); },[]);

  const setStatus = (id,st) => { recordsRef.current={...recordsRef.current,[id]:st}; setFormTick(t=>t+1); setDirty(true); };
  const save = () => {
    const atts = officeStaff.map(s=>({ id:"att_"+user.id+"_"+s.id+"_"+displayDate, date:displayDate, supervisorId:user.id, staffId:s.id,
      status:recordsRef.current[s.id]||"present", reason:reasonsRef.current[s.id]||"",
      markedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) }));
    setState(p=>({...p,attendance:[...p.attendance.filter(a=>!(a.supervisorId===user.id&&a.date===displayDate)),...atts]}));
    setDirty(false); toast.show("Attendance saved ✅");
  };
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>My Attendance</div>
      <Card style={{maxWidth:640}}>
        <Input label="Date" type="date" value={displayDate} onChange={loadDate}/>
        {officeStaff.map(s=>{ const st=recordsRef.current[s.id]; return (
          <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 220px 1fr",gap:8,alignItems:"center",marginBottom:10,
            background:s.id===user.id?T.navyXL:"transparent",padding:"4px 8px",borderRadius:6}}>
            <div style={{fontSize:14,fontWeight:700}}>{s.name}{s.id===user.id&&<Badge color={T.navy} style={{marginLeft:6}}>You</Badge>}</div>
            <div style={{display:"flex",gap:4}}>
              {["present","absent","half_day"].map(status=>{ const active=st===status||(!st&&status==="present");
                return <button key={status} onClick={()=>setStatus(s.id,status)} style={{
                  padding:"5px 8px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  border:"1px solid "+(active?(status==="present"?T.grn:status==="absent"?T.red:T.amber):T.bdrS),
                  background:active?(status==="present"?T.grnL:status==="absent"?T.redL:T.amberL):"transparent",
                  color:active?(status==="present"?T.grn:status==="absent"?T.red:T.amberD):T.txt2
                }}>{status==="half_day"?"½":status==="absent"?"Absent":"Present"}</button>;
              })}
            </div>
            <input key={"r"+s.id+formTick} defaultValue={reasonsRef.current[s.id]||""} onChange={e=>{ reasonsRef.current={...reasonsRef.current,[s.id]:e.target.value}; setDirty(true); }}
              placeholder={st==="absent"?"Reason":"Optional"}
              style={{padding:"6px 10px",border:"1px solid "+(st==="absent"?T.red:T.bdrS),borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          </div>
        );})}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <span style={{fontSize:12,color:T.txt2}}>{fmtDate(displayDate)}{dirty&&<span style={{color:T.amber,marginLeft:8}}>● Unsaved</span>}</span>
          <Btn onClick={save} variant={dirty?"amber":"primary"}>{dirty?"⚠️ Save":"✅ Save Attendance"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Office: Export ────────────────────────────────────────────────────────────
function OfficeExport({ state, toast }) {
  const dl = (data, name) => {
    if (!data.length) { toast.show("No data","error"); return; }
    const h = Object.keys(data[0]);
    const csv = [h.join(","), ...data.map(r=>h.map(k=>`"${(r[k]||"").toString().replace(/"/g,'""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = name; a.click();
    toast.show("Exported "+name);
  };
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:20}}>Export Data</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
        {[
          ["Service Reports","📋",()=>dl(state.serviceReports.map(r=>({ Date:r.date, Counter:r.counterName||"", Executive:state.users.find(u=>u.id===r.supervisorId)?.name||"", Total:r.totalAmount, Status:r.status })),"reports_"+today()+".csv")],
          ["Attendance","👥",()=>dl(state.attendance.map(a=>({ Date:a.date, Staff:state.users.find(u=>u.id===a.staffId)?.name||"", Status:a.status, Reason:a.reason||"" })),"attendance_"+today()+".csv")],
          ["Staff List","👤",()=>dl(state.users.map(u=>({ ID:u.empId, Name:u.name, Role:ROLE_LABELS[u.role]||u.role, Phone:u.phone||"" })),"staff_"+today()+".csv")],
          ["Feedback","💬",()=>dl(state.feedback.map(f=>({ Date:f.date, Counter:f.counterName||"", Rating:f.rating, Vehicle:f.vehicleNo||"", Comment:f.comment||"" })),"feedback_"+today()+".csv")],
        ].map(([label,icon,fn])=>(
          <Card key={label} style={{cursor:"pointer",textAlign:"center",padding:24}} onClick={fn}>
            <div style={{fontSize:32,marginBottom:8}}>{icon}</div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Export {label}</div>
            <div style={{fontSize:12,color:T.txt2}}>Download as CSV</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Public Feedback Form ──────────────────────────────────────────────────────
function PublicFeedbackForm({ counterName, counters, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [vehicle, setVehicle] = useState("");
  const [service, setService] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!rating) { alert("Please select a rating"); return; }
    const counter = counters.find(c=>c.name===counterName);
    onSubmit({ id:"fb_"+Date.now(), counterId:counter?.id||"", counterName, date:today(),
      submittedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      rating, vehicleNo:vehicle.toUpperCase(), serviceType:service, customerName:name, comment, source:"public_form" });
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F7F9FC",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <div style={{fontSize:24,fontWeight:800,color:"#0F2B4A",marginBottom:8}}>Thank you for your feedback!</div>
        <div style={{fontSize:15,color:"#64748B"}}>We appreciate your time. See you again!</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#F7F9FC",fontFamily:"system-ui,sans-serif",padding:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:32,marginBottom:6}}>✨</div>
          <div style={{fontSize:22,fontWeight:800,color:"#0F2B4A"}}>Benaka Enterprises</div>
          <div style={{fontSize:15,color:"#64748B"}}>{counterName}</div>
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:28,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:20,color:"#0F2B4A"}}>How was your service today?</div>
          <div style={{display:"flex",gap:8,marginBottom:20,justifyContent:"center"}}>
            {[1,2,3,4,5].map(r=>(
              <button key={r} onClick={()=>setRating(r)} style={{fontSize:36,background:"none",border:"none",cursor:"pointer",opacity:r<=rating?1:.3,transition:"opacity .15s"}}>⭐</button>
            ))}
          </div>
          {[["Vehicle Number",vehicle,setVehicle,"e.g. KA19AB1234"],["Service Type",service,setService,"e.g. Wash, Polish"],["Your Name (optional)",name,setName,"Optional"]].map(([label,val,setter,ph])=>(
            <div key={label} style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:700,color:"#64748B",marginBottom:5,textTransform:"uppercase"}}>{label}</label>
              <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                style={{width:"100%",padding:"10px 14px",border:"1px solid #E2E8F0",borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#64748B",marginBottom:5,textTransform:"uppercase"}}>Comments</label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="Tell us about your experience..."
              style={{width:"100%",padding:"10px 14px",border:"1px solid #E2E8F0",borderRadius:8,fontSize:14,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
          </div>
          <button onClick={submit} style={{width:"100%",padding:"13px",background:"#E8A020",color:"#000",border:"none",borderRadius:10,fontSize:16,fontWeight:800,cursor:"pointer"}}>
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Planned Leave Portal (field staff) ────────────────────────────────────────
function PlannedLeavePortal({ user, state, setState, toast, mode }) {
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [reason, setReason] = useState("");

  const myLeaves = (state.plannedLeaves||[]).filter(l=>l.userId===user.id).sort((a,b)=>b.appliedOn?.localeCompare(a.appliedOn||"")||0);
  const pending  = mode==="executive" ? (state.plannedLeaves||[]).filter(l=>{
    const staff = state.users.find(u=>u.id===l.userId);
    return staff?.managerId===user.id && l.status==="pending";
  }) : [];

  const submit = () => {
    if (!from||!to||!reason) { toast.show("Fill all fields","error"); return; }
    const leave = { id:"pl_"+Date.now(), userId:user.id, staffName:state.users.find(u=>u.id===user.id)?.name||"",
      supervisorId:user.managerId||"", fromDate:from, toDate:to, reason, status:"pending",
      appliedOn:today(), decidedOn:null };
    setState(p=>({...p, plannedLeaves:[...(p.plannedLeaves||[]), leave]}));
    toast.show("Leave request submitted");
    setFrom(""); setTo(""); setReason("");
  };

  const decide = (id, status) => {
    setState(p=>({...p, plannedLeaves:(p.plannedLeaves||[]).map(l=>l.id===id?{...l,status,decidedOn:today()}:l)}));
    toast.show(status==="approved"?"Leave approved":"Leave rejected");
  };

  return (
    <div>
      {pending.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:800,marginBottom:12,color:T.red}}>⏳ Pending Approvals ({pending.length})</div>
          {pending.map(l=>{
            const staff = state.users.find(u=>u.id===l.userId);
            return (
              <Card key={l.id} style={{marginBottom:10,borderLeft:"3px solid "+T.amber}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700}}>{l.staffName||staff?.name}</div>
                    <div style={{fontSize:12,color:T.txt2}}>{fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</div>
                    <div style={{fontSize:13,marginTop:4}}>{l.reason}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={()=>decide(l.id,"approved")} variant="success" size="sm">Approve</Btn>
                    <Btn onClick={()=>decide(l.id,"rejected")} variant="danger" size="sm">Reject</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Request Planned Leave</div>
      <Card style={{maxWidth:500,marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <Input label="From Date" type="date" value={from} onChange={setFrom}/>
          <Input label="To Date" type="date" value={to} onChange={setTo}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Reason</label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
            style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
        </div>
        <Btn onClick={submit} variant="amber">Submit Leave Request</Btn>
      </Card>

      {myLeaves.length > 0 && (
        <>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>My Leave Requests</div>
          <Table cols={[
            {key:"fromDate",label:"From",render:r=>fmtDate(r.fromDate)},
            {key:"toDate",  label:"To",  render:r=>fmtDate(r.toDate)},
            {key:"reason",  label:"Reason"},
            {key:"status",  label:"Status",render:r=><Badge color={r.status==="approved"?T.grn:r.status==="rejected"?T.red:T.amber}>{r.status}</Badge>},
          ]} rows={myLeaves}/>
        </>
      )}
    </div>
  );
}

// ─── Field Staff Portal ────────────────────────────────────────────────────────
function OfficeCombinedAttendance({ user, state, setState, toast }) {
  const [tab, setTab] = useState("exec");
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Mark Attendance</div>
      <Tabs tabs={[{id:"exec",label:"For Executives & Staff"},{id:"office",label:"Office Staff"}]} active={tab} onChange={setTab}/>
      {tab==="exec"   && <OfficeMarkAttendance   user={user} state={state} setState={setState} toast={toast}/>}
      {tab==="office" && <OfficeOwnAttendance user={user} state={state} setState={setState} toast={toast}/>}
    </div>
  );
}

function DebugReports({ state }) {
  const now = new Date(new Date().getTime() + (330 + new Date().getTimezoneOffset()) * 60000);
  const tod = now.toISOString().split("T")[0];
  const todayReps = (state.serviceReports||[]).filter(r=>r.date===tod);
  const matchCounter = (r) => {
    let m = state.counters.find(c=>r.counterId&&r.counterId===c.id);
    if(!m&&r.counterName){ const rn=r.counterName.trim().toUpperCase(); m=state.counters.find(c=>c.name.trim().toUpperCase()===rn); }
    if(!m&&r.supervisorId){ const sc=state.counters.filter(c=>c.supervisorId===r.supervisorId); if(sc.length===1) m=sc[0]; }
    return m;
  };
  const unmatched = todayReps.filter(r=>!matchCounter(r));
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Debug Reports</div>
      <Card style={{marginBottom:16,background:"#0f1117",color:"#4ade80"}}>
        <div style={{fontWeight:800,marginBottom:8,color:"#fbbf24"}}>TODAY {tod}: {todayReps.length} reports · Total Rs.{todayReps.reduce((s,r)=>s+r.totalAmount,0).toLocaleString("en-IN")}</div>
        <div style={{marginBottom:8,color:unmatched.length>0?"#f87171":"#4ade80"}}>Unmatched: {unmatched.length}</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:700}}>
            <thead><tr style={{background:"#1e293b",color:"#fbbf24"}}>
              {["Exec","counterId","counterName","Total","Matched To","OK?"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",border:"1px solid #334"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {todayReps.map((r,i)=>{ const sup=state.users.find(u=>u.id===r.supervisorId); const ctr=matchCounter(r); return (
                <tr key={i} style={{background:ctr?"#0d1f0d":"#1f0d0d"}}>
                  <td style={{padding:"3px 8px",border:"1px solid #334"}}>{sup?.name||r.supervisorId}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:r.counterId?"#4ade80":"#f87171"}}>{r.counterId||"NONE"}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:r.counterName?"#4ade80":"#f87171"}}>{r.counterName||"NONE"}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:"#fbbf24"}}>Rs.{r.totalAmount}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:ctr?"#4ade80":"#f87171"}}>{ctr?ctr.name:"NO MATCH"}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:ctr?"#4ade80":"#f87171"}}>{ctr?"YES":"NO"}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>
      <Card style={{background:"#0f1117",color:"#4ade80"}}>
        <div style={{fontWeight:800,marginBottom:8,color:"#fbbf24"}}>COUNTERS ({state.counters.length})</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"#1e293b",color:"#fbbf24"}}>
              {["id","name","supervisorId","Supervisor"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",border:"1px solid #334"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {state.counters.map((c,i)=>{ const sup=state.users.find(u=>u.id===c.supervisorId); return (
                <tr key={i}><td style={{padding:"3px 8px",border:"1px solid #334"}}>{c.id}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:"#fbbf24"}}>{c.name}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:c.supervisorId?"#4ade80":"#f87171"}}>{c.supervisorId||"EMPTY"}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334"}}>{sup?.name||"?"}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


