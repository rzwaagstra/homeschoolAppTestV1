
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Plus, Calendar as CalendarIcon, Save, FileDown, Trash2, CheckCircle2, Copy, Users, BookOpen, ChevronLeft, ChevronRight, Clock3, Upload, Link as LinkIcon, Target, PieChart, FileText } from "lucide-react";

const APP_VERSION = "homeschoolTestV1";

// ---------- Helpers ----------
const fmt = (d) => {
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, "0");
  const day = String(dd.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfWeek = (d, weekStartsOn = 1) => {
  const date = new Date(d);
  const diff = (date.getDay() + 7 - weekStartsOn) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfWeek = (d, weekStartsOn = 1) => {
  const s = startOfWeek(d, weekStartsOn);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};

const monthMatrix = (year, month, weekStartsOn = 1) => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const gridStart = startOfWeek(first, weekStartsOn);
  const gridEnd = endOfWeek(last, weekStartsOn);
  const days = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const SUBJECTS_DEFAULT = ["Math", "ELA", "Science", "History", "PE", "Art"];

// ---------- Storage ----------
const STORAGE_KEY = "homeschool.tracker.v1";
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
};

const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
};

// ---------- Initial Data ----------
const initialData = () => {
  const today = new Date();
  const s1 = { id: uid(), name: "Student One", grade: "5", subjects: [...SUBJECTS_DEFAULT], weeklyTargets: { Math: 5, ELA: 5, Science: 3, History: 3, PE: 2, Art: 2 } };
  const s2 = { id: uid(), name: "Student Two", grade: "2", subjects: ["Math", "ELA", "Science", "Art"], weeklyTargets: { Math: 4, ELA: 4, Science: 2, Art: 2 } };
  return {
    students: [s1, s2],
    activeStudentId: s1.id,
    attendance: {},
    lessons: {},
    templates: [],
    portfolio: {},
    grades: {},
    feedback: [], // NEW
    settings: { weekStartsOn: 1, feedbackEmail: "" }, // NEW
    createdAt: fmt(today),
    appVersion: APP_VERSION, // NEW
  };
};

