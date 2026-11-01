// Load .env secara manual (tidak butuh package dotenv)
const fs = require('fs');
const envPath = require('path').join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
}
const express = require('express');
const path = require('path');
const { runAgent } = require('./agent');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory session store for conversation history (keyed by sessionId)
const conversationSessions = {};

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
// DUMMY DATA
// ──────────────────────────────────────────────

const tasks = [
  {
    id: 1,
    title: 'Buat laporan analisis data mingguan',
    description: 'Analisis penjualan Q4 menggunakan Python dan buat visualisasi grafik',
    category: 'Pekerjaan',
    priority: 'high',
    status: 'in-progress',
    deadline: '2026-11-03',
    createdAt: '2026-10-28'
  },
  {
    id: 2,
    title: 'Review Pull Request tim frontend',
    description: 'Review PR #42 dan PR #45 dari tim, berikan komentar dan approve',
    category: 'Pekerjaan',
    priority: 'high',
    status: 'todo',
    deadline: '2026-11-02',
    createdAt: '2026-10-29'
  },
  {
    id: 3,
    title: 'Belajar React Query',
    description: 'Pelajari dokumentasi React Query v5 dan buat project latihan sederhana',
    category: 'Belajar',
    priority: 'medium',
    status: 'in-progress',
    deadline: '2026-11-07',
    createdAt: '2026-10-25'
  },
  {
    id: 4,
    title: 'Olahraga pagi (lari 5km)',
    description: 'Lari pagi di taman sekitar perumahan, target 5km dalam 30 menit',
    category: 'Pribadi',
    priority: 'medium',
    status: 'done',
    deadline: '2026-11-01',
    createdAt: '2026-10-31'
  },
  {
    id: 5,
    title: 'Meeting dengan klien PT Maju Jaya',
    description: 'Presentasi proposal redesign website klien, siapkan mockup dan estimasi biaya',
    category: 'Pekerjaan',
    priority: 'high',
    status: 'done',
    deadline: '2026-10-31',
    createdAt: '2026-10-27'
  },
  {
    id: 6,
    title: 'Perbarui CV dan portofolio',
    description: 'Tambahkan project terbaru ke portofolio dan update skill di CV',
    category: 'Pribadi',
    priority: 'low',
    status: 'todo',
    deadline: '2026-11-10',
    createdAt: '2026-10-30'
  },
  {
    id: 7,
    title: 'Setup database PostgreSQL untuk project baru',
    description: 'Buat schema database, migrasi awal, dan konfigurasi koneksi ORM',
    category: 'Pekerjaan',
    priority: 'high',
    status: 'todo',
    deadline: '2026-11-04',
    createdAt: '2026-11-01'
  },
  {
    id: 8,
    title: 'Baca buku "Clean Code"',
    description: 'Lanjutkan baca chapter 4-6 dan buat catatan ringkasan',
    category: 'Belajar',
    priority: 'low',
    status: 'in-progress',
    deadline: '2026-11-15',
    createdAt: '2026-10-20'
  },
  {
    id: 9,
    title: 'Bayar tagihan listrik dan internet',
    description: 'Bayar tagihan bulan November sebelum tanggal 5',
    category: 'Pribadi',
    priority: 'high',
    status: 'todo',
    deadline: '2026-11-05',
    createdAt: '2026-11-01'
  },
  {
    id: 10,
    title: 'Deploy aplikasi ke server staging',
    description: 'Build Docker image, push ke registry, dan deploy ke Kubernetes cluster staging',
    category: 'Pekerjaan',
    priority: 'medium',
    status: 'done',
    deadline: '2026-10-30',
    createdAt: '2026-10-28'
  }
];

