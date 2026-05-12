"use client";

/*
  ╔══════════════════════════════════════════════════════════════════╗
  ║   مركز دعم — نظام إدارة العيادات                              ║
  ║   Arabic RTL Clinic SaaS — Production v2.0 (Supabase Connected) ║
  ╚══════════════════════════════════════════════════════════════════╝

  SUPABASE SETUP — run these SQL statements in your Supabase SQL editor:

  create table patients (
    id uuid default gen_random_uuid() primary key,
    full_name text not null,
    phone text,
    age integer,
    gender text default 'ذكر',
    case_type text,
    doctor_name text,
    status text default 'نشط',
    notes text,
    created_at timestamptz default now()
  );

  create table appointments (
    id uuid default gen_random_uuid() primary key,
    patient_id uuid references patients(id) on delete set null,
    patient_name text not null,
    doctor_name text,
    appointment_date date not null,
    appointment_time time not null,
    session_type text,
    duration integer default 60,
    room text,
    status text default 'مؤكد',
    notes text,
    created_at timestamptz default now()
  );

  create table financials (
    id uuid default gen_random_uuid() primary key,
    patient_name text not null,
    service text,
    amount numeric not null,
    payment_status text default 'معلقة',
    payment_method text default 'نقدي',
    invoice_number text,
    notes text,
    created_at timestamptz default now()
  );

  create table doctors (
    id uuid default gen_random_uuid() primary key,
    full_name text not null,
    specialty text,
    phone text,
    email text,
    experience text,
    education text,
    available boolean default true,
    schedule jsonb,
    created_at timestamptz default now()
  );

  create table notifications (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text,
    type text default 'info',
    is_read boolean default false,
    created_at timestamptz default now()
  );

  alter table patients enable row level security;
  alter table appointments enable row level security;
  alter table financials enable row level security;
  alter table doctors enable row level security;
  alter table notifications enable row level security;

  create policy "allow all" on patients for all using (true);
  create policy "allow all" on appointments for all using (true);
  create policy "allow all" on financials for all using (true);
  create policy "allow all" on doctors for all using (true);
  create policy "allow all" on notifications for all using (true);

  alter publication supabase_realtime add table patients;
  alter publication supabase_realtime add table appointments;
  alter publication supabase_realtime add table financials;
  alter publication supabase_realtime add table notifications;
*/

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type CSSProperties,
} from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Patient {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  case_type?: string;
  doctor_name?: string;
  status?: string;
  notes?: string;
  created_at?: string;
}

interface Appointment {
  id: string;
  patient_id?: string;
  patient_name: string;
  doctor_name?: string;
  appointment_date: string;
  appointment_time: string;
  session_type?: string;
  duration?: number;
  room?: string;
  status?: string;
  notes?: string;
  created_at?: string;
}

interface Financial {
  id: string;
  patient_name: string;
  service?: string;
  amount: number;
  payment_status?: string;
  payment_method?: string;
  invoice_number?: string;
  notes?: string;
  created_at?: string;
}

interface Doctor {
  id: string;
  full_name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  experience?: string;
  education?: string;
  available?: boolean;
  created_at?: string;
}

interface Notification {
  id: string;
  title: string;
  description?: string;
  type?: string;
  is_read?: boolean;
  created_at?: string;
}

interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  monthlyRevenue: number;
  attendanceRate: number;
  topDoctor: string;
  topDoctorSessions: number;
  pendingInvoices: number;
  newPatients: number;
  monthlyData: { month: string; revenue: number }[];
  caseDistribution: { label: string; value: number }[];
  weeklyStats: { day: string; sessions: number }[];
}

interface ApiResult<T> {
  data: T | null;
  error: unknown;
}

interface User {
  email: string;
}

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

// ─── Minimal Supabase client ──────────────────────────────────────────────────
function createSupabaseClient(url: string, key: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  async function query<T>(
    table: string,
    options: {
      select?: string;
      filters?: { col: string; val: string }[];
      order?: string;
      limit?: number;
      count?: boolean;
    } = {}
  ): Promise<ApiResult<T[]>> {
    let endpoint = `${url}/rest/v1/${table}`;
    const params = new URLSearchParams();
    if (options.select) params.set("select", options.select);
    if (options.filters) options.filters.forEach((f) => params.set(f.col, f.val));
    if (options.order) params.set("order", options.order);
    if (options.limit) params.set("limit", String(options.limit));
    if (params.toString()) endpoint += `?${params}`;
    const res = await fetch(endpoint, {
      headers: { ...headers, ...(options.count ? { Prefer: "count=exact" } : {}) },
    });
    const data = await res.json();
    return { data: res.ok ? (data as T[]) : null, error: res.ok ? null : data };
  }

  async function insert<T>(table: string, body: Partial<T>): Promise<ApiResult<T>> {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(Array.isArray(body) ? body : [body]),
    });
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    return { data: res.ok ? (row as T) : null, error: res.ok ? null : data };
  }

  async function update<T>(table: string, id: string, body: Partial<T>): Promise<ApiResult<T>> {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    return { data: res.ok ? (row as T) : null, error: res.ok ? null : data };
  }

  async function remove(table: string, id: string): Promise<{ error: unknown }> {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    return { error: res.ok ? null : await res.json() };
  }

  async function signIn(email: string, password: string) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      headers.Authorization = `Bearer ${data.access_token}`;
    }
    return { data, error: res.ok ? null : data };
  }

  function signOut() {
    headers.Authorization = `Bearer ${key}`;
  }

  return { query, insert, update, remove, signIn, signOut };
}

const sb = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DEMO_MODE = SUPABASE_URL.includes("YOUR_PROJECT");

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
function genId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const TODAY = new Date().toISOString().split("T")[0];

let DEMO_PATIENTS: Patient[] = [
  { id: "p1", full_name: "أحمد محمد علي", phone: "0501234567", age: 8, gender: "ذكر", case_type: "تأخر لغوي", doctor_name: "د. نورا السعيد", status: "نشط", notes: "يحتاج تمارين نطق يومية", created_at: "2024-01-01" },
  { id: "p2", full_name: "سارة خالد المطيري", phone: "0559876543", age: 6, gender: "أنثى", case_type: "تعديل سلوك", doctor_name: "د. عمر الحربي", status: "نشط", notes: "تقدم ملحوظ في الشهر الأخير", created_at: "2024-01-02" },
  { id: "p3", full_name: "يوسف محمود العتيبي", phone: "0534567890", age: 10, gender: "ذكر", case_type: "فرط حركة", doctor_name: "د. نورا السعيد", status: "متوقف", notes: "", created_at: "2024-01-03" },
  { id: "p4", full_name: "مريم حسن الدوسري", phone: "0568901234", age: 5, gender: "أنثى", case_type: "جلسة نفسية", doctor_name: "د. ليلى القحطاني", status: "نشط", notes: "تحتاج متابعة مع الأهل", created_at: "2024-01-04" },
  { id: "p5", full_name: "عبدالله سعد الزهراني", phone: "0512345678", age: 9, gender: "ذكر", case_type: "تقييم قدرات", doctor_name: "د. عمر الحربي", status: "جديد", notes: "", created_at: "2024-01-05" },
  { id: "p6", full_name: "ليلى فهد الشمري", phone: "0545678901", age: 7, gender: "أنثى", case_type: "تأخر لغوي", doctor_name: "د. ليلى القحطاني", status: "نشط", notes: "الجلسات 3 مرات أسبوعياً", created_at: "2024-01-06" },
  { id: "p7", full_name: "محمد تركي النفيسة", phone: "0578901234", age: 11, gender: "ذكر", case_type: "تعديل سلوك", doctor_name: "د. نورا السعيد", status: "نشط", notes: "31 جلسة مكتملة بنجاح", created_at: "2024-01-07" },
  { id: "p8", full_name: "ريم عبدالرحمن العنزي", phone: "0521234567", age: 4, gender: "أنثى", case_type: "تقييم قدرات", doctor_name: "د. عمر الحربي", status: "جديد", notes: "", created_at: "2024-01-08" },
];

let DEMO_APPOINTMENTS: Appointment[] = [
  { id: "a1", patient_name: "أحمد محمد علي", doctor_name: "د. نورا السعيد", appointment_date: TODAY, appointment_time: "09:00", session_type: "تأخر لغوي", duration: 60, room: "غرفة 1", status: "مؤكد", notes: "" },
  { id: "a2", patient_name: "سارة خالد المطيري", doctor_name: "د. عمر الحربي", appointment_date: TODAY, appointment_time: "10:30", session_type: "تعديل سلوك", duration: 45, room: "غرفة 2", status: "مكتمل", notes: "" },
  { id: "a3", patient_name: "مريم حسن الدوسري", doctor_name: "د. ليلى القحطاني", appointment_date: TODAY, appointment_time: "11:00", session_type: "جلسة نفسية", duration: 60, room: "غرفة 3", status: "مؤكد", notes: "" },
  { id: "a4", patient_name: "يوسف محمود العتيبي", doctor_name: "د. نورا السعيد", appointment_date: TODAY, appointment_time: "12:30", session_type: "فرط حركة", duration: 45, room: "غرفة 1", status: "لم يحضر", notes: "" },
  { id: "a5", patient_name: "عبدالله سعد الزهراني", doctor_name: "د. عمر الحربي", appointment_date: TODAY, appointment_time: "14:00", session_type: "تقييم قدرات", duration: 60, room: "غرفة 2", status: "مؤكد", notes: "" },
  { id: "a6", patient_name: "ليلى فهد الشمري", doctor_name: "د. ليلى القحطاني", appointment_date: TODAY, appointment_time: "15:30", session_type: "تأخر لغوي", duration: 45, room: "غرفة 3", status: "قيد المراجعة", notes: "" },
];