// ---------- Core App ----------
export default function App() {
  const [db, setDb] = useState(() => loadState() || initialData());
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => { saveState(db); }, [db]);

  const activeStudent = useMemo(() => db.students.find(s => s.id === db.activeStudentId) || db.students[0], [db]);

  const setActiveStudent = (id) => setDb(d => ({ ...d, activeStudentId: id }));
  const upsertStudent = (stu) => setDb(d => ({ ...d, students: d.students.some(s=>s.id===stu.id) ? d.students.map(s=>s.id===stu.id?stu:s) : [...d.students, { ...stu, id: uid() }] }));
  const removeStudent = (id) => setDb(d => ({ ...d, students: d.students.filter(s=>s.id!==id) }));

  const toggleAttendance = (dateStr, studentId) => setDb(d => {
    const sid = studentId || d.activeStudentId;
    const att = d.attendance[sid] || {};
    const next = { ...att, [dateStr]: !att[dateStr] };
    return { ...d, attendance: { ...d.attendance, [sid]: next } };
  });

  const addLesson = (dateStr, payload) => setDb(d => {
    const day = d.lessons[dateStr] || [];
    return { ...d, lessons: { ...d.lessons, [dateStr]: [...day, { id: uid(), ...payload }] } };
  });

  const updateLesson = (dateStr, lessonId, patch) => setDb(d => {
    const day = d.lessons[dateStr] || [];
    return { ...d, lessons: { ...d.lessons, [dateStr]: day.map(l => l.id===lessonId? { ...l, ...patch }: l) } };
  });

  const removeLesson = (dateStr, lessonId) => setDb(d => {
    const day = d.lessons[dateStr] || [];
    return { ...d, lessons: { ...d.lessons, [dateStr]: day.filter(l => l.id!==lessonId) } };
  });

  const addTemplate = (tpl) => setDb(d => ({ ...d, templates: [...d.templates, { id: uid(), ...tpl }] }));
  const applyTemplateToWeek = (templateId, anchorDateStr) => {
    const tpl = db.templates.find(t => t.id === templateId);
    if (!tpl) return;
    const anchor = new Date(anchorDateStr);
    const start = startOfWeek(anchor, db.settings.weekStartsOn);
    const subjects = activeStudent?.subjects || SUBJECTS_DEFAULT;
    const forStudents = [activeStudent?.id].filter(Boolean);
    const days = Array.from({ length: 5 }, (_, i) => fmt(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    let di = 0;
    tpl.items.forEach(item => {
      const dateStr = days[di % days.length];
      addLesson(dateStr, { ...item, subject: item.subject || subjects[0], for: forStudents });
      di++;
    });
  };

  const addPortfolio = (studentId, item) => setDb(d => ({ ...d, portfolio: { ...d.portfolio, [studentId]: [ ...(d.portfolio[studentId]||[]), { id: uid(), ...item } ] } }));
  const removePortfolio = (studentId, id) => setDb(d => ({ ...d, portfolio: { ...d.portfolio, [studentId]: (d.portfolio[studentId]||[]).filter(x=>x.id!==id) } }));

  const addAssignment = (studentId, subject, a) => setDb(d => {
    const s = d.grades[studentId] || {};
    const subj = s[subject] || { assignments: [] };
    return { ...d, grades: { ...d.grades, [studentId]: { ...s, [subject]: { assignments: [...subj.assignments, { id: uid(), ...a }] } } } };
  });
  const removeAssignment = (studentId, subject, id) => setDb(d => {
    const s = d.grades[studentId] || {};
    const subj = s[subject] || { assignments: [] };
    return { ...d, grades: { ...d.grades, [studentId]: { ...s, [subject]: { assignments: subj.assignments.filter(x=>x.id!==id) } } } };
  });

  // ---------- Derived Metrics ----------
  const weekRange = (date) => ({ start: startOfWeek(date, db.settings.weekStartsOn), end: endOfWeek(date, db.settings.weekStartsOn) });

  const weeklyHours = (studentId, date = new Date()) => {
    const { start, end } = weekRange(date);
    const res = {};
    Object.entries(db.lessons).forEach(([dstr, items]) => {
      const d = new Date(dstr);
      if (d >= start && d <= end) {
        items.forEach(l => {
          if (!l.for || l.for.includes(studentId)) {
            const s = l.subject || "Other";
            res[s] = (res[s] || 0) + (Number(l.duration) || 0);
          }
        });
      }
    });
    return res; // hours
  };

  const weeklyHoursSeries = (studentId, weeksBack = 8) => {
    const today = new Date();
    const data = [];
    for (let i = weeksBack - 1; i >= 0; i--) {
      const ref = new Date(today);
      ref.setDate(ref.getDate() - i * 7);
      const { start, end } = weekRange(ref);
      let total = 0;
      Object.entries(db.lessons).forEach(([dstr, items]) => {
        const d = new Date(dstr);
        if (d >= start && d <= end) {
          items.forEach(l => { if (!l.for || l.for.includes(studentId)) total += Number(l.duration) || 0; });
        }
      });
      data.push({ week: `${fmt(start).slice(5)}→${fmt(end).slice(5)}`, hours: Number(total.toFixed(2)) });
    }
    return data;
  };

  const attendanceHeat = (studentId, days = 90) => {
    const today = new Date();
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmt(d);
      const val = (db.attendance[studentId] || {})[key] ? 1 : 0;
      data.push({ date: key, present: val });
    }
    return data;
  };

  // ---------- PDF Exports ----------
  const exportElementToPDF = async (element, filename = "report.pdf") => {
    const node = element.current;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    const x = (pageWidth - w) / 2;
    const y = 20;
    pdf.addImage(imgData, "PNG", x, y, w, h);
    pdf.save(filename);
  };

  // ---------- UI ----------
  const [tab, setTab] = useState("dashboard");

  const doReset = () => {
    if (!confirm("Reset all local data and reload?")) return;
    localStorage.removeItem(STORAGE_KEY);
    const fresh = initialData();
    setDb(fresh);
    setTimeout(()=>window.location.reload(), 100);
  };

  const onSubmitFeedback = (payload) => {
    const entry = { id: uid(), ...payload, at: new Date().toISOString(), appVersion: APP_VERSION };
    setDb(d => ({ ...d, feedback: [...(d.feedback || []), entry] }));
    setShowFeedback(false);
  };

  const exportFeedbackJSON = () => {
    const data = JSON.stringify(db.feedback || [], null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "homeschool-feedback.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <CalendarIcon className="w-6 h-6"/>
          <h1 className="text-xl font-bold">Homeschool HQ</h1>
          <span className="text-slate-500">• The all‑in‑one homeschool tracker</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">v {APP_VERSION}</span>
          <div className="ml-auto flex items-center gap-2">
            <StudentSelect students={db.students} value={activeStudent?.id} onChange={setActiveStudent} />
            <button onClick={() => setTab("dashboard")} className={navBtn(tab==="dashboard")}><PieChart className="w-4 h-4"/>Dashboard</button>
            <button onClick={() => setTab("calendar")} className={navBtn(tab==="calendar")}><CalendarIcon className="w-4 h-4"/>Calendar</button>
            <button onClick={() => setTab("lessons")} className={navBtn(tab==="lessons")}><BookOpen className="w-4 h-4"/>Lessons</button>
            <button onClick={() => setTab("students")} className={navBtn(tab==="students")}><Users className="w-4 h-4"/>Students</button>
            <button onClick={() => setTab("reports")} className={navBtn(tab==="reports")}><FileText className="w-4 h-4"/>Reports</button>
            <button onClick={() => setTab("settings")} className={navBtn(tab==="settings")}><Target className="w-4 h-4"/>Settings</button>
            <button onClick={() => setShowFeedback(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm bg-white hover:bg-slate-100"><FileText className="w-4 h-4"/>Feedback</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {tab === "dashboard" && (
          <Dashboard db={db} activeStudent={activeStudent} weeklyHours={weeklyHours} weeklyHoursSeries={weeklyHoursSeries} attendanceHeat={attendanceHeat} />
        )}
        {tab === "calendar" && (
          <CalendarView
            db={db}
            year={year}
            month={month}
            setYear={setYear}
            setMonth={setMonth}
            activeStudent={activeStudent}
            toggleAttendance={toggleAttendance}
            addLesson={addLesson}
            updateLesson={updateLesson}
            removeLesson={removeLesson}
            applyTemplateToWeek={applyTemplateToWeek}
          />
        )}
        {tab === "lessons" && (
          <LessonsPanel db={db} activeStudent={activeStudent} addTemplate={addTemplate} addPortfolio={addPortfolio} addAssignment={addAssignment} removeAssignment={removeAssignment} />
        )}
        {tab === "students" && (
          <StudentsPanel db={db} upsertStudent={upsertStudent} removeStudent={removeStudent} />
        )}
        {tab === "reports" && (
          <ReportsPanel db={db} activeStudent={activeStudent} attendanceHeat={attendanceHeat} weeklyHours={weeklyHours} />
        )}
        {tab === "settings" && (
          <SettingsPanel db={db} setDb={setDb} onReset={doReset} onExportFeedback={exportFeedbackJSON} />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 text-sm text-slate-500">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Data saves automatically to your browser (local‑only). You can export PDFs from Reports.</div>
      </footer>

      {showFeedback && (
        <FeedbackModal
          defaultEmail={db.settings?.feedbackEmail || ""}
          onClose={()=>setShowFeedback(false)}
          onSubmit={onSubmitFeedback}
        />
      )}
    </div>
  );
}

const navBtn = (active) => `inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-100 border-slate-300'}`;

// ---------- Components ----------
function StudentSelect({ students, value, onChange }) {
  return (
    <select className="px-2 py-1.5 border rounded-md" value={value} onChange={e=>onChange(e.target.value)}>
      {students.map(s => <option key={s.id} value={s.id}>{s.name} (Gr {s.grade})</option>)}
    </select>
  );
}

function Dashboard({ db, activeStudent, weeklyHours, weeklyHoursSeries, attendanceHeat }) {
  const wh = weeklyHours(activeStudent.id);
  const series = weeklyHoursSeries(activeStudent.id, 10);
  const heat = attendanceHeat(activeStudent.id, 84);

  const totalThisWeek = Object.values(wh).reduce((a,b)=>a+b,0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Weekly Hours Trend</h2>
          <Clock3 className="w-5 h-5 text-slate-500"/>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="hours" name="Total Hours" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">This Week Progress – {activeStudent.name}</h2>
        <div className="space-y-3">
          { (activeStudent.subjects || SUBJECTS_DEFAULT).map(sub => {
            const done = wh[sub] || 0;
            const tgt = activeStudent.weeklyTargets?.[sub] ?? 0;
            const pct = tgt ? Math.min(100, Math.round((done / tgt) * 100)) : 0;
            return (
              <div key={sub}>
                <div className="flex justify-between text-sm"><span className="font-medium">{sub}</span><span>{done.toFixed(1)}h / {tgt || 0}h</span></div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          }) }
          <div className="pt-2 text-sm text-slate-600">Total this week: <span className="font-semibold">{totalThisWeek.toFixed(1)} hours</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Attendance Heat (last 12 weeks)</h2>
        <AttendanceHeatGrid data={heat} />
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Subject Mix (This Week)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.entries(wh).map(([k,v])=>({ subject:k, hours:v }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Quick Tips</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-slate-700">
          <li>Use <span className="font-medium">Calendar</span> to toggle daily attendance and attach lessons.</li>
          <li>Create a <span className="font-medium">Template</span> once, then apply it to future weeks.</li>
          <li>Add <span className="font-medium">Standards</span> codes to lessons for coverage reporting.</li>
          <li>Export official <span className="font-medium">Attendance</span> and <span className="font-medium">Transcript</span> in the Reports tab.</li>
        </ul>
      </div>
    </div>
  );
}

function AttendanceHeatGrid({ data }) {
  return (
    <div className="grid grid-cols-12 gap-1">
      {Array.from({ length: 12 }).map((_, col) => (
        <div key={col} className="grid grid-rows-7 gap-1">
          {data.slice(col*7, col*7+7).map((d, i) => (
            <div key={i} title={`${d.date}: ${d.present ? 'Present' : 'Absent'}`} className={`w-4 h-4 rounded ${d.present ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CalendarView({ db, year, month, setYear, setMonth, activeStudent, toggleAttendance, addLesson, updateLesson, removeLesson, applyTemplateToWeek }) {
  const weeks = monthMatrix(year, month, db.settings.weekStartsOn);

  const nextMonth = () => {
    let m = month + 1, y = year;
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };
  const prevMonth = () => {
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y--; }
    setMonth(m); setYear(y);
  };

  const monthName = new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const weekApplyTemplate = (date) => {
    if (db.templates.length === 0) return alert("Create a template in Lessons first.");
    const tplId = prompt("Apply which template? Enter template ID (see Lessons).\nTemplates:\n" + db.templates.map(t=>`${t.name} — ${t.id}`).join("\n"));
    if (!tplId) return;
    applyTemplateToWeek(tplId.trim(), fmt(date));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded border"><ChevronLeft className="w-4 h-4"/></button>
          <div className="text-lg font-semibold w-56 text-center">{monthName}</div>
          <button onClick={nextMonth} className="p-2 rounded border"><ChevronRight className="w-4 h-4"/></button>
        </div>
        <div className="text-sm text-slate-600">Active student: <span className="font-semibold">{activeStudent?.name}</span></div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(<div key={d} className="text-center text-xs uppercase tracking-wide text-slate-500">{d}</div>))}
        {weeks.flat().map((d, idx) => {
          const inMonth = d.getMonth() === month;
          const dstr = fmt(d);
          const present = (db.attendance[activeStudent.id]||{})[dstr];
          const dayLessons = (db.lessons[dstr]||[]).filter(l=>!l.for || l.for.includes(activeStudent.id));
          const isMon = d.getDay() === (db.settings.weekStartsOn % 7);
          return (
            <div key={idx} className={`rounded-xl border p-2 min-h-[120px] ${inMonth? 'bg-white' : 'bg-slate-50 border-dashed text-slate-400'}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{d.getDate()}</div>
                {inMonth && (
                  <button onClick={()=>toggleAttendance(dstr, activeStudent.id)} className={`text-xs px-2 py-0.5 rounded-full border ${present? 'bg-emerald-500 text-white border-emerald-600':'bg-white'}`}>{present? 'Present':'Absent'}</button>
                )}
              </div>
              {inMonth && (
                <div className="mt-2 space-y-1">
                  {dayLessons.map(les => (
                    <div key={les.id} className="text-xs p-2 border rounded-lg">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{les.title}</span>
                        <button className="ml-2 text-slate-500 hover:text-red-600" title="Remove" onClick={()=>removeLesson(dstr, les.id)}><Trash2 className="w-3 h-3"/></button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100">{les.subject}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100">{Number(les.duration)||0}h</span>
                        {les.standards?.slice(0,2).map((s,i)=>(<span key={i} className="px-1.5 py-0.5 rounded bg-indigo-50">{s}</span>))}
                      </div>
                    </div>
                  ))}
                  <AddLessonForm onAdd={(p)=>addLesson(dstr, { ...p, for: [activeStudent.id] })} student={activeStudent} />
                </div>
              )}
              {isMon && inMonth && (
                <button onClick={()=>weekApplyTemplate(d)} className="mt-2 w-full text-xs px-2 py-1 border rounded hover:bg-slate-50 flex items-center justify-center gap-1"><Copy className="w-3 h-3"/>Apply Template to Week</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddLessonForm({ onAdd, student }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(student?.subjects?.[0] || SUBJECTS_DEFAULT[0]);
  const [duration, setDuration] = useState("1");
  const [standards, setStandards] = useState("");
  const [objectives, setObjectives] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!title) return;
    const payload = { title, subject, duration: Number(duration)||0, standards: standards? standards.split(/[,\n]/).map(s=>s.trim()).filter(Boolean):[], objectives, links: link? [{ url: link, title }]:[], notes };
    onAdd(payload);
    setTitle(""); setDuration("1"); setStandards(""); setObjectives(""); setLink(""); setNotes("");
  };

  return (
    <div className="border rounded-xl p-2">
      <div className="flex gap-2 items-end">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add lesson title" className="flex-1 px-2 py-1 border rounded"/>
        <select value={subject} onChange={e=>setSubject(e.target.value)} className="px-2 py-1 border rounded">
          {(student?.subjects || SUBJECTS_DEFAULT).map(s=>(<option key={s} value={s}>{s}</option>))}
        </select>
        <input value={duration} onChange={e=>setDuration(e.target.value)} type="number" step="0.25" min="0" className="w-20 px-2 py-1 border rounded"/>
        <button onClick={submit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white"><Plus className="w-4 h-4"/>Add</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
        <input value={standards} onChange={e=>setStandards(e.target.value)} placeholder="Standards (comma or newline)" className="px-2 py-1 border rounded"/>
        <input value={link} onChange={e=>setLink(e.target.value)} placeholder="Link (Drive/YouTube/etc)" className="px-2 py-1 border rounded"/>
        <input value={objectives} onChange={e=>setObjectives(e.target.value)} placeholder="Objectives" className="px-2 py-1 border rounded"/>
      </div>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes" className="mt-2 w-full px-2 py-1 border rounded" rows={2}/>
    </div>
  );
}

function LessonsPanel({ db, activeStudent, addTemplate, addPortfolio, addAssignment, removeAssignment }) {
  const [tplName, setTplName] = useState("");
  const [tplItems, setTplItems] = useState([{ id: uid(), title: "", subject: activeStudent?.subjects?.[0] || SUBJECTS_DEFAULT[0], duration: 1, standards: "", objectives: "" }]);

  const addTplItem = () => setTplItems(items => [...items, { id: uid(), title: "", subject: activeStudent?.subjects?.[0] || SUBJECTS_DEFAULT[0], duration: 1, standards: "", objectives: "" }]);
  const saveTemplate = () => {
    const items = tplItems.filter(i=>i.title.trim()).map(i=>({ title: i.title.trim(), subject: i.subject, duration: Number(i.duration)||0, standards: i.standards? i.standards.split(/[,\n]/).map(s=>s.trim()).filter(Boolean):[], objectives: i.objectives }));
    if (!tplName || items.length===0) return alert("Give the template a name and at least one item");
    addTemplate({ name: tplName, items });
    setTplName(""); setTplItems([{ id: uid(), title: "", subject: activeStudent?.subjects?.[0] || SUBJECTS_DEFAULT[0], duration: 1, standards: "", objectives: "" }]);
  };

  const [pfUrl, setPfUrl] = useState("");
  const [pfTitle, setPfTitle] = useState("");
  const [pfNotes, setPfNotes] = useState("");

  const [assignTitle, setAssignTitle] = useState("");
  const [assignSubj, setAssignSubj] = useState(activeStudent?.subjects?.[0] || SUBJECTS_DEFAULT[0]);
  const [assignScore, setAssignScore] = useState("");
  const [assignMax, setAssignMax] = useState("");

  const portfolio = db.portfolio[activeStudent.id] || {};
  const grades = db.grades[activeStudent.id] || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Reusable Weekly Template</h2>
        <div className="flex gap-2 mb-2">
          <input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Template name (e.g., Week A)" className="px-2 py-1 border rounded flex-1"/>
          <button onClick={saveTemplate} className="px-3 py-1.5 rounded bg-slate-900 text-white inline-flex items-center gap-1"><Save className="w-4 h-4"/>Save</button>
        </div>
        <div className="space-y-2">
          {tplItems.map((it, idx) => (
            <div key={it.id} className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input value={it.title} onChange={e=>setTplItems(x=>x.map(y=>y.id===it.id?{...y,title:e.target.value}:y))} placeholder={`Item ${idx+1} title`} className="px-2 py-1 border rounded md:col-span-2"/>
              <select value={it.subject} onChange={e=>setTplItems(x=>x.map(y=>y.id===it.id?{...y,subject:e.target.value}:y))} className="px-2 py-1 border rounded">
                {(activeStudent?.subjects || SUBJECTS_DEFAULT).map(s=>(<option key={s} value={s}>{s}</option>))}
              </select>
              <input type="number" step="0.25" min="0" value={it.duration} onChange={e=>setTplItems(x=>x.map(y=>y.id===it.id?{...y,duration:e.target.value}:y))} className="px-2 py-1 border rounded"/>
              <input value={it.standards} onChange={e=>setTplItems(x=>x.map(y=>y.id===it.id?{...y,standards:e.target.value}:y))} placeholder="Standards" className="px-2 py-1 border rounded md:col-span-2"/>
              <input value={it.objectives} onChange={e=>setTplItems(x=>x.map(y=>y.id===it.id?{...y,objectives:e.target.value}:y))} placeholder="Objectives" className="px-2 py-1 border rounded md:col-span-3"/>
            </div>
          ))}
        </div>
        <div className="pt-2">
          <button onClick={addTplItem} className="px-3 py-1.5 rounded border inline-flex items-center gap-1"><Plus className="w-4 h-4"/>Add Item</button>
        </div>
        <div className="mt-3 text-sm text-slate-600">After saving, go to <span className="font-medium">Calendar</span> and click <em>Apply Template to Week</em>.</div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Portfolio Artifacts</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={pfTitle} onChange={e=>setPfTitle(e.target.value)} placeholder="Title" className="px-2 py-1 border rounded"/>
          <input value={pfUrl} onChange={e=>setPfUrl(e.target.value)} placeholder="Link (Drive, photo, video)" className="px-2 py-1 border rounded"/>
          <input value={pfNotes} onChange={e=>setPfNotes(e.target.value)} placeholder="Notes" className="px-2 py-1 border rounded"/>
        </div>
        <div className="pt-2">
          <button onClick={()=>{ if(!pfTitle||!pfUrl) return; addPortfolio(activeStudent.id, { date: fmt(new Date()), title: pfTitle, url: pfUrl, notes: pfNotes }); setPfNotes(""); setPfTitle(""); setPfUrl(""); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white"><Upload className="w-4 h-4"/>Add to Portfolio</button>
        </div>
        <div className="mt-3 space-y-2">
          {(db.portfolio[activeStudent.id]||[]).map(p => (
            <div key={p.id} className="border rounded-lg p-2 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="flex items-center gap-2 text-slate-600"><LinkIcon className="w-3 h-3"/><a href={p.url} target="_blank" rel="noreferrer" className="underline break-all">{p.url}</a></div>
                {p.notes && (<div className="text-slate-500">{p.notes}</div>)}
              </div>
              <div className="text-xs text-slate-500">{p.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border lg:col-span-2">
        <h2 className="font-semibold mb-2">Grades / Assignments</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input value={assignTitle} onChange={e=>setAssignTitle(e.target.value)} placeholder="Assignment title" className="px-2 py-1 border rounded md:col-span-2"/>
          <select value={assignSubj} onChange={e=>setAssignSubj(e.target.value)} className="px-2 py-1 border rounded">
            {(activeStudent?.subjects || SUBJECTS_DEFAULT).map(s=>(<option key={s} value={s}>{s}</option>))}
          </select>
          <input type="number" value={assignScore} onChange={e=>setAssignScore(e.target.value)} placeholder="Score" className="px-2 py-1 border rounded"/>
          <input type="number" value={assignMax} onChange={e=>setAssignMax(e.target.value)} placeholder="Max" className="px-2 py-1 border rounded"/>
        </div>
        <div className="pt-2">
          <button onClick={()=>{ if(!assignTitle||!assignMax) return; addAssignment(activeStudent.id, assignSubj, { title: assignTitle, score: Number(assignScore)||0, max: Number(assignMax)||100, date: fmt(new Date()) }); setAssignTitle(""); setAssignScore(""); setAssignMax(""); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white"><Plus className="w-4 h-4"/>Add Assignment</button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(db.grades[activeStudent.id] || {}).map(([subj, obj]) => {
            const total = obj.assignments.reduce((a,x)=>a+x.max,0)||1;
            const earned = obj.assignments.reduce((a,x)=>a+x.score,0);
            const pct = Math.round((earned/total)*100);
            return (
              <div key={subj} className="border rounded-xl p-3">
                <div className="flex items-center justify_between mb-1"><div className="font-semibold">{subj}</div><div className="text-sm">{pct}%</div></div>
                <div className="space-y-1 text-sm">
                  {obj.assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded p-2">
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-slate-600 text-xs">{a.date}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">{a.score}/{a.max}</div>
                        <button className="text-slate-500 hover:text-red-600" title="Remove" onClick={()=>removeAssignment(activeStudent.id, subj, a.id)}><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentsPanel({ db, upsertStudent, removeStudent }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subjects, setSubjects] = useState(SUBJECTS_DEFAULT.join(", "));

  const [weeklyTargets, setWeeklyTargets] = useState(() => {
    const obj = {};
    SUBJECTS_DEFAULT.forEach(s => obj[s] = s==="PE"||s==="Art"?2:4);
    return obj;
  });

  const add = () => {
    if (!name || !grade) return;
    const subs = subjects.split(",").map(s=>s.trim()).filter(Boolean);
    const tgt = { ...weeklyTargets };
    Object.keys(tgt).forEach(k=>{ if(!subs.includes(k)) delete tgt[k]; });
    upsertStudent({ id: uid(), name, grade, subjects: subs, weeklyTargets: tgt });
    setName(""); setGrade(""); setSubjects(SUBJECTS_DEFAULT.join(", "));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Add / Edit Student</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="px-2 py-1 border rounded"/>
          <input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Grade" className="px-2 py-1 border rounded"/>
          <input value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Subjects (comma separated)" className="px-2 py-1 border rounded md:col-span-2"/>
        </div>
        <div className="mt-3">
          <div className="text-sm font-medium mb-1">Weekly Hour Targets</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {subjects.split(",").map(s=>s.trim()).filter(Boolean).map(s=> (
              <div key={s} className="flex items-center gap-2 text-sm">
                <label className="w-24">{s}</label>
                <input type="number" step="0.5" min="0" value={weeklyTargets[s] ?? 0} onChange={e=>setWeeklyTargets(prev=>({...prev,[s]:Number(e.target.value)||0}))} className="px-2 py-1 border rounded w-24"/>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-3">
          <button onClick={add} className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white"><Plus className="w-4 h-4"/>Save Student</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h2 className="font-semibold mb-2">Students</h2>
        <div className="space-y-2">
          {db.students.map(s => (
            <div key={s.id} className="flex items-center justify-between border rounded-xl p-3">
              <div>
                <div className="font-semibold">{s.name} <span className="text-slate-500 font-normal">(Grade {s.grade})</span></div>
                <div className="text-sm text-slate-600">Subjects: {s.subjects.join(", ")}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>upsertStudent(s)} className="px-2 py-1 border rounded">Edit</button>
                <button onClick={()=>removeStudent(s.id)} className="px-2 py-1 border rounded text-red-600">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsPanel({ db, activeStudent, attendanceHeat, weeklyHours }) {
  const [rangeStart, setRangeStart] = useState(() => fmt(startOfWeek(new Date())));
  const [rangeEnd, setRangeEnd] = useState(() => fmt(endOfWeek(new Date())));
  const attRef = useRef(null);
  const trRef = useRef(null);

  const attSummary = useMemo(() => {
    const sid = activeStudent.id;
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    const att = db.attendance[sid] || {};
    let present = 0, total = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
      if ([0,6].includes(d.getDay())) continue; // weekdays only
      total++;
      if (att[fmt(d)]) present++;
    }
    return { present, total, percent: total ? Math.round((present/total)*100) : 0 };
  }, [db.attendance, activeStudent.id, rangeStart, rangeEnd]);

  const transcript = useMemo(() => {
    const sid = activeStudent.id;
    const subj = db.grades[sid] || {};
    const lines = Object.entries(subj).map(([s, obj]) => {
      const total = obj.assignments.reduce((a,x)=>a+x.max,0)||0;
      const earned = obj.assignments.reduce((a,x)=>a+x.score,0)||0;
      const pct = total? Math.round((earned/total)*100): 0;
      const gpa = pctToGPA(pct);
      return { subject: s, percent: pct, gpa };
    });
    const gpa = lines.length? (lines.reduce((a,x)=>a+x.gpa,0)/lines.length).toFixed(2) : "N/A";
    return { lines, gpa };
  }, [db.grades, activeStudent.id]);

  const hoursBySubject = weeklyHours(activeStudent.id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Official Attendance Report</h2>
          <button onClick={()=>exportElementToPDF(attRef, `${activeStudent.name}-Attendance.pdf`)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded border"><FileDown className="w-4 h-4"/>Export PDF</button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)} className="px-2 py-1 border rounded"/>
          <input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} className="px-2 py-1 border rounded"/>
        </div>
        <div ref={attRef} className="border rounded-xl p-3">
          <div className="text-center text-sm text-slate-600">Homeschool HQ • Attendance Report</div>
          <div className="text-center font-semibold text-lg">{activeStudent.name} (Grade {activeStudent.grade})</div>
          <div className="text-center text-sm">Range: {rangeStart} to {rangeEnd}</div>
          <div className="mt-3 grid grid-cols-3 text-center">
            <div>
              <div className="text-2xl font-bold">{attSummary.present}</div>
              <div className="text-xs text-slate-600">Days Present</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{attSummary.total}</div>
              <div className="text-xs text-slate-600">Weekdays in Range</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{attSummary.percent}%</div>
              <div className="text-xs text-slate-600">Attendance Rate</div>
            </div>
          </div>
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50"><th className="text-left p-1">Date</th><th className="text-left p-1">Present</th></tr>
              </thead>
              <tbody>
                {generateDates(rangeStart, rangeEnd).filter(d=>![0,6].includes(new Date(d).getDay())).map(d=>{
                  const present = (db.attendance[activeStudent.id]||{})[d];
                  return (
                    <tr key={d} className="border-b last:border-0">
                      <td className="p-1">{d}</td>
                      <td className="p-1">{present? 'Yes':'No'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Transcript (Unofficial)</h2>
          <button onClick={()=>exportElementToPDF(trRef, `${activeStudent.name}-Transcript.pdf`)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded border"><FileDown className="w-4 h-4"/>Export PDF</button>
        </div>
        <div ref={trRef} className="border rounded-xl p-3">
          <div className="text-center text-sm text-slate-600">Homeschool HQ • Unofficial Transcript</div>
          <div className="text-center font-semibold text-lg">{activeStudent.name} (Grade {activeStudent.grade})</div>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-slate-50 border-b"><th className="text-left p-1">Subject</th><th className="text-right p-1">Percent</th><th className="text-right p-1">GPA (4.0)</th></tr>
            </thead>
            <tbody>
              {transcript.lines.map(line => (
                <tr key={line.subject} className="border-b last:border-0"><td className="p-1">{line.subject}</td><td className="p-1 text-right">{line.percent}%</td><td className="p-1 text-right">{line.gpa.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-right font-semibold">Cumulative GPA: {typeof transcript.gpa === 'string'? transcript.gpa : Number(transcript.gpa).toFixed(2)}</div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-3 border">
          <h3 className="font-semibold mb-2">Standards Coverage (All Lessons)</h3>
          <StandardsCoverage lessons={db.lessons} activeStudentId={activeStudent.id} />
        </div>

        <div className="mt-4 bg-white rounded-2xl p-3 border">
          <h3 className="font-semibold mb-2">Weekly Hours by Subject (Current Week)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(hoursBySubject).map(([sub,h]) => (
              <div key={sub} className="flex items-center justify-between border rounded p-2"><span>{sub}</span><span className="font-semibold">{h.toFixed(1)}h</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StandardsCoverage({ lessons, activeStudentId }) {
  const counts = {};
  Object.entries(lessons).forEach(([d, items]) => {
    items.forEach(l => {
      if (l.for && !l.for.includes(activeStudentId)) return;
      (l.standards||[]).forEach(s => {
        counts[s] = (counts[s]||0) + 1;
      });
    });
  });
  const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if (rows.length===0) return <div className="text-sm text-slate-600">No standards tagged yet. Add standards to lessons to see coverage.</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="bg-slate-50 border-b"><th className="text-left p-1">Standard</th><th className="text-right p-1">Count</th></tr></thead>
      <tbody>
        {rows.map(([s,c]) => (<tr key={s} className="border-b last:border-0"><td className="p-1">{s}</td><td className="p-1 text-right">{c}</td></tr>))}
      </tbody>
    </table>
  );
}

function SettingsPanel({ db, setDb, onReset, onExportFeedback }) {
  const [weekStartsOn, setWeekStartsOn] = useState(db.settings.weekStartsOn ?? 1);
  const [feedbackEmail, setFeedbackEmail] = useState(db.settings.feedbackEmail ?? "");

  return (
    <div className="max-w-xl bg-white rounded-2xl p-4 shadow-sm border space-y-4">
      <h2 className="font-semibold">Settings</h2>

      <div className="flex items-center gap-3">
        <label className="text-sm">Week starts on</label>
        <select value={weekStartsOn} onChange={e=>setWeekStartsOn(Number(e.target.value))} className="px-2 py-1 border rounded">
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
        <button onClick={()=>setDb(d=>({...d, settings:{...d.settings, weekStartsOn}}))} className="px-3 py-1.5 rounded border">Save</button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm">Feedback email (optional)</label>
        <input value={feedbackEmail} onChange={e=>setFeedbackEmail(e.target.value)} placeholder="you@example.com" className="px-2 py-1 border rounded flex-1"/>
        <button onClick={()=>setDb(d=>({...d, settings:{...d.settings, feedbackEmail}}))} className="px-3 py-1.5 rounded border">Save</button>
      </div>

      <div className="pt-2 border-t">
        <div className="flex flex-wrap gap-2">
          <button onClick={onReset} className="px-3 py-1.5 rounded bg-red-600 text-white">Reset demo data</button>
          <button onClick={onExportFeedback} className="px-3 py-1.5 rounded border">Export all feedback (JSON)</button>
        </div>
        <div className="text-xs text-slate-500 mt-2">Version: <span className="font-mono">{APP_VERSION}</span></div>
      </div>
    </div>
  );
}

function FeedbackModal({ defaultEmail, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!message.trim()) return alert("Please write a bit of feedback first.");
    onSubmit({ name, email, rating, message });
  };

  const mailtoHref = email
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Homeschool HQ Feedback — " + APP_VERSION)}&body=${encodeURIComponent(`Name: ${name || "(anon)"}\nRating: ${rating}/5\n\n${message}\n\n— Sent from ${APP_VERSION}`)}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Send Feedback</div>
          <button onClick={onClose} className="px-2 py-1 rounded border">Close</button>
        </div>
        <div className="p-4 space-y-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name (optional)" className="w-full px-2 py-1 border rounded"/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email or recipient (e.g., you@example.com)" className="w-full px-2 py-1 border rounded"/>
          <div className="flex items-center gap-2">
            <label className="text-sm">Rating</label>
            <select value={rating} onChange={e=>setRating(Number(e.target.value))} className="px-2 py-1 border rounded">
              {[5,4,3,2,1].map(n=>(<option key={n} value={n}>{n}</option>))}
            </select>
            <span className="text-sm text-slate-500">/ 5</span>
          </div>
          <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="What's working? What's confusing? What would you change?" className="w-full px-2 py-1 border rounded" rows={5}/>
          <div className="flex flex-wrap gap-2">
            <button onClick={submit} className="px-3 py-1.5 rounded bg-emerald-600 text-white">Save Feedback</button>
            {mailtoHref && <a href={mailtoHref} className="px-3 py-1.5 rounded border inline-flex items-center">Send via Email</a>}
          </div>
          <div className="text-xs text-slate-500">Saved feedback is stored locally and can be exported from Settings.</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Utils ----------
function generateDates(start, end) {
  const s = new Date(start); const e = new Date(end);
  const out = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) out.push(fmt(d));
  return out;
}

function pctToGPA(p) {
  if (p >= 93) return 4.0; // A
  if (p >= 90) return 3.7; // A-
  if (p >= 87) return 3.3; // B+
  if (p >= 83) return 3.0; // B
  if (p >= 80) return 2.7; // B-
  if (p >= 77) return 2.3; // C+
  if (p >= 73) return 2.0; // C
  if (p >= 70) return 1.7; // C-
  if (p >= 67) return 1.3; // D+
  if (p >= 65) return 1.0; // D
  return 0.0; // F
}
