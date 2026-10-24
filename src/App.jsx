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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leaves?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  },
  async upsertLeave(leave) {
    const row = {
      id: leave.id,
      user_id: leave.userId || leave.user_id,
      role: leave.role || "",
      date: leave.date || leave.fromDate || leave.from_date,
      to_date: leave.toDate || leave.to_date,
      type: leave.type || "other",
      reason: leave.reason || "",
      status: leave.status || "pending",
      approver_id: leave.approverId || leave.approver_id,
      submitted_at: leave.submittedAt || leave.submitted_at || new Date().toISOString(),
      decided_at: leave.decidedAt || leave.decided_at || null,
    };
    const res = await supabase.from("leaves").upsert(row);
    if (res && res.code) console.error("upsertLeave failed:", res);
    return res;
  },
  // Feedback
  async getFeedback() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/feedback?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  },
  async insertFeedback(fb) {
    return supabase.from("feedback").insert(fb);
  },
  async upsertFeedback(fb) {
    const row = {
      id: fb.id,
      type: fb.type || "customer",
      category: fb.category || "general",
      date: fb.date || fb.created_at || "",
      counter_id:   fb.counterId   || fb.counter_id   || "",
      counter_name: fb.counterName || fb.counter_name || "",
      user_id:   fb.userId   || fb.user_id   || null,
      user_name: fb.userName || fb.user_name || "",
      role: fb.role || "",
      message:  fb.message  || fb.comment || "",
      rating:   fb.rating   || null,
      status:   fb.status   || "unread",
      read_at:  fb.readAt   || fb.read_at  || null,
      submitted_at: fb.submittedAt || fb.submitted_at || new Date().toISOString(),
    };
    const res = await supabase.from("feedback").upsert(row);
    if (res && res.code) console.error("upsertFeedback failed:", res.message, row);
    return res;
  },
  // Collection Reports
  async getCollectionReports(filter={}) {
    let url = `${SUPABASE_URL}/rest/v1/collection_reports?select=*`;
    if (filter.date) url += `&date=eq.${filter.date}`;
    const r = await fetch(url, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const d = await r.json();
    return Array.isArray(d) ? d : [];
    },
  // Collection Reports
  async upsertCollectionReport(rep) {
    const bankEntries = rep.bankEntries || [];
    const expenses    = rep.expenses || [];
    const totalBank   = bankEntries.reduce((s,b)=>s+(Number(b.amount)||0),0);
    const totalExp    = expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
    // Always store data as JSON in notes — works regardless of extra column existence
    // Try adding computed columns too; if schema doesn't have them yet, they're ignored
    const row = {
      id: rep.id,
      date: rep.date,
      supervisor_id: rep.supervisorId || rep.supervisor_id || "",
      notes: JSON.stringify({ bankEntries, expenses, totalBank, totalExp }),
    };
    // Attempt to add numeric columns (fail silently if missing)
    try {
      const fullRow = { ...row, total_bank: totalBank, total_expenses: totalExp, net_collection: totalBank - totalExp };
      const res = await supabase.from("collection_reports").upsert(fullRow);
      if (!res || !res.code) return res;
    } catch(e) {}
    // Fallback: just the base columns
    return supabase.from("collection_reports").upsert(row);
  },
  // Inventory
  async getInventory() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/inventory?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const d = await r.json(); return Array.isArray(d) ? d : [];
  },
  async upsertInventory(items) {
    const rows = (Array.isArray(items)?items:[items]).map(i=>({
      id: i.id, product_id: i.productId||i.id, product_name: i.productName||i.name||"",
      unit: i.unit||"pcs", current_stock: Number(i.currentStock)||0,
      min_stock: Number(i.minStock)||0, last_updated: i.lastUpdated||today(),
      updated_by: i.updatedBy||"",
    }));
    const res = await supabase.from("inventory").upsert(rows);
    if (res&&res.code) console.error("upsertInventory failed:", res.message);
    return res;
  },
  async getStockTransactions() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock_transactions?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const d = await r.json(); return Array.isArray(d) ? d : [];
  },
  async upsertStockTransaction(tx) {
    const row = {
      id: tx.id, date: tx.date, type: tx.type, product_id: tx.productId||"",
      product_name: tx.productName||"", qty: Number(tx.qty)||0,
      counter_id: tx.counterId||"", counter_name: tx.counterName||"",
      request_id: tx.requestId||null, notes: tx.notes||"", done_by: tx.doneBy||"",
    };
    return supabase.from("stock_transactions").upsert(row);
  },
  async getStockRequests() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stock_requests?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const d = await r.json(); return Array.isArray(d) ? d : [];
  },
  async upsertStockRequest(req) {
    const row = {
      id: req.id, date: req.date, counter_id: req.counterId||"",
      counter_name: req.counterName||"", requested_by: req.requestedBy||"",
      requested_by_name: req.requestedByName||"",
      items: JSON.stringify(req.items||[]),
      status: req.status||"pending", notes: req.notes||"",
      approved_by: req.approvedBy||null, approved_at: req.approvedAt||null,
    };
    const res = await supabase.from("stock_requests").upsert(row);
    if (res&&res.code) console.error("upsertStockRequest failed:", res.message);
    return res;
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
      counter: u.counter||"",
      status: u.status||null,
      resigned_on: u.resignedOn||null,
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
      supervisor_ids: JSON.stringify(c.supervisorIds||[c.supervisorId].filter(Boolean)),
      dealership: c.dealership||"",
      city: c.city||""
    }));
    // Try with supervisor_ids column, fallback without it
    const result = await supabase.from("app_counters").upsert(rows);
    if (result && result.code) {
      const fallback = rows.map(({supervisor_ids,...r})=>r);
      return supabase.from("app_counters").upsert(fallback);
    }
    return result;
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/planned_leaves?select=*`, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  },
  async upsertPlannedLeave(leave) {
    const row = {
      id: leave.id, user_id: leave.userId, staff_name: leave.staffName,
      supervisor_id: leave.supervisorId, approver_id: leave.approverId||"",
      from_date: leave.fromDate, to_date: leave.toDate,
      reason: leave.reason, status: leave.status,
      applied_on: leave.appliedOn, applied_by: leave.appliedBy||leave.userId,
      decided_on: leave.decidedOn||null, decided_by: leave.decidedBy||null
    };
    const res = await supabase.from("planned_leaves").upsert(row);
    if (res && res.code) console.error("upsertPlannedLeave failed:", res);
    return res;
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
      const [reports, attendance, leaves, feedback, salaries, collReports, config, dbCounters, dbWorkTypes, plannedLeaves, dbInventory, dbStockTx, dbStockReqs] = await Promise.all([
        DB.getReports(), DB.getAttendance(), DB.getLeaves(), DB.getFeedback(),
        DB.getSalaries(), DB.getCollectionReports(), DB.getConfig(),
        DB.getCounters(), DB.getWorkTypes(), DB.getPlannedLeaves(), DB.getInventory(), DB.getStockTransactions(), DB.getStockRequests()
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
            managerId: u.manager_id||u.managerId||null, counter: u.counter||"",
            status: u.status||undefined,
            resignedOn: u.resigned_on||u.resignedOn||undefined
          }))
        : null;

      // Map counters from DB
      const mappedCounters = Array.isArray(dbCounters) && dbCounters.length > 0
        ? dbCounters.map(c => {
            let supervisorIds = [];
            try { supervisorIds = c.supervisor_ids ? JSON.parse(c.supervisor_ids) : []; } catch(e) {}
            if (!supervisorIds.length && c.supervisor_id) supervisorIds = [c.supervisor_id];
            return {
              id: c.id, name: c.name,
              supervisorId: c.supervisor_id||c.supervisorId||supervisorIds[0]||null,
              supervisorIds,
              dealership: c.dealership||"", city: c.city||""
            };
          })
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
        users:     (mappedUsers && mappedUsers.length > 0) ? mappedUsers : p.users,
        passwords: pwdObj && Object.keys(pwdObj).length > 0 ? pwdObj : p.passwords,
        counters:  mappedCounters  || p.counters,
        workTypes: mappedWorkTypes || p.workTypes,
        inventory: Array.isArray(dbInventory) && dbInventory.length>0 ? dbInventory.map(i=>({
          id: i.id, productId: i.product_id||i.id, productName: i.product_name||"",
          unit: i.unit||"pcs", currentStock: Number(i.current_stock)||0,
          minStock: Number(i.min_stock)||0, lastUpdated: i.last_updated||"", updatedBy: i.updated_by||"",
        })) : p.inventory,
        stockTransactions: Array.isArray(dbStockTx) && dbStockTx.length>0 ? dbStockTx.map(t=>({
          id: t.id, date: t.date, type: t.type, productId: t.product_id||"",
          productName: t.product_name||"", qty: Number(t.qty)||0,
          counterId: t.counter_id||"", counterName: t.counter_name||"",
          requestId: t.request_id||null, notes: t.notes||"", doneBy: t.done_by||"",
        })) : p.stockTransactions,
        stockRequests: Array.isArray(dbStockReqs) && dbStockReqs.length>0 ? dbStockReqs.map(r=>{
          let items=[]; try{items=JSON.parse(r.items||"[]");}catch(e){}
          return {
            id: r.id, date: r.date, counterId: r.counter_id||"", counterName: r.counter_name||"",
            requestedBy: r.requested_by||"", requestedByName: r.requested_by_name||"",
            items, status: r.status||"pending", notes: r.notes||"",
            approvedBy: r.approved_by||null, approvedAt: r.approved_at||null,
          };
        }) : p.stockRequests,
        plannedLeaves: Array.isArray(plannedLeaves) && plannedLeaves.length > 0 ? plannedLeaves.map(l=>({
          id: l.id,
          userId: l.user_id||l.userId,
          staffName: l.staff_name||l.staffName||"",
          supervisorId: l.supervisor_id||l.supervisorId,
          approverId: l.approver_id||l.approverId||"",
          fromDate: l.from_date||l.fromDate,
          toDate: l.to_date||l.toDate,
          reason: l.reason||"",
          status: l.status||"pending",
          appliedOn: l.applied_on||l.appliedOn,
          appliedBy: l.applied_by||l.appliedBy,
          decidedOn: l.decided_on||l.decidedOn,
          decidedBy: l.decided_by||l.decidedBy,
        })) : p.plannedLeaves,
        serviceReports:    reports.map(mapReport),
        attendance:        Array.isArray(attendance) && attendance.length > 0 ? attendance.map(mapAtt) : p.attendance,
        leaves: Array.isArray(leaves) && leaves.length > 0 ? leaves.map(l=>({
          id: l.id,
          userId: l.user_id||l.userId,
          role: l.role||"",
          date: l.date,
          toDate: l.to_date||l.toDate,
          type: l.type||"other",
          reason: l.reason||"",
          status: l.status||"pending",
          approverId: l.approver_id||l.approverId,
          submittedAt: l.submitted_at||l.submittedAt,
          decidedAt: l.decided_at||l.decidedAt,
        })) : p.leaves,
        feedback: Array.isArray(feedback) && feedback.length > 0 ? feedback.map(f=>({
          id: f.id,
          type: f.type||"customer",
          category: f.category||"general",
          date: f.date||"",
          counterId:   f.counter_id||f.counterId||"",
          counterName: f.counter_name||f.counterName||"",
          userId:   f.user_id||f.userId||null,
          userName: f.user_name||f.userName||"",
          role: f.role||"",
          message:  f.message||f.comment||"",
          rating:   f.rating||null,
          comment:  f.comment||f.message||"",
          status:   f.status||"unread",
          readAt:   f.read_at||f.readAt||null,
          submittedAt: f.submitted_at||f.submittedAt||"",
        })) : p.feedback,
        salaries:          Array.isArray(salaries)    ? salaries    : p.salaries,
        collectionReports: Array.isArray(collReports) && collReports.length > 0 ? collReports.map(r=>{
          // Parse from notes JSON blob (primary) or direct columns (fallback)
          let parsed = {};
          try { parsed = r.notes ? JSON.parse(r.notes) : {}; } catch(e) {}
          const bankEntries = parsed.bankEntries || (typeof r.bank_entries==="string" ? JSON.parse(r.bank_entries||"[]") : (r.bank_entries||[]));
          const expenses    = parsed.expenses || (typeof r.expenses==="string" ? JSON.parse(r.expenses||"[]") : (r.expenses||[]));
          return {
          id: r.id, date: r.date,
          supervisorId: r.supervisor_id || r.supervisorId,
          bankEntries, expenses,
        notes: r.notes || "",
        totalBank: parsed.totalBank || r.total_bank || 0,
        totalExpenses: parsed.totalExp || r.total_expenses || 0,
        netCollection: (parsed.totalBank||0) - (parsed.totalExp||0) || r.net_collection || 0,
          };
        }) : p.collectionReports,
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
  grn:     "#16A34A",
  grnL:    "#DCFCE7",
  lime:    "#84CC16",
  limeL:   "#F7FEE7",
  limeD:   "#4D7C0F",
  present: "#84CC16",
  presentL:"#F0FDF4",
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
  inventory: [],
  stockTransactions: [],
  stockRequests: [],
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
  const [sideOpen, setSideOpen]       = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (g) => setCollapsedGroups(p=>({...p,[g]:!p[g]}));

  // Group navItems by their `group` field; ungrouped items render flat
  const grouped = [];
  const seen = new Set();
  navItems.forEach(item => {
    if (!item.group) {
      grouped.push({type:'item', item});
    } else if (!seen.has(item.group)) {
      seen.add(item.group);
      grouped.push({type:'group', group:item.group, groupIcon:item.groupIcon||'📁',
        items: navItems.filter(i=>i.group===item.group)});
    }
  });

  const NavBtn = ({item, indent=false}) => (
    <button key={item.id} onClick={()=>setActivePage(item.id)} style={{
      display:"flex", alignItems:"center", gap:10, width:"100%",
      padding:indent?"7px 10px 7px 28px":"9px 10px",
      borderRadius:8, border:"none",
      background:activePage===item.id?"rgba(232,160,32,.2)":"transparent",
      color:activePage===item.id?T.amber:"rgba(255,255,255,.7)",
      fontFamily:"inherit", fontSize:indent?12:13, fontWeight:activePage===item.id?700:500,
      cursor:"pointer", marginBottom:2, transition:"all .15s", textAlign:"left"
    }}>
      <span style={{fontSize:indent?13:16,flexShrink:0}}>{item.icon}</span>
      {sideOpen && <span>{item.label}</span>}
    </button>
  );

  return (
    <div style={{display:"flex",minHeight:"100vh",background:T.surf,fontFamily:"'Segoe UI',system-ui,sans-serif",color:T.txt}}>
      {/* Sidebar */}
      <div style={{width:sideOpen?220:60,background:T.navy,flexShrink:0,display:"flex",flexDirection:"column",transition:"width .2s",overflow:"hidden"}}>
        {/* Brand */}
        <div style={{padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,background:T.amber,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✨</div>
            {sideOpen && <div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>Benaka Enterprises</div><div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>Operations</div></div>}
          </div>
        </div>

        {/* Nav */}
        <div style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
          {grouped.map((entry,ei) => {
            if (entry.type==="item") return <NavBtn key={entry.item.id} item={entry.item}/>;
            const isOpen = !collapsedGroups[entry.group];
            const hasActive = entry.items.some(i=>i.id===activePage);
            return (
              <div key={entry.group} style={{marginBottom:2}}>
                {/* Group header */}
                <button onClick={()=>sideOpen&&toggleGroup(entry.group)} style={{
                  display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",
                  borderRadius:8,border:"none",
                  background:hasActive?"rgba(232,160,32,.15)":"transparent",
                  color:hasActive?T.amber:"rgba(255,255,255,.6)",
                  fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",
                  textAlign:"left",transition:"all .15s",textTransform:"uppercase",letterSpacing:".04em"
                }}>
                  <span style={{fontSize:14,flexShrink:0}}>{entry.groupIcon}</span>
                  {sideOpen && <>
                    <span style={{flex:1}}>{entry.group}</span>
                    <span style={{fontSize:10,opacity:.7}}>{isOpen?"▲":"▼"}</span>
                  </>}
                </button>
                {/* Group items */}
                {(isOpen||!sideOpen) && entry.items.map(item=>(
                  <NavBtn key={item.id} item={item} indent={sideOpen}/>
                ))}
              </div>
            );
          })}
        </div>

        {/* User info & logout */}
        <div style={{padding:"12px",borderTop:"1px solid rgba(255,255,255,.1)"}}>
          {sideOpen && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>{ROLE_LABELS[user.role]||user.role} · {user.empId}</div>
              {syncStatus&&<div style={{fontSize:9,color:syncStatus==="synced"?"#86efac":"rgba(255,255,255,.4)",marginTop:2}}>{syncStatus==="synced"?"● Synced":"● Syncing..."}</div>}
            </div>
          )}
          <button onClick={()=>setSideOpen(p=>!p)} style={{
            display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 8px",borderRadius:6,
            border:"none",background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",
            fontFamily:"inherit",fontSize:12,cursor:"pointer",marginBottom:6
          }}>{sideOpen?"◀ Collapse":"▶"}</button>
          <button onClick={onLogout} style={{
            display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 8px",borderRadius:6,
            border:"none",background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",
            fontFamily:"inherit",fontSize:12,cursor:"pointer"
          }}>
            <span>🚪</span>{sideOpen&&<span>Sign out</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto",padding:"0 0 40px 0"}}>
        {children}
      </div>
    </div>
  );
}


function SupervisorPortal({ user, state, setState, toast, syncStatus="" }) {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"dashboard", icon:"🏠", label:"Dashboard" },
    { id:"report", icon:"📋", label:"Daily Report", group:"Reports", groupIcon:"📋" },
    { id:"collection", icon:"📊", label:"Collection Report", group:"Reports", groupIcon:"📋" },
    { id:"analysis", icon:"📈", label:"Analysis", group:"Reports", groupIcon:"📋" },
    { id:"history", icon:"📁", label:"Report History", group:"Reports", groupIcon:"📋" },
    { id:"attendance", icon:"👥", label:"Mark Attendance", group:"Attendance", groupIcon:"🗓️" },
    { id:"staffleaves", icon:"🗓️", label:"Staff Leaves", group:"Attendance", groupIcon:"🗓️" },
    { id:"myleaves", icon:"🌿", label:"My Leave", group:"Attendance", groupIcon:"🗓️" },
    { id:"stockrequest", icon:"📦", label:"Request Stock", group:"Inventory", groupIcon:"📦" },
    { id:"counternotes", icon:"📝", label:"Daily Note" },
    { id:"feedback", icon:"⭐", label:"Customer Feedback" },
    { id:"directory", icon:"👤", label:"Staff Directory" },
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
      {page==="counternotes" && <DailyNotePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockrequest"  && <StockRequest user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockcheckin"  && <StockCheckin user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockapproval" && <StockRequestsApproval user={user} state={state} setState={setState} toast={toast}/>}
      {page==="inventory"     && <InventoryDashboard user={user} state={state} setState={setState} toast={toast}/>}
      {page==="history"     && <SupHistory user={user} state={state}/>}
      {page==="feedback"    && <SupFeedback user={user} state={state}/>}
      {page==="collection"  && <SupCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"    && <CounterAnalysis user={user} state={state} myCounterIds={state.counters.filter(c=>c.supervisorId===user.id||(c.supervisorIds||[]).includes(user.id)).map(c=>c.id)}/>}
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
                {att ? <Badge color={att.status==="present"?T.lime:T.red}>{att.status}</Badge> : <Badge color={T.txt3}>Not marked</Badge>}
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
                <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 250px 1fr", gap:8, alignItems:"center", marginBottom:8,
                  background:curStatus==="present"?"#ECFCCB":curStatus==="absent"?T.redL:curStatus==="half_day"?T.amberL:T.surf,
                  padding:"8px 10px", borderRadius:8,
                  borderLeft:`4px solid ${curStatus==="present"?T.lime:curStatus==="absent"?T.red:curStatus==="half_day"?T.amber:T.bdrS}`,
                  transition:"all 0.2s" }}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700}}>{s.name}{s.id===user.id&&<Badge color={T.navy} style={{marginLeft:6}}>You</Badge>}</div>
                    {!curStatus && <div style={{fontSize:10,color:T.txt3,marginTop:1}}>Not marked yet</div>}
                    {curStatus && <div style={{fontSize:11,color:curStatus==="present"?"#fff":curStatus==="absent"?T.red:T.amberD,marginTop:1,fontWeight:800,
                      background:curStatus==="present"?T.lime:"transparent",
                      padding:curStatus==="present"?"1px 6px":"0",borderRadius:10,display:"inline-block"}}>
                      {curStatus==="present"?"✓ Present":curStatus==="absent"?"✗ Absent":"◑ Half Day"}
                    </div>}
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    {["present","absent","half_day"].map(status => {
                      const active = curStatus===status;
                      return (
                        <button key={status} onClick={()=>setStatus(s.id, status)} style={{
                          padding:"5px 10px", borderRadius:6,
                          border:`1px solid ${active?(status==="present"?T.lime:status==="absent"?T.red:T.amber):T.bdrS}`,
                          background:active?(status==="present"?T.lime:status==="absent"?T.redL:T.amberL):"transparent",
                          color:active?(status==="present"?"#fff":status==="absent"?T.red:T.amberD):T.txt2,
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
                {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.lime:r.status==="half_day"?T.amber:T.red}>{r.status}</Badge>},
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
  const [to, setTo]     = useState(today());
  const [type, setType] = useState("sick");
  const [reason, setReason] = useState("");
  const myLeaves = (state.leaves||[]).filter(l=>l.userId===user.id).sort((a,b)=>(b.submittedAt||b.date||"").localeCompare(a.submittedAt||a.date||""));
  const manager = state.users.find(u=>u.id===user.managerId);

  const submit = async () => {
    if (!reason.trim()) { toast.show("Please provide a reason","error"); return; }
    if (!manager) { toast.show("No manager assigned — contact IT Admin","error"); return; }
    // Prevent overlapping leave requests
    const overlap = myLeaves.find(l=>{
      if (l.status==="rejected") return false;
      const lFrom = l.date||l.fromDate||"";
      const lTo   = l.toDate||lFrom;
      return from<=lTo && to>=lFrom;
    });
    if (overlap) { toast.show("You already have a leave ("+overlap.status+") for these dates","error"); return; }
    const leave = {
      id: `l_${user.id}_${from}_${Date.now()}`,
      userId: user.id,
      role: user.role,
      date: from,
      toDate: to,
      type,
      reason,
      status: "pending",
      approverId: manager.id,
      submittedAt: new Date().toISOString(),
      decidedAt: null,
    };
    // Write to state immediately
    setState(p=>({...p, leaves:[...(p.leaves||[]), leave]}));
    // Write to DB
    try {
      const result = await DB.upsertLeave(leave);
      if (result && result.code) {
        console.error("DB leave error:", result);
        toast.show("Leave saved locally. Will sync when connection restored.");
      } else {
        toast.show("Leave request submitted to " + manager.name + " ✅");
      }
    } catch(e) {
      console.error("Leave save error:", e);
      toast.show("Leave saved locally ✅");
    }
    setReason("");
  };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>My Leave Requests</div>
      {!manager && (
        <div style={{background:T.redL,border:"1px solid "+T.red,borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:T.red}}>
          ⚠ No manager assigned to your account. Contact IT Admin.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Apply Leave</div>
          {manager && <div style={{fontSize:12,color:T.txt2,marginBottom:12}}>Approver: <b>{manager.name}</b></div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <Input label="From Date" type="date" value={from} onChange={v=>{setFrom(v);if(v>to)setTo(v);}}/>
            <Input label="To Date"   type="date" value={to}   onChange={v=>{setTo(v);if(v<from)setFrom(v);}}/>
          </div>
          {from!==to&&<div style={{fontSize:12,color:T.navy,fontWeight:600,marginBottom:8}}>
            Duration: {Math.max(1,Math.round((new Date(to)-new Date(from))/86400000)+1)} days
          </div>}
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Leave Type</label>
            <select value={type} onChange={e=>setType(e.target.value)}
              style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value="sick">Sick Leave</option>
              <option value="casual">Casual Leave</option>
              <option value="earned">Earned Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Reason</label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Please provide a reason..."
              style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
          </div>
          <Btn onClick={submit} variant="amber" disabled={!manager}>Submit Leave Request</Btn>
        </Card>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>My Requests ({myLeaves.length})</div>
          {myLeaves.length===0 && <div style={{color:T.txt3,fontSize:13}}>No leave requests yet</div>}
          {myLeaves.map(l=>(
            <div key={l.id} style={{borderBottom:"1px solid "+T.bdr,paddingBottom:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>
                {fmtDate(l.date||l.fromDate||"")}
                {(()=>{const t=l.toDate||(l.date);const f=l.date||l.fromDate||"";const d=f&&t?Math.max(1,Math.round((new Date(t)-new Date(f))/86400000)+1):1;return t&&t!==f?<span> → {fmtDate(t)} <span style={{fontSize:11,background:T.navyXL,color:T.navy,padding:"1px 6px",borderRadius:10,marginLeft:4}}>{d}d</span></span>:<span style={{fontSize:11,background:T.navyXL,color:T.navy,padding:"1px 6px",borderRadius:10,marginLeft:4}}>{d}d</span>;})()}
              </div>
                  <div style={{fontSize:12,color:T.txt2,marginTop:2}}>{l.type} · {l.reason}</div>
                </div>
                <Badge color={l.status==="approved"?T.grn:l.status==="rejected"?T.red:T.amber}>
                  {l.status}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}


function ManagerPortal({ user, state, setState, toast, syncFromCloud, syncStatus="" }) {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"dashboard", icon:"🏠", label:"Dashboard" },
    { id:"collection", icon:"📊", label:"Collection Report", group:"Collection", groupIcon:"💰" },
    { id:"colldash", icon:"🏦", label:"Collection Dashboard", group:"Collection", groupIcon:"💰" },
    { id:"reports", icon:"📋", label:"Reports", group:"Reports", groupIcon:"📋" },
    { id:"targetreport", icon:"🎯", label:"Target Report", group:"Reports", groupIcon:"📋" },
    { id:"execreport", icon:"📄", label:"MD Report", group:"Reports", groupIcon:"📋" },
    { id:"financial", icon:"💹", label:"Financial Trends", group:"Reports", groupIcon:"📋" },
    { id:"operations", icon:"🏪", label:"Operations", group:"Reports", groupIcon:"📋" },
    { id:"analysis", icon:"📈", label:"Counter Analysis", group:"Reports", groupIcon:"📋" },
    { id:"attendance", icon:"🗓️", label:"All Attendance", group:"Attendance", groupIcon:"🗓️" },
    { id:"leaves", icon:"✅", label:"Leave Approvals", group:"Attendance", groupIcon:"🗓️" },
    { id:"myleaves", icon:"🌿", label:"My Leave", group:"Attendance", groupIcon:"🗓️" },
    { id:"stockcheckin", icon:"🏭", label:"Godown Check-in", group:"Inventory", groupIcon:"📦" },
    { id:"stockapproval", icon:"📦", label:"Stock Requests", group:"Inventory", groupIcon:"📦" },
    { id:"inventory", icon:"📊", label:"Inventory", group:"Inventory", groupIcon:"📦" },
    { id:"people", icon:"👥", label:"People & Counters", group:"Team", groupIcon:"👥" },
    { id:"staffnotes", icon:"📝", label:"Staff Notes", group:"Team", groupIcon:"👥" },
    { id:"targets", icon:"🎯", label:"Set Targets", group:"Team", groupIcon:"👥" },
    { id:"salary", icon:"💰", label:"Salary & P&L", group:"Team", groupIcon:"👥" },
    { id:"feedback", icon:"💬", label:"Feedback", group:"Team", groupIcon:"👥" },
    { id:"directory", icon:"👤", label:"Staff Directory", group:"Team", groupIcon:"👥" },
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
      {page==="targetreport" && <TargetFulfillmentReport user={user} state={state}/>}
      {page==="leaves"    && <MgrLeaves user={user} state={state} setState={setState} toast={toast} syncFromCloud={syncFromCloud}/>}
      {page==="people"    && <MgrPeople user={user} state={state} setState={setState} toast={toast}/>}
      
      {page==="feedback"   && <MgrFeedback user={user} state={state} myCounters={myCounters}/>}
      {page==="staffnotes" && <StaffNotesViewer user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockcheckin"  && <StockCheckin user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockapproval" && <StockRequestsApproval user={user} state={state} setState={setState} toast={toast}/>}
      {page==="inventory"     && <InventoryDashboard user={user} state={state} setState={setState} toast={toast}/>}
      {page==="collection" && <MgrCollectionReport user={user} state={state} setState={setState} toast={toast} mySupervisors={mySupervisors} myCounters={myCounters}/>}
      {page==="colldash"   && <CollectionDashboard state={state} user={user}/>}
      {page==="myleaves"   && <LeavePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="execreport" && <ExecutiveReportGenerator state={state}/>}
      {page==="collection" && <MgrCollectionReport user={user} state={state} setState={setState} toast={toast} mySupervisors={mySupervisors} myCounters={myCounters}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state}/>}
      {page==="colldash"   && <CollectionDashboard state={state} user={user} isAdmin/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="attendance"  && <MDAttendance state={state}/>}
      {page==="financial"   && <MDFinancial  state={state}/>}
      {page==="operations"  && <MDOperations state={state}/>}
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
  const pendingLeaves = (
    (state.leaves||[]).filter(l=>l.approverId===user.id&&l.status==="pending").length +
    (state.plannedLeaves||[]).filter(l=>{
      const mySupIds2 = mySupervisors.map(s=>s.id);
      return (l.approverId===user.id||mySupIds2.includes(l.supervisorId)||mySupIds2.includes(l.userId))&&l.status==="pending";
    }).length
  );
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

      {/* Collection & Sales Summary */}
      {(() => {
        const todayDate = today_;
        const monthPfx  = todayDate.slice(0,7);
        const todayColRep = (state.collectionReports||[]).find(r=>r.date===todayDate);
        const todayBank = (todayColRep?.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0);
        const todayExp  = (todayColRep?.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        const OFFICE_ID = state.counters.find(c=>c.name==="OFFICE")?.id||"c1";
        const salesToday = state.serviceReports.filter(r=>r.date===todayDate&&(r.counterId===OFFICE_ID||r.counterName==="OFFICE"));
        const getE = r=>r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
        const todayBardahl = salesToday.flatMap(getE).filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const todayOther   = salesToday.flatMap(getE).filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const hasColl  = todayBank>0||todayExp>0;
        const hasSales = todayBardahl>0||todayOther>0;
        if (!hasColl && !hasSales) return null;
        return (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:16}}>
            {hasColl && (
              <Card style={{borderTop:"3px solid "+T.navy}}>
                <div style={{fontSize:13,fontWeight:800,color:T.navy,marginBottom:10}}>💰 Today's Collection</div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1,background:T.navyXL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.txt2}}>Bank In</div>
                    <div style={{fontSize:15,fontWeight:800,color:T.navy}}>{fmtCurr(todayBank)}</div>
                  </div>
                  <div style={{flex:1,background:T.redL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.red}}>Expenses</div>
                    <div style={{fontSize:15,fontWeight:800,color:T.red}}>{fmtCurr(todayExp)}</div>
                  </div>
                  <div style={{flex:1,background:todayBank-todayExp>=0?T.grnL:T.redL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:todayBank-todayExp>=0?T.grn:T.red}}>Net</div>
                    <div style={{fontSize:15,fontWeight:800,color:todayBank-todayExp>=0?T.grn:T.red}}>{fmtCurr(todayBank-todayExp)}</div>
                  </div>
                </div>
              </Card>
            )}
            {hasSales && (
              <Card style={{borderTop:"3px solid #15803D"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#15803D",marginBottom:10}}>🛢 Company Sales Today</div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1,background:"#F0FDF4",borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#15803D"}}>Bardahl</div>
                    <div style={{fontSize:15,fontWeight:800,color:"#15803D"}}>{fmtCurr(todayBardahl)}</div>
                  </div>
                  <div style={{flex:1,background:"#EFF6FF",borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#0369A1"}}>Other</div>
                    <div style={{fontSize:15,fontWeight:800,color:"#0369A1"}}>{fmtCurr(todayOther)}</div>
                  </div>
                  <div style={{flex:1,background:T.amberL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.amberD}}>Total</div>
                    <div style={{fontSize:15,fontWeight:800,color:T.amber}}>{fmtCurr(todayBardahl+todayOther)}</div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        );
      })()}
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


function MgrLeaves({ user, state, setState, toast, syncFromCloud=null }) {
  // Unify state.leaves and state.plannedLeaves into one view
  const mySupIds = state.users.filter(u=>u.managerId===user.id).map(u=>u.id);

  // From state.leaves (old system)
  const pendingOld = (state.leaves||[]).filter(l=>l.approverId===user.id&&l.status==="pending");
  const allOld     = (state.leaves||[]).filter(l=>l.approverId===user.id);

  // From state.plannedLeaves (new system via PlannedLeavePortal)
  const pendingNew = (state.plannedLeaves||[]).filter(l=> {
    if (l.status!=="pending") return false;
    if (l.approverId===user.id) return true;
    if (mySupIds.includes(l.supervisorId)) return true;
    if (mySupIds.includes(l.userId)) return true;
    // Also match if the staff member reports to one of my supervisors
    const staffUser = state.users.find(u=>u.id===l.userId);
    if (staffUser?.managerId===user.id) return true;
    return false;
  });
  const allNew     = (state.plannedLeaves||[]).filter(l=>
    l.approverId===user.id || mySupIds.includes(l.supervisorId) || mySupIds.includes(l.userId)
  );

  const autoMarkLeave = (leave, st) => {
    if (st!=="approved") return;
    const from = leave.date||leave.fromDate||"";
    const to   = leave.toDate||from;
    if (!from) return;
    // Generate date range
    const dates = [];
    const cur = new Date(from+"T00:00:00");
    const end = new Date(to+"T00:00:00");
    while (cur<=end && dates.length<60) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate()+1);
    }
    const userId = leave.userId||leave.user_id||"";
    const staffUser = state.users.find(u=>u.id===userId);
    if (!staffUser) return;
    // Find their supervisor
    const supId = staffUser.managerId||"";
    const newAtts = dates.map(date=>({
      id:`att_${supId}_${userId}_${date}`,
      date, supervisorId:supId, staffId:userId,
      status:"absent", reason:`Approved leave: ${leave.reason||leave.type||""}`,
      markedAt:"auto"
    }));
    setState(p=>({...p, attendance:[
      ...p.attendance.filter(a=>!(a.staffId===userId&&dates.includes(a.date))),
      ...newAtts
    ]}));
    DB.upsertAttendance(newAtts).catch(console.error);
  };

  const decideOld = (id, status) => {
    const updated = (state.leaves||[]).map(l=>l.id===id?{...l,status,decidedAt:today(),decidedBy:user.id}:l);
    setState(p=>({...p, leaves:updated}));
    const leave = updated.find(l=>l.id===id);
    if (leave) {
      DB.upsertLeave(leave).catch(console.error);
      if (status==="approved") autoMarkLeave(leave, status);
    }
    const applicant = state.users.find(u=>u.id===leave?.userId);
    toast.show(status==="approved"
      ? `✅ Leave approved for ${applicant?.name||"staff"}${status==="approved"?" — attendance auto-marked":""}`
      : `❌ Leave rejected for ${applicant?.name||"staff"}`
    );
  };

  const decideNew = (id, status) => {
    const updated = (state.plannedLeaves||[]).map(l=>l.id===id?{...l,status,decidedOn:today(),decidedBy:user.id}:l);
    setState(p=>({...p, plannedLeaves:updated}));
    const leave = updated.find(l=>l.id===id);
    if (leave) {
      DB.upsertPlannedLeave(leave).catch(console.error);
      if (status==="approved") autoMarkLeave({...leave, date:leave.fromDate, toDate:leave.toDate}, status);
    }
    const applicant = state.users.find(u=>u.id===leave?.userId);
    toast.show(status==="approved"
      ? `✅ Leave approved for ${applicant?.name||"staff"} — attendance auto-marked absent`
      : `❌ Leave rejected for ${applicant?.name||"staff"}`
    );
  };

  const totalPending = pendingOld.length + pendingNew.length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontSize:18,fontWeight:800}}>Leave Approvals</div>
      {syncFromCloud && <Btn onClick={syncFromCloud} size="sm" variant="outline">🔄 Refresh</Btn>}
    </div>

      {totalPending === 0 && (
        <Card><div style={{textAlign:"center",padding:20,color:T.grn}}>✅ No pending approvals</div></Card>
      )}

      {pendingNew.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:T.red}}>⏳ Pending ({pendingNew.length})</div>
          {pendingNew.map(l=>{
            const applicant = state.users.find(u=>u.id===l.userId);
            return (
              <Card key={l.id} style={{marginBottom:12,borderLeft:"4px solid "+T.amber}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700}}>{l.staffName||applicant?.name||"—"}</div>
                    <div style={{fontSize:12,color:T.txt2,marginTop:2}}>
                      <b style={{color:T.navy}}>{fmtDate(l.fromDate||l.from_date||"")}</b>
                      {(l.toDate||l.to_date)!==(l.fromDate||l.from_date)&&<span> → <b style={{color:T.navy}}>{fmtDate(l.toDate||l.to_date||"")}</b></span>}
                      {(()=>{const f=l.fromDate||l.from_date||"",t=l.toDate||l.to_date||f;const d=f&&t?Math.max(1,Math.round((new Date(t)-new Date(f))/86400000)+1):1;return <span style={{background:T.navyXL,color:T.navy,padding:"1px 8px",borderRadius:20,fontSize:11,fontWeight:700,marginLeft:6}}>{d} day{d!==1?"s":""}</span>;})()}
                    </div>
                    <div style={{fontSize:13,marginTop:4}}>{l.reason}</div>
                    <div style={{fontSize:11,color:T.txt3}}>Applied: {fmtDate(l.appliedOn)}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Btn onClick={()=>decideNew(l.id,"approved")} variant="success" size="sm">✅ Approve</Btn>
                    <Btn onClick={()=>decideNew(l.id,"rejected")} variant="danger" size="sm">❌ Reject</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pendingOld.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:T.amber}}>Legacy Requests ({pendingOld.length})</div>
          {pendingOld.map(l=>{
            const applicant = state.users.find(u=>u.id===l.userId);
            const fromD = l.date||l.fromDate||"";
            const toD   = l.toDate||fromD;
            const days  = fromD&&toD?Math.max(1,Math.round((new Date(toD)-new Date(fromD))/86400000)+1):1;
            return (
              <Card key={l.id} style={{marginBottom:10,borderLeft:"3px solid "+T.bdrS}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>{applicant?.name||l.userId}</div>
                    <div style={{fontSize:12,color:T.txt2,marginTop:2}}>
                      <b style={{color:T.navy}}>{fmtDate(fromD)}</b>
                      {toD!==fromD&&<span> → <b style={{color:T.navy}}>{fmtDate(toD)}</b></span>}
                      <span style={{background:T.navyXL,color:T.navy,padding:"1px 8px",borderRadius:20,fontSize:11,fontWeight:700,marginLeft:6}}>{days} day{days!==1?"s":""}</span>
                      {l.type&&<span style={{background:T.amberL,color:T.amberD,padding:"1px 8px",borderRadius:20,fontSize:11,marginLeft:4}}>{l.type}</span>}
                    </div>
                    <div style={{fontSize:13,marginTop:4}}>{l.reason}</div>
                    <div style={{fontSize:11,color:T.txt3}}>Applied: {fmtDate(l.submittedAt?.split?.("T")[0]||"")}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Btn onClick={()=>decideOld(l.id,"approved")} variant="success" size="sm">✅ Approve</Btn>
                    <Btn onClick={()=>decideOld(l.id,"rejected")} variant="danger"  size="sm">❌ Reject</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* All leaves history */}
      {allNew.length > 0 && (
        <>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>All Leave Requests</div>
          <Table cols={[
            {key:"name",label:"Staff",render:r=>r.staffName||state.users.find(u=>u.id===r.userId)?.name||"—"},
            {key:"fromDate",label:"From",render:r=>fmtDate(r.fromDate)},
            {key:"toDate",label:"To",render:r=>fmtDate(r.toDate)},
            {key:"reason",label:"Reason"},
            {key:"status",label:"Status",render:r=><Badge color={r.status==="approved"?T.grn:r.status==="rejected"?T.red:T.amber}>{r.status}</Badge>},
          ]} rows={[...allNew].sort((a,b)=>(b.appliedOn||"").localeCompare(a.appliedOn||""))}/>
        </>
      )}
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

function MDTargets({ user, state, setState, toast }) {
  const [selPeriod, setSelPeriod] = useState("monthly");
  const [selRef,    setSelRef]    = useState(today().slice(0,7));
  const [viewMode,  setViewMode]  = useState("counter"); // counter | executive | manager
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState({ daily:"", weekly:"", monthly:"", quarterly:"", yearly:"" });

  const periods = [
    { id:"daily",     label:"Daily",     inputType:"date"  },
    { id:"weekly",    label:"Weekly",    inputType:"week"  },
    { id:"monthly",   label:"Monthly",   inputType:"month" },
    { id:"quarterly", label:"Quarterly", inputType:"month" },
    { id:"yearly",    label:"Yearly",    inputType:"number"},
  ];

  const getTargetKey = (id) => `tgt_${id}_${selPeriod}_${selRef}`;
  const getActual = (supId) => {
    const reps = (state.serviceReports||[]).filter(r=>{
      if (selPeriod==="monthly") return r.date.startsWith(selRef) && r.supervisorId===supId;
      if (selPeriod==="daily")   return r.date===selRef && r.supervisorId===supId;
      return r.supervisorId===supId;
    });
    return reps.reduce((s,r)=>s+r.totalAmount,0);
  };

  const save = (targetId, supervisorId, counterId) => {
    const tgt = {
      id: getTargetKey(targetId),
      counterId, supervisorId,
      period:selPeriod, periodRef:selRef,
      month: selPeriod==="monthly"?selRef:today().slice(0,7),
      ...form,
      setBy: user.id, setAt: new Date().toISOString(),
    };
    const newTargets = [...(state.targets||[]).filter(t=>t.id!==tgt.id), tgt];
    setState(p=>({...p, targets:newTargets}));
    DB.upsertTargets && DB.upsertTargets(newTargets).catch(console.error);
    toast.show("Target saved ✅");
    setEditing(null);
  };

  const openEdit = (id, existing) => {
    setEditing(id);
    setForm({ daily:existing?.daily||"", weekly:existing?.weekly||"",
      monthly:existing?.monthly||"", quarterly:existing?.quarterly||"", yearly:existing?.yearly||"" });
  };

  // Build target subjects based on viewMode
  const subjects = viewMode==="counter"
    ? state.counters.filter(c=>c.name!=="OFFICE").map(c=>{
        const execs = state.users.filter(u=>u.supervisorId===c.id||(c.supervisorIds||[]).includes(u.id)||c.supervisorId===u.id);
        return { id:c.id, name:c.name, subtitle:execs.map(e=>e.name).join(", ")||"No exec", supervisorId:c.supervisorId||"", counterId:c.id };
      })
    : viewMode==="executive"
    ? state.users.filter(u=>u.role==="supervisor"&&u.active!==false).map(u=>{
        const ctr = state.counters.find(c=>c.supervisorId===u.id||(c.supervisorIds||[]).includes(u.id));
        return { id:u.id, name:u.name, subtitle:ctr?.name||"No counter", supervisorId:u.id, counterId:ctr?.id||"" };
      })
    : state.users.filter(u=>u.role==="manager"&&u.active!==false).map(u=>{
        const execs = state.users.filter(e=>e.role==="supervisor"&&e.managerId===u.id);
        return { id:u.id, name:u.name, subtitle:`${execs.length} executives`, supervisorId:u.id, counterId:"" };
      });

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Set Targets</div>

      {/* View mode toggle */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[["counter","🏪 By Counter"],["executive","👤 By Executive"],["manager","👔 By Manager"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setViewMode(id);setEditing(null);}} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(viewMode===id?T.navy:T.bdrS),
            background:viewMode===id?T.navy:"transparent",color:viewMode===id?"#fff":T.txt2
          }}>{label}</button>
        ))}
      </div>

      {/* Period selector */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {periods.map(p=>(
          <button key={p.id} onClick={()=>setSelPeriod(p.id)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(selPeriod===p.id?T.amber:T.bdrS),
            background:selPeriod===p.id?T.amber:"transparent",color:selPeriod===p.id?"#fff":T.txt2
          }}>{p.label}</button>
        ))}
      </div>

      {/* Reference period input */}
      <div style={{marginBottom:16}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>
          {selPeriod==="yearly"?"Year":"Period Reference"}
        </label>
        <input type={periods.find(p=>p.id===selPeriod)?.inputType||"month"}
          value={selRef} onChange={e=>setSelRef(e.target.value)}
          style={{padding:"7px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      </div>

      {/* Target cards */}
      {subjects.map(sub => {
        const existing = (state.targets||[]).find(t=>t.id===getTargetKey(sub.id));
        const targetVal = Number(existing?.[selPeriod]||existing?.monthly||0);
        const actual    = getActual(sub.supervisorId);
        const pct       = targetVal>0 ? Math.round(actual/targetVal*100) : 0;
        const isEditing = editing===sub.id;

        return (
          <Card key={sub.id} style={{marginBottom:10,borderLeft:`3px solid ${pct>=100?T.grn:pct>=75?T.amber:targetVal?T.red:T.bdrS}`}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:isEditing?14:0}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14}}>{sub.name}</div>
                <div style={{fontSize:12,color:T.txt2,marginTop:2}}>{sub.subtitle}</div>
                {targetVal>0 && (
                  <div style={{marginTop:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span>{fmtCurr(actual)} actual</span>
                      <span style={{fontWeight:700,color:pct>=100?T.grn:pct>=75?T.amber:T.red}}>{pct}%</span>
                    </div>
                    <div style={{height:6,background:T.surf,borderRadius:3}}>
                      <div style={{height:6,borderRadius:3,width:Math.min(pct,100)+"%",
                        background:pct>=100?T.grn:pct>=75?T.amber:T.red,transition:"width .3s"}}/>
                    </div>
                    <div style={{fontSize:11,color:T.txt2,marginTop:2}}>Target: {fmtCurr(targetVal)}</div>
                  </div>
                )}
                {!targetVal && <div style={{fontSize:11,color:T.txt3,marginTop:4}}>No target set</div>}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                <Btn onClick={()=>isEditing?setEditing(null):openEdit(sub.id,existing)} size="sm" variant={isEditing?"ghost":"outline"}>
                  {isEditing?"Cancel":"✏️ Set Target"}
                </Btn>
              </div>
            </div>

            {isEditing && (
              <div style={{borderTop:"1px solid "+T.bdr,paddingTop:12}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:12}}>
                  {periods.map(p=>(
                    <div key={p.id}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{p.label} Target (₹)</label>
                      <input type="number" value={form[p.id]||""} onChange={e=>setForm(f=>({...f,[p.id]:e.target.value}))}
                        placeholder="0"
                        style={{width:"100%",padding:"6px 8px",border:"1px solid "+(selPeriod===p.id?T.amber:T.bdrS),
                          borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box",
                          background:selPeriod===p.id?T.amberL:"transparent"}}/>
                    </div>
                  ))}
                </div>
                <Btn onClick={()=>save(sub.id, sub.supervisorId, sub.counterId)} variant="amber">💾 Save Target</Btn>
              </div>
            )}
          </Card>
        );
      })}

      {subjects.length===0 && <Card><div style={{textAlign:"center",padding:20,color:T.txt3}}>No {viewMode}s found</div></Card>}
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


function MDAttendance({ state }) {
  const [view, setView]         = useState("daily");   // daily | monthly
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]     = useState("");
  const [showUnmarked, setShowUnmarked] = useState(true);
  const dr = useDateRange("today");

  // ── MONTHLY view ────────────────────────────────────────────────
  const selMonth = dr.from.slice(0,7);  // "2026-09"
  const monthStart = selMonth+"-01";
  const monthEndDate = new Date(selMonth.split("-")[0], selMonth.split("-")[1], 0);
  // Count all days in month including Sundays (as user requested)
  const totalWorkingDays = monthEndDate.getDate();
  // Also count Sundays for reference
  const _sundaysInMonth = (() => {
    let count = 0;
    const d = new Date(monthStart+"T00:00:00");
    while (d.getMonth() === monthEndDate.getMonth() || (d.getMonth()===0&&monthEndDate.getMonth()===11)) {
      if (d.getDay()===0) count++;
      d.setDate(d.getDate()+1);
      if (d.getDate()===1 && d.getMonth()!==new Date(monthStart+"T00:00:00").getMonth()) break;
    }
    return count;
  })();

  const activeStaff = state.users.filter(u=>u.active!==false && u.role!=="it_admin");

  const monthlyRows = activeStaff.map(staff => {
    const monthLastDay = `${selMonth}-${String(monthEndDate.getDate()).padStart(2,"0")}`;
      const recs = (state.attendance||[]).filter(a=>
        a.staffId===staff.id && a.date>=monthStart && a.date<=monthLastDay
      );
    const present  = recs.filter(a=>a.status==="present").length;
    const absent   = recs.filter(a=>a.status==="absent").length;
    const halfDay  = recs.filter(a=>a.status==="half_day").length;
    const onLeave  = [...(state.leaves||[]),...(state.plannedLeaves||[])].filter(l=>{
      const uid  = l.userId||l.user_id;
      const from = l.fromDate||l.from_date||l.date||"";
      const to   = l.toDate||l.to_date||from;
      return uid===staff.id && l.status==="approved" && from<=monthStart.slice(0,7)+"-31" && to>=monthStart;
    }).length;
    const marked   = recs.length;
    const exec     = state.users.find(u=>u.id===staff.managerId);
    return { staff, exec, present, absent, halfDay, onLeave, marked, totalWorkingDays,
             pct: totalWorkingDays>0 ? Math.round((present+halfDay*0.5)/totalWorkingDays*100) : 0,
             effective: totalWorkingDays };
  }).filter(r=>
    !search || r.staff.name.toLowerCase().includes(search.toLowerCase()) ||
    r.exec?.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b)=>b.pct-a.pct);

  // ── DAILY view ──────────────────────────────────────────────────
  const dates = [];
  const cur = new Date(dr.from+"T00:00:00");
  const end = new Date(dr.to+"T00:00:00");
  while (cur <= end && dates.length < 60) {
    const y=cur.getFullYear(),m=String(cur.getMonth()+1).padStart(2,"0"),d=String(cur.getDate()).padStart(2,"0");
    dates.push(y+"-"+m+"-"+d);
    cur.setDate(cur.getDate()+1);
  }
  const allRows = [];
  dates.forEach(date => {
    activeStaff.forEach(staff => {
      const attRec = (state.attendance||[]).find(a=>a.staffId===staff.id&&a.date===date);
      const leave  = [...(state.leaves||[]),...(state.plannedLeaves||[])].find(l=>{
        const uid=l.userId||l.user_id; const from=l.fromDate||l.from_date||l.date||"";
        const to=l.toDate||l.to_date||from;
        return uid===staff.id && date>=from && date<=to;
      });
      const supervisor = state.users.find(u=>u.id===staff.managerId)||state.users.find(u=>u.id===attRec?.supervisorId);
      allRows.push({
        date, staffId:staff.id, staffName:staff.name, role:staff.role,
        supervisorName:supervisor?.name||"—",
        status:attRec?.status||(leave?.status==="approved"?"on_leave":"not_marked"),
        reason:attRec?.reason||(leave?`Leave (${leave.status}): ${leave.reason||""}`:""),
        leaveStatus:leave?.status||null, marked:!!attRec,
      });
    });
  });

  const filtered = allRows
    .filter(r=>filterStatus==="all"||r.status===filterStatus)
    .filter(r=>showUnmarked||r.marked||r.status==="on_leave")
    .filter(r=>!search||r.staffName.toLowerCase().includes(search.toLowerCase())||r.supervisorName.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.staffName.localeCompare(b.staffName));

  const statusColor = s=>({present:T.lime,absent:T.red,half_day:T.amber,on_leave:"#7C3AED",not_marked:T.txt3}[s]||T.txt2);
  const statusBg    = s=>({present:T.limeL,absent:T.redL,half_day:T.amberL,on_leave:"#EDE9FE",not_marked:T.surf}[s]||T.surf);
  const statusLabel = s=>({all:"All",present:"Present",absent:"Absent",half_day:"Half Day",on_leave:"On Leave",not_marked:"Not Marked"}[s]||s);

  const summary = {
    present:    allRows.filter(r=>r.status==="present").length,
    absent:     allRows.filter(r=>r.status==="absent").length,
    half_day:   allRows.filter(r=>r.status==="half_day").length,
    on_leave:   allRows.filter(r=>r.status==="on_leave").length,
    not_marked: allRows.filter(r=>r.status==="not_marked").length,
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Attendance</div>
      <Tabs tabs={[{id:"daily",label:"Daily View"},{id:"monthly",label:"Monthly Report"}]} active={view} onChange={setView}/>

      {/* ── MONTHLY REPORT ── */}
      {view==="monthly" && (
        <div style={{marginTop:16}}>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:T.txt2,textTransform:"uppercase",display:"block",marginBottom:4}}>Month</label>
              <input type="month" value={selMonth} onChange={e=>dr.setCustomFrom(e.target.value+"-01")}
                style={{padding:"7px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..."
              style={{padding:"7px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",flex:1,minWidth:160,marginTop:20}}/>
          </div>

          {/* Summary */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
            {[
              {label:"Avg Attendance",val:monthlyRows.length?Math.round(monthlyRows.reduce((s,r)=>s+r.pct,0)/monthlyRows.length)+"%":"—",color:T.navy},
              {label:"Full Attendance",val:monthlyRows.filter(r=>r.pct>=100).length,color:T.grn},
              {label:"< 75% Present",val:monthlyRows.filter(r=>r.pct<75&&r.pct>0).length,color:T.amber},
              {label:"No Records",val:monthlyRows.filter(r=>r.marked===0).length,color:T.red},
            ].map(c=>(
              <Card key={c.label} style={{textAlign:"center",padding:"10px 8px"}}>
                <div style={{fontSize:20,fontWeight:800,color:c.color}}>{c.val}</div>
                <div style={{fontSize:10,color:T.txt2,textTransform:"uppercase",fontWeight:600}}>{c.label}</div>
              </Card>
            ))}
          </div>

          {/* Per-staff monthly table */}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:T.navy,color:"#fff"}}>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700}}>Staff</th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700}}>Role / Exec</th>
                  <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#4ade80"}}>{active&&status==="present"?"✓ Present":"Present"}</th>
                  <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#fca5a5"}}>{active&&status==="absent"?"✓ Absent":"Absent"}</th>
                  <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#fcd34d"}}>{active&&status==="half_day"?"✓ Half Day":"Half Day"}</th>
                  <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#c4b5fd"}}>On Leave</th>
                  <th style={{padding:"8px 10px",textAlign:"center",fontWeight:700}}>Marked</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:T.amber}}>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r,i)=>(
                  <tr key={r.staff.id} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr}}>
                    <td style={{padding:"8px 12px",fontWeight:600}}>{r.staff.name}</td>
                    <td style={{padding:"8px 12px",color:T.txt2,fontSize:12}}>{ROLE_LABELS[r.staff.role]||r.staff.role}{r.exec?" · "+r.exec.name:""}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:T.grn,fontWeight:700}}>{r.present}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:T.red,fontWeight:700}}>{r.absent}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:T.amber,fontWeight:700}}>{r.halfDay}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:"#7C3AED",fontWeight:700}}>{r.onLeave}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:T.txt2}}>{r.marked}/{totalWorkingDays}</td>
                    <td style={{padding:"8px 12px",textAlign:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                        <div style={{flex:1,height:6,background:T.surf,borderRadius:3,minWidth:50}}>
                          <div style={{height:6,borderRadius:3,width:r.pct+"%",
                            background:r.pct>=80?T.grn:r.pct>=60?T.amber:T.red}}/>
                        </div>
                        <span style={{fontWeight:700,color:r.pct>=80?T.grn:r.pct>=60?T.amber:T.red,minWidth:36}}>{r.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DAILY VIEW ── */}
      {view==="daily" && (
        <div style={{marginTop:16}}>
          <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:14}}>
            {Object.entries(summary).map(([s,v])=>(
              <div key={s} onClick={()=>setFilterStatus(filterStatus===s?"all":s)} style={{cursor:"pointer",
                background:filterStatus===s?statusBg(s):T.surf,border:"1px solid "+(filterStatus===s?statusColor(s):T.bdr),
                borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:statusColor(s)}}>{v}</div>
                <div style={{fontSize:10,color:T.txt2,textTransform:"uppercase",fontWeight:600}}>{statusLabel(s)}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff or executive..."
              style={{padding:"6px 12px",border:"1px solid "+T.bdrS,borderRadius:20,fontSize:12,fontFamily:"inherit",outline:"none",flex:1,minWidth:160}}/>
            <button onClick={()=>setShowUnmarked(p=>!p)} style={{
              padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              border:"1px solid "+(showUnmarked?T.navy:T.bdrS),background:showUnmarked?T.navy:"transparent",color:showUnmarked?"#fff":T.txt2
            }}>{showUnmarked?"Hide Not Marked":"Show Not Marked"}</button>
          </div>
          <Table cols={[
            {key:"date",   label:"Date",      render:r=>fmtDate(r.date)},
            {key:"staff",  label:"Staff",     render:r=><span style={{fontWeight:700}}>{r.staffName}</span>},
            {key:"exec",   label:"Executive", render:r=>r.supervisorName},
            {key:"role",   label:"Role",      render:r=>ROLE_LABELS[r.role]||r.role},
            {key:"status", label:"Status",    render:r=><Badge color={statusColor(r.status)}>{statusLabel(r.status)}{r.leaveStatus&&r.leaveStatus!=="approved"&&<span style={{fontSize:10,marginLeft:4,opacity:.8}}>({r.leaveStatus})</span>}</Badge>},
            {key:"reason", label:"Notes",     render:r=>r.reason||"—"},
          ]} rows={filtered} emptyMsg="No records for selected period"/>
        </div>
      )}
    </div>
  );
}


function MDPortal({ user, state, setState, toast, syncFromCloud, syncStatus="" }) {
  const [page, setPage] = useState("dashboard");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"dashboard", icon:"🏆", label:"Live Dashboard" },
    { id:"collection", icon:"📊", label:"Collection Report", group:"Collection", groupIcon:"💰" },
    { id:"colldash", icon:"🏦", label:"Collection Dashboard", group:"Collection", groupIcon:"💰" },
    { id:"reports", icon:"📋", label:"All Reports", group:"Reports", groupIcon:"📋" },
    { id:"targetreport", icon:"🎯", label:"Target Report", group:"Reports", groupIcon:"📋" },
    { id:"execreport", icon:"📄", label:"MD Report", group:"Reports", groupIcon:"📋" },
    { id:"financial", icon:"💰", label:"Financial Trends", group:"Reports", groupIcon:"📋" },
    { id:"operations", icon:"🏪", label:"Operations", group:"Reports", groupIcon:"📋" },
    { id:"analysis", icon:"📈", label:"Counter Analysis", group:"Reports", groupIcon:"📋" },
    { id:"salary", icon:"💳", label:"Salary & P&L", group:"Reports", groupIcon:"📋" },
    { id:"attendance", icon:"🗓️", label:"All Attendance", group:"Attendance", groupIcon:"🗓️" },
    { id:"leaves", icon:"✅", label:"Leave Approvals", group:"Attendance", groupIcon:"🗓️" },
    { id:"inventory", icon:"📊", label:"Inventory", group:"Inventory", groupIcon:"📦" },
    { id:"people", icon:"👥", label:"Full Org", group:"Team", groupIcon:"👥" },
    { id:"staffnotes", icon:"📝", label:"Staff Notes", group:"Team", groupIcon:"👥" },
    { id:"targets", icon:"🎯", label:"Set Targets", group:"Team", groupIcon:"👥" },
    { id:"feedback", icon:"💬", label:"All Feedback", group:"Team", groupIcon:"👥" },
    { id:"directory", icon:"👤", label:"Staff Directory", group:"Team", groupIcon:"👥" },
    { id:"debug", icon:"🔍", label:"Debug" },
  ];


  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="dashboard"  && <MDDashboard user={user} state={state} syncFromCloud={syncFromCloud}/>}
      {page==="collection"  && <MDCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="analysis"   && <CounterAnalysis user={user} state={state}/>}
      {page==="colldash"   && <CollectionDashboard state={state} user={user} isAdmin/>}
      {page==="financial"  && <MDFinancial state={state}/>}
      {page==="operations" && <MDOperations state={state}/>}
      {page==="salary"     && <SalaryView user={user} state={state} setState={setState} toast={toast} viewScope="all"/>}
      {page==="directory"   && <StaffDirectory state={state}/>}
      {page==="leaves"     && <MgrLeaves user={user} state={state} setState={setState} toast={toast} syncFromCloud={syncFromCloud}/>}
      {page==="people"     && <MDPeople state={state} setState={setState} toast={toast}/>}
      {page==="reports"     && <AllReports state={state}/>}
      {page==="execreport"  && <ExecutiveReportGenerator state={state}/>}
      {page==="feedback"    && <MDFeedbackAll state={state}/>}
      {page==="targets"      && <MDTargets user={user} state={state} setState={setState} toast={toast}/>}
      {page==="staffnotes"  && <StaffNotesViewer user={user} state={state} setState={setState} toast={toast}/>}
      {page==="inventory"     && <InventoryDashboard user={user} state={state} setState={setState} toast={toast}/>}
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

  // Grand totals from counterStats
  const svcCounters  = counterStats.filter(c=>c.name!=="OFFICE");
  const offCounter   = counterStats.find(c=>c.name==="OFFICE");

  // Today totals
  const SALES_WTS_SET = new Set(["JOPASU","SHAMPOO","POLISH LIQUID","MICROFIBER CLOTH","AIR FRESHENER","TYRE SHINE","BARDAHL","OTHER SALES"]);
  const getEntriesMD  = r => r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
  const today_         = today();
  const todayOffId   = state.counters.find(c=>c.name==="OFFICE")?.id;
  const todaySvcReps = state.serviceReports.filter(r=>r.date===today_&&r.counterId!==todayOffId&&r.counterName!=="OFFICE");
  const gDaySvc      = todaySvcReps.flatMap(getEntriesMD).filter(e=>!SALES_WTS_SET.has(e.workTypeName)&&e.type!=="sales").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const todayOffReps  = state.serviceReports.filter(r=>r.date===today_&&(r.counterId===todayOffId||r.counterName==="OFFICE"));
  const dayBardahlCo  = todayOffReps.flatMap(getEntriesMD).filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const dayOtherCo   = todayOffReps.flatMap(getEntriesMD).filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const gDaySales    = dayBardahlCo + dayOtherCo;
  const gDayTotal    = gDaySvc + gDaySales;

  // Yesterday totals (for day-over-day growth)
  const activeStaff    = state.users.filter(u=>u.active!==false&&u.role!=="md"&&u.role!=="it_admin");
  const presentToday   = state.attendance.filter(a=>a.date===today_&&a.status==="present");
  const halfToday      = state.attendance.filter(a=>a.date===today_&&a.status==="half_day");
  const notMarkedToday = activeStaff.filter(u=>!state.attendance.some(a=>a.staffId===u.id&&a.date===today_)).length;
  const yest = new Date(today_); yest.setDate(yest.getDate()-1);
  const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,"0")}-${String(yest.getDate()).padStart(2,"0")}`;
  const yesterdayTotal = state.serviceReports
    .filter(r=>r.date===yesterdayStr)
    .reduce((s,r)=>s+r.totalAmount,0);
  const dayGrowth = yesterdayTotal > 0
    ? Math.round((gDayTotal - yesterdayTotal) * 100 / yesterdayTotal)
    : gDayTotal > 0 ? 100 : 0;

  // Month totals — computed directly from state, NOT from counterStats (which uses range filter)
  const moReps        = state.serviceReports.filter(r=>r.date.startsWith(thisMonth)&&!(state.counters.find(c=>c.name==="OFFICE")?.id===r.counterId||r.counterName==="OFFICE"));
  const moOffReps     = state.serviceReports.filter(r=>r.date.startsWith(thisMonth)&&(state.counters.find(c=>c.name==="OFFICE")?.id===r.counterId||r.counterName==="OFFICE"));
  const gMoSvc        = moReps.flatMap(getEntriesMD).filter(e=>!SALES_WTS_SET.has(e.workTypeName)&&e.type!=="sales").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const moBardahlCo   = moOffReps.flatMap(getEntriesMD).filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const moOtherCo     = moOffReps.flatMap(getEntriesMD).filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const gMoSales      = moBardahlCo + moOtherCo;
  const gMoTotal      = gMoSvc + gMoSales;
  const lastMonthD = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth()+1).padStart(2,"0")}`;
  const thisMonthRev = gMoTotal;  // Use same computation as displayed Month Total
  const lastMonthOffReps  = state.serviceReports.filter(r=>r.date.startsWith(lastMonth)&&(state.counters.find(c=>c.name==="OFFICE")?.id===r.counterId||r.counterName==="OFFICE"));
  const lastMonthSvcReps   = state.serviceReports.filter(r=>r.date.startsWith(lastMonth)&&r.counterId!==state.counters.find(c=>c.name==="OFFICE")?.id&&r.counterName!=="OFFICE");
  const lastMonthSvc       = lastMonthSvcReps.flatMap(getEntriesMD).filter(e=>!SALES_WTS_SET.has(e.workTypeName)&&e.type!=="sales").reduce((s,e)=>s+(Number(e.amount)||0),0);
  const lastMonthSalesAmt  = lastMonthOffReps.flatMap(getEntriesMD).filter(e=>["BARDAHL","OTHER SALES"].includes(e.workTypeName)).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const lastMonthRev       = lastMonthSvc + lastMonthSalesAmt;
  const growth = lastMonthRev > 0 ? Math.round((thisMonthRev-lastMonthRev)*100/lastMonthRev) : (thisMonthRev>0?100:0);
  // Daily revenue for bar chart (last 14 days)
  const last14 = Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-13+i); return d.toISOString().split("T")[0]; });
  const dailyRevs = last14.map(d => ({ date:d, rev:state.serviceReports.filter(r=>r.date===d).reduce((s,r)=>s+r.totalAmount,0) }));
  const maxDailyRev = Math.max(...dailyRevs.map(d=>d.rev),1);

  // Absent today
  const absentToday = state.attendance.filter(a=>a.date===today()&&a.status==="absent");

  // Pending leaves
  const pendingLeaves = [
    ...(state.leaves||[]).filter(l=>l.approverId===user.id&&l.status==="pending"),
    ...(state.plannedLeaves||[]).filter(l=>l.approverId===user.id&&l.status==="pending"),
  ];

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
        {/* Key metrics — 4×3 grid matching dashboard spec */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20 }}>
          {[
            { l:"Today Service",  v:fmtCurr(gDaySvc),   i:"🔧", c:"#bfdbfe" },
            { l:"Today Sales",    v:fmtCurr(gDaySales),  i:"🛢", c:"#bbf7d0" },
            { l:"Today Total",    v:fmtCurr(gDayTotal),  i:"💰", c:"#fde68a" },
            { l:"Day Growth", v:yesterdayTotal>0?(dayGrowth>=0?"+":"")+dayGrowth+"%":"New Day", i:dayGrowth>0?"📈":dayGrowth<0?"📉":"➡️", c:dayGrowth>0?"#86EFAC":dayGrowth<0?"#FCA5A5":"rgba(255,255,255,.7)" },
            { l:"Month Service",  v:fmtCurr(gMoSvc),    i:"📅", c:"#bfdbfe" },
            { l:"Month Sales",    v:fmtCurr(gMoSales),   i:"📊", c:"#bbf7d0" },
            { l:"Month Total",    v:fmtCurr(gMoTotal),   i:"🏆", c:"#fde68a" },
            { l:"Monthly Growth", v:lastMonthRev>0?(growth>=0?"+":"")+growth+"%":"New Month", i:growth>0?"📈":growth<0?"📉":"➡️", c:growth>0?"#86EFAC":growth<0?"#FCA5A5":"rgba(255,255,255,.7)" },
            { l:"Present Today",  v:presentToday.length+halfToday.length, i:"✅", c:"#84CC16" },
            { l:"Absent Today",   v:absentToday.length,  i:"❌", c:"#FCA5A5" },
            { l:"Not Marked",     v:notMarkedToday,       i:"❓", c:"rgba(255,255,255,.5)" },
            { l:"Total Staff",    v:activeStaff.length,   i:"👥", c:"#e9d5ff" },
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

      {/* Collection & Sales Summary */}
      {(() => {
        const todayDate = today();
        const monthPfx  = todayDate.slice(0,7);
        const todayColRep = (state.collectionReports||[]).find(r=>r.date===todayDate);
        const allMonthCol = (state.collectionReports||[]).filter(r=>r.date.startsWith(monthPfx));
        const todayBank   = (todayColRep?.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0);
        const todayExp    = (todayColRep?.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        const todayNet    = todayBank - todayExp;
        const moBank      = allMonthCol.reduce((s,r)=>(r.bankEntries||[]).reduce((ss,b)=>ss+(Number(b.amount)||0),s),0);
        const moExp       = allMonthCol.reduce((s,r)=>(r.expenses||[]).reduce((ss,e)=>ss+(Number(e.amount)||0),s),0);
        const moNet       = moBank - moExp;
        // Sales (OFFICE counter only)
        const OFFICE_ID = state.counters.find(c=>c.name==="OFFICE")?.id||"c1";
        const salesRepsToday = state.serviceReports.filter(r=>r.date===todayDate&&(r.counterId===OFFICE_ID||r.counterName==="OFFICE"));
        const salesRepsMo    = state.serviceReports.filter(r=>r.date.startsWith(monthPfx)&&(r.counterId===OFFICE_ID||r.counterName==="OFFICE"));
        const getEntries = r => r.entries&&r.entries.length>0?r.entries:(r.counters||[]).flatMap(c=>c.entries||[]);
        const todayBardahl = salesRepsToday.flatMap(getEntries).filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const todayOther   = salesRepsToday.flatMap(getEntries).filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const moBardahl    = salesRepsMo.flatMap(getEntries).filter(e=>e.workTypeName==="BARDAHL").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const moOther      = salesRepsMo.flatMap(getEntries).filter(e=>e.workTypeName==="OTHER SALES").reduce((s,e)=>s+(Number(e.amount)||0),0);
        const hasColl = todayBank>0||todayExp>0;
        const hasSales = todayBardahl>0||todayOther>0;
        if (!hasColl && !hasSales) return null;
        return (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14,marginBottom:20}}>
            {hasColl && (
              <Card style={{borderTop:"3px solid "+T.navy}}>
                <div style={{fontSize:13,fontWeight:800,color:T.navy,marginBottom:12}}>💰 Today's Collection</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:T.navyXL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.txt2,textTransform:"uppercase"}}>Bank In</div>
                    <div style={{fontSize:16,fontWeight:800,color:T.navy}}>{fmtCurr(todayBank)}</div>
                  </div>
                  <div style={{background:T.redL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.red,textTransform:"uppercase"}}>Expenses</div>
                    <div style={{fontSize:16,fontWeight:800,color:T.red}}>{fmtCurr(todayExp)}</div>
                  </div>
                  <div style={{background:todayNet>=0?T.grnL:T.redL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:todayNet>=0?T.grn:T.red,textTransform:"uppercase"}}>Net</div>
                    <div style={{fontSize:16,fontWeight:800,color:todayNet>=0?T.grn:T.red}}>{fmtCurr(todayNet)}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:T.txt2}}>Month — Bank: {fmtCurr(moBank)} · Exp: {fmtCurr(moExp)} · Net: <b style={{color:moNet>=0?T.grn:T.red}}>{fmtCurr(moNet)}</b></div>
              </Card>
            )}
            {hasSales && (
              <Card style={{borderTop:"3px solid #15803D"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#15803D",marginBottom:12}}>🛢 Today's Company Sales</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:"#F0FDF4",borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#15803D",textTransform:"uppercase"}}>Bardahl</div>
                    <div style={{fontSize:16,fontWeight:800,color:"#15803D"}}>{fmtCurr(todayBardahl)}</div>
                  </div>
                  <div style={{background:"#EFF6FF",borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#0369A1",textTransform:"uppercase"}}>Other</div>
                    <div style={{fontSize:16,fontWeight:800,color:"#0369A1"}}>{fmtCurr(todayOther)}</div>
                  </div>
                  <div style={{background:T.amberL,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:T.amberD,textTransform:"uppercase"}}>Total</div>
                    <div style={{fontSize:16,fontWeight:800,color:T.amber}}>{fmtCurr(todayBardahl+todayOther)}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:T.txt2}}>Month — Bardahl: {fmtCurr(moBardahl)} · Other: {fmtCurr(moOther)} · Total: <b style={{color:"#15803D"}}>{fmtCurr(moBardahl+moOther)}</b></div>
              </Card>
            )}
          </div>
        );
      })()}

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
function OfficeCombinedAttendance({ user, state, setState, toast }) {
  const [tab, setTab] = useState("exec");
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Mark Attendance</div>
      <Tabs tabs={[{id:"exec",label:"For Executives & Staff"},{id:"office",label:"Office Staff"}]} active={tab} onChange={setTab}/>
      {tab==="exec"   && <OfficeMarkAttendance user={user} state={state} setState={setState} toast={toast}/>}
      {tab==="office" && <OfficeOwnAttendance  user={user} state={state} setState={setState} toast={toast}/>}
    </div>
  );
}


function OfficePortal({ user, state, setState, toast, syncStatus="" }) {
  const [page, setPage] = useState("reports");
  const [pageHistory, setPageHistory] = useState([]);
  const navTo = (p) => { if(p!==page) setPageHistory(h=>[...h.slice(-4),page]); setPage(p); };
  const navItems = [
    { id:"enter", icon:"✏️", label:"Enter Report", group:"Reports", groupIcon:"📋" },
    { id:"sales", icon:"🛒", label:"Sales Entry", group:"Reports", groupIcon:"📋" },
    { id:"reports", icon:"📋", label:"View Reports", group:"Reports", groupIcon:"📋" },
    { id:"execreport", icon:"📄", label:"Executive Report", group:"Reports", groupIcon:"📋" },
    { id:"collection", icon:"📊", label:"Collection Report", group:"Collection", groupIcon:"💰" },
    { id:"colldash", icon:"🏦", label:"Collection Dashboard", group:"Collection", groupIcon:"💰" },
    { id:"attendance", icon:"👥", label:"Mark Attendance", group:"Attendance", groupIcon:"🗓️" },
    { id:"viewatt", icon:"📅", label:"All Attendance", group:"Attendance", groupIcon:"🗓️" },
    { id:"myleaves", icon:"🌿", label:"My Leave", group:"Attendance", groupIcon:"🗓️" },
    { id:"stockcheckin", icon:"🏭", label:"Godown Check-in", group:"Inventory", groupIcon:"📦" },
    { id:"stockapproval", icon:"📦", label:"Stock Requests", group:"Inventory", groupIcon:"📦" },
    { id:"inventory", icon:"📊", label:"Inventory", group:"Inventory", groupIcon:"📦" },
    { id:"counternotes", icon:"📝", label:"Daily Note" },
    { id:"export", icon:"📥", label:"Export Data" },
    { id:"directory", icon:"👤", label:"Staff Directory" },
  ];


  return (
    <Shell user={user} state={state} syncStatus={syncStatus} activePage={page} setActivePage={navTo} navItems={navItems} onLogout={()=>setState(p=>({...p,currentUser:null}))} pageHistory={pageHistory}>
      {page==="enter"        && <OfficeEnterReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="sales"        && <OfficeSalesEntry user={user} state={state} setState={setState} toast={toast}/>}
      {page==="collection"   && <OfficeCollectionReport user={user} state={state} setState={setState} toast={toast}/>}
      {page==="attendance"   && <OfficeCombinedAttendance user={user} state={state} setState={setState} toast={toast}/>}
      {page==="reports"      && <OfficeReports state={state}/>}
      {page==="viewatt"      && <OfficeAttendanceView state={state}/>}
      {page==="myleaves"     && <LeavePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="counternotes" && <DailyNotePortal user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockrequest"  && <StockRequest user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockcheckin"  && <StockCheckin user={user} state={state} setState={setState} toast={toast}/>}
      {page==="stockapproval" && <StockRequestsApproval user={user} state={state} setState={setState} toast={toast}/>}
      {page==="inventory"     && <InventoryDashboard user={user} state={state} setState={setState} toast={toast}/>}
      {page==="colldash"     && <CollectionDashboard state={state} user={user}/>}
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
  const save = async (bankEntries, expenses) => {
    console.log("💾 Collection save:", {date, bankEntries, expenses, userId:user.id});
    const rep = { id:existing?.id||`cr_${Date.now()}`, date, supervisorId:user.id, bankEntries, expenses };
    setState(p=>({...p, collectionReports:[...(p.collectionReports||[]).filter(r=>r.id!==rep.id), rep]}));
    const result = await DB.upsertCollectionReport(rep).catch(e=>({error:e.message}));
    const totalBank = (bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0);
    const totalExp  = (expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
    if (result && (result.code || result.error)) {
      toast.show("⚠ DB error: "+(result.message||result.error||"unknown")+" — saved locally", "error");
    } else {
      toast.show("✅ Saved — Bank: "+fmtCurr(totalBank)+" | Expenses: "+fmtCurr(totalExp)+" | Net: "+fmtCurr(totalBank-totalExp));
    }
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

  const executives = state.users.filter(u=>(u.role==="supervisor"||u.role==="manager"||u.role==="md")&&u.active!==false);

  const selExecUser = state.users.find(u=>u.id===selExec);
  const isSupRole = selExecUser?.role==="supervisor";
  const allToMark = selExec ? [
    selExecUser,
    ...(isSupRole ? state.users.filter(u=>u.role==="field_staff"&&u.active!==false&&u.managerId===selExec) : [])
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
              <option value="">Select Executive / Manager / MD</option>
              {executives.map(u=><option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role]||u.role})</option>)}
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
                        border:`1px solid ${active?(status==="present"?T.lime:status==="absent"?T.red:T.amber):T.bdrS}`,
                        background:active?(status==="present"?T.lime:status==="absent"?T.redL:T.amberL):"transparent",
                        color:active?(status==="present"?"#fff":status==="absent"?T.red:T.amberD):T.txt2
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
        {selExec && staffList.length===0 && <div style={{color:T.txt3,padding:16,textAlign:"center"}}>No staff found for this person.</div>}
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
  const gDaySales = dayBardahlCo + dayOtherCo;
  const gMoSales  = moBardahlCo  + moOtherCo;
  // Attendance & growth vars for stat cards
  const today_erg      = selDate;
  const activeStaff    = state.users.filter(u=>u.active!==false&&u.role!=="md"&&u.role!=="it_admin");
  const presentToday   = state.attendance.filter(a=>a.date===selDate&&a.status==="present");
  const halfToday      = state.attendance.filter(a=>a.date===selDate&&a.status==="half_day");
  const notMarkedToday = activeStaff.filter(u=>!state.attendance.some(a=>a.staffId===u.id&&a.date===selDate)).length;
  const absentToday    = state.attendance.filter(a=>a.date===selDate&&a.status==="absent");
  // Day growth vs previous day
  const _prevDay = new Date(selDate+"T00:00:00"); _prevDay.setDate(_prevDay.getDate()-1);
  const _prevStr = `${_prevDay.getFullYear()}-${String(_prevDay.getMonth()+1).padStart(2,"0")}-${String(_prevDay.getDate()).padStart(2,"0")}`;
  const yesterdayTotal = state.serviceReports.filter(r=>r.date===_prevStr).reduce((s,r)=>s+r.totalAmount,0);
  const dayGrowth = yesterdayTotal>0 ? Math.round((gDayTotal-yesterdayTotal)*100/yesterdayTotal) : (gDayTotal>0?100:0);
  // Monthly growth
  const _selMo = selDate.slice(0,7);
  const _prevMoD = new Date(_selMo+"-01"); _prevMoD.setMonth(_prevMoD.getMonth()-1);
  const _prevMo = `${_prevMoD.getFullYear()}-${String(_prevMoD.getMonth()+1).padStart(2,"0")}`;
  const _prevMoRev = state.serviceReports.filter(r=>r.date.startsWith(_prevMo)).reduce((s,r)=>s+r.totalAmount,0);
  const growth = _prevMoRev>0 ? Math.round((gMoTotal-_prevMoRev)*100/_prevMoRev) : (gMoTotal>0?100:0);

  const printReport = () => {
    const todayColRep = (state.collectionReports||[]).find(r=>r.date===selDate);
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

    const colBankTotal = todayColRep ? (todayColRep.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0) : 0;
    const colExpTotal  = todayColRep ? (todayColRep.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0) : 0;
    const colNet       = colBankTotal - colExpTotal;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>MD Report ${selDate}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{color:#0f2b4a}table{width:100%;border-collapse:collapse}@media print{body{padding:8px}}</style>
    </head><body>
    <h2>Benaka Enterprises — MD Report</h2>
    <p style="color:#666">${selDate} · Generated ${new Date().toLocaleString("en-IN")}</p>
    ${todayColRep ? `<table style="margin-bottom:16px;border-collapse:collapse;width:100%">
      <tr style="background:#0f2b4a;color:#fff"><th colspan="2" style="padding:6px 10px;text-align:left">Collection Report</th></tr>
      ${(todayColRep.bankEntries||[]).map(b=>`<tr><td style="padding:4px 10px;border:1px solid #ddd">${b.bank||"Bank"}</td><td style="padding:4px 10px;border:1px solid #ddd;text-align:right">₹${Number(b.amount||0).toLocaleString("en-IN")}</td></tr>`).join("")}
      ${(todayColRep.expenses||[]).map(e=>`<tr style="color:#dc2626"><td style="padding:4px 10px;border:1px solid #ddd">${e.desc||"Expense"}</td><td style="padding:4px 10px;border:1px solid #ddd;text-align:right">-₹${Number(e.amount||0).toLocaleString("en-IN")}</td></tr>`).join("")}
      <tr style="background:#f0fdf4;font-weight:800"><td style="padding:6px 10px;border:1px solid #ddd">Net Collection</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;color:#15803D">₹${colNet.toLocaleString("en-IN")}</td></tr>
    </table>` : ""}
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
        <tr style="background:#f0f9ff">
          <td colspan="2" style="padding:8px 10px;border:1px solid #ccc;font-weight:700;color:#0369A1">COLLECTION REPORT</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc;color:#0369A1">Bank In: ₹${todayColRep?((todayColRep.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0)).toLocaleString("en-IN"):"0"}</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc;color:#dc2626">Expenses: ₹${todayColRep?((todayColRep.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0)).toLocaleString("en-IN"):"0"}</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #ccc;font-weight:800;color:#15803D">Net: ₹${todayColRep?(((todayColRep.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0))-((todayColRep.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0))).toLocaleString("en-IN"):"0"}</td>
        </tr>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {/* Row 1 — Today */}
        <StatCard label="Today Service"   value={fmtCurr(gDaySvc)}   color={T.navy}    icon="🔧"/>
        <StatCard label="Today Sales"     value={fmtCurr(gDaySales)}  color="#15803D"   icon="🛢"/>
        <StatCard label="Today Total"     value={fmtCurr(gDayTotal)}  color={T.amber}   icon="💰"/>
        <StatCard label="Day Growth"      value={(dayGrowth>=0?"+":"")+dayGrowth+"%"} color={dayGrowth>=0?T.grn:T.red} icon={dayGrowth>=0?"📈":"📉"}/>
        {/* Row 2 — Monthly */}
        <StatCard label="Month Service"   value={fmtCurr(gMoSvc)}    color={T.navy}    icon="📅"/>
        <StatCard label="Month Sales"     value={fmtCurr(gMoSales)}   color="#15803D"   icon="📊"/>
        <StatCard label="Month Total"     value={fmtCurr(gMoTotal)}   color={T.amber}   icon="🏆"/>
        <StatCard label="Monthly Growth"  value={(growth>=0?"+":"")+growth+"%"} color={growth>=0?T.grn:T.red} icon={growth>=0?"📈":"📉"}/>
        {/* Row 3 — Attendance */}
        <StatCard label="Present Today"   value={presentToday.length+halfToday.length} color={T.grn} icon="✅"/>
        <StatCard label="Absent Today"    value={absentToday.length}  color={T.red}     icon="❌"/>
        <StatCard label="Not Marked"      value={notMarkedToday}      color={T.txt2}    icon="❓"/>
        <StatCard label="Total Staff"     value={activeStaff.length}  color="#7C3AED"   icon="👥"/>
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

      {/* Collection Summary */}
      {(()=>{
        const colRep = (state.serviceReports||[]).length>=0 && (state.collectionReports||[]).find(r=>r.date===selDate);
        if (!colRep) return null;
        const bank = (colRep.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0);
        const exp  = (colRep.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
        return (
          <Card style={{borderTop:"3px solid "+T.navy,marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:800,color:T.navy,marginBottom:10}}>🏦 Bank Collection — {fmtDate(selDate)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
              <div style={{background:T.navyXL,borderRadius:7,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:10,color:T.txt2}}>Bank Deposited</div>
                <div style={{fontSize:18,fontWeight:800,color:T.navy}}>{fmtCurr(bank)}</div>
                <div style={{fontSize:10,color:T.txt3,marginTop:2}}>{(colRep.bankEntries||[]).map(b=>b.bank+": "+fmtCurr(b.amount)).join(" · ")}</div>
              </div>
              <div style={{background:T.redL,borderRadius:7,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:10,color:T.red}}>Expenses</div>
                <div style={{fontSize:18,fontWeight:800,color:T.red}}>{fmtCurr(exp)}</div>
                <div style={{fontSize:10,color:T.txt3,marginTop:2}}>{(colRep.expenses||[]).map(e=>(e.desc||e.description)+": "+fmtCurr(e.amount)).join(" · ")}</div>
              </div>
              <div style={{background:bank-exp>=0?T.grnL:T.redL,borderRadius:7,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:10,color:bank-exp>=0?T.grn:T.red}}>Net</div>
                <div style={{fontSize:18,fontWeight:800,color:bank-exp>=0?T.grn:T.red}}>{fmtCurr(bank-exp)}</div>
              </div>
            </div>
          </Card>
        );
      })()}

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
    { id:"users", icon:"👥", label:"User Management", group:"Setup", groupIcon:"⚙️" },
    { id:"counters", icon:"🏪", label:"Counters", group:"Setup", groupIcon:"⚙️" },
    { id:"worktypes", icon:"🔧", label:"Work Types", group:"Setup", groupIcon:"⚙️" },
    { id:"reports", icon:"📋", label:"All Reports", group:"Reports", groupIcon:"📋" },
    { id:"data", icon:"🗑️", label:"Data Management", group:"Reports", groupIcon:"📋" },
    { id:"export", icon:"📥", label:"Export", group:"Reports", groupIcon:"📋" },
    { id:"debug", icon:"🔍", label:"Debug Reports", group:"Reports", groupIcon:"📋" },
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
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState({});
  const [newPwd, setNewPwd]         = useState("");
  const [viewFilter, setViewFilter] = useState("active"); // active | inactive | resigned | all
  const [resignModal, setResignModal] = useState(null);   // user being resigned
  const [resignDate, setResignDate]   = useState(today());

  const openEdit = u => { setEditing(u); setForm({...u}); setNewPwd(""); };
  const openNew  = () => { setEditing({}); setForm({ role:"field_staff", active:true }); setNewPwd(""); };

  const save = () => {
    if (!form.empId||!form.name) { toast.show("ID and Name required","error"); return; }
    if (editing?.id) {
      const updated = state.users.map(u=>u.id===editing.id?{...u,...form}:u);
      const pwds    = newPwd ? {...state.passwords,[form.empId]:newPwd} : state.passwords;
      DB.upsertUsers(updated).catch(console.error);
      DB.upsertPasswords(pwds).catch(console.error);
      setState(p=>({...p,users:updated,passwords:pwds,_configVersion:(p._configVersion||0)+1}));
      toast.show("User "+form.name+" saved ✅");
    } else {
      if (state.users.find(u=>u.empId===form.empId)) { toast.show("Employee ID already exists","error"); return; }
      const newUser = {...form, id:"u_"+Date.now(), active:true};
      const updated = [...state.users, newUser];
      const pwds    = newPwd ? {...state.passwords,[form.empId]:newPwd} : state.passwords;
      DB.upsertUsers(updated).catch(console.error);
      DB.upsertPasswords(pwds).catch(console.error);
      setState(p=>({...p,users:updated,passwords:pwds,_configVersion:(p._configVersion||0)+1}));
      toast.show("User "+form.name+" added ✅");
    }
    setEditing(null);
  };

  const toggleActive = (r) => {
    const updated = state.users.map(u=>u.id===r.id?{...u,active:u.active===false,resignedOn:undefined,status:undefined}:u);
    setState(p=>({...p,users:updated}));
    DB.upsertUsers(updated).catch(console.error);
    toast.show((r.active!==false?"Deactivated ":"Activated ")+r.name);
  };

  const confirmResign = () => {
    if (!resignDate) { toast.show("Select resignation date","error"); return; }
    const updated = state.users.map(u=>u.id===resignModal.id
      ? {...u, active:false, status:"resigned", resignedOn:resignDate}
      : u
    );
    setState(p=>({...p,users:updated,_configVersion:(p._configVersion||0)+1}));
    DB.upsertUsers(updated).catch(console.error);
    toast.show(resignModal.name+" marked as resigned ("+fmtDate(resignDate)+")");
    setResignModal(null);
  };

  // Filter users by view
  const filteredUsers = state.users.filter(u => {
    if (viewFilter==="active")   return u.active!==false && u.status!=="resigned";
    if (viewFilter==="inactive") return u.active===false  && u.status!=="resigned";
    if (viewFilter==="resigned") return u.status==="resigned";
    return true; // all
  });

  const counts = {
    active:   state.users.filter(u=>u.active!==false&&u.status!=="resigned").length,
    inactive: state.users.filter(u=>u.active===false&&u.status!=="resigned").length,
    resigned: state.users.filter(u=>u.status==="resigned").length,
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:800}}>User Management</div>
        <Btn onClick={openNew} variant="amber">+ Add User</Btn>
      </div>

      {/* Resign confirmation modal */}
      {resignModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:360,width:"90%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Mark as Resigned</div>
            <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>
              <b>{resignModal.name}</b> ({resignModal.empId}) will be marked as resigned and hidden from active lists.
            </div>
            <Input label="Date of Resignation" type="date" value={resignDate} onChange={setResignDate}/>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <Btn onClick={confirmResign} variant="danger" style={{flex:1}}>Confirm Resignation</Btn>
              <Btn onClick={()=>setResignModal(null)} variant="ghost" style={{flex:1}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add form */}
      {editing!==null && (
        <Card style={{marginBottom:20,borderTop:"3px solid "+T.amber}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>{editing?.id?"Edit User":"New User"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:12}}>
            {[["empId","Employee ID"],["name","Full Name"],["email","Email"],["phone","Phone"],
              ["dob","Date of Birth","date"],["joining","Joining Date","date"],
              ["weddingAnniversary","Anniversary","date"],["counter","Counter/Dept"]
            ].map(([k,l,t])=>(
              <div key={k}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{l}</label>
                <input type={t||"text"} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Role</label>
              <select value={form.role||"field_staff"} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                {Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>Manager</label>
              <select value={form.managerId||""} onChange={e=>setForm(p=>({...p,managerId:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                <option value="">None</option>
                {state.users.filter(u=>["manager","md","supervisor"].includes(u.role)).map(u=>(
                  <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role]})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>New Password</label>
              <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Leave blank to keep"
                style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={save} variant="amber">Save User</Btn>
            <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[
          {id:"active",   label:`Active (${counts.active})`,   color:T.grn},
          {id:"inactive", label:`Inactive (${counts.inactive})`, color:T.amber},
          {id:"resigned", label:`Resigned (${counts.resigned})`, color:T.red},
          {id:"all",      label:`All (${state.users.length})`,   color:T.navy},
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setViewFilter(tab.id)} style={{
            padding:"6px 16px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(viewFilter===tab.id?tab.color:T.bdrS),
            background:viewFilter===tab.id?tab.color:"transparent",
            color:viewFilter===tab.id?"#fff":T.txt2,transition:"all .15s"
          }}>{tab.label}</button>
        ))}
      </div>

      <Table cols={[
        {key:"empId", label:"ID",   render:r=><span style={{fontFamily:"monospace",fontSize:12,color:r.status==="resigned"?T.red:T.txt}}>{r.empId}</span>},
        {key:"name",  label:"Name", render:r=>(
          <div>
            <b style={{color:r.status==="resigned"?T.red:r.active===false?T.txt2:T.txt}}>{r.name}</b>
            {r.status==="resigned" && <div style={{fontSize:10,color:T.red}}>Resigned {r.resignedOn?fmtDate(r.resignedOn):""}</div>}
            {r.active===false && r.status!=="resigned" && <div style={{fontSize:10,color:T.amber}}>Inactive</div>}
          </div>
        )},
        {key:"role",  label:"Role", render:r=><Badge color={ROLE_COLORS[r.role]||T.navy}>{ROLE_LABELS[r.role]||r.role}</Badge>},
        {key:"mgr",   label:"Manager", render:r=>state.users.find(u=>u.id===r.managerId)?.name||"—"},
        {key:"act",   label:"", render:r=>(
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {r.status!=="resigned" && <Btn onClick={()=>openEdit(r)} size="sm" variant="outline">Edit</Btn>}
            {r.status!=="resigned" && (
              <Btn onClick={()=>toggleActive(r)} size="sm" variant="ghost">
                {r.active!==false?"Deactivate":"Activate"}
              </Btn>
            )}
            {r.status!=="resigned"
              ? <Btn onClick={()=>{setResignModal(r);setResignDate(today());}} size="sm" variant="danger">Resign</Btn>
              : <Btn onClick={()=>{
                  const updated=state.users.map(u=>u.id===r.id?{...u,active:true,status:undefined,resignedOn:undefined}:u);
                  setState(p=>({...p,users:updated}));
                  DB.upsertUsers(updated).catch(console.error);
                  toast.show(r.name+" reinstated ✅");
                }} size="sm" variant="outline">Reinstate</Btn>
            }
          </div>
        )},
      ]} rows={filteredUsers} emptyMsg={`No ${viewFilter} users`}/>
    </div>
  );
}


function CounterMgmt({ user, state, setState, toast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({});
  const [selExecs, setSelExecs] = useState([]); // array of supervisorIds

  const open = c => {
    setEditing(c||{});
    setForm(c&&c.id ? {...c} : {name:"",dealership:"",city:""});
    // Support both old (supervisorId) and new (supervisorIds) format
    const ids = c?.supervisorIds || (c?.supervisorId ? [c.supervisorId] : []);
    setSelExecs(ids);
  };

  const toggleExec = (id) => {
    setSelExecs(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  };

  const save = () => {
    if (!form.name) { toast.show("Name required","error"); return; }
    const counterData = {
      ...form,
      supervisorId: selExecs[0] || "",       // primary exec (backward compat)
      supervisorIds: selExecs,               // all execs
    };
    let newCounters;
    if (editing?.id) {
      newCounters = state.counters.map(c=>c.id===editing.id?{...c,...counterData}:c);
    } else {
      newCounters = [...state.counters, {id:"c_"+Date.now(), ...counterData}];
    }
    DB.upsertCounters(newCounters).catch(console.error);
    setState(p=>({...p,counters:newCounters,_configVersion:(p._configVersion||0)+1}));
    toast.show("Counter saved ✅");
    setEditing(null); setSelExecs([]);
  };

  const executives = state.users.filter(u=>u.role==="supervisor"&&u.active!==false);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:16,fontWeight:800}}>Counter Management</div>
        <Btn onClick={()=>open(null)} variant="amber">+ Add Counter</Btn>
      </div>

      {editing!==null && (
        <Card style={{marginBottom:20,borderTop:"3px solid "+T.amber}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>{editing?.id?"Edit Counter":"New Counter"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:14}}>
            {[["name","Counter Name"],["dealership","Dealership"],["city","City"]].map(([k,l])=>(
              <div key={k}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:4,textTransform:"uppercase"}}>{l}</label>
                <input value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  style={{width:"100%",padding:"8px 10px",border:"1px solid "+T.bdrS,borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>

          {/* Multi-executive selection */}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:8,textTransform:"uppercase"}}>
              Assigned Executives ({selExecs.length} selected)
            </label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6,background:T.navyXL,borderRadius:8,padding:12}}>
              {executives.map(u=>{
                const checked = selExecs.includes(u.id);
                return (
                  <label key={u.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                    padding:"6px 10px",borderRadius:6,background:checked?T.amberL:"transparent",
                    border:"1px solid "+(checked?T.amber:T.bdr)}}>
                    <input type="checkbox" checked={checked} onChange={()=>toggleExec(u.id)}
                      style={{cursor:"pointer",accentColor:T.amber,width:14,height:14}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:checked?700:400}}>{u.name}</div>
                      <div style={{fontSize:10,color:T.txt2}}>{u.empId}</div>
                    </div>
                  </label>
                );
              })}
              {executives.length===0 && <div style={{color:T.txt3,fontSize:12}}>No executives found</div>}
            </div>
            {selExecs.length>1 && (
              <div style={{fontSize:11,color:T.amber,marginTop:6}}>
                Primary executive (first selected): {state.users.find(u=>u.id===selExecs[0])?.name}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8}}>
            <Btn onClick={save} variant="amber">Save Counter</Btn>
            <Btn onClick={()=>setEditing(null)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Counter list */}
      {[["Service Counters",state.counters.filter(c=>c.name!=="OFFICE")],["Office",state.counters.filter(c=>c.name==="OFFICE")]].map(([label,ctrs])=>
        ctrs.length>0 && (
          <div key={label} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:800,color:T.txt2,textTransform:"uppercase",marginBottom:8}}>{label}</div>
            {ctrs.map(c=>{
              const supIds = c.supervisorIds || (c.supervisorId?[c.supervisorId]:[]);
              const sups   = supIds.map(id=>state.users.find(u=>u.id===id)).filter(Boolean);
              return (
                <Card key={c.id} style={{marginBottom:8,padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                      <div style={{fontSize:12,color:T.txt2}}>{c.dealership||"—"} · {c.city||"—"}</div>
                      <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:4}}>
                        {sups.length>0 ? sups.map(s=>(
                          <span key={s.id} style={{fontSize:11,background:T.navyXL,color:T.navy,padding:"2px 8px",borderRadius:20,fontWeight:600}}>{s.name}</span>
                        )) : <span style={{fontSize:11,color:T.txt3}}>No executive assigned</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <Btn onClick={()=>open(c)} size="sm" variant="outline">Edit</Btn>
                      <Btn onClick={()=>{if(confirm("Delete "+c.name+"?")){
                        const nw=state.counters.filter(x=>x.id!==c.id);
                        supabase.from("app_counters").delete().eq("id",c.id).catch(console.error);
                        setState(p=>({...p,counters:nw,_configVersion:(p._configVersion||0)+1}));
                        toast.show(c.name+" deleted");
                      }}} size="sm" variant="danger">Delete</Btn>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function WorkTypeMgmt({ user, state, setState, toast }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [editCat, setEditCat] = useState("service");
  const open = w => { setEditing(w||{}); setName(w?.name||""); setRate(w?.defaultRate||""); setEditCat(w?.category||"service"); };
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
    toast.show("Work type saved ✅"); setEditing(null); setName(""); setRate(""); setEditCat("service"); setName(""); setRate("");
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
            {key:"act",label:"",render:r=><div style={{display:"flex",gap:4}}>
              <Btn onClick={()=>open(r)} size="sm" variant="outline">Edit</Btn>
              <Btn onClick={()=>{
                if(confirm("Delete "+r.name+"?")){
                  const nw=state.workTypes.filter(w=>w.id!==r.id);
                  DB.upsertWorkTypes(nw).catch(console.error);
                  setState(p=>({...p,workTypes:nw}));
                  toast.show(r.name+" deleted");
                }
              }} size="sm" variant="danger">Delete</Btn>
            </div>},
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
    // Only restore from report if it has actual saved data
    if (report?.bankEntries?.length > 0 || report?.expenses?.length > 0) {
      setBankEntries(report.bankEntries || [{ bank:"SBI", amount:"" }, { bank:"KBL", amount:"" }]);
      setExpenses(report.expenses || [{ desc:"", amount:"" }]);
    }
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
            border:"1px solid "+(filterStatus===s?(s==="present"?T.lime:s==="absent"?T.red:s==="half_day"?T.amber:T.navy):T.bdrS),
            background:filterStatus===s?(s==="present"?T.limeL:s==="absent"?T.redL:s==="half_day"?T.amberL:T.navy):"transparent",
            color:filterStatus===s?(s==="all"?"#fff":s==="present"?T.lime:s==="absent"?T.red:T.amberD):T.txt2
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
        {key:"status",label:"Status",render:r=><Badge color={r.status==="present"?T.lime:r.status==="half_day"?T.amber:T.red}>{r.status==="half_day"?"Half Day":r.status.charAt(0).toUpperCase()+r.status.slice(1)}</Badge>},
        {key:"reason",label:"Reason",render:r=>r.reason||"—"},
      ]} rows={att} emptyMsg="No records"/>
    </div>
  );
}

// ─── Office: Sales Entry ────────────────────────────────────────────────────────
function OfficeSalesEntry({ user, state, setState, toast }) {
  const [date, setDate] = useState(today());
  const [bardahl, setBardahl] = useState("");
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!bardahl && !other) { toast.show("Enter at least one sales amount","error"); return; }
    const entries = [];
    if (Number(bardahl)>0) entries.push({workTypeId:"wt_bardahl",workTypeName:"BARDAHL",amount:Number(bardahl),type:"sales",vehicles:0,rate:0});
    if (Number(other)>0)   entries.push({workTypeId:"wt_other",workTypeName:"OTHER SALES",amount:Number(other),type:"sales",vehicles:0,rate:0});
    const report = {
      id: "sr_sales_office_"+date+"_"+Date.now(),
      date, supervisorId:user.id, counterId:"c1", counterName:"OFFICE",
      submittedAt: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
      entries, counters:[{counterName:"OFFICE",entries}],
      totalAmount: entries.reduce((s,e)=>s+e.amount,0),
      notes, status:"submitted", submittedBy:user.id,
    };
    setState(p=>({...p,serviceReports:[...p.serviceReports,report]}));
    DB.upsertReport(report).catch(console.error);
    toast.show("Sales entry saved ✅");
    setBardahl(""); setOther(""); setNotes("");
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Sales Entry</div>
      <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>Company-level Bardahl and product sales — not linked to any counter or executive</div>
      <Card style={{maxWidth:480}}>
        <Input label="Date" type="date" value={date} onChange={setDate}/>
        <div style={{background:T.navyXL,borderRadius:10,padding:16,margin:"14px 0"}}>
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
          {(Number(bardahl)+Number(other))>0&&(
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
    DB.upsertAttendance(atts).catch(e=>console.error("OwnAtt save:",e));
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
                  border:"1px solid "+(active?(status==="present"?T.lime:status==="absent"?T.red:T.amber):T.bdrS),
                  background:active?(status==="present"?T.lime:status==="absent"?T.redL:T.amberL):"transparent",
                  color:active?(status==="present"?"#fff":status==="absent"?T.red:T.amberD):T.txt2
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
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");
  const [reason, setReason] = useState("");
  const [forStaff, setForStaff] = useState(user.id); // who the leave is for

  // Staff this executive manages (for applying on behalf)
  const myStaff = state.users.filter(u=>u.managerId===user.id&&u.active!==false);
  const isExec  = mode==="executive" || user.role==="supervisor";

  // Pending approvals: leaves from my staff waiting for approval
  const pending = (state.plannedLeaves||[]).filter(l=>{
    const staff = state.users.find(u=>u.id===l.userId);
    return staff?.managerId===user.id && l.status==="pending";
  });

  // My own leaves (or the selected staff member's)
  const myLeaves = (state.plannedLeaves||[])
    .filter(l=>l.userId===forStaff||l.userId===user.id)
    .sort((a,b)=>(b.appliedOn||"").localeCompare(a.appliedOn||""));

  const submit = () => {
    if (!from||!to||!reason) { toast.show("Fill all fields","error"); return; }
    const targetUser = state.users.find(u=>u.id===forStaff)||state.users.find(u=>u.id===user.id);
    const leave = {
      id: "pl_"+Date.now(),
      userId: forStaff,
      staffName: targetUser?.name||"",
      supervisorId: targetUser?.managerId||user.id,
      approverId: (()=>{
        // Find the correct approver: manager of the target user
        const tu = targetUser || state.users.find(u=>u.id===user.id);
        // If target is field staff, their supervisor's manager approves
        const tuSup = tu?.role==="field_staff" ? state.users.find(u=>u.id===tu.managerId) : tu;
        return tuSup?.managerId || tu?.managerId || user.managerId || "";
      })(),
      fromDate: from, toDate: to, reason,
      status: "pending",
      appliedOn: today(),
      appliedBy: user.id,
      decidedOn: null,
    };
    setState(p=>({...p, plannedLeaves:[...(p.plannedLeaves||[]), leave]}));
    DB.upsertPlannedLeave(leave).catch(console.error);
    toast.show("Leave request submitted ✅");
    setFrom(""); setTo(""); setReason(""); setForStaff(user.id);
  };

  const decide = (id, status) => {
    const updated = (state.plannedLeaves||[]).map(l=>
      l.id===id ? {...l, status, decidedOn:today(), decidedBy:user.id} : l
    );
    setState(p=>({...p, plannedLeaves:updated}));
    const leave = updated.find(l=>l.id===id);
    if (leave) DB.upsertPlannedLeave(leave).catch(console.error);
    toast.show(status==="approved"?"Leave approved ✅":"Leave rejected");
  };

  return (
    <div>
      {/* Pending approvals for this executive/manager */}
      {pending.length > 0 && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:15,fontWeight:800,marginBottom:12,color:T.red}}>⏳ Pending Approvals ({pending.length})</div>
          {pending.map(l=>{
            const staff = state.users.find(u=>u.id===l.userId);
            return (
              <Card key={l.id} style={{marginBottom:10,borderLeft:"3px solid "+T.amber}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700}}>{l.staffName||staff?.name}</div>
                    <div style={{fontSize:12,color:T.txt2}}>{fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</div>
                    <div style={{fontSize:13,marginTop:4,color:T.txt}}>{l.reason}</div>
                    <div style={{fontSize:11,color:T.txt3}}>Applied: {fmtDate(l.appliedOn)}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Btn onClick={()=>decide(l.id,"approved")} variant="success" size="sm">✅ Approve</Btn>
                    <Btn onClick={()=>decide(l.id,"rejected")} variant="danger" size="sm">❌ Reject</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply leave form */}
      <div style={{fontSize:15,fontWeight:800,marginBottom:12}}>Apply Leave</div>
      <Card style={{maxWidth:520,marginBottom:20}}>
        {/* Staff selection for executives */}
        {isExec && myStaff.length > 0 && (
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>For (self or staff member)</label>
            <select value={forStaff} onChange={e=>setForStaff(e.target.value)}
              style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
              <option value={user.id}>Myself ({state.users.find(u=>u.id===user.id)?.name})</option>
              {myStaff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
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

      {/* My leave history */}
      {myLeaves.length > 0 && (
        <>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>
            {forStaff===user.id ? "My Leave Requests" : state.users.find(u=>u.id===forStaff)?.name+"'s Leaves"}
          </div>
          <Table cols={[
            {key:"staffName",label:"Staff",render:r=>r.staffName||state.users.find(u=>u.id===r.userId)?.name||"—"},
            {key:"fromDate",label:"From",render:r=>fmtDate(r.fromDate)},
            {key:"toDate",label:"To",render:r=>fmtDate(r.toDate)},
            {key:"reason",label:"Reason"},
            {key:"status",label:"Status",render:r=><Badge color={r.status==="approved"?T.grn:r.status==="rejected"?T.red:T.amber}>{r.status}</Badge>},
            {key:"decidedOn",label:"Decided",render:r=>r.decidedOn?fmtDate(r.decidedOn):"—"},
          ]} rows={myLeaves}/>
        </>
      )}
    </div>
  );
}



function CollectionDashboard({ state, user, isAdmin }) {
  const dr = useDateRange("month");

  // All collection reports in range
  const allReps = (state.collectionReports||[]).filter(r=>r.date>=dr.from&&r.date<=dr.to);

  // Summary per date
  const byDate = {};
  allReps.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { date:r.date, bank:0, expenses:0, net:0, bankBreakdown:[], expBreakdown:[] };
    const bank = (r.bankEntries||[]).reduce((s,b)=>s+(Number(b.amount)||0),0);
    const exp  = (r.expenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
    byDate[r.date].bank     += bank;
    byDate[r.date].expenses += exp;
    byDate[r.date].net      += bank - exp;
    byDate[r.date].bankBreakdown.push(...(r.bankEntries||[]));
    byDate[r.date].expBreakdown.push(...(r.expenses||[]));
  });
  const rows = Object.values(byDate).sort((a,b)=>b.date.localeCompare(a.date));

  const totalBank = rows.reduce((s,r)=>s+r.bank,0);
  const totalExp  = rows.reduce((s,r)=>s+r.expenses,0);
  const totalNet  = totalBank - totalExp;

  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Collection Report Dashboard</div>
      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <Card style={{textAlign:"center",padding:16}}>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase",fontWeight:700}}>Total Bank In</div>
          <div style={{fontSize:22,fontWeight:800,color:T.navy}}>{fmtCurr(totalBank)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:16}}>
          <div style={{fontSize:11,color:T.red,textTransform:"uppercase",fontWeight:700}}>Total Expenses</div>
          <div style={{fontSize:22,fontWeight:800,color:T.red}}>{fmtCurr(totalExp)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:16,background:totalNet>=0?T.grnL:T.redL,border:"1px solid "+(totalNet>=0?T.grn:T.red)}}>
          <div style={{fontSize:11,color:totalNet>=0?T.grn:T.red,textTransform:"uppercase",fontWeight:700}}>Net Collection</div>
          <div style={{fontSize:22,fontWeight:800,color:totalNet>=0?T.grn:T.red}}>{fmtCurr(totalNet)}</div>
        </Card>
        <Card style={{textAlign:"center",padding:16}}>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase",fontWeight:700}}>Days Reported</div>
          <div style={{fontSize:22,fontWeight:800,color:T.amber}}>{rows.length}</div>
        </Card>
      </div>

      {rows.length===0 && (
        <Card><div style={{textAlign:"center",padding:24,color:T.txt3}}>No collection reports for selected period</div></Card>
      )}

      {/* Per-date breakdown */}
      {rows.map(r=>(
        <Card key={r.date} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>setExpanded(expanded===r.date?null:r.date)}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{fmtDate(r.date)}</div>
              <div style={{fontSize:12,color:T.txt2}}>Bank: {fmtCurr(r.bank)} · Expenses: {fmtCurr(r.expenses)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18,fontWeight:800,color:r.net>=0?T.grn:T.red}}>{fmtCurr(r.net)}</div>
              <div style={{fontSize:11,color:T.txt2}}>Net Collection</div>
            </div>
          </div>

          {expanded===r.date && (
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+T.bdr}}>
              {r.bankBreakdown.length>0 && (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:T.navy,marginBottom:6,textTransform:"uppercase"}}>Bank Deposits</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
                    <tbody>
                      {r.bankBreakdown.map((b,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid "+T.bdr}}>
                          <td style={{padding:"5px 8px"}}>{b.bank||b.description||"—"}</td>
                          <td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:T.navy}}>{fmtCurr(b.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {r.expBreakdown.length>0 && (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:T.red,marginBottom:6,textTransform:"uppercase"}}>Expenses</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <tbody>
                      {r.expBreakdown.map((e,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid "+T.bdr}}>
                          <td style={{padding:"5px 8px"}}>{e.desc||e.description||"—"}</td>
                          <td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:T.red}}>{fmtCurr(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </Card>
      ))}
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
    if(!m&&r.supervisorId){ const sc=state.counters.filter(c=>c.supervisorId===r.supervisorId||(c.supervisorIds||[]).includes(r.supervisorId)); if(sc.length===1) m=sc[0]; }
    return m;
  };
  const unmatched = todayReps.filter(r=>!matchCounter(r));
  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Debug Reports</div>
      <Card style={{marginBottom:16,background:"#0f1117",color:"#4ade80"}}>
        <div style={{fontWeight:800,marginBottom:8,color:"#fbbf24"}}>TODAY {tod}: {todayReps.length} reports · Total ₹{todayReps.reduce((s,r)=>s+r.totalAmount,0).toLocaleString("en-IN")}</div>
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
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:"#fbbf24"}}>₹{r.totalAmount}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:ctr?"#4ade80":"#f87171"}}>{ctr?ctr.name:"NO MATCH"}</td>
                  <td style={{padding:"3px 8px",border:"1px solid #334",color:ctr?"#4ade80":"#f87171"}}>{ctr?"✅":"❌"}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>
      <Card style={{background:"#0f1117",color:"#4ade80"}}>
        <div style={{fontWeight:800,marginBottom:8,color:"#fbbf24"}}>COUNTERS ({state.counters.length})</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:"#1e293b",color:"#fbbf24"}}>
            {["id","name","supervisorId","supervisorIds","Supervisor"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"left",border:"1px solid #334"}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {state.counters.map((c,i)=>{ const sup=state.users.find(u=>u.id===c.supervisorId); return (
              <tr key={i}>
                <td style={{padding:"3px 8px",border:"1px solid #334"}}>{c.id}</td>
                <td style={{padding:"3px 8px",border:"1px solid #334",color:"#fbbf24"}}>{c.name}</td>
                <td style={{padding:"3px 8px",border:"1px solid #334",color:c.supervisorId?"#4ade80":"#f87171"}}>{c.supervisorId||"EMPTY"}</td>
                <td style={{padding:"3px 8px",border:"1px solid #334",color:"#93c5fd"}}>{(c.supervisorIds||[]).join(", ")||"—"}</td>
                <td style={{padding:"3px 8px",border:"1px solid #334"}}>{sup?.name||"?"}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </Card>
    </div>
  );
}


// ─── Daily Counter Note / Staff Comment ──────────────────────────────────────

function DailyNotePortal({ user, state, setState, toast }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [date, setDate]         = useState(today());

  // Determine counters for this user
  const myCounters = state.counters.filter(c=>
    c.supervisorId===user.id || (c.supervisorIds||[]).includes(user.id) ||
    (user.role==="office" && c.name==="OFFICE")
  );
  const [selCounter, setSelCounter] = useState("");

  const myNotes = (state.feedback||[])
    .filter(f=>f.type==="internal"&&f.userId===user.id)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const submit = async () => {
    if (!message.trim()) { toast.show("Please enter your note","error"); return; }
    const counter = selCounter
      ? state.counters.find(c=>c.id===selCounter)
      : myCounters[0];
    const note = {
      id: `note_${user.id}_${date}_${Date.now()}`,
      type: "internal",
      userId: user.id,
      userName: user.name,
      role: user.role,
      counterId: counter?.id||"",
      counterName: counter?.name||"",
      date,
      category,
      message: message.trim(),
      submittedAt: new Date().toISOString(),
      status: "unread",
    };
    setState(p=>({...p, feedback:[...(p.feedback||[]), note]}));
    DB.upsertFeedback(note).catch(console.error);
    toast.show("Note submitted to manager ✅");
    setMessage("");
  };

  const cats = [
    {id:"general",  label:"General",      icon:"💬"},
    {id:"demand",   label:"Demand/Need",   icon:"📦"},
    {id:"issue",    label:"Issue/Problem", icon:"⚠️"},
    {id:"suggestion",label:"Suggestion",  icon:"💡"},
    {id:"achievement",label:"Achievement",icon:"🏆"},
  ];

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Daily Counter Note</div>
      <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>Send a note to your manager about counter demands, issues or updates</div>

      <Card style={{maxWidth:560,marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <Input label="Date" type="date" value={date} onChange={setDate}/>
          {myCounters.length > 1 && (
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Counter</label>
              <select value={selCounter} onChange={e=>setSelCounter(e.target.value)}
                style={{width:"100%",padding:"9px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}>
                {myCounters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Category selector */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:8,textTransform:"uppercase"}}>Category</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {cats.map(c=>(
              <button key={c.id} onClick={()=>setCategory(c.id)} style={{
                padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                border:"1px solid "+(category===c.id?T.navy:T.bdrS),
                background:category===c.id?T.navy:"transparent",
                color:category===c.id?"#fff":T.txt2,transition:"all .15s"
              }}>{c.icon} {c.label}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.txt2,marginBottom:5,textTransform:"uppercase"}}>Message</label>
          <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4}
            placeholder="Describe your demand, issue, or update for the day..."
            style={{width:"100%",padding:"9px 12px",border:"1px solid "+(message?T.navy:T.bdrS),
              borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
          <div style={{fontSize:11,color:T.txt2,marginTop:4,textAlign:"right"}}>{message.length} chars</div>
        </div>
        <Btn onClick={submit} variant="amber" disabled={!message.trim()}>📤 Submit Note</Btn>
      </Card>

      {/* My note history */}
      {myNotes.length > 0 && (
        <div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>My Notes ({myNotes.length})</div>
          {myNotes.slice(0,10).map(n=>(
            <Card key={n.id} style={{marginBottom:8,borderLeft:`3px solid ${
              n.category==="issue"?"#ef4444":n.category==="demand"?"#f59e0b":
              n.category==="achievement"?"#10b981":n.category==="suggestion"?"#6366f1":T.navy}`}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:11,background:T.navyXL,color:T.navy,padding:"2px 8px",borderRadius:20,fontWeight:700}}>
                      {cats.find(c=>c.id===n.category)?.icon} {cats.find(c=>c.id===n.category)?.label||n.category}
                    </span>
                    {n.counterName&&<span style={{fontSize:11,color:T.txt2}}>📍 {n.counterName}</span>}
                  </div>
                  <div style={{fontSize:13}}>{n.message}</div>
                </div>
                <div style={{textAlign:"right",fontSize:11,color:T.txt2,whiteSpace:"nowrap"}}>
                  <div>{fmtDate(n.date)}</div>
                  <Badge color={n.status==="read"?T.grn:T.amber} style={{marginTop:4}}>{n.status==="read"?"Read":"Unread"}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Manager/MD: View Staff Notes ────────────────────────────────────────────

function StaffNotesViewer({ user, state, setState, toast }) {
  const [filterCat, setFilterCat]     = useState("all");
  const [filterStatus, setFilterStatus] = useState("unread");
  const [search, setSearch]           = useState("");
  const dr = useDateRange("week");

  const cats = [
    {id:"all",label:"All"},
    {id:"general",label:"💬 General"},
    {id:"demand",label:"📦 Demand"},
    {id:"issue",label:"⚠️ Issue"},
    {id:"suggestion",label:"💡 Suggestion"},
    {id:"achievement",label:"🏆 Achievement"},
  ];

  const isMyStaff = (userId) => {
    const u = state.users.find(x=>x.id===userId);
    if (!u) return false;
    if (u.managerId===user.id) return true;
    // Also show notes from staff whose supervisor reports to this manager
    const sup = state.users.find(x=>x.id===u.managerId);
    if (sup?.managerId===user.id) return true;
    // MD sees all
    if (user.role==="md") return true;
    return false;
  };

  const notes = (state.feedback||[])
    .filter(n=>n.type==="internal")
    .filter(n=>isMyStaff(n.userId))
    .filter(n=>n.date>=dr.from&&n.date<=dr.to)
    .filter(n=>filterCat==="all"||n.category===filterCat)
    .filter(n=>filterStatus==="all"||n.status===filterStatus)
    .filter(n=>!search||n.userName?.toLowerCase().includes(search.toLowerCase())||n.message?.toLowerCase().includes(search.toLowerCase())||n.counterName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const unreadCount = notes.filter(n=>n.status==="unread").length;

  const markRead = (id) => {
    const updated = (state.feedback||[]).map(f=>f.id===id?{...f,status:"read",readAt:new Date().toISOString()}:f);
    setState(p=>({...p,feedback:updated}));
    const note = updated.find(f=>f.id===id);
    if (note) DB.upsertFeedback(note).catch(console.error);
  };

  const markAllRead = () => {
    const updated = (state.feedback||[]).map(f=>
      notes.find(n=>n.id===f.id) ? {...f,status:"read",readAt:new Date().toISOString()} : f
    );
    setState(p=>({...p,feedback:updated}));
    notes.forEach(n=>DB.upsertFeedback({...n,status:"read"}).catch(console.error));
    toast.show("All notes marked as read ✅");
  };

  const catColors = {demand:"#f59e0b",issue:"#ef4444",suggestion:"#6366f1",achievement:"#10b981",general:T.navy};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:18,fontWeight:800}}>Staff Notes</div>
          {unreadCount>0&&<div style={{fontSize:12,color:T.red,fontWeight:600}}>{unreadCount} unread</div>}
        </div>
        {unreadCount>0&&<Btn onClick={markAllRead} size="sm" variant="outline">Mark All Read</Btn>}
      </div>

      <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center",marginTop:8}}>
        {["all","unread","read"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{
            padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(filterStatus===s?T.navy:T.bdrS),background:filterStatus===s?T.navy:"transparent",color:filterStatus===s?"#fff":T.txt2
          }}>{s==="all"?"All":s==="unread"?"Unread":"Read"}</button>
        ))}
        <div style={{width:1,height:20,background:T.bdr}}/>
        {cats.map(c=>(
          <button key={c.id} onClick={()=>setFilterCat(c.id)} style={{
            padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(filterCat===c.id?"#6366f1":T.bdrS),background:filterCat===c.id?"#6366f1":"transparent",color:filterCat===c.id?"#fff":T.txt2
          }}>{c.label}</button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff, counter, message..."
          style={{padding:"5px 12px",border:"1px solid "+T.bdrS,borderRadius:20,fontSize:12,fontFamily:"inherit",outline:"none",flex:1,minWidth:160}}/>
      </div>

      {notes.length===0&&<Card><div style={{textAlign:"center",padding:20,color:T.txt3}}>No notes for selected period</div></Card>}

      {notes.map(n=>(
        <Card key={n.id} style={{marginBottom:8,borderLeft:`3px solid ${catColors[n.category]||T.navy}`,
          background:n.status==="unread"?"#FFFDF7":"#fff",opacity:n.status==="read"?.85:1}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:13}}>{n.userName}</span>
                <Badge color={ROLE_COLORS[n.role]||T.navy}>{ROLE_LABELS[n.role]||n.role}</Badge>
                {n.counterName&&<span style={{fontSize:11,color:T.txt2}}>📍 {n.counterName}</span>}
                <span style={{fontSize:11,background:catColors[n.category]+"22",color:catColors[n.category]||T.navy,padding:"1px 8px",borderRadius:20,fontWeight:700}}>
                  {cats.find(c=>c.id===n.category)?.label||n.category}
                </span>
              </div>
              <div style={{fontSize:13,lineHeight:1.5}}>{n.message}</div>
            </div>
            <div style={{textAlign:"right",minWidth:80}}>
              <div style={{fontSize:11,color:T.txt2}}>{fmtDate(n.date)}</div>
              <div style={{fontSize:10,color:T.txt3,marginTop:2}}>{n.submittedAt?.split("T")[1]?.slice(0,5)||""}</div>
              {n.status==="unread"&&(
                <button onClick={()=>markRead(n.id)} style={{
                  marginTop:6,padding:"3px 10px",borderRadius:20,fontSize:11,cursor:"pointer",
                  border:"1px solid "+T.navy,background:"transparent",color:T.navy,fontFamily:"inherit",fontWeight:600
                }}>Mark Read</button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// INVENTORY MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ─── Stock Check-in (Office/Manager enters stock received from godown) ────────
function StockCheckin({ user, state, setState, toast }) {
  const [rows, setRows]     = useState([{ productName:"", qty:"", unit:"pcs", notes:"" }]);
  const [date, setDate]     = useState(today());
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows(p=>[...p,{productName:"",qty:"",unit:"pcs",notes:""}]);
  const rmRow  = i => setRows(p=>p.filter((_,j)=>j!==i));
  const upRow  = (i,k,v) => setRows(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r));

  const submit = async () => {
    const valid = rows.filter(r=>r.productName.trim() && Number(r.qty)>0);
    if (!valid.length) { toast.show("Add at least one product with quantity","error"); return; }
    setSaving(true);

    // Build new inventory by copying each item immutably
    const inv = [...(state.inventory||[])];
    const txs = [];

    valid.forEach(row => {
      const name = row.productName.trim();
      const qty  = Number(row.qty);
      const idx  = inv.findIndex(i=>i.productName===name);
      if (idx >= 0) {
        // Replace the item with a new object (immutable)
        inv[idx] = { ...inv[idx], currentStock: Number(inv[idx].currentStock||0) + qty,
          lastUpdated:date, updatedBy:user.id };
      } else {
        inv.push({ id:`inv_${name.toLowerCase().replace(/[^a-z0-9]/g,"_")}_${Date.now()}`,
          productName:name, unit:row.unit||"pcs",
          currentStock:qty, minStock:0, lastUpdated:date, updatedBy:user.id });
      }
      txs.push({ id:`tx_ci_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        date, type:"checkin", productName:name, qty,
        counterId:"GODOWN", counterName:"Godown", notes:row.notes||"", doneBy:user.id });
    });

    setState(p=>({...p, inventory:inv,
      stockTransactions:[...(p.stockTransactions||[]),...txs]}));
    await DB.upsertInventory(inv).catch(console.error);
    for (const tx of txs) await DB.upsertStockTransaction(tx).catch(console.error);
    toast.show(`✅ Checked in ${valid.length} product(s)`);
    setRows([{productName:"",qty:"",unit:"pcs",notes:""}]);
    setSaving(false);
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Godown Check-in</div>
      <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>Enter stock received from the godown</div>
      <Card style={{marginBottom:20}}>
        <Input label="Date" type="date" value={date} onChange={setDate} style={{maxWidth:200,marginBottom:14}}/>

        {/* Current stock summary */}
        {state.inventory?.length>0 && (
          <div style={{background:T.navyXL,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12}}>
            <b>Current Stock:</b>{" "}
            {(state.inventory||[]).map(i=>`${i.productName}: ${i.currentStock} ${i.unit}`).join(" · ")}
          </div>
        )}

        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12,minWidth:500}}>
          <thead>
            <tr style={{background:T.navyXL}}>
              {["Product","Qty","Unit","Notes",""].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:T.txt2,textTransform:"uppercase"}}>{h}</th>
              ))}
              </tr></thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} style={{borderBottom:"1px solid "+T.bdr}}>
                <td style={{padding:"5px 6px"}}>
                  <input list="ci-products" value={row.productName}
                    onChange={e=>upRow(i,"productName",e.target.value)}
                    placeholder="Product name..."
                    style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                </td>
                <td style={{padding:"5px 6px",width:80}}>
                  <input type="number" value={row.qty} min="0"
                    onChange={e=>upRow(i,"qty",e.target.value)}
                    style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                </td>
                <td style={{padding:"5px 6px",width:80}}>
                  <select value={row.unit} onChange={e=>upRow(i,"unit",e.target.value)}
                    style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}>
                    {["pcs","ltr","kg","ml","gm","box","roll","pair"].map(u=><option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{padding:"5px 6px"}}>
                  <input value={row.notes} onChange={e=>upRow(i,"notes",e.target.value)}
                    placeholder="Optional..."
                    style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                </td>
                <td style={{padding:"5px 6px",width:36,textAlign:"center"}}>
                  <button onClick={()=>rmRow(i)}
                    style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.red,lineHeight:1}}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="ci-products">
          {(state.workTypes||[]).map(w=><option key={w.id} value={w.name}/>)}
          {(state.inventory||[]).map(i=><option key={i.id} value={i.productName}/>)}
        </datalist>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={addRow} variant="outline" size="sm">+ Add Row</Btn>
          <Btn onClick={submit} variant="amber" disabled={saving}>
            {saving?"Saving...":"💾 Check In Stock"}
          </Btn>
        </div>
      </Card>

      {/* Recent check-ins */}
      {(state.stockTransactions||[]).filter(t=>t.type==="checkin").slice(0,5).length>0 && (
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:T.txt2}}>Recent Check-ins</div>
          {(state.stockTransactions||[]).filter(t=>t.type==="checkin")
            .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(tx=>(
            <div key={tx.id} style={{fontSize:12,color:T.txt2,padding:"4px 0",borderBottom:"1px solid "+T.bdr}}>
              {fmtDate(tx.date)} · <b>{tx.productName}</b> · +{tx.qty} {tx.unit||"pcs"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockRequest({ user, state, setState, toast }) {
  const myCounter = state.counters.find(c=>
    c.supervisorId===user.id||(c.supervisorIds||[]).includes(user.id)||
    (user.role==="office"&&c.name==="OFFICE")
  );
  const [rows, setRows]       = useState([{productName:"",qty:"",notes:""}]);
  const [urgency, setUrgency] = useState("normal");
  const [saving, setSaving]   = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [editRows, setEditRows]     = useState([]);

  const addRow = () => setRows(p=>[...p,{productName:"",qty:"",notes:""}]);
  const rmRow  = i => setRows(p=>p.filter((_,j)=>j!==i));
  const upRow  = (i,k,v) => setRows(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r));

  const myRequests = (state.stockRequests||[])
    .filter(r=>r.requestedBy===user.id)
    .sort((a,b)=>b.date.localeCompare(a.date));

  const submit = async () => {
    const valid = rows.filter(r=>r.productName.trim()&&Number(r.qty)>0);
    if (!valid.length) { toast.show("Add at least one product with quantity","error"); return; }
    if (!myCounter) { toast.show("No counter assigned to you","error"); return; }
    setSaving(true);
    const req = {
      id:`req_${user.id}_${Date.now()}`,
      date:today(), counterId:myCounter.id, counterName:myCounter.name,
      requestedBy:user.id, requestedByName:user.name,
      items: valid.map(r=>({
        productName:r.productName.trim(), qty:Number(r.qty),
        approvedQty:null, notes:r.notes||"", urgency
      })),
      status:"pending", notes:"", approvedBy:null, approvedAt:null,
    };
    setState(p=>({...p, stockRequests:[...(p.stockRequests||[]),req]}));
    await DB.upsertStockRequest(req).catch(console.error);
    toast.show(`📦 Request submitted — ${valid.length} item(s)`);
    setRows([{productName:"",qty:"",notes:""}]);
    setSaving(false);
  };

  const saveEdit = async (req) => {
    const valid = editRows.filter(r=>r.productName.trim()&&Number(r.qty)>0);
    if (!valid.length) { toast.show("At least one item required","error"); return; }
    const updated = {...req, items:valid.map(r=>({...r,qty:Number(r.qty),approvedQty:null}))};
    setState(p=>({...p,stockRequests:p.stockRequests.map(r=>r.id===req.id?updated:r)}));
    await DB.upsertStockRequest(updated).catch(console.error);
    toast.show("Request updated ✅");
    setEditingReq(null);
  };

  const cancelReq = async (req) => {
    const updated = {...req, status:"cancelled"};
    setState(p=>({...p,stockRequests:p.stockRequests.map(r=>r.id===req.id?updated:r)}));
    await DB.upsertStockRequest(updated).catch(console.error);
    toast.show("Request cancelled");
  };

  const statusColor = s=>({pending:T.amber,approved:T.grn,partial:"#7C3AED",rejected:T.red,cancelled:T.txt2}[s]||T.txt2);

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Request Stock</div>
      <div style={{fontSize:13,color:T.txt2,marginBottom:16}}>
        Request products for <b>{myCounter?.name||"your counter"}</b>
      </div>
      {!myCounter && <Card><div style={{color:T.red,padding:12}}>⚠ No counter assigned. Contact IT Admin.</div></Card>}
      {myCounter && (
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:T.navy}}>📍 {myCounter.name}</span>
            <div style={{marginLeft:"auto",display:"flex",gap:6}}>
              {["normal","urgent"].map(u=>(
                <button key={u} onClick={()=>setUrgency(u)} style={{
                  padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  border:"1px solid "+(urgency===u?(u==="urgent"?T.red:T.navy):T.bdrS),
                  background:urgency===u?(u==="urgent"?T.redL:T.navyXL):"transparent",
                  color:urgency===u?(u==="urgent"?T.red:T.navy):T.txt2
                }}>{u==="urgent"?"🔴 Urgent":"🟢 Normal"}</button>
              ))}
            </div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
            <thead><tr style={{background:T.navyXL}}>
              {["Product","Qty Needed","Notes",""].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:T.txt2,textTransform:"uppercase"}}>{h}</th>
              ))}
                                  </tr></thead>
            <tbody>
              {rows.map((row,i)=>(
                <tr key={i} style={{borderBottom:"1px solid "+T.bdr}}>
                  <td style={{padding:"5px 6px"}}>
                    <input list="req-products" value={row.productName}
                      onChange={e=>upRow(i,"productName",e.target.value)}
                      placeholder="Product..."
                      style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  </td>
                  <td style={{padding:"5px 6px",width:90}}>
                    <input type="number" value={row.qty} min="1"
                      onChange={e=>upRow(i,"qty",e.target.value)}
                      style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  </td>
                  <td style={{padding:"5px 6px"}}>
                    <input value={row.notes} onChange={e=>upRow(i,"notes",e.target.value)}
                      placeholder="Reason..."
                      style={{width:"100%",padding:"6px 8px",border:"1px solid "+T.bdrS,borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  </td>
                  <td style={{padding:"5px 6px",width:36,textAlign:"center"}}>
                    <button onClick={()=>rmRow(i)}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.red}}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="req-products">
            {(state.workTypes||[]).map(w=><option key={w.id} value={w.name}/>)}
            {(state.inventory||[]).map(i=><option key={i.id} value={i.productName}/>)}
          </datalist>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={addRow} variant="outline" size="sm">+ Add Row</Btn>
            <Btn onClick={submit} variant="amber" disabled={saving}>
              {saving?"Submitting...":"📤 Submit Request"}
            </Btn>
          </div>
        </Card>
      )}

      {myRequests.length>0 && (
        <div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>My Requests ({myRequests.length})</div>
          {myRequests.map(req=>(
            <Card key={req.id} style={{marginBottom:8,borderLeft:`3px solid ${statusColor(req.status)}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{fmtDate(req.date)} · {req.items.length} item(s)</div>
                  {editingReq!==req.id && (
                    <>
                      <div style={{fontSize:12,color:T.txt2,marginTop:2}}>
                        {req.items.map(it=>`${it.productName} × ${it.qty}`).join(" | ")}
                      </div>
                      {(req.status==="approved"||req.status==="partial") && (
                        <div style={{fontSize:11,color:T.grn,marginTop:2,fontWeight:600}}>
                          ✅ Released: {req.items.filter(it=>Number(it.approvedQty)>0)
                            .map(it=>`${it.productName} × ${it.approvedQty}`).join(" | ")}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <Badge color={statusColor(req.status)}>{req.status}</Badge>
                  {req.status==="pending" && editingReq!==req.id && <>
                    <Btn onClick={()=>{setEditingReq(req.id);setEditRows(req.items.map(it=>({...it})));}} size="sm" variant="outline">✏️ Edit</Btn>
                    <Btn onClick={()=>cancelReq(req)} size="sm" variant="danger">✕ Cancel</Btn>
                  </>}
                  {(req.status==="cancelled"||req.status==="rejected") && (
                    <Btn onClick={()=>{
                      if(!confirm("Delete this request?")) return;
                      setState(p=>({...p,stockRequests:p.stockRequests.filter(r=>r.id!==req.id)}));
                      supabase.from("stock_requests").delete().eq("id",req.id).catch(console.error);
                      toast.show("Request deleted");
                    }} size="sm" variant="danger">🗑 Delete</Btn>
                  )}
                  {req.status==="pending" && editingReq===req.id && <>
                    <Btn onClick={()=>saveEdit(req)} size="sm" variant="amber">💾 Save</Btn>
                    <Btn onClick={()=>setEditingReq(null)} size="sm" variant="ghost">Cancel</Btn>
                  </>}
                </div>
              </div>
              {editingReq===req.id && (
                <div style={{marginTop:10,borderTop:"1px solid "+T.bdr,paddingTop:10}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:T.navyXL}}>
                      {["Product","Qty","Notes",""].map(h=><th key={h} style={{padding:"5px 8px",textAlign:"left",fontSize:10,fontWeight:700,color:T.txt2}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                       {editRows.map((row,i)=>(
                         <tr key={i} style={{borderBottom:"1px solid "+T.bdr}}>
                           <td style={{padding:"4px 5px"}}>
                             <input list="req-edit-products" value={row.productName} onChange={e=>setEditRows(p=>p.map((r,j)=>j===i?{...r,productName:e.target.value}:r))} style={{width:"100%",padding:"4px 6px",border:"1px solid "+T.bdrS,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                           </td>
                           <td style={{padding:"4px 5px",width:70}}>
                             <input type="number" value={row.qty} min="1" onChange={e=>setEditRows(p=>p.map((r,j)=>j===i?{...r,qty:e.target.value}:r))} style={{width:"100%",padding:"4px 6px",border:"1px solid "+T.bdrS,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                           </td>
                           <td style={{padding:"4px 5px"}}>
                             <input value={row.notes||""} onChange={e=>setEditRows(p=>p.map((r,j)=>j===i?{...r,notes:e.target.value}:r))} style={{width:"100%",padding:"4px 6px",border:"1px solid "+T.bdrS,borderRadius:5,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                           </td>
                           <td style={{padding:"4px 5px",width:30,textAlign:"center"}}>
                             <button onClick={()=>setEditRows(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:15}}>×</button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                  <datalist id="req-edit-products">
                    {(state.workTypes||[]).map(w=><option key={w.id} value={w.name}/>)}
                    {(state.inventory||[]).map(i=><option key={i.id} value={i.productName}/>)}
                  </datalist>
                  <Btn onClick={()=>setEditRows(p=>[...p,{productName:"",qty:"",notes:""}])} size="sm" variant="outline" style={{marginTop:6}}>+ Row</Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StockRequestsApproval({ user, state, setState, toast }) {
  const pending = (state.stockRequests||[]).filter(r=>r.status==="pending").sort((a,b)=>b.date.localeCompare(a.date));
  const history = (state.stockRequests||[]).filter(r=>r.status!=="pending").sort((a,b)=>b.date.localeCompare(a.date));
  const [editQtys, setEditQtys]   = useState({});
  const [expanded, setExpanded]   = useState(null);

  // Match inventory item by productName only (reliable)
  const findInv = (name) => (state.inventory||[]).find(x=>x.productName===name);

  const initEdit = (req) => {
    const qtys = {};
    req.items.forEach((it,i)=>{ qtys[i] = it.qty; });
    setEditQtys(p=>({...p,[req.id]:qtys}));
    setExpanded(req.id);
  };

  const approve = async (req, status) => {
    if (status==="rejected") {
      const updated = {...req, status:"rejected", approvedBy:user.id, approvedAt:new Date().toISOString()};
      setState(p=>({...p,stockRequests:p.stockRequests.map(r=>r.id===req.id?updated:r)}));
      await DB.upsertStockRequest(updated).catch(console.error);
      toast.show("❌ Request rejected");
      setExpanded(null);
      return;
    }

    // Compute approved quantities: capped at available stock
    const approvedItems = req.items.map((it,i)=>{
      const inv       = findInv(it.productName);
      const available = Number(inv?.currentStock||0);
      const requested = Number(it.qty)||0;
      const edited    = editQtys[req.id]?.[i];
      const want      = edited!==undefined ? Number(edited) : requested;
      const approvedQty = Math.min(Math.max(0, want), available);
      return {...it, approvedQty};
    });

    const anyReleased = approvedItems.some(it=>it.approvedQty>0);
    const allFulfilled = approvedItems.every(it=>it.approvedQty>=Number(it.qty));
    const finalStatus = anyReleased ? (allFulfilled?"approved":"partial") : "rejected";

    const updatedReq = {...req, items:approvedItems, status:finalStatus,
      approvedBy:user.id, approvedAt:new Date().toISOString()};

    // Deduct from inventory — build completely new array with new objects
    const newInventory = (state.inventory||[]).map(inv=>{
      const released = approvedItems.find(it=>it.productName===inv.productName);
      if (!released || !released.approvedQty) return inv;
      return {
        ...inv,
        currentStock: Math.max(0, Number(inv.currentStock||0) - Number(released.approvedQty)),
        lastUpdated: today(),
        updatedBy: user.id,
      };
    });

    // Create release transactions
    const txs = approvedItems
      .filter(it=>it.approvedQty>0)
      .map(it=>({
        id:`tx_rel_${req.id}_${it.productName.replace(/\s+/g,"_")}_${Date.now()}`,
        date:today(), type:"release", productName:it.productName, qty:it.approvedQty,
        counterId:req.counterId, counterName:req.counterName,
        requestId:req.id, notes:`Released by ${user.name}`, doneBy:user.id,
      }));

    setState(p=>({
      ...p,
      inventory: newInventory,
      stockRequests: p.stockRequests.map(r=>r.id===req.id?updatedReq:r),
      stockTransactions: [...(p.stockTransactions||[]), ...txs],
    }));

    await DB.upsertInventory(newInventory).catch(console.error);
    for (const tx of txs) await DB.upsertStockTransaction(tx).catch(console.error);
    await DB.upsertStockRequest(updatedReq).catch(console.error);

    toast.show(finalStatus==="approved"
      ? `✅ Approved — released ${approvedItems.reduce((s,i)=>s+i.approvedQty,0)} units across ${approvedItems.filter(i=>i.approvedQty>0).length} product(s)`
      : finalStatus==="partial"
      ? `⚡ Partial — some items had insufficient stock`
      : `❌ No stock available to release`
    );
    setExpanded(null);
  };

  const statusColor = s=>({pending:T.amber,approved:T.grn,partial:"#7C3AED",rejected:T.red,cancelled:T.txt2}[s]||T.txt2);

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Stock Requests</div>

      {pending.length===0&&history.length===0&&(
        <Card><div style={{textAlign:"center",padding:20,color:T.txt3}}>No stock requests yet</div></Card>
      )}

      {pending.length>0 && (
        <div style={{marginBottom:24}}>
          <div style={{fontSize:14,fontWeight:800,color:T.amber,marginBottom:10}}>⏳ Pending ({pending.length})</div>
          {pending.map(req=>(
            <Card key={req.id} style={{marginBottom:12,borderLeft:"4px solid "+T.amber}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:14}}>{req.counterName}</div>
                  <div style={{fontSize:12,color:T.txt2}}>{req.requestedByName} · {fmtDate(req.date)}</div>
                  {expanded!==req.id&&<div style={{fontSize:12,color:T.txt2,marginTop:4}}>
                    {req.items.map(it=>`${it.productName} × ${it.qty}`).join(" | ")}
                  </div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn onClick={()=>expanded===req.id?setExpanded(null):initEdit(req)} size="sm" variant="outline">
                    {expanded===req.id?"▲ Collapse":"▼ Review"}
                  </Btn>
                  <Btn onClick={()=>{
                    if(!confirm("Delete this pending request?")) return;
                    setState(p=>({...p,stockRequests:p.stockRequests.filter(r=>r.id!==req.id)}));
                    supabase.from("stock_requests").delete().eq("id",req.id).catch(console.error);
                    toast.show("Request deleted");
                  }} size="sm" variant="danger">🗑</Btn>
                </div>
              </div>

              {expanded===req.id && (
                <div style={{marginTop:12,borderTop:"1px solid "+T.bdr,paddingTop:12}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
                    <thead><tr style={{background:T.navyXL}}>
                      {["Product","Requested","Available","Release Qty","Status"].map(h=>(
                        <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:T.txt2,textTransform:"uppercase"}}>{h}</th>
                      ))}
                      </tr></thead>
                    <tbody>
                      {req.items.map((it,i)=>{
                        const inv       = findInv(it.productName);
                        const available = Number(inv?.currentStock||0);
                        const releaseQty = Number(editQtys[req.id]?.[i]??it.qty);
                        const canFulfil  = available >= it.qty;
                        return (
                          <tr key={i} style={{borderBottom:"1px solid "+T.bdr,
                            background:available===0?"#fff5f5":!canFulfil?"#fffbf0":"#f0fff4"}}>
                            <td style={{padding:"7px 10px",fontWeight:600}}>{it.productName}</td>
                            <td style={{padding:"7px 10px",textAlign:"center"}}>{it.qty}</td>
                            <td style={{padding:"7px 10px",textAlign:"center",fontWeight:700,
                              color:available===0?T.red:!canFulfil?T.amber:T.grn}}>{available}</td>
                            <td style={{padding:"7px 10px",width:90}}>
                              <input type="number" value={releaseQty}
                                min="0" max={available}
                                onChange={e=>setEditQtys(p=>({...p,[req.id]:{...p[req.id],[i]:e.target.value}}))}
                                style={{width:"100%",padding:"5px 8px",border:"1px solid "+
                                  (releaseQty>available?"#ef4444":T.bdrS),
                                  borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                            </td>
                            <td style={{padding:"7px 10px",fontSize:11}}>
                              {available===0?<span style={{color:T.red}}>Out of stock</span>
                                :!canFulfil?<span style={{color:T.amber}}>Partial only ({available} avail)</span>
                                :<span style={{color:T.grn}}>Can fulfil</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={()=>approve(req,"approved")} variant="success" size="sm">✅ Release Stock</Btn>
                    <Btn onClick={()=>approve(req,"rejected")} variant="danger"  size="sm">❌ Reject</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {history.length>0 && (
        <div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>History ({history.length})</div>
          {history.slice(0,30).map(req=>(
            <Card key={req.id} style={{marginBottom:8,borderLeft:`3px solid ${statusColor(req.status)}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>
                    {req.counterName} · <span style={{color:T.txt2,fontWeight:400}}>{req.requestedByName}</span>
                  </div>
                  <div style={{fontSize:12,color:T.txt2,marginTop:2}}>
                    {fmtDate(req.date)} · Requested: {req.items.map(it=>`${it.productName}×${it.qty}`).join(", ")}
                  </div>
                  {(req.status==="approved"||req.status==="partial")&&(
                    <div style={{fontSize:11,color:T.grn,marginTop:2}}>
                      Released: {req.items.filter(it=>Number(it.approvedQty)>0).map(it=>`${it.productName}×${it.approvedQty}`).join(", ")}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <Badge color={statusColor(req.status)}>{req.status}</Badge>
                  {req.status==="rejected"&&(
                    <Btn onClick={()=>{
                      const r2={...req,status:"pending",approvedBy:null,approvedAt:null,
                        items:req.items.map(it=>({...it,approvedQty:null}))};
                      setState(p=>({...p,stockRequests:p.stockRequests.map(r=>r.id===req.id?r2:r)}));
                      DB.upsertStockRequest(r2).catch(console.error);
                      toast.show("Request reopened");
                    }} size="sm" variant="outline">↩ Reopen</Btn>
                  )}
                  <Btn onClick={()=>{
                    if(!confirm("Delete this request record?")) return;
                    setState(p=>({...p,stockRequests:p.stockRequests.filter(r=>r.id!==req.id)}));
                    supabase.from("stock_requests").delete().eq("id",req.id).catch(console.error);
                    toast.show("Request deleted");
                  }} size="sm" variant="danger">🗑</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


function InventoryDashboard({ user, state, setState, toast }) {
  const [view, setView]   = useState("stock");   // stock | requests | transactions | monthly
  const [search, setSearch] = useState("");
  const dr = useDateRange("month");
  const selMonth = dr.from.slice(0,7);

  // Current stock
  const stockItems = (state.inventory||[]).filter(i=>!search||i.productName.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>a.productName.localeCompare(b.productName));

  // Requests in range
  const reqsInRange = (state.stockRequests||[]).filter(r=>r.date>=dr.from&&r.date<=dr.to)
    .sort((a,b)=>b.date.localeCompare(a.date));

  // Transactions in range
  const txsInRange = (state.stockTransactions||[]).filter(t=>t.date>=dr.from&&t.date<=dr.to)
    .sort((a,b)=>b.date.localeCompare(a.date));

  // Monthly pending (approved qty vs requested qty)
  const monthReqs = (state.stockRequests||[]).filter(r=>r.date.startsWith(selMonth));
  const monthPending = {};
  monthReqs.forEach(req => {
    req.items.forEach(it => {
      if (!monthPending[it.productName]) monthPending[it.productName] = {requested:0,released:0,pending:0};
      monthPending[it.productName].requested += Number(it.qty)||0;
      if (req.status==="approved"||req.status==="partial") {
        monthPending[it.productName].released += Number(it.approvedQty||it.qty)||0;
      }
    });
  });
  Object.keys(monthPending).forEach(k=>{
    monthPending[k].pending = monthPending[k].requested - monthPending[k].released;
  });

  const tabs = [{id:"stock",label:"📦 Stock"},{id:"requests",label:"📋 Requests"},{id:"transactions",label:"📜 Transactions"},{id:"monthly",label:"📅 Monthly"}];

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Inventory Dashboard</div>
      <Tabs tabs={tabs} active={view} onChange={setView}/>
      <div style={{marginTop:16}}>

        {/* ── STOCK VIEW ── */}
        {view==="stock" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
              <Card style={{textAlign:"center",padding:12}}>
                <div style={{fontSize:22,fontWeight:800,color:T.navy}}>{stockItems.length}</div>
                <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Products</div>
              </Card>
              <Card style={{textAlign:"center",padding:12}}>
                <div style={{fontSize:22,fontWeight:800,color:T.grn}}>{stockItems.reduce((s,i)=>s+i.currentStock,0)}</div>
                <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Total Units</div>
              </Card>
              <Card style={{textAlign:"center",padding:12}}>
                <div style={{fontSize:22,fontWeight:800,color:T.red}}>{stockItems.filter(i=>i.currentStock<=i.minStock&&i.minStock>0).length}</div>
                <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Low Stock</div>
              </Card>
              <Card style={{textAlign:"center",padding:12}}>
                <div style={{fontSize:22,fontWeight:800,color:T.amber}}>{(state.stockRequests||[]).filter(r=>r.status==="pending").length}</div>
                <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Pending Requests</div>
              </Card>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <Btn onClick={()=>{
                if(!confirm("Clear ALL stock quantities to 0? This cannot be undone.")) return;
                const updated = (state.inventory||[]).map(x=>({...x,currentStock:0,lastUpdated:today(),updatedBy:user.id}));
                setState(p=>({...p,inventory:updated}));
                DB.upsertInventory(updated).catch(console.error);
                toast.show("All stock cleared to 0");
              }} variant="danger" size="sm">⬜ Clear All Stock</Btn>
              <Btn onClick={()=>{
                if(!confirm("Delete ALL inventory records? This cannot be undone.")) return;
                setState(p=>({...p,inventory:[],stockTransactions:[],stockRequests:[]}));
                supabase.from("inventory").delete().neq("id","").catch(console.error);
                supabase.from("stock_transactions").delete().neq("id","").catch(console.error);
                supabase.from("stock_requests").delete().neq("id","").catch(console.error);
                toast.show("All inventory data cleared");
              }} variant="danger" size="sm">🗑 Clear All Data</Btn>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product..."
              style={{width:"100%",padding:"8px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:T.navy,color:"#fff"}}>
                  {["Product","Unit","Current Stock","Min Stock","Status","Last Updated","Updated By",""].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                  </tr></thead>
                <tbody>
                  {stockItems.length===0&&<tr><td colSpan={7} style={{padding:20,textAlign:"center",color:T.txt3}}>No inventory records yet. Check in stock first.</td></tr>}
                  {stockItems.map((item,i)=>{
                    const isLow = item.currentStock<=item.minStock&&item.minStock>0;
                    const isOut = item.currentStock<=0;
                    return (
                      <tr key={item.id} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr}}>
                        <td style={{padding:"8px 12px",fontWeight:600}}>{item.productName}</td>
                        <td style={{padding:"8px 12px",color:T.txt2}}>{item.unit}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:800,
                          color:isOut?T.red:isLow?T.amber:T.grn,fontSize:15}}>{item.currentStock}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:T.txt2}}>{item.minStock||"—"}</td>
                        <td style={{padding:"8px 12px"}}>
                          <Badge color={isOut?T.red:isLow?T.amber:T.grn}>{isOut?"Out of Stock":isLow?"Low Stock":"In Stock"}</Badge>
                        </td>
                        <td style={{padding:"8px 12px",fontSize:11,color:T.txt2}}>{fmtDate(item.lastUpdated)}</td>
                        <td style={{padding:"8px 12px",fontSize:11,color:T.txt2}}>{state.users.find(u=>u.id===item.updatedBy)?.name||item.updatedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REQUESTS VIEW ── */}
        {view==="requests" && (
          <div>
            <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
            <div style={{marginTop:12,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:T.navy,color:"#fff"}}>
                  {["Date","Counter","Requested By","Items","Status","Approved By",""].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11}}>{h}</th>
                  ))}
                  </tr></thead>
                <tbody>
                  {reqsInRange.length===0&&<tr><td colSpan={6} style={{padding:20,textAlign:"center",color:T.txt3}}>No requests for this period</td></tr>}
                  {reqsInRange.map((req,i)=>(
                    <tr key={req.id} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr}}>
                      <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{fmtDate(req.date)}</td>
                      <td style={{padding:"8px 12px",fontWeight:600}}>{req.counterName}</td>
                      <td style={{padding:"8px 12px"}}>{req.requestedByName}</td>
                      <td style={{padding:"8px 12px",fontSize:12,color:T.txt2}}>
                        {req.items.map(it=>`${it.productName}×${it.qty}`).join(", ")}
                      </td>
                      <td style={{padding:"8px 12px"}}>
                        <Badge color={{pending:T.amber,approved:T.grn,partial:"#7C3AED",rejected:T.red}[req.status]||T.txt2}>{req.status}</Badge>
                      </td>
                      <td style={{padding:"8px 12px",fontSize:12}}>{req.approvedBy?state.users.find(u=>u.id===req.approvedBy)?.name||req.approvedBy:"—"}</td>
                      <td style={{padding:"8px 12px",textAlign:"center"}}>
                        <button onClick={()=>{
                          if(!confirm("Delete this request record?")) return;
                          setState(p=>({...p,stockRequests:p.stockRequests.filter(x=>x.id!==req.id)}));
                          supabase.from("stock_requests").delete().eq("id",req.id).catch(console.error);
                          toast.show("Request deleted");
                        }} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:15,padding:"2px 6px"}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS VIEW ── */}
        {view==="transactions" && (
          <div>
            <DateRangePicker range={dr.range} setRange={dr.setRange} customFrom={dr.customFrom} setCustomFrom={dr.setCustomFrom} customTo={dr.customTo} setCustomTo={dr.setCustomTo}/>
            <div style={{marginTop:12,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:T.navy,color:"#fff"}}>
                  {["Date","Type","Product","Qty","Counter","Done By","Notes",""].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {txsInRange.length===0&&<tr><td colSpan={7} style={{padding:20,textAlign:"center",color:T.txt3}}>No transactions for this period</td></tr>}
                  {txsInRange.map((tx,i)=>(
                    <tr key={tx.id} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr}}>
                      <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{fmtDate(tx.date)}</td>
                      <td style={{padding:"8px 12px"}}>
                        <Badge color={tx.type==="checkin"?T.grn:tx.type==="release"?T.amber:T.navy}>{tx.type}</Badge>
                      </td>
                      <td style={{padding:"8px 12px",fontWeight:600}}>{tx.productName}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:tx.type==="checkin"?T.grn:T.red}}>
                        {tx.type==="checkin"?"+":"-"}{tx.qty}
                      </td>
                      <td style={{padding:"8px 12px"}}>{tx.counterName}</td>
                      <td style={{padding:"8px 12px",fontSize:12}}>{state.users.find(u=>u.id===tx.doneBy)?.name||tx.doneBy}</td>
                      <td style={{padding:"8px 12px",fontSize:12,color:T.txt2}}>{tx.notes}</td>
                      <td style={{padding:"8px 12px",textAlign:"center"}}>
                        <button onClick={()=>{
                          if(!confirm("Delete this transaction?")) return;
                          setState(p=>({...p,stockTransactions:p.stockTransactions.filter(x=>x.id!==tx.id)}));
                          supabase.from("stock_transactions").delete().eq("id",tx.id).catch(console.error);
                          toast.show("Transaction deleted");
                        }} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:15,padding:"2px 6px"}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MONTHLY PENDING ── */}
        {view==="monthly" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:T.txt2,textTransform:"uppercase",display:"block",marginBottom:4}}>Month</label>
                <input type="month" value={selMonth} onChange={e=>dr.setCustomFrom(e.target.value+"-01")}
                  style={{padding:"7px 12px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
              </div>
            </div>
            {Object.keys(monthPending).length===0
              ? <Card><div style={{textAlign:"center",padding:20,color:T.txt3}}>No requests this month</div></Card>
              : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{background:T.navy,color:"#fff"}}>
                    {["Product","Total Requested","Released","Pending","Fulfillment %"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {Object.entries(monthPending).map(([name,d],i)=>{
                      const pct = d.requested>0?Math.round(d.released/d.requested*100):0;
                      return (
                        <tr key={name} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr}}>
                          <td style={{padding:"8px 12px",fontWeight:600}}>{name}</td>
                          <td style={{padding:"8px 12px",textAlign:"right"}}>{d.requested}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:T.grn,fontWeight:700}}>{d.released}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:d.pending>0?T.red:T.grn,fontWeight:700}}>{d.pending}</td>
                          <td style={{padding:"8px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{flex:1,height:6,background:T.surf,borderRadius:3}}>
                                <div style={{height:6,borderRadius:3,width:pct+"%",background:pct>=80?T.grn:pct>=50?T.amber:T.red}}/>
                              </div>
                              <span style={{fontWeight:700,color:pct>=80?T.grn:pct>=50?T.amber:T.red,minWidth:36}}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            }
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Target Fulfillment Report ───────────────────────────────────────────────
function TargetFulfillmentReport({ user, state }) {
  const [view, setView]   = useState("counter");  // counter | executive | manager
  const [period, setPeriod] = useState("monthly");
  const [selRef, setSelRef] = useState(today().slice(0,7));
  const [expanded, setExpanded] = useState(null);

  const periods = [
    {id:"daily",label:"Daily"},{id:"weekly",label:"Weekly"},
    {id:"monthly",label:"Monthly"},{id:"quarterly",label:"Quarterly"},{id:"yearly",label:"Yearly"}
  ];

  // Get revenue for a supervisor in period
  const getRevenue = (supId) => {
    return (state.serviceReports||[]).filter(r => {
      if (!supId) return false;
      if (r.supervisorId !== supId) return false;
      if (period==="daily")   return r.date===selRef;
      if (period==="monthly") return r.date.startsWith(selRef);
      if (period==="yearly")  return r.date.startsWith(selRef);
      return r.date.startsWith(selRef.slice(0,7));
    }).reduce((s,r)=>s+r.totalAmount,0);
  };

  // Get target value for an id
  const getTarget = (id) => {
    const tgt = (state.targets||[]).find(t =>
      t.supervisorId===id || t.counterId===id
    );
    return tgt ? Number(tgt[period]||tgt.monthly||0) : 0;
  };

  // Build rows
  const counterRows = state.counters.filter(c=>c.name!=="OFFICE").map(c => {
    const execs   = state.users.filter(u=>c.supervisorId===u.id||(c.supervisorIds||[]).includes(u.id));
    const revenue = execs.reduce((s,e)=>s+getRevenue(e.id),0);
    const target  = getTarget(c.id) || execs.reduce((s,e)=>s+getTarget(e.id),0);
    const pct     = target>0 ? Math.round(revenue/target*100) : null;
    return {id:c.id, name:c.name, subtitle:execs.map(e=>e.name).join(", ")||"—",
      revenue, target, pct, execs};
  }).sort((a,b)=>(b.pct??-1)-(a.pct??-1));

  const execRows = state.users.filter(u=>u.role==="supervisor"&&u.active!==false).map(u => {
    const ctr     = state.counters.find(c=>c.supervisorId===u.id||(c.supervisorIds||[]).includes(u.id));
    const mgr     = state.users.find(m=>m.id===u.managerId);
    const revenue = getRevenue(u.id);
    const target  = getTarget(u.id) || getTarget(ctr?.id||"");
    const pct     = target>0 ? Math.round(revenue/target*100) : null;
    return {id:u.id, name:u.name, subtitle:(ctr?.name||"No counter")+(mgr?" · "+mgr.name:""),
      revenue, target, pct};
  }).sort((a,b)=>(b.pct??-1)-(a.pct??-1));

  const mgrRows = state.users.filter(u=>u.role==="manager"&&u.active!==false).map(u => {
    const myExecs  = state.users.filter(e=>e.role==="supervisor"&&e.managerId===u.id);
    const revenue  = myExecs.reduce((s,e)=>s+getRevenue(e.id),0);
    const target   = getTarget(u.id) || myExecs.reduce((s,e)=>s+getTarget(e.id),0);
    const pct      = target>0 ? Math.round(revenue/target*100) : null;
    return {id:u.id, name:u.name, subtitle:myExecs.length+" executives",
      revenue, target, pct, execs:myExecs};
  }).sort((a,b)=>(b.pct??-1)-(a.pct??-1));

  const rows = view==="counter" ? counterRows : view==="executive" ? execRows : mgrRows;
  const withTarget  = rows.filter(r=>r.target>0);
  const noTarget    = rows.filter(r=>!r.target);
  const achieved    = withTarget.filter(r=>r.pct>=100).length;
  const totalRev    = rows.reduce((s,r)=>s+r.revenue,0);
  const totalTarget = withTarget.reduce((s,r)=>s+r.target,0);
  const overallPct  = totalTarget>0 ? Math.round(totalRev/totalTarget*100) : null;

  const PctBar = ({pct}) => {
    if (pct===null) return <span style={{fontSize:11,color:T.txt3}}>No target</span>;
    const col = pct>=100?T.grn:pct>=75?T.amber:T.red;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:140}}>
        <div style={{flex:1,height:8,background:T.surf,borderRadius:4}}>
          <div style={{height:8,borderRadius:4,width:Math.min(pct,100)+"%",background:col,transition:"width .3s"}}/>
        </div>
        <span style={{fontWeight:800,color:col,minWidth:38,fontSize:13}}>{pct}%</span>
      </div>
    );
  };

  return (
    <div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>Target Fulfillment Report</div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
        <Card style={{textAlign:"center",padding:12}}>
          <div style={{fontSize:22,fontWeight:800,color:T.navy}}>{fmtCurr(totalRev)}</div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Total Revenue</div>
        </Card>
        <Card style={{textAlign:"center",padding:12}}>
          <div style={{fontSize:22,fontWeight:800,color:T.amber}}>{fmtCurr(totalTarget)}</div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Total Target</div>
        </Card>
        <Card style={{textAlign:"center",padding:12,background:overallPct>=100?T.grnL:overallPct>=75?T.amberL:T.redL}}>
          <div style={{fontSize:22,fontWeight:800,color:overallPct>=100?T.grn:overallPct>=75?T.amber:T.red}}>
            {overallPct!==null?overallPct+"%":"—"}
          </div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Overall Fulfillment</div>
        </Card>
        <Card style={{textAlign:"center",padding:12}}>
          <div style={{fontSize:22,fontWeight:800,color:T.grn}}>{achieved}/{withTarget.length}</div>
          <div style={{fontSize:11,color:T.txt2,textTransform:"uppercase"}}>Targets Achieved</div>
        </Card>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["counter","🏪 Counter"],["executive","👤 Executive"],["manager","👔 Manager"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setView(id);setExpanded(null);}} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(view===id?T.navy:T.bdrS),background:view===id?T.navy:"transparent",color:view===id?"#fff":T.txt2
          }}>{label}</button>
        ))}
        <div style={{width:1,height:20,background:T.bdr}}/>
        {periods.map(p=>(
          <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
            padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            border:"1px solid "+(period===p.id?T.amber:T.bdrS),background:period===p.id?T.amber:"transparent",color:period===p.id?"#fff":T.txt2
          }}>{p.label}</button>
        ))}
        <input type={period==="yearly"?"number":"month"} value={selRef} onChange={e=>setSelRef(e.target.value)}
          style={{padding:"5px 10px",border:"1px solid "+T.bdrS,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
      </div>

      {/* Table */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{background:T.navy,color:"#fff"}}>
              {["Name","Revenue","Target","Fulfillment","Gap",""].map(h=>(
                <th key={h} style={{padding:"8px 12px",textAlign:h==="Name"?"left":"right",fontWeight:700,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withTarget.map((r,i)=>(
              <tr key={r.id} style={{background:i%2===0?"#fff":T.surf,borderBottom:"1px solid "+T.bdr,cursor:r.execs?"pointer":"default"}}
                onClick={()=>r.execs&&setExpanded(expanded===r.id?null:r.id)}>
                <td style={{padding:"8px 12px"}}>
                  <div style={{fontWeight:700}}>{r.name}</div>
                  <div style={{fontSize:11,color:T.txt2}}>{r.subtitle}</div>
                  {expanded===r.id && r.execs && (
                    <div style={{marginTop:8,paddingLeft:8,borderLeft:"2px solid "+T.bdr}}>
                      {r.execs.map(e=>{
                        const er = getRevenue(e.id);
                        const et = getTarget(e.id);
                        const ep = et>0?Math.round(er/et*100):null;
                        return (
                          <div key={e.id} style={{fontSize:12,marginBottom:4,display:"flex",justifyContent:"space-between",gap:12}}>
                            <span style={{color:T.txt2}}>{e.name}</span>
                            <span>{fmtCurr(er)}{et>0&&<span style={{color:ep>=100?T.grn:ep>=75?T.amber:T.red,marginLeft:6}}>{ep}%</span>}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td style={{padding:"8px 12px",textAlign:"right",fontWeight:600}}>{fmtCurr(r.revenue)}</td>
                <td style={{padding:"8px 12px",textAlign:"right",color:T.txt2}}>{fmtCurr(r.target)}</td>
                <td style={{padding:"8px 12px",textAlign:"right"}}><PctBar pct={r.pct}/></td>
                <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,
                  color:r.revenue>=r.target?T.grn:T.red}}>
                  {r.revenue>=r.target?"+":""}{fmtCurr(r.revenue-r.target)}
                </td>
                <td style={{padding:"8px 12px",textAlign:"center",fontSize:11,color:T.txt3}}>
                  {r.execs?"▼":""}
                </td>
              </tr>
            ))}
            {noTarget.length>0 && (
              <tr><td colSpan={6} style={{padding:"8px 12px",color:T.txt3,fontSize:12,fontStyle:"italic"}}>
                {noTarget.length} {view}(s) with no target set — {noTarget.map(r=>r.name).join(", ")}
              </td></tr>
            )}
          </tbody>
          {withTarget.length>0 && (
            <tfoot>
              <tr style={{background:T.navy,color:"#fff",fontWeight:800}}>
                <td style={{padding:"8px 12px"}}>TOTAL</td>
                <td style={{padding:"8px 12px",textAlign:"right"}}>{fmtCurr(totalRev)}</td>
                <td style={{padding:"8px 12px",textAlign:"right"}}>{fmtCurr(totalTarget)}</td>
                <td style={{padding:"8px 12px",textAlign:"right",color:overallPct>=100?"#86efac":overallPct>=75?"#fde68a":"#fca5a5"}}>
                  {overallPct!==null?overallPct+"%":"—"}
                </td>
                <td style={{padding:"8px 12px",textAlign:"right",color:totalRev>=totalTarget?"#86efac":"#fca5a5"}}>
                  {totalRev>=totalTarget?"+":""}{fmtCurr(totalRev-totalTarget)}
                </td>
                <td/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}


export default function App() {
  const [state, setState] = useLocalStorage("benaka_state", INITIAL_STATE);
  const { syncStatus, syncFromCloud } = useSupabaseSync(state, setState);
  const toast = useToast();
  const { Toast } = toast;

  const handleLogin = (user) => setState(p => ({ ...p, currentUser: user }));
  const handleUsersLoaded = (users, passwords) => setState(p => ({ ...p, users, passwords }));

  if (!state.currentUser) {
    return (
      <ErrorBoundary>
        <LoginScreen
          onLogin={handleLogin}
          users={state.users}
          passwords={state.passwords}
          onUsersLoaded={handleUsersLoaded}
        />
        <Toast/>
      </ErrorBoundary>
    );
  }

  const user   = state.currentUser;
  const logout = () => setState(p => ({ ...p, currentUser: null }));
  const props  = { user, state, setState, toast, logout, syncFromCloud, syncStatus };

  return (
    <ErrorBoundary>
      {user.role === "supervisor"   && <SupervisorPortal {...props}/>}
      {user.role === "manager"      && <ManagerPortal    {...props}/>}
      {user.role === "md"           && <MDPortal         {...props}/>}
      {user.role === "office"       && <OfficePortal     {...props}/>}
      {user.role === "it_admin"     && <ITAdminPortal    {...props}/>}
      {user.role === "field_staff"  && <FieldStaffPortal {...props}/>}
      <Toast/>
    </ErrorBoundary>
  );
}