let DEMO_DOCTORS: Doctor[] = [
  { id: "d1", full_name: "د. نورا السعيد", specialty: "علم النفس السريري", phone: "0501111111", email: "nora@clinic.com", experience: "8 سنوات", education: "دكتوراه جامعة الملك سعود", available: true },
  { id: "d2", full_name: "د. عمر الحربي", specialty: "علاج النطق واللغة", phone: "0502222222", email: "omar@clinic.com", experience: "6 سنوات", education: "ماجستير جامعة الأمير سلطان", available: true },
  { id: "d3", full_name: "د. ليلى القحطاني", specialty: "تعديل السلوك", phone: "0503333333", email: "layla@clinic.com", experience: "10 سنوات", education: "دكتوراه جامعة الملك عبدالعزيز", available: false },
  { id: "d4", full_name: "د. فهد المنصور", specialty: "التطور الطفولي", phone: "0504444444", email: "fahad@clinic.com", experience: "5 سنوات", education: "ماجستير جامعة القصيم", available: true },
];

let DEMO_FINANCIALS: Financial[] = [
  { id: "f1", patient_name: "أحمد محمد علي", service: "جلسة تأخر لغوي", amount: 450, payment_status: "مدفوعة", payment_method: "نقدي", invoice_number: "INV-2024-001", created_at: "2024-01-15" },
  { id: "f2", patient_name: "سارة خالد المطيري", service: "جلسة تعديل سلوك", amount: 650, payment_status: "مدفوعة", payment_method: "بطاقة", invoice_number: "INV-2024-002", created_at: "2024-01-14" },
  { id: "f3", patient_name: "مريم حسن الدوسري", service: "جلسة نفسية", amount: 500, payment_status: "معلقة", payment_method: "تحويل", invoice_number: "INV-2024-003", created_at: "2024-01-16" },
  { id: "f4", patient_name: "يوسف محمود العتيبي", service: "فرط حركة", amount: 750, payment_status: "متأخرة", payment_method: "نقدي", invoice_number: "INV-2024-004", created_at: "2024-01-10" },
  { id: "f5", patient_name: "عبدالله سعد الزهراني", service: "تقييم قدرات", amount: 450, payment_status: "مدفوعة", payment_method: "بطاقة", invoice_number: "INV-2024-005", created_at: "2024-01-16" },
  { id: "f6", patient_name: "ليلى فهد الشمري", service: "تأخر لغوي", amount: 400, payment_status: "مدفوعة", payment_method: "نقدي", invoice_number: "INV-2024-006", created_at: "2024-01-12" },
];