const schedules = [
  {
    id: 1,
    title: 'Standup Meeting Tim',
    time: '09:00',
    endTime: '09:30',
    day: 'Senin',
    type: 'meeting',
    location: 'Google Meet',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 2,
    title: 'Deep Work — Coding & Development',
    time: '09:30',
    endTime: '12:00',
    day: 'Senin',
    type: 'work',
    location: 'WFH',
    color: '#8b5cf6',
    isRecurring: true
  },
  {
    id: 3,
    title: 'Sesi Belajar — Online Course',
    time: '19:00',
    endTime: '20:30',
    day: 'Senin',
    type: 'study',
    location: 'Rumah',
    color: '#10b981',
    isRecurring: true
  },
  {
    id: 4,
    title: 'Standup Meeting Tim',
    time: '09:00',
    endTime: '09:30',
    day: 'Selasa',
    type: 'meeting',
    location: 'Google Meet',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 5,
    title: 'Review Code & Testing',
    time: '10:00',
    endTime: '12:00',
    day: 'Selasa',
    type: 'work',
    location: 'WFH',
    color: '#8b5cf6',
    isRecurring: false
  },
  {
    id: 6,
    title: 'Meeting Klien — Presentasi Proposal',
    time: '14:00',
    endTime: '15:30',
    day: 'Selasa',
    type: 'meeting',
    location: 'Zoom',
    color: '#3b82f6',
    isRecurring: false
  },
  {
    id: 7,
    title: 'Gym / Olahraga',
    time: '17:00',
    endTime: '18:30',
    day: 'Selasa',
    type: 'personal',
    location: 'Gym Dekat Rumah',
    color: '#f59e0b',
    isRecurring: true
  },
  {
    id: 8,
    title: 'Standup Meeting Tim',
    time: '09:00',
    endTime: '09:30',
    day: 'Rabu',
    type: 'meeting',
    location: 'Google Meet',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 9,
    title: 'Deep Work — Analisis Data',
    time: '10:00',
    endTime: '13:00',
    day: 'Rabu',
    type: 'work',
    location: 'WFH',
    color: '#8b5cf6',
    isRecurring: false
  },
  {
    id: 10,
    title: 'Belajar React Query',
    time: '20:00',
    endTime: '21:30',
    day: 'Rabu',
    type: 'study',
    location: 'Rumah',
    color: '#10b981',
    isRecurring: false
  },
  {
    id: 11,
    title: 'Standup Meeting Tim',
    time: '09:00',
    endTime: '09:30',
    day: 'Kamis',
    type: 'meeting',
    location: 'Google Meet',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 12,
    title: 'Sprint Planning',
    time: '10:00',
    endTime: '11:30',
    day: 'Kamis',
    type: 'meeting',
    location: 'Zoom',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 13,
    title: 'Gym / Olahraga',
    time: '17:00',
    endTime: '18:30',
    day: 'Kamis',
    type: 'personal',
    location: 'Gym Dekat Rumah',
    color: '#f59e0b',
    isRecurring: true
  },
  {
    id: 14,
    title: 'Sesi Belajar — Baca Buku',
    time: '20:00',
    endTime: '21:00',
    day: 'Kamis',
    type: 'study',
    location: 'Rumah',
    color: '#10b981',
    isRecurring: true
  },
  {
    id: 15,
    title: 'Standup Meeting Tim',
    time: '09:00',
    endTime: '09:30',
    day: 'Jumat',
    type: 'meeting',
    location: 'Google Meet',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 16,
    title: 'Sprint Review & Retrospective',
    time: '13:00',
    endTime: '15:00',
    day: 'Jumat',
    type: 'meeting',
    location: 'Zoom',
    color: '#3b82f6',
    isRecurring: true
  },
  {
    id: 17,
    title: 'Lari Pagi',
    time: '06:30',
    endTime: '07:30',
    day: 'Sabtu',
    type: 'personal',
    location: 'Taman Kota',
    color: '#f59e0b',
    isRecurring: true
  },
  {
    id: 18,
    title: 'Side Project — Personal Website',
    time: '10:00',
    endTime: '13:00',
    day: 'Sabtu',
    type: 'work',
    location: 'Rumah',
    color: '#8b5cf6',
    isRecurring: false
  },
  {
    id: 19,
    title: 'Waktu Keluarga',
    time: '14:00',
    endTime: '17:00',
    day: 'Sabtu',
    type: 'personal',
    location: 'Rumah',
    color: '#f59e0b',
    isRecurring: true
  },
  {
    id: 20,
    title: 'Lari Pagi',
    time: '06:30',
    endTime: '07:30',
    day: 'Minggu',
    type: 'personal',
    location: 'Taman Kota',
    color: '#f59e0b',
    isRecurring: true
  },
  {
    id: 21,
    title: 'Perencanaan Minggu Depan',
    time: '20:00',
    endTime: '21:00',
    day: 'Minggu',
    type: 'work',
    location: 'Rumah',
    color: '#8b5cf6',
    isRecurring: true
  }
];

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────

function getStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const highPriority = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.deadline < today && t.status !== 'done').length;

  return { total, done, inProgress, todo, highPriority, completionRate, overdue };
}

function getTodaySchedule(schedules) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = days[new Date().getDay()];
  return schedules
    .filter(s => s.day === todayName)
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────

// Dashboard Home
app.get('/', (req, res) => {
  const stats = getStats(tasks);
  const todaySchedule = getTodaySchedule(schedules);
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .filter(t => t.status !== 'done')
    .slice(0, 5);

  res.render('dashboard', {
    title: 'Dashboard Pribadi',
    stats,
    tasks,
    todaySchedule,
    recentTasks,
    currentPage: 'dashboard'
  });
});

// Tasks Page
app.get('/tasks', (req, res) => {
  const { status, priority, category, search } = req.query;
  let filtered = [...tasks];

  if (status && status !== 'all') filtered = filtered.filter(t => t.status === status);
  if (priority && priority !== 'all') filtered = filtered.filter(t => t.priority === priority);
  if (category && category !== 'all') filtered = filtered.filter(t => t.category === category);
  if (search) filtered = filtered.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(tasks.map(t => t.category))];
  const stats = getStats(tasks);

  res.render('tasks', {
    title: 'Daftar Tugas',
    tasks: filtered,
    stats,
    categories,
    filters: { status: status || 'all', priority: priority || 'all', category: category || 'all', search: search || '' },
    currentPage: 'tasks'
  });
});

// Schedule Page
app.get('/schedule', (req, res) => {
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const scheduleByDay = {};
  days.forEach(day => {
    scheduleByDay[day] = schedules
      .filter(s => s.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));
  });

  res.render('schedule', {
    title: 'Jadwal Mingguan',
    scheduleByDay,
    days,
    schedules,
    currentPage: 'schedule'
  });
});

// API: Update task status (AJAX)
app.patch('/api/tasks/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  task.status = status;
  res.json({ success: true, task });
});

// API: Get stats (AJAX)
app.get('/api/stats', (req, res) => {
  res.json(getStats(tasks));
});

// ──────────────────────────────────────────────
// AI AGENT ROUTES
// ──────────────────────────────────────────────

// Agent Page
app.get('/agent', (req, res) => {
  res.render('agent', {
    title: 'AI Agent — Aria',
    currentPage: 'agent',
    hasApiKey: !!process.env.GROQ_API_KEY
  });
});

// Agent Chat API (POST /api/agent)
app.post('/api/agent', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return res.status(503).json({
      error: 'GROQ_API_KEY belum dikonfigurasi. Buat file .env dan isi GROQ_API_KEY.',
      setupRequired: true
    });
  }

  // Ambil atau buat session history
  const sid = sessionId || 'default';
  if (!conversationSessions[sid]) conversationSessions[sid] = [];

  try {
    const result = await runAgent(
      message.trim(),
      conversationSessions[sid],
      { tasks, schedules },
      apiKey
    );

    // Simpan history terbaru
    conversationSessions[sid] = result.updatedHistory.slice(-20); // batasi 20 pesan terakhir

    res.json({
      reply: result.reply,
      toolCallLog: result.toolCallLog,
      sessionId: sid
    });
  } catch (err) {
    console.error('[Agent Error]', err.message);
    const isRateLimit = err.status === 429;
    res.status(500).json({
      error: isRateLimit
        ? 'Rate limit Groq API tercapai. Tunggu sebentar lalu coba lagi.'
        : 'Terjadi kesalahan pada AI Agent: ' + err.message
    });
  }
});

// Agent: Clear session
app.delete('/api/agent/session/:id', (req, res) => {
  delete conversationSessions[req.params.id];
  res.json({ success: true });
});

// ──────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅  Dashboard berjalan di http://localhost:${PORT}`);
  console.log(`   Tekan CTRL+C untuk menghentikan server\n`);
});