let DEMO_NOTIFICATIONS: Notification[] = [
  { id: "n1", title: "موعد قريب", description: "موعد أحمد علي خلال 30 دقيقة", type: "warning", is_read: false, created_at: new Date().toISOString() },
  { id: "n2", title: "دفعة واردة", description: "دفعة جديدة 650 جنيه - سارة خالد", type: "success", is_read: false, created_at: new Date().toISOString() },
  { id: "n3", title: "تذكير تقرير", description: "تذكير: تقرير شهري يناير", type: "info", is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "n4", title: "إنجاز!", description: "محمد تركي أكمل 30 جلسة", type: "success", is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
];

// ─── Demo CRUD ────────────────────────────────────────────────────────────────
const demoApi = {
  patients: {
    list: async (): Promise<ApiResult<Patient[]>> => ({ data: [...DEMO_PATIENTS].reverse(), error: null }),
    insert: async (row: Partial<Patient>): Promise<ApiResult<Patient>> => {
      const r: Patient = { ...row, id: genId(), created_at: new Date().toISOString() } as Patient;
      DEMO_PATIENTS.unshift(r);
      return { data: r, error: null };
    },
    update: async (id: string, row: Partial<Patient>): Promise<ApiResult<Patient>> => {
      DEMO_PATIENTS = DEMO_PATIENTS.map((p) => (p.id === id ? { ...p, ...row } : p));
      return { data: DEMO_PATIENTS.find((p) => p.id === id) ?? null, error: null };
    },
    remove: async (id: string) => {
      DEMO_PATIENTS = DEMO_PATIENTS.filter((p) => p.id !== id);
      return { error: null };
    },
  },
  appointments: {
    list: async (date?: string): Promise<ApiResult<Appointment[]>> => ({
      data: (date ? DEMO_APPOINTMENTS.filter((a) => a.appointment_date === date) : DEMO_APPOINTMENTS)
        .slice()
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
      error: null,
    }),
    listAll: async (): Promise<ApiResult<Appointment[]>> => ({ data: [...DEMO_APPOINTMENTS], error: null }),
    insert: async (row: Partial<Appointment>): Promise<ApiResult<Appointment>> => {
      const r: Appointment = { ...row, id: genId(), created_at: new Date().toISOString() } as Appointment;
      DEMO_APPOINTMENTS.push(r);
      return { data: r, error: null };
    },
    update: async (id: string, row: Partial<Appointment>): Promise<ApiResult<Appointment>> => {
      DEMO_APPOINTMENTS = DEMO_APPOINTMENTS.map((a) => (a.id === id ? { ...a, ...row } : a));
      return { data: DEMO_APPOINTMENTS.find((a) => a.id === id) ?? null, error: null };
    },
    remove: async (id: string) => {
      DEMO_APPOINTMENTS = DEMO_APPOINTMENTS.filter((a) => a.id !== id);
      return { error: null };
    },
  },
  doctors: {
    list: async (): Promise<ApiResult<Doctor[]>> => ({ data: [...DEMO_DOCTORS], error: null }),
    insert: async (row: Partial<Doctor>): Promise<ApiResult<Doctor>> => {
      const r: Doctor = { ...row, id: genId(), created_at: new Date().toISOString() } as Doctor;
      DEMO_DOCTORS.push(r);
      return { data: r, error: null };
    },
    update: async (id: string, row: Partial<Doctor>): Promise<ApiResult<Doctor>> => {
      DEMO_DOCTORS = DEMO_DOCTORS.map((d) => (d.id === id ? { ...d, ...row } : d));
      return { data: DEMO_DOCTORS.find((d) => d.id === id) ?? null, error: null };
    },
    remove: async (id: string) => {
      DEMO_DOCTORS = DEMO_DOCTORS.filter((d) => d.id !== id);
      return { error: null };
    },
  },
  financials: {
    list: async (): Promise<ApiResult<Financial[]>> => ({ data: [...DEMO_FINANCIALS].reverse(), error: null }),
    insert: async (row: Partial<Financial>): Promise<ApiResult<Financial>> => {
      const r: Financial = {
        ...row,
        id: genId(),
        invoice_number: `INV-2024-${String(DEMO_FINANCIALS.length + 1).padStart(3, "0")}`,
        created_at: new Date().toISOString(),
      } as Financial;
      DEMO_FINANCIALS.unshift(r);
      return { data: r, error: null };
    },
    update: async (id: string, row: Partial<Financial>): Promise<ApiResult<Financial>> => {
      DEMO_FINANCIALS = DEMO_FINANCIALS.map((f) => (f.id === id ? { ...f, ...row } : f));
      return { data: DEMO_FINANCIALS.find((f) => f.id === id) ?? null, error: null };
    },
    remove: async (id: string) => {
      DEMO_FINANCIALS = DEMO_FINANCIALS.filter((f) => f.id !== id);
      return { error: null };
    },
  },
  notifications: {
    list: async (): Promise<ApiResult<Notification[]>> => ({
      data: [...DEMO_NOTIFICATIONS].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
      error: null,
    }),
    markRead: async (id: string) => {
      DEMO_NOTIFICATIONS = DEMO_NOTIFICATIONS.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      return { error: null };
    },
    markAllRead: async () => {
      DEMO_NOTIFICATIONS = DEMO_NOTIFICATIONS.map((n) => ({ ...n, is_read: true }));
      return { error: null };
    },
    insert: async (row: Partial<Notification>): Promise<ApiResult<Notification>> => {
      const r: Notification = { ...row, id: genId(), created_at: new Date().toISOString() } as Notification;
      DEMO_NOTIFICATIONS.unshift(r);
      return { data: r, error: null };
    },
  },
  dashboard: {
    stats: async (): Promise<ApiResult<DashboardStats>> => {
      const safePatients = Array.isArray(DEMO_PATIENTS) ? DEMO_PATIENTS : [];
      const safeAppts = Array.isArray(DEMO_APPOINTMENTS) ? DEMO_APPOINTMENTS : [];
      const safeFins = Array.isArray(DEMO_FINANCIALS) ? DEMO_FINANCIALS : [];

      const total = safePatients.length;
      const todayAppts = safeAppts.filter((a) => a.appointment_date === TODAY);
      const completed = safeAppts.filter((a) => a.status === "مكتمل").length;
      const totalAppts = safeAppts.length;
      const revenue = safeFins
        .filter((f) => f.payment_status === "مدفوعة")
        .reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const attendance = totalAppts > 0 ? Math.round((completed / totalAppts) * 100) : 0;

      const docCounts: Record<string, number> = {};
      safeAppts.forEach((a) => {
        if (a.doctor_name) docCounts[a.doctor_name] = (docCounts[a.doctor_name] ?? 0) + 1;
      });
      const topDocEntry = Object.entries(docCounts).sort((a, b) => b[1] - a[1])[0];

      const monthly: Record<string, number> = {};
      safeFins.forEach((f) => {
        const m = (f.created_at ?? "").slice(0, 7);
        if (m) monthly[m] = (monthly[m] ?? 0) + (f.payment_status === "مدفوعة" ? Number(f.amount) || 0 : 0);
      });

      const caseDist: Record<string, number> = {};
      safePatients.forEach((p) => {
        if (p.case_type) caseDist[p.case_type] = (caseDist[p.case_type] ?? 0) + 1;
      });

      return {
        data: {
          totalPatients: total,
          todayAppointments: todayAppts.length,
          monthlyRevenue: revenue,
          attendanceRate: attendance,
          topDoctor: topDocEntry ? topDocEntry[0] : "-",
          topDoctorSessions: topDocEntry ? topDocEntry[1] : 0,
          pendingInvoices: safeFins.filter((f) => f.payment_status !== "مدفوعة").length,
          newPatients: safePatients.filter((p) => p.status === "جديد").length,
          monthlyData: Object.entries(monthly)
            .map(([month, rev]) => ({ month, revenue: rev }))
            .slice(-7),
          caseDistribution: Object.entries(caseDist).map(([label, value]) => ({ label, value })),
          weeklyStats: [
            { day: "الأحد", sessions: safeAppts.filter((a) => a.status !== "ملغي").length },
            { day: "الإثنين", sessions: 21 },
            { day: "الثلاثاء", sessions: 18 },
            { day: "الأربعاء", sessions: 24 },
            { day: "الخميس", sessions: 16 },
          ],
        },
        error: null,
      };
    },
  },
};

// ─── API layer ────────────────────────────────────────────────────────────────
const api = DEMO_MODE
  ? demoApi
  : {
      patients: {
        list: () => sb.query<Patient>("patients", { select: "*", order: "created_at.desc" }),
        insert: (row: Partial<Patient>) => sb.insert<Patient>("patients", row),
        update: (id: string, row: Partial<Patient>) => sb.update<Patient>("patients", id, row),
        remove: (id: string) => sb.remove("patients", id),
      },
      appointments: {
        list: (date?: string) =>
          sb.query<Appointment>("appointments", {
            select: "*",
            filters: date ? [{ col: "appointment_date", val: `eq.${date}` }] : [],
            order: "appointment_time.asc",
          }),
        listAll: () => sb.query<Appointment>("appointments", { select: "*", order: "created_at.desc" }),
        insert: (row: Partial<Appointment>) => sb.insert<Appointment>("appointments", row),
        update: (id: string, row: Partial<Appointment>) => sb.update<Appointment>("appointments", id, row),
        remove: (id: string) => sb.remove("appointments", id),
      },
      doctors: {
        list: () => sb.query<Doctor>("doctors", { select: "*" }),
        insert: (row: Partial<Doctor>) => sb.insert<Doctor>("doctors", row),
        update: (id: string, row: Partial<Doctor>) => sb.update<Doctor>("doctors", id, row),
        remove: (id: string) => sb.remove("doctors", id),
      },
      financials: {
        list: () => sb.query<Financial>("financials", { select: "*", order: "created_at.desc" }),
        insert: (row: Partial<Financial>) => sb.insert<Financial>("financials", row),
        update: (id: string, row: Partial<Financial>) => sb.update<Financial>("financials", id, row),
        remove: (id: string) => sb.remove("financials", id),
      },
      notifications: {
        list: () => sb.query<Notification>("notifications", { select: "*", order: "created_at.desc", limit: 20 }),
        markRead: (id: string) => sb.update<Notification>("notifications", id, { is_read: true }),
        markAllRead: async () => ({ error: null }),
        insert: (row: Partial<Notification>) => sb.insert<Notification>("notifications", row),
      },
      dashboard: {
        stats: () => demoApi.dashboard.stats(),
      },
    };

// ─── Design System ────────────────────────────────────────────────────────────
const C = {
  navy: "#1E2A4A",
  sage: "#5F8E7E",
  white: "#FFFFFF",
  lightGray: "#F5F7FA",
  dark: "#1F2937",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  navyL: "#2E3F6B",
  sageL: "#7AAAA0",
  border: "#E5E7EB",
  muted: "#9CA3AF",
  purple: "#8B5CF6",
};

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  msg: string;
  type: "success" | "error" | "info";
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = genId();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return {
    toasts,
    success: (m: string) => add(m, "success"),
    error: (m: string) => add(m, "error"),
    info: (m: string) => add(m, "info"),
  };
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const colors: Record<string, string> = { success: C.success, error: C.error, info: C.navy };
  return (
    <div style={{ position: "fixed", bottom: 24, left: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "12px 18px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            border: `1px solid ${colors[t.type]}30`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 260,
            direction: "rtl",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors[t.type], flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: C.dark, fontFamily: "inherit" }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 20, br = 6 }: { w?: string | number; h?: number; br?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: br,
        background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,42,74,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 32 : width),
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          direction: "rtl",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.muted, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────
function FormField({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: C.error }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  fontSize: 13,
  outline: "none",
  direction: "rtl",
  fontFamily: "inherit",
  background: C.lightGray,
  boxSizing: "border-box",
  color: C.dark,
};

// Hydration-safe Input: avoids onFocus/onBlur DOM style mutations that mismatch SSR
function Input({
  style: extraStyle,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { style?: CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{
        ...inputStyle,
        borderColor: focused ? C.sage : "#E5E7EB",
        transition: "border-color 0.15s",
        ...extraStyle,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Select({
  children,
  style: extraStyle,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { style?: CSSProperties }) {
  return (
    <select {...props} style={{ ...inputStyle, cursor: "pointer", ...extraStyle }}>
      {children}
    </select>
  );
}

function Textarea({
  style: extraStyle,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { style?: CSSProperties }) {
  return (
    <textarea
      {...props}
      style={{ ...inputStyle, resize: "vertical", minHeight: 80, ...extraStyle }}
    />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; c: string }> = {
    نشط: { bg: "#D1FAE5", c: "#065F46" },
    متوقف: { bg: "#FEF3C7", c: "#92400E" },
    جديد: { bg: "#DBEAFE", c: "#1E40AF" },
    مؤكد: { bg: "#DBEAFE", c: "#1E40AF" },
    مكتمل: { bg: "#D1FAE5", c: "#065F46" },
    ملغي: { bg: "#FEE2E2", c: "#991B1B" },
    "لم يحضر": { bg: "#FEF3C7", c: "#92400E" },
    "قيد المراجعة": { bg: "#EDE9FE", c: "#5B21B6" },
    مدفوعة: { bg: "#D1FAE5", c: "#065F46" },
    معلقة: { bg: "#FEF3C7", c: "#92400E" },
    متأخرة: { bg: "#FEE2E2", c: "#991B1B" },
  };
  const s = (status && map[status]) || { bg: "#F3F4F6", c: "#374151" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.c,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status ?? "—"}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
  color,
  loading,
}: {
  label?: string;
  value?: string | number;
  sub?: string;
  trend?: number;
  icon?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "22px 24px",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 6px rgba(30,42,74,0.05)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton h={12} w="60%" />
          <Skeleton h={32} w="40%" />
          <Skeleton h={10} w="80%" />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.navy, marginTop: 4 }}>{value}</div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: (color ?? "#000") + "18",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              {icon}
            </div>
          </div>
          {trend !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
              <span style={{ color: trend >= 0 ? C.success : C.error, fontWeight: 700 }}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </span>
              <span style={{ color: C.muted }}>{sub}</span>
            </div>
          )}
          {trend === undefined && sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function BarChart({
  data,
  valueKey,
  labelKey,
  color,
  height = 100,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color: string;
  height?: number;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const max = Math.max(...safeData.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {safeData.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: "100%",
              height: `${((Number(d[valueKey]) || 0) / max) * (height - 20)}px`,
              background: color,
              borderRadius: "4px 4px 0 0",
              minHeight: 4,
            }}
          />
          <span style={{ fontSize: 9, color: C.muted, textAlign: "center" }}>{String(d[labelKey] ?? "")}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data }: { data: { month: string; revenue: number }[] }) {
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length < 2)
    return (
      <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
        لا توجد بيانات كافية
      </div>
    );
  const W = 480, H = 150, PAD = 30;
  const max = Math.max(...safeData.map((d) => d.revenue), 1);
  const pts = safeData.map((d, i) => ({
    x: PAD + (i / (safeData.length - 1)) * (W - PAD * 2),
    y: H - PAD - (d.revenue / max) * (H - PAD * 2),
    label: d.month,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${H - PAD} L${pts[0].x},${H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 150 }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.sage} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.sage} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke={C.sage} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={C.sage} />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill={C.muted}>
            {(p.label ?? "").slice(-2)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const safeData = Array.isArray(data) ? data : [];
  const COLORS_PIE = [C.sage, C.navy, C.purple, C.warning, C.error, "#06B6D4"];
  const total = safeData.reduce((s, d) => s + (d.value || 0), 0) || 1;
  let cumulative = 0;
  const cx = 65, cy = 65, r = 50;
  const paths = safeData.map((sl, idx) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += sl.value;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    return {
      ...sl,
      color: COLORS_PIE[idx % COLORS_PIE.length],
      d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${end - start > Math.PI ? 1 : 0},1 ${x2},${y2} Z`,
    };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg viewBox="0 0 130 130" style={{ width: 130, height: 130, flexShrink: 0 }}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
        <circle cx={cx} cy={cy} r={28} fill="#fff" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={C.navy}>{total}</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {paths.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.dark, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
type PageId = "dashboard" | "patients" | "appointments" | "reception" | "doctors" | "financials" | "reports" | "settings";

function Sidebar({
  page,
  setPage,
  collapsed,
  setCollapsed,
}: {
  page: PageId;
  setPage: (p: PageId) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const items: { id: PageId; label: string; icon: string }[] = [
    { id: "dashboard", label: "الرئيسية", icon: "⊞" },
    { id: "patients", label: "المرضى", icon: "👤" },
    { id: "appointments", label: "المواعيد", icon: "📅" },
    { id: "reception", label: "الاستقبال", icon: "🏥" },
    { id: "doctors", label: "الأطباء", icon: "🩺" },
    { id: "financials", label: "الحسابات", icon: "💰" },
    { id: "reports", label: "التقارير", icon: "📊" },
    { id: "settings", label: "الإعدادات", icon: "⚙️" },
  ];
  return (
    <div
      style={{
        width: collapsed ? 68 : 230,
        background: C.navy,
        height: "100vh",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
        boxShadow: "4px 0 24px rgba(30,42,74,0.18)",
      }}
    >
      <div
        style={{
          padding: collapsed ? "22px 0" : "22px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 10, background: C.sage,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
          }}
        >
          ✦
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>مركز دعم</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>للإرشاد النفسي</div>
          </div>
        )}
      </div>
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {items.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: collapsed ? "12px 0" : "11px 18px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "rgba(95,142,126,0.22)" : "transparent",
                border: "none",
                cursor: "pointer",
                color: active ? C.sageL : "rgba(255,255,255,0.5)",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                borderRight: active ? `3px solid ${C.sage}` : "3px solid transparent",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8,
            width: "100%", padding: "8px 0", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", fontSize: 14,
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({
  pageTitle,
  notifications,
  onMarkAllRead,
  onMarkRead,
  user,
  onLogout,
}: {
  pageTitle: string;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  user: User | null;
  onLogout: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch for date
  useEffect(() => { setMounted(true); }, []);

  const safeNotifs = Array.isArray(notifications) ? notifications : [];
  const unread = safeNotifs.filter((n) => !n.is_read).length;
  const todayStr = mounted
    ? new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div
      style={{
        height: 64, background: "#fff", borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 14,
        position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
      suppressHydrationWarning
    >
      <h1 style={{ fontSize: 17, fontWeight: 700, color: C.navy, flexShrink: 0 }}>{pageTitle}</h1>
      {DEMO_MODE && (
        <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
          وضع تجريبي
        </span>
      )}
      <div style={{ flex: 1 }} />
      {mounted && <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{todayStr}</div>}
      <div style={{ padding: "4px 12px", borderRadius: 20, background: "#D1FAE5", color: "#065F46", fontSize: 12, fontWeight: 700 }}>
        ● مفتوح
      </div>

      {/* Notifications */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, position: "relative", lineHeight: 1 }}
        >
          🔔
          {unread > 0 && (
            <span
              style={{
                position: "absolute", top: -4, right: -4, width: 16, height: 16,
                background: C.error, borderRadius: "50%", color: "#fff",
                fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
              }}
            >
              {unread}
            </span>
          )}
        </button>
        {notifOpen && (
          <div
            style={{
              position: "absolute", left: 0, top: 46, width: 330, background: "#fff",
              borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
              border: "1px solid #E5E7EB", zIndex: 200,
            }}
          >
            <div
              style={{
                padding: "14px 16px", borderBottom: "1px solid #E5E7EB",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>
                الإشعارات {unread > 0 && `(${unread})`}
              </span>
              {unread > 0 && (
                <button
                  onClick={onMarkAllRead}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.sage, fontFamily: "inherit" }}
                >
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
            {safeNotifs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>لا توجد إشعارات</div>
            ) : (
              safeNotifs.slice(0, 6).map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkRead(n.id)}
                  style={{
                    padding: "12px 16px", display: "flex", gap: 10,
                    background: n.is_read ? "transparent" : "#F0FDF4",
                    borderBottom: "1px solid #F3F4F6", cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: n.type === "success" ? C.success : n.type === "warning" ? C.warning : C.navy,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{n.description}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                      {new Date(n.created_at ?? "").toLocaleString("ar-EG")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Profile */}
      <div style={{ position: "relative" }}>
        <div
          onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%", background: C.navy,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 14,
            }}
          >
            {(user?.email?.[0] ?? "م").toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>
              {user?.email?.split("@")[0] ?? "مدير النظام"}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>مديرة النظام</div>
          </div>
        </div>
        {profileOpen && (
          <div
            style={{
              position: "absolute", left: 0, top: 46, width: 180, background: "#fff",
              borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              border: "1px solid #E5E7EB", zIndex: 200, overflow: "hidden",
            }}
          >
            <button
              onClick={onLogout}
              style={{
                width: "100%", padding: "12px 16px", background: "none", border: "none",
                cursor: "pointer", textAlign: "right", fontSize: 13, color: C.error,
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span>🚪</span> تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function DashboardPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [activity, setActivity] = useState<{ text: string; time: string; icon: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: appts }, { data: fins }] = await Promise.all([
      api.dashboard.stats(),
      api.appointments.list(TODAY),
      api.financials.list(),
    ]);
    if (s) setStats(s as unknown as DashboardStats);

    const safeAppts = Array.isArray(appts) ? (appts as Appointment[]) : [];
    setTodayAppts(safeAppts);

    const safeFins = Array.isArray(fins) ? (fins as Financial[]) : [];
    const recentActivity = safeFins.slice(0, 3).map((f) => ({
      text: `دفعة ${f.amount} جنيه من ${f.patient_name}`,
      time: new Date(f.created_at ?? "").toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      icon: "💰",
    }));
    setActivity(recentActivity);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = stats
    ? [
        { label: "إجمالي المرضى", value: stats.totalPatients, sub: `${stats.newPatients} مرضى جدد`, trend: 12, icon: "👥", color: C.navy },
        { label: "جلسات اليوم", value: stats.todayAppointments, sub: "من أصل المجدولة", trend: 8, icon: "📅", color: C.sage },
        { label: "الإيرادات الشهرية (EGP)", value: `${stats.monthlyRevenue.toLocaleString("ar-EG")} جنيه`, sub: "مدفوعات مؤكدة", trend: 18, icon: "💰", color: C.purple },
        { label: "نسبة الحضور", value: `${stats.attendanceRate}%`, sub: "من الجلسات المجدولة", trend: stats.attendanceRate > 80 ? 3 : -5, icon: "✅", color: C.warning },
      ]
    : Array(4).fill(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpis.map((k, i) => <KpiCard key={i} loading={loading} {...(k ?? {})} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>تطور الإيرادات (بالجنيه المصري)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>آخر الأشهر المسجلة</div>
          {loading ? <Skeleton h={150} /> : (
            <LineChart data={(stats?.monthlyData?.length ?? 0) > 0 ? (stats?.monthlyData ?? []) : [{ month: "يناير", revenue: 0 }]} />
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>توزيع الحالات</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>حسب نوع الجلسة</div>
          {loading ? <Skeleton h={130} /> : <DonutChart data={stats?.caseDistribution ?? []} />}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>الجلسات الأسبوعية</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>توزيع أيام الأسبوع</div>
          {loading ? <Skeleton h={100} /> : (
            <BarChart
              data={(stats?.weeklyStats ?? []) as unknown as Record<string, unknown>[]}
              valueKey="sessions"
              labelKey="day"
              color={C.navy}
            />
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>آخر النشاطات</div>
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={40} /></div>)
          ) : activity.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>لا توجد نشاطات حديثة</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    {a.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.4 }}>{a.text}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: C.navy, borderRadius: 16, padding: 24, color: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>الملخص المالي</div>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 18 }}>تجميع الفترة الحالية</div>
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={20} /></div>)
          ) : (
            [
              { label: "إجمالي الإيرادات", val: `${(stats?.monthlyRevenue ?? 0).toLocaleString("ar-EG")} جنيه`, color: C.success },
              { label: "فواتير معلقة", val: `${stats?.pendingInvoices ?? 0} فاتورة`, color: C.warning },
              { label: "أفضل طبيب", val: stats?.topDoctor ?? "-", color: C.sageL },
              { label: "جلسات اليوم", val: stats?.todayAppointments ?? 0, color: "rgba(255,255,255,0.8)" },
            ].map((row, i, arr) => (
              <div
                key={i}
                style={{
                  display: "flex", justifyContent: "space-between", padding: "10px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.65 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>مواعيد اليوم</div>
          <span style={{ fontSize: 12, color: C.sage, fontWeight: 700 }}>{todayAppts.length} موعد</span>
        </div>
        {loading ? <Skeleton h={60} /> : todayAppts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 14 }}>لا توجد مواعيد مجدولة اليوم</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {todayAppts.map((a) => (
              <div key={a.id} style={{ background: C.lightGray, borderRadius: 12, padding: "14px 16px", minWidth: 180, flexShrink: 0, border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{a.appointment_time}</div>
                <div style={{ fontSize: 12, color: C.dark, marginTop: 4 }}>{a.patient_name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{a.doctor_name}</div>
                <div style={{ marginTop: 8 }}><StatusBadge status={a.status} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PATIENTS PAGE ────────────────────────────────────────────────────────────
function PatientsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("الكل");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<Patient>>({});
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = 8;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.patients.list();
    setPatients(Array.isArray(data) ? (data as Patient[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Safe filtered list — all array ops guarded
  const safePatients = Array.isArray(patients) ? patients : [];
  const filtered = safePatients.filter((p) => {
    const q = search.toLowerCase();
    const matchQ =
      (p.full_name ?? "").includes(q) ||
      (p.case_type ?? "").includes(q) ||
      (p.phone ?? "").includes(q);
    const matchStatus = filterStatus === "الكل" || p.status === filterStatus;
    return matchQ && matchStatus;
  });
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const openAdd = () => { setForm({ status: "جديد", gender: "ذكر" }); setModal("add"); };
  const openEdit = (p: Patient) => { setForm({ ...p }); setModal("edit"); };

  const save = async () => {
    if (!form.full_name) { toast.error("اسم المريض مطلوب"); return; }
    setSaving(true);
    if (modal === "add") {
      const { error } = await api.patients.insert(form);
      if (error) toast.error("حدث خطأ أثناء الإضافة");
      else { toast.success("تم إضافة المريض بنجاح"); setModal(null); load(); }
    } else {
      const { error } = await api.patients.update(form.id!, form);
      if (error) toast.error("حدث خطأ أثناء التحديث");
      else {
        toast.success("تم تحديث بيانات المريض");
        setModal(null);
        load();
        if (selected?.id === form.id) setSelected((prev) => prev ? { ...prev, ...form } : null);
      }
    }
    setSaving(false);
  };

  const del = async (p: Patient) => {
    if (!window.confirm(`هل أنت متأكد من حذف ${p.full_name}؟`)) return;
    const { error } = await api.patients.remove(p.id);
    if (error) toast.error("حدث خطأ أثناء الحذف");
    else { toast.success("تم حذف المريض"); if (selected?.id === p.id) setSelected(null); load(); }
  };

  const doctorNames = Array.isArray(DEMO_DOCTORS) ? DEMO_DOCTORS.map((d) => d.full_name) : [];

  return (
    <div style={{ display: "flex", gap: 18 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }}>🔍</span>
            <Input
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(0); }}
              placeholder="البحث باسم المريض أو الحالة..."
              style={{ paddingRight: 36 }}
            />
          </div>
          {["الكل", "نشط", "جديد", "متوقف"].map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(0); }}
              style={{
                padding: "9px 16px", borderRadius: 10, border: "1px solid #E5E7EB",
                background: filterStatus === s ? C.navy : "#fff",
                color: filterStatus === s ? "#fff" : C.dark,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
          <button
            onClick={openAdd}
            style={{ padding: "9px 20px", borderRadius: 10, background: C.sage, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}
          >
            + مريض جديد
          </button>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr 80px", padding: "10px 18px", background: C.lightGray, borderBottom: "1px solid #E5E7EB", fontSize: 11, fontWeight: 700, color: C.muted }}>
            <span>المريض</span><span>الحالة</span><span>الطبيب</span><span>النوع</span><span>التاريخ</span><span>إجراء</span>
          </div>
          {loading ? (
            Array(5).fill(0).map((_, i) => <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}><Skeleton h={36} /></div>)
          ) : paged.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
              <div style={{ color: C.muted, fontSize: 14 }}>لا يوجد مرضى مطابقون للبحث</div>
            </div>
          ) : paged.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1fr 80px",
                padding: "13px 18px", borderBottom: "1px solid #F3F4F6",
                alignItems: "center", cursor: "pointer",
                background: selected?.id === p.id ? "#F0FDF4" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: p.gender === "ذكر" ? "#DBEAFE" : "#FCE7F3",
                    color: p.gender === "ذكر" ? "#1E40AF" : "#9D174D",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}
                >
                  {(p.full_name ?? "؟")[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{p.full_name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {p.age ? `${p.age} سنوات` : ""} {p.phone ? `• ${p.phone}` : ""}
                  </div>
                </div>
              </div>
              <StatusBadge status={p.status} />
              <span style={{ fontSize: 12, color: C.muted }}>{p.doctor_name}</span>
              <span style={{ fontSize: 12, color: C.dark }}>{p.case_type}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{(p.created_at ?? "").slice(0, 10)}</span>
              <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(p)} style={{ background: C.lightGray, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13 }} title="تعديل">✏️</button>
                <button onClick={() => del(p)} style={{ background: "#FEE2E2", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13 }} title="حذف">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: "0 4px" }}>
            <span style={{ fontSize: 12, color: C.muted }}>عرض {paged.length} من {filtered.length} نتيجة</span>
            <div style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB",
                    background: page === i ? C.navy : "#fff",
                    color: page === i ? "#fff" : C.dark,
                    cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ width: 270, background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", padding: 20, flexShrink: 0, boxShadow: "0 1px 6px rgba(30,42,74,0.05)", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>ملف المريض</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div
              style={{
                width: 60, height: 60, borderRadius: "50%", margin: "0 auto 8px",
                background: selected.gender === "ذكر" ? "#DBEAFE" : "#FCE7F3",
                color: selected.gender === "ذكر" ? "#1E40AF" : "#9D174D",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24,
              }}
            >
              {(selected.full_name ?? "؟")[0]}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{selected.full_name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.case_type}</div>
          </div>
          {[
            { l: "العمر", v: selected.age ? `${selected.age} سنوات` : "-" },
            { l: "الطبيب", v: selected.doctor_name ?? "-" },
            { l: "الهاتف", v: selected.phone ?? "-" },
            { l: "تاريخ التسجيل", v: (selected.created_at ?? "").slice(0, 10) || "-" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 11, color: C.muted }}>{row.l}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{row.v}</span>
            </div>
          ))}
          {selected.notes && <div style={{ marginTop: 10, padding: 10, background: C.lightGray, borderRadius: 8, fontSize: 12, color: C.dark }}>{selected.notes}</div>}
          <div style={{ marginTop: 12 }}><StatusBadge status={selected.status} /></div>
          <button
            onClick={() => openEdit(selected)}
            style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, background: C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
          >
            تعديل البيانات
          </button>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "إضافة مريض جديد" : "تعديل بيانات المريض"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <FormField label="الاسم الكامل" required>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="أحمد محمد علي" />
          </FormField>
          <FormField label="رقم الهاتف">
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" />
          </FormField>
          <FormField label="العمر">
            <Input type="number" value={form.age ?? ""} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} placeholder="8" />
          </FormField>
          <FormField label="الجنس">
            <Select value={form.gender ?? "ذكر"} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option>ذكر</option><option>أنثى</option>
            </Select>
          </FormField>
          <FormField label="نوع الحالة">
            <Select value={form.case_type ?? ""} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>
              <option value="">اختر نوع الحالة</option>
              {["تأخر لغوي", "فرط حركة", "تعديل سلوك", "جلسة نفسية", "تقييم قدرات"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="الطبيب المعالج">
            <Select value={form.doctor_name ?? ""} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}>
              <option value="">اختر الطبيب</option>
              {doctorNames.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </FormField>
          <FormField label="الحالة">
            <Select value={form.status ?? "جديد"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {["نشط", "جديد", "متوقف"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="ملاحظات">
          <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية..." rows={3} />
        </FormField>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", marginTop: 8 }}>
          <button
            onClick={save} disabled={saving}
            style={{ padding: "11px 28px", borderRadius: 10, background: saving ? C.muted : C.navy, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button onClick={() => setModal(null)} style={{ padding: "11px 20px", borderRadius: 10, background: C.lightGray, color: C.dark, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── APPOINTMENTS PAGE ────────────────────────────────────────────────────────
function AppointmentsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Appointment>>({ appointment_date: TODAY, status: "مؤكد" });
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(TODAY);
  const [filterDoctor, setFilterDoctor] = useState("الكل");
  const [filterStatus, setFilterStatus] = useState("الكل");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.appointments.listAll();
    setAppointments(Array.isArray(data) ? (data as Appointment[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const safeAppts = Array.isArray(appointments) ? appointments : [];
  const filtered = safeAppts
    .filter((a) => {
      const matchDate = !filterDate || a.appointment_date === filterDate;
      const matchDoc = filterDoctor === "الكل" || a.doctor_name === filterDoctor;
      const matchStatus = filterStatus === "الكل" || a.status === filterStatus;
      return matchDate && matchDoc && matchStatus;
    })
    .slice()
    .sort((a, b) => (a.appointment_time ?? "").localeCompare(b.appointment_time ?? ""));

  const statuses = ["مؤكد", "مكتمل", "ملغي", "لم يحضر", "قيد المراجعة"];

  const updateStatus = async (id: string, status: string) => {
    const { error } = await api.appointments.update(id, { status });
    if (error) toast.error("فشل تحديث الحالة");
    else { toast.success("تم تحديث حالة الموعد"); load(); }
  };

  const del = async (a: Appointment) => {
    if (!window.confirm(`حذف موعد ${a.patient_name}؟`)) return;
    await api.appointments.remove(a.id);
    toast.success("تم حذف الموعد"); load();
  };

  const save = async () => {
    if (!form.patient_name || !form.appointment_date || !form.appointment_time) { toast.error("يرجى تعبئة الحقول المطلوبة"); return; }
    setSaving(true);
    const { error } = await api.appointments.insert(form);
    if (error) toast.error("فشل إضافة الموعد");
    else { toast.success("تم إضافة الموعد بنجاح"); setModal(false); setForm({ appointment_date: TODAY, status: "مؤكد" }); load(); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: "auto" }} />
        <Select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)} style={{ width: "auto" }}>
          <option>الكل</option>
          {DEMO_DOCTORS.map((d) => <option key={d.id}>{d.full_name}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: "auto" }}>
          <option>الكل</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <button
          onClick={() => { setFilterDate(""); setFilterDoctor("الكل"); setFilterStatus("الكل"); }}
          style={{ padding: "9px 16px", borderRadius: 10, background: C.lightGray, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 12, color: C.muted, fontFamily: "inherit" }}
        >
          مسح الفلاتر
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setModal(true)}
          style={{ padding: "9px 20px", borderRadius: 10, background: C.sage, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}
        >
          + موعد جديد
        </button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "الكل", count: filtered.length, color: C.navy },
          { label: "مؤكد", count: filtered.filter((a) => a.status === "مؤكد").length, color: "#1E40AF" },
          { label: "مكتمل", count: filtered.filter((a) => a.status === "مكتمل").length, color: C.success },
          { label: "لم يحضر", count: filtered.filter((a) => a.status === "لم يحضر").length, color: C.warning },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 10, padding: "10px 16px", border: "1px solid #E5E7EB", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1.5fr 1.2fr 1fr 1fr 1fr 120px", padding: "10px 18px", background: C.lightGray, borderBottom: "1px solid #E5E7EB", fontSize: 11, fontWeight: 700, color: C.muted }}>
          <span>الوقت</span><span>المريض</span><span>الطبيب</span><span>نوع الجلسة</span><span>الغرفة</span><span>الحالة</span><span>إجراءات</span>
        </div>
        {loading ? (
          Array(5).fill(0).map((_, i) => <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}><Skeleton h={40} /></div>)
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
            <div style={{ color: C.muted, fontSize: 14 }}>لا توجد مواعيد مطابقة</div>
          </div>
        ) : filtered.map((a) => (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "80px 1.5fr 1.2fr 1fr 1fr 1fr 120px", padding: "13px 18px", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>{a.appointment_time}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{a.patient_name}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{a.appointment_date}</div>
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>{a.doctor_name}</span>
            <span style={{ fontSize: 12, color: C.dark }}>{a.session_type}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{a.room ?? "-"}</span>
            <StatusBadge status={a.status} />
            <div style={{ display: "flex", gap: 4 }}>
              <Select
                value={a.status ?? "مؤكد"}
                onChange={(e) => updateStatus(a.id, e.target.value)}
                style={{ padding: "4px 6px", fontSize: 11, background: C.lightGray, width: "auto" }}
              >
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
              <button onClick={() => del(a)} style={{ background: "#FEE2E2", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة موعد جديد">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <FormField label="اسم المريض" required>
            <Input value={form.patient_name ?? ""} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} placeholder="اسم المريض" />
          </FormField>
          <FormField label="الطبيب">
            <Select value={form.doctor_name ?? ""} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}>
              <option value="">اختر الطبيب</option>
              {DEMO_DOCTORS.map((d) => <option key={d.id}>{d.full_name}</option>)}
            </Select>
          </FormField>
          <FormField label="التاريخ" required>
            <Input type="date" value={form.appointment_date ?? TODAY} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
          </FormField>
          <FormField label="الوقت" required>
            <Input type="time" value={form.appointment_time ?? ""} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} />
          </FormField>
          <FormField label="نوع الجلسة">
            <Select value={form.session_type ?? ""} onChange={(e) => setForm({ ...form, session_type: e.target.value })}>
              <option value="">اختر النوع</option>
              {["تأخر لغوي", "فرط حركة", "تعديل سلوك", "جلسة نفسية", "تقييم قدرات"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="الغرفة">
            <Select value={form.room ?? ""} onChange={(e) => setForm({ ...form, room: e.target.value })}>
              <option value="">اختر الغرفة</option>
              {["غرفة 1", "غرفة 2", "غرفة 3", "غرفة 4"].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </FormField>
          <FormField label="الحالة">
            <Select value={form.status ?? "مؤكد"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {["مؤكد", "قيد المراجعة"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="المدة (دقيقة)">
            <Select value={form.duration ?? 60} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
              {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} دقيقة</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="ملاحظات">
          <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </FormField>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={save} disabled={saving}
            style={{ padding: "11px 28px", borderRadius: 10, background: saving ? C.muted : C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}
          >
            {saving ? "جارٍ الحفظ..." : "تأكيد الحجز"}
          </button>
          <button onClick={() => setModal(false)} style={{ padding: "11px 20px", borderRadius: 10, background: C.lightGray, color: C.dark, border: "none", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── RECEPTION PAGE ───────────────────────────────────────────────────────────
function ReceptionPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [form, setForm] = useState<Partial<Appointment>>({ appointment_date: TODAY, status: "مؤكد", duration: 60 });
  const [saving, setSaving] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadToday = useCallback(async () => {
    setLoadingAppts(true);
    const { data } = await api.appointments.list(TODAY);
    setTodayAppts(Array.isArray(data) ? (data as Appointment[]) : []);
    setLoadingAppts(false);
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await api.patients.list();
    const safeData = Array.isArray(data) ? (data as Patient[]) : [];
    setSearchResults(
      safeData.filter((p) => (p.full_name ?? "").includes(q) || (p.phone ?? "").includes(q)).slice(0, 5)
    );
  };

  const selectPatient = (p: Patient) => {
    setForm((f) => ({ ...f, patient_name: p.full_name, doctor_name: p.doctor_name, session_type: p.case_type }));
    setSearchQ(p.full_name);
    setSearchResults([]);
  };

  const save = async () => {
    if (!form.patient_name || !form.appointment_time) { toast.error("يرجى إدخال اسم المريض والوقت"); return; }
    setSaving(true);
    const { error } = await api.appointments.insert(form);
    if (error) toast.error("فشل الحجز");
    else { toast.success("تم الحجز بنجاح ✓"); setForm({ appointment_date: TODAY, status: "مؤكد", duration: 60 }); setSearchQ(""); loadToday(); }
    setSaving(false);
  };

  const checkIn = async (id: string) => {
    await api.appointments.update(id, { status: "مكتمل" });
    toast.success("تم تسجيل الدخول"); loadToday();
  };

  const safeTodayAppts = Array.isArray(todayAppts) ? todayAppts : [];
  const waiting = safeTodayAppts.filter((a) => a.status === "مؤكد");
  const completed = safeTodayAppts.filter((a) => a.status === "مكتمل").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.navy, marginBottom: 20 }}>⚡ حجز سريع</div>
        <FormField label="ابحث عن مريض" required>
          <div style={{ position: "relative" }} ref={searchRef}>
            <Input
              value={searchQ}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="اكتب اسم المريض أو رقمه..."
            />
            {searchResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, marginTop: 4 }}>
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: C.dark, borderBottom: "1px solid #F3F4F6" }}
                  >
                    <strong>{p.full_name}</strong> <span style={{ color: C.muted }}>— {p.case_type}</span>
                  </div>
                ))}
                <div
                  onClick={() => { setForm((f) => ({ ...f, patient_name: searchQ })); setSearchResults([]); }}
                  style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, color: C.sage, fontWeight: 700 }}
                >
                  + تسجيل كمريض جديد: "{searchQ}"
                </div>
              </div>
            )}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <FormField label="الطبيب">
            <Select value={form.doctor_name ?? ""} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}>
              <option value="">اختر الطبيب</option>
              {DEMO_DOCTORS.map((d) => <option key={d.id}>{d.full_name}</option>)}
            </Select>
          </FormField>
          <FormField label="نوع الجلسة">
            <Select value={form.session_type ?? ""} onChange={(e) => setForm({ ...form, session_type: e.target.value })}>
              <option value="">نوع الجلسة</option>
              {["تأخر لغوي", "فرط حركة", "تعديل سلوك", "جلسة نفسية", "تقييم قدرات"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="التاريخ">
            <Input type="date" value={form.appointment_date ?? TODAY} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
          </FormField>
          <FormField label="الوقت" required>
            <Input type="time" value={form.appointment_time ?? ""} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} />
          </FormField>
          <FormField label="الغرفة">
            <Select value={form.room ?? ""} onChange={(e) => setForm({ ...form, room: e.target.value })}>
              <option value="">اختر</option>
              {["غرفة 1", "غرفة 2", "غرفة 3"].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </FormField>
          <FormField label="المدة">
            <Select value={form.duration ?? 60} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
              {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} دقيقة</option>)}
            </Select>
          </FormField>
        </div>
        <button
          onClick={save} disabled={saving}
          style={{ width: "100%", padding: "12px", borderRadius: 12, background: saving ? C.muted : C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: "inherit", marginTop: 4 }}
        >
          {saving ? "جارٍ التسجيل..." : "✓ تأكيد الحجز"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: C.navy, borderRadius: 16, padding: 20, color: "#fff" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>إحصائيات اليوم</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { l: "مجدول", v: safeTodayAppts.length },
              { l: "مكتمل", v: completed },
              { l: "في الانتظار", v: waiting.length },
            ].map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{s.v}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>قائمة الانتظار</div>
            {waiting.length > 0 && (
              <span style={{ background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {waiting.length} ينتظر
              </span>
            )}
          </div>
          {loadingAppts ? (
            Array(3).fill(0).map((_, i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton h={52} /></div>)
          ) : waiting.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.muted, fontSize: 13 }}>قائمة الانتظار فارغة 🎉</div>
          ) : waiting.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < waiting.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{a.patient_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{a.session_type} • {a.appointment_time}</div>
              </div>
              <button
                onClick={() => checkIn(a.id)}
                style={{ padding: "6px 14px", borderRadius: 8, background: C.sage, border: "none", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              >
                ✓ تسجيل
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DOCTORS PAGE ─────────────────────────────────────────────────────────────
function DoctorsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<Partial<Doctor>>({ available: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.doctors.list();
    setDoctors(Array.isArray(data) ? (data as Doctor[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.full_name) { toast.error("اسم الطبيب مطلوب"); return; }
    setSaving(true);
    const op = modal === "add" ? api.doctors.insert(form) : api.doctors.update(form.id!, form);
    const { error } = await op;
    if (error) toast.error("حدث خطأ");
    else { toast.success(modal === "add" ? "تم إضافة الطبيب" : "تم التحديث"); setModal(null); load(); }
    setSaving(false);
  };

  const del = async (d: Doctor) => {
    if (!window.confirm(`حذف ${d.full_name}؟`)) return;
    await api.doctors.remove(d.id);
    toast.success("تم الحذف"); load();
  };

  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const sessionCount = (name: string) =>
    Array.isArray(DEMO_APPOINTMENTS) ? DEMO_APPOINTMENTS.filter((a) => a.doctor_name === name).length : 0;
  const patientCount = (name: string) =>
    Array.isArray(DEMO_PATIENTS) ? DEMO_PATIENTS.filter((p) => p.doctor_name === name).length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => { setForm({ available: true }); setModal("add"); }}
          style={{ padding: "9px 20px", borderRadius: 10, background: C.sage, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}
        >
          + إضافة طبيب
        </button>
      </div>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {Array(4).fill(0).map((_, i) => <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB" }}><Skeleton h={180} /></div>)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {safeDoctors.map((d) => (
            <div key={d.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
              <div style={{ height: 5, background: d.available ? C.success : C.muted }} />
              <div style={{ padding: 22 }}>
                <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
                    {(d.full_name ?? "").split(" ").slice(1, 2)[0]?.[0] ?? "د"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{d.full_name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{d.specialty}</div>
                    <span style={{ display: "inline-block", marginTop: 6, background: d.available ? "#D1FAE5" : "#F3F4F6", color: d.available ? "#065F46" : C.muted, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {d.available ? "متاح الآن" : "غير متاح"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  {[
                    { l: "الجلسات", v: sessionCount(d.full_name) },
                    { l: "المرضى", v: patientCount(d.full_name) },
                    { l: "الخبرة", v: d.experience ?? "-" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.lightGray, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {d.education && <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>📚 {d.education}</div>}
                {d.phone && <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>📞 {d.phone}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setForm({ ...d }); setModal("edit"); }} style={{ flex: 1, padding: "8px", borderRadius: 8, background: C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>تعديل</button>
                  <button onClick={() => del(d)} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "#FEE2E2", color: C.error, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "إضافة طبيب جديد" : "تعديل بيانات الطبيب"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <FormField label="الاسم الكامل" required>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="د. الاسم الكامل" />
          </FormField>
          <FormField label="التخصص">
            <Select value={form.specialty ?? ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
              <option value="">اختر التخصص</option>
              {["علم النفس السريني", "علاج النطق واللغة", "تعديل السلوك", "التطور الطفولي"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="رقم الهاتف">
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" />
          </FormField>
          <FormField label="البريد الإلكتروني">
            <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="doctor@clinic.com" />
          </FormField>
          <FormField label="سنوات الخبرة">
            <Input value={form.experience ?? ""} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="5 سنوات" />
          </FormField>
          <FormField label="الحالة">
            <Select value={form.available ? "true" : "false"} onChange={(e) => setForm({ ...form, available: e.target.value === "true" })}>
              <option value="true">متاح</option>
              <option value="false">غير متاح</option>
            </Select>
          </FormField>
        </div>
        <FormField label="المؤهل العلمي">
          <Input value={form.education ?? ""} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="دكتوراه جامعة..." />
        </FormField>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={save} disabled={saving}
            style={{ padding: "11px 28px", borderRadius: 10, background: saving ? C.muted : C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button onClick={() => setModal(null)} style={{ padding: "11px 20px", borderRadius: 10, background: C.lightGray, color: C.dark, border: "none", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── FINANCIALS PAGE ──────────────────────────────────────────────────────────
function FinancialsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [records, setRecords] = useState<Financial[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Financial>>({ payment_status: "معلقة", payment_method: "نقدي" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.financials.list();
    setRecords(Array.isArray(data) ? (data as Financial[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // All financial calculations declared inside component scope, before return
  const safeRecords = Array.isArray(records) ? records : [];

  const totalRevenue = safeRecords
    .filter((f) => f.payment_status === "مدفوعة")
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const pending = safeRecords
    .filter((f) => f.payment_status !== "مدفوعة")
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const totalAll = safeRecords.reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const save = async () => {
    if (!form.patient_name || !form.amount) { toast.error("اسم المريض والمبلغ مطلوبان"); return; }
    setSaving(true);
    if (editId) {
      const { error } = await api.financials.update(editId, form);
      if (error) toast.error("فشل التحديث");
      else { toast.success("تم تحديث الفاتورة"); setModal(false); setEditId(null); load(); }
    } else {
      const { error } = await api.financials.insert(form);
      if (error) toast.error("فشل الإضافة");
      else { toast.success("تم إضافة الفاتورة"); setModal(false); load(); }
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await api.financials.update(id, { payment_status: status });
    toast.success("تم تحديث حالة الدفع"); load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { l: "إجمالي الإيرادات المحصّلة (EGP)", v: `${totalRevenue.toLocaleString("ar-EG")} جنيه`, c: C.success, icon: "📈" },
          { l: "المبالغ المعلقة", v: `${pending.toLocaleString("ar-EG")} جنيه`, c: C.warning, icon: "⏳" },
          { l: "إجمالي الفواتير", v: `${totalAll.toLocaleString("ar-EG")} جنيه`, c: C.navy, icon: "📋" },
          { l: "عدد الفواتير", v: safeRecords.length, c: C.purple, icon: "🧾" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>سجل الفواتير</div>
          <button
            onClick={() => { setForm({ payment_status: "معلقة", payment_method: "نقدي" }); setEditId(null); setModal(true); }}
            style={{ padding: "8px 18px", borderRadius: 10, background: C.sage, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}
          >
            + فاتورة جديدة
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr 1fr 1fr 80px", padding: "10px 18px", background: C.lightGray, borderBottom: "1px solid #E5E7EB", fontSize: 11, fontWeight: 700, color: C.muted }}>
          <span>رقم الفاتورة</span><span>المريض</span><span>الخدمة</span><span>المبلغ</span><span>طريقة الدفع</span><span>الحالة</span><span>إجراء</span>
        </div>
        {loading ? (
          Array(5).fill(0).map((_, i) => <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}><Skeleton h={36} /></div>)
        ) : safeRecords.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>💰</div>
            <div style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>لا توجد فواتير بعد</div>
          </div>
        ) : safeRecords.map((f) => (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr 1fr 1fr 1fr 80px", padding: "12px 18px", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{f.invoice_number}</span>
            <span style={{ fontSize: 13, color: C.dark }}>{f.patient_name}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{f.service}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>{Number(f.amount).toLocaleString("ar-EG")} جنيه</span>
            <span style={{ fontSize: 12, color: C.muted }}>{f.payment_method}</span>
            <StatusBadge status={f.payment_status} />
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => { setForm({ ...f }); setEditId(f.id); setModal(true); }}
                style={{ background: C.lightGray, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}
              >
                ✏️
              </button>
              {f.payment_status !== "مدفوعة" && (
                <button
                  onClick={() => updateStatus(f.id, "مدفوعة")}
                  style={{ background: "#D1FAE5", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#065F46", fontFamily: "inherit" }}
                >
                  دفع
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditId(null); }} title={editId ? "تعديل فاتورة" : "إضافة فاتورة جديدة"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <FormField label="اسم المريض" required>
            <Input value={form.patient_name ?? ""} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} placeholder="اسم المريض" />
          </FormField>
          <FormField label="الخدمة">
            <Select value={form.service ?? ""} onChange={(e) => setForm({ ...form, service: e.target.value })}>
              <option value="">اختر الخدمة</option>
              {["تأخر لغوي", "فرط حركة", "تعديل سلوك", "جلسة نفسية", "تقييم قدرات"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="المبلغ (جنيه)" required>
            <Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="450" />
          </FormField>
          <FormField label="طريقة الدفع">
            <Select value={form.payment_method ?? "نقدي"} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              {["نقدي", "بطاقة", "تحويل"].map((m) => <option key={m}>{m}</option>)}
            </Select>
          </FormField>
          <FormField label="حالة الدفع">
            <Select value={form.payment_status ?? "معلقة"} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
              {["مدفوعة", "معلقة", "متأخرة"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="ملاحظات">
          <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </FormField>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={save} disabled={saving}
            style={{ padding: "11px 28px", borderRadius: 10, background: saving ? C.muted : C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button onClick={() => { setModal(false); setEditId(null); }} style={{ padding: "11px 20px", borderRadius: 10, background: C.lightGray, color: C.dark, border: "none", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────────────────────
function ReportsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.patients.list(), api.appointments.listAll(), api.financials.list()]).then(
      ([p, a, f]) => {
        setPatients(Array.isArray(p.data) ? (p.data as Patient[]) : []);
        setAppointments(Array.isArray(a.data) ? (a.data as Appointment[]) : []);
        setFinancials(Array.isArray(f.data) ? (f.data as Financial[]) : []);
        setLoading(false);
      }
    );
  }, []);

  // All derived values declared before return
  const safePatients = Array.isArray(patients) ? patients : [];
  const safeAppts = Array.isArray(appointments) ? appointments : [];
  const safeFins = Array.isArray(financials) ? financials : [];

  const totalRevenue = safeFins
    .filter((f) => f.payment_status === "مدفوعة")
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const totalAppts = safeAppts.length;
  const completedAppts = safeAppts.filter((a) => a.status === "مكتمل").length;
  const attendanceRate = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;

  const caseDist: Record<string, number> = {};
  safePatients.forEach((p) => {
    if (p.case_type) caseDist[p.case_type] = (caseDist[p.case_type] ?? 0) + 1;
  });
  const caseData = Object.entries(caseDist).map(([label, value]) => ({ label, value }));

  const statusDist: Record<string, number> = {};
  safeAppts.forEach((a) => {
    if (a.status) statusDist[a.status] = (statusDist[a.status] ?? 0) + 1;
  });
  const statusData = Object.entries(statusDist).map(([label, value]) => ({ label, value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        {["تصدير Excel", "تصدير PDF", "طباعة"].map((b) => (
          <button key={b} style={{ padding: "8px 16px", borderRadius: 10, background: "#fff", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 12, color: C.dark, fontFamily: "inherit" }}>{b}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { l: "إجمالي المرضى", v: safePatients.length, c: C.navy },
          { l: "إجمالي المواعيد", v: safeAppts.length, c: C.sage },
          { l: "الإيرادات المحصّلة (EGP)", v: `${totalRevenue.toLocaleString("ar-EG")} جنيه`, c: C.success },
          { l: "معدل الحضور", v: `${attendanceRate}%`, c: C.warning },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>توزيع الحالات</div>
          {loading ? <Skeleton h={130} /> : <DonutChart data={caseData} />}
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>حالات المواعيد</div>
          {loading ? <Skeleton h={130} /> : <DonutChart data={statusData} />}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", fontWeight: 800, fontSize: 15, color: C.navy }}>تقرير المرضى</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 18px", background: C.lightGray, borderBottom: "1px solid #E5E7EB", fontSize: 11, fontWeight: 700, color: C.muted }}>
          <span>المريض</span><span>الحالة</span><span>الطبيب</span><span>نوع الحالة</span><span>تاريخ التسجيل</span>
        </div>
        {loading ? (
          Array(5).fill(0).map((_, i) => <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}><Skeleton h={32} /></div>)
        ) : safePatients.map((p) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "12px 18px", borderBottom: "1px solid #F3F4F6", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: p.gender === "ذكر" ? "#DBEAFE" : "#FCE7F3",
                  color: p.gender === "ذكر" ? "#1E40AF" : "#9D174D",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 12, flexShrink: 0,
                }}
              >
                {(p.full_name ?? "؟")[0]}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{p.full_name}</span>
            </div>
            <StatusBadge status={p.status} />
            <span style={{ fontSize: 12, color: C.muted }}>{p.doctor_name}</span>
            <span style={{ fontSize: 12, color: C.dark }}>{p.case_type}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{(p.created_at ?? "").slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [clinic, setClinic] = useState({
    name: "مركز دعم للإرشاد النفسي",
    phone: "0112345678",
    email: "info@alnumow.com",
    address: "القاهرة، مصر الجديدة، شارع العروبة",
    timezone: "Africa/Cairo",
  });
  const [notifs, setNotifs] = useState({ email: true, sms: true, appointments: true, payments: false });
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    toast.success("تم حفظ الإعدادات بنجاح ✓");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy, marginBottom: 20 }}>معلومات العيادة</div>
          <FormField label="اسم العيادة"><Input value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} /></FormField>
          <FormField label="رقم الهاتف"><Input value={clinic.phone} onChange={(e) => setClinic({ ...clinic, phone: e.target.value })} /></FormField>
          <FormField label="البريد الإلكتروني"><Input value={clinic.email} onChange={(e) => setClinic({ ...clinic, email: e.target.value })} /></FormField>
          <FormField label="العنوان"><Textarea value={clinic.address} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} rows={2} /></FormField>
          <button
            onClick={save}
            style={{ padding: "10px 24px", borderRadius: 10, background: saved ? C.success : C.navy, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "background 0.2s" }}
          >
            {saved ? "✓ تم الحفظ" : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy, marginBottom: 20 }}>إعدادات الإشعارات</div>
          {[
            { k: "email" as const, l: "إشعارات البريد الإلكتروني" },
            { k: "sms" as const, l: "إشعارات الرسائل النصية" },
            { k: "appointments" as const, l: "تذكير المواعيد" },
            { k: "payments" as const, l: "إشعارات المدفوعات" },
          ].map((n) => (
            <div key={n.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 13, color: C.dark }}>{n.l}</span>
              <div
                onClick={() => setNotifs((p) => ({ ...p, [n.k]: !p[n.k] }))}
                style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: notifs[n.k] ? C.sage : "#E5E7EB", position: "relative", transition: "background 0.2s" }}
              >
                <div style={{ position: "absolute", top: 2, right: notifs[n.k] ? 2 : 20, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "right 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E5E7EB", boxShadow: "0 1px 6px rgba(30,42,74,0.05)" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.navy, marginBottom: 16 }}>الاتصال بقاعدة البيانات</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: DEMO_MODE ? "#FEF3C7" : "#D1FAE5", borderRadius: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: DEMO_MODE ? C.warning : C.success }} />
            <span style={{ fontSize: 13, color: DEMO_MODE ? "#92400E" : "#065F46", fontWeight: 600 }}>
              {DEMO_MODE ? "وضع تجريبي — البيانات محلية" : "متصل بـ Supabase ✓"}
            </span>
          </div>
          {DEMO_MODE && (
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, background: C.lightGray, padding: 12, borderRadius: 8 }}>
              لتفعيل Supabase، عدّل متغيرَي SUPABASE_URL وSUPABASE_ANON_KEY في أعلى الملف وأنشئ جداول قاعدة البيانات باستخدام SQL المرفق في تعليقات الكود.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@clinic.com");
  const [password, setPassword] = useState("123456");
  const [showPass, setShowPass] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!email || !password) { setError("يرجى إدخال البريد وكلمة المرور"); return; }
    setError(""); setLoadingAuth(true);
    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 900));
      onLogin({ email });
    } else {
      const { data, error: err } = await sb.signIn(email, password);
      if (err) setError("بيانات الدخول غير صحيحة");
      else onLogin({ email: data?.user?.email ?? email });
    }
    setLoadingAuth(false);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: "rtl" }}>
      <div style={{ width: "45%", background: C.navy, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 60, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, left: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(95,142,126,0.12)" }} />
        <div style={{ position: "absolute", bottom: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(95,142,126,0.08)" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "#fff" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: C.sage, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 24px" }}>✦</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 8px" }}>مركز دعم</h1>
          <p style={{ fontSize: 15, opacity: 0.55, margin: "0 0 48px" }}>للإرشاد النفسي والتطوير</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "right" }}>
            {[
              ["👥", "إدارة شاملة للمرضى"],
              ["📅", "جدولة المواعيد بذكاء"],
              ["📊", "تقارير وتحليلات متقدمة"],
              ["💰", "نظام حسابات بالجنيه المصري"],
              ["🔄", "تحديث فوري بـ Supabase Realtime"],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ opacity: 0.8, fontSize: 14 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: C.lightGray, padding: 60 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: C.navy, margin: "0 0 6px", textAlign: "right" }}>مرحباً بك</h2>
          <p style={{ color: C.muted, fontSize: 14, margin: "0 0 30px", textAlign: "right" }}>سجّل دخولك للمتابعة</p>
          {DEMO_MODE && (
            <div style={{ background: "#DBEAFE", color: "#1E40AF", padding: "10px 14px", borderRadius: 10, fontSize: 12, marginBottom: 20, fontWeight: 600, textAlign: "right" }}>
              🎯 وضع تجريبي — اضغط تسجيل الدخول مباشرة
            </div>
          )}
          {error && <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: "right" }}>{error}</div>}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textAlign: "right" }}>البريد الإلكتروني</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@clinic.com" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textAlign: "right" }}>كلمة المرور</label>
            <div style={{ position: "relative" }}>
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handle()}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <button
            onClick={handle}
            disabled={loadingAuth}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loadingAuth ? C.muted : C.navy, color: "#fff", fontSize: 15, fontWeight: 800, cursor: loadingAuth ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loadingAuth ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول →"}
          </button>
          <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 24 }}>
            © 2024 مركز دعم — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<PageId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mounted, setMounted] = useState(false);
  const toast = useToast();

  // Avoid SSR/hydration mismatch — mark as mounted on client only
  useEffect(() => {
    setMounted(true);
    if (DEMO_MODE) setUser({ email: "admin@clinic.com" });
  }, []);

  const loadNotifs = useCallback(async () => {
    const { data } = await api.notifications.list();
    setNotifications(Array.isArray(data) ? (data as Notification[]) : []);
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifs();
      const t = setInterval(loadNotifs, 15000);
      return () => clearInterval(t);
    }
  }, [user, loadNotifs]);

  const markRead = async (id: string) => { await api.notifications.markRead(id); loadNotifs(); };
  const markAllRead = async () => { await api.notifications.markAllRead(); loadNotifs(); };
  const logout = () => { sb.signOut(); setUser(null); };

  const pageTitles: Record<PageId, string> = {
    dashboard: "الرئيسية",
    patients: "المرضى",
    appointments: "المواعيد",
    reception: "الاستقبال",
    doctors: "الأطباء",
    financials: "الحسابات",
    reports: "التقارير",
    settings: "الإعدادات",
  };

  // Suppress hydration warning on root shell; actual content renders after mount
  if (!mounted) {
    return (
      <div suppressHydrationWarning style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.lightGray, fontFamily: "inherit" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 14 }}>جارٍ التحميل...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style>{`
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          * { box-sizing: border-box; }
          body { margin: 0; }
        `}</style>
        <LoginPage onLogin={(u) => setUser(u)} />
      </>
    );
  }

  const pages: Record<PageId, ReactNode> = {
    dashboard: <DashboardPage toast={toast} />,
    patients: <PatientsPage toast={toast} />,
    appointments: <AppointmentsPage toast={toast} />,
    reception: <ReceptionPage toast={toast} />,
    doctors: <DoctorsPage toast={toast} />,
    financials: <FinancialsPage toast={toast} />,
    reports: <ReportsPage />,
    settings: <SettingsPage toast={toast} />,
  };

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }
      `}</style>
      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Arial, sans-serif",
          direction: "rtl",
          background: C.lightGray,
        }}
        suppressHydrationWarning
      >
        <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar
            pageTitle={pageTitles[page]}
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            user={user}
            onLogout={logout}
          />
          <main style={{ flex: 1, overflowY: "auto", padding: 22 }}>
            {pages[page]}
          </main>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} />
    </>
  );
}
