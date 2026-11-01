/**
 * agent.js — AI Agent Engine with Tool Calling
 *
 * Arsitektur: ReAct-style Agent Loop
 *   1. Terima pesan user
 *   2. LLM (Groq) memutuskan apakah perlu memanggil tool
 *   3. Eksekusi tool → hasilkan observasi
 *   4. Ulangi sampai LLM puas → kembalikan final answer
 *
 * Tools yang tersedia:
 *   - get_all_tasks        : Ambil semua tugas
 *   - get_task_by_status   : Filter tugas by status
 *   - get_task_by_priority : Filter tugas by prioritas
 *   - get_overdue_tasks    : Tugas yang sudah lewat deadline
 *   - get_today_schedule   : Jadwal hari ini
 *   - get_week_schedule    : Semua jadwal mingguan
 *   - update_task_status   : Update status sebuah tugas
 *   - get_stats            : Statistik ringkas dashboard
 *   - suggest_prioritization: AI saran urutan pengerjaan tugas
 */

'use strict';

let Groq;
try {
  Groq = require('groq-sdk');
} catch (_) {
  // groq-sdk belum diinstall — jalankan: npm install
}

// ──────────────────────────────────────────────
// TOOL DEFINITIONS (dikirim ke LLM sebagai schema)
// ──────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_all_tasks',
      description: 'Ambil semua tugas yang ada di dashboard. Gunakan untuk pertanyaan umum tentang tugas.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_task_by_status',
      description: 'Ambil tugas berdasarkan status tertentu.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'done'],
            description: 'Status tugas: todo (belum mulai), in-progress (sedang dikerjakan), done (selesai)'
          }
        },
        required: ['status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_task_by_priority',
      description: 'Ambil tugas berdasarkan tingkat prioritas.',
      parameters: {
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Prioritas: high (tinggi), medium (sedang), low (rendah)'
          }
        },
        required: ['priority']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_overdue_tasks',
      description: 'Ambil semua tugas yang sudah melewati deadline dan belum selesai. Penting untuk manajemen waktu.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_today_schedule',
      description: 'Ambil jadwal hari ini. Gunakan saat user bertanya tentang kegiatan/agenda hari ini.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_week_schedule',
      description: 'Ambil seluruh jadwal mingguan. Gunakan saat user ingin overview jadwal seminggu.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'Update status sebuah tugas. Gunakan saat user minta tandai tugas selesai, mulai dikerjakan, atau reset.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'number',
            description: 'ID numerik tugas yang akan diubah statusnya'
          },
          new_status: {
            type: 'string',
            enum: ['todo', 'in-progress', 'done'],
            description: 'Status baru untuk tugas tersebut'
          }
        },
        required: ['task_id', 'new_status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Ambil statistik ringkas dashboard: total tugas, selesai, sedang dikerjakan, terlambat, dll.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_prioritization',
      description: 'Dapatkan daftar tugas yang perlu diprioritaskan, diurutkan berdasarkan deadline dan urgensi.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
];

// ──────────────────────────────────────────────
// TOOL EXECUTOR
// ──────────────────────────────────────────────

function executeTool(toolName, toolArgs, dataStore) {
  const { tasks, schedules } = dataStore;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  switch (toolName) {
    case 'get_all_tasks':
      return {
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id, title: t.title, category: t.category,
          priority: t.priority, status: t.status, deadline: t.deadline
        }))
      };

    case 'get_task_by_status': {
      const filtered = tasks.filter(t => t.status === toolArgs.status);
      return { status: toolArgs.status, count: filtered.length, tasks: filtered };
    }

    case 'get_task_by_priority': {
      const filtered = tasks.filter(t => t.priority === toolArgs.priority);
      return { priority: toolArgs.priority, count: filtered.length, tasks: filtered };
    }

    case 'get_overdue_tasks': {
      const overdue = tasks.filter(t => t.deadline < todayStr && t.status !== 'done');
      return {
        count: overdue.length,
        tasks: overdue.map(t => {
          const daysLate = Math.ceil((today - new Date(t.deadline)) / (1000 * 60 * 60 * 24));
          return { ...t, daysLate };
        })
      };
    }

    case 'get_today_schedule': {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayName = dayNames[new Date().getDay()];
      const todayScheds = schedules
        .filter(s => s.day === todayName)
        .sort((a, b) => a.time.localeCompare(b.time));
      return { day: todayName, count: todayScheds.length, schedules: todayScheds };
    }

    case 'get_week_schedule': {
      const byDay = {};
      schedules.forEach(s => {
        if (!byDay[s.day]) byDay[s.day] = [];
        byDay[s.day].push(s);
      });
      return { totalSchedules: schedules.length, byDay };
    }

    case 'update_task_status': {
      const task = tasks.find(t => t.id === toolArgs.task_id);
      if (!task) return { success: false, error: `Tugas dengan ID ${toolArgs.task_id} tidak ditemukan.` };
      const oldStatus = task.status;
      task.status = toolArgs.new_status;
      return {
        success: true,
        message: `Status tugas "${task.title}" berhasil diubah dari "${oldStatus}" menjadi "${toolArgs.new_status}".`,
        task: { id: task.id, title: task.title, status: task.status }
      };
    }

    case 'get_stats': {
      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'done').length;
      const inProgress = tasks.filter(t => t.status === 'in-progress').length;
      const todo = tasks.filter(t => t.status === 'todo').length;
      const highPriority = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
      const overdue = tasks.filter(t => t.deadline < todayStr && t.status !== 'done').length;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      return { total, done, inProgress, todo, highPriority, overdue, completionRate };
    }

    case 'suggest_prioritization': {
      const pending = tasks
        .filter(t => t.status !== 'done')
        .map(t => {
          const dl = new Date(t.deadline);
          const daysLeft = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
          const urgencyScore =
            (t.priority === 'high' ? 30 : t.priority === 'medium' ? 15 : 5) +
            (daysLeft < 0 ? 50 : daysLeft <= 1 ? 35 : daysLeft <= 3 ? 20 : daysLeft <= 7 ? 10 : 0);
          return { ...t, daysLeft, urgencyScore };
        })
        .sort((a, b) => b.urgencyScore - a.urgencyScore);
      return {
        count: pending.length,
        suggestion: 'Urutan berdasarkan skor urgensi (prioritas + deadline)',
        tasks: pending.map(t => ({
          id: t.id, title: t.title, priority: t.priority,
          status: t.status, deadline: t.deadline,
          daysLeft: t.daysLeft, urgencyScore: t.urgencyScore
        }))
      };
    }

    default:
      return { error: `Tool "${toolName}" tidak dikenali.` };
  }
}

// ──────────────────────────────────────────────
// AGENT LOOP (ReAct Pattern)
// ──────────────────────────────────────────────

async function runAgent(userMessage, conversationHistory, dataStore, apiKey) {
  if (!Groq) {
    throw new Error('groq-sdk belum diinstall. Jalankan: npm install');
  }
  const groq = new Groq({ apiKey });

  const systemPrompt = `Kamu adalah asisten AI pribadi yang membantu mengelola tugas dan jadwal. Kamu bernama "Aria" (Asisten Rika & Andi).

Kamu memiliki akses ke tools untuk:
- Melihat dan mencari tugas berdasarkan status, prioritas, atau deadline
- Melihat jadwal hari ini dan mingguan  
- Mengubah status tugas
- Memberikan saran prioritisasi tugas
- Melihat statistik produktivitas

Panduan perilaku:
- Selalu gunakan tools untuk mendapatkan data terbaru sebelum menjawab pertanyaan tentang tugas/jadwal
- Berikan jawaban dalam Bahasa Indonesia yang natural dan helpful
- Saat memberikan saran, pertimbangkan deadline dan prioritas
- Format list menggunakan bullet points atau angka
- Jika user minta update status, konfirmasi perubahan yang berhasil dilakukan
- Bersikap proaktif: setelah jawab pertanyaan, tawarkan bantuan lanjutan yang relevan`;

  // Bangun message history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const toolCallLog = []; // catat semua tool calls untuk transparency
  const MAX_ITERATIONS = 6; // safety limit loop

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 1500
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    // Tambahkan respons asisten ke history
    messages.push(assistantMsg);

    // Jika tidak ada tool call → jawaban final
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return {
        reply: assistantMsg.content,
        toolCallLog,
        updatedHistory: [
          ...conversationHistory,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantMsg.content }
        ]
      };
    }

    // Proses setiap tool call
    for (const toolCall of assistantMsg.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (_) {}

      const toolResult = executeTool(toolName, toolArgs, dataStore);

      toolCallLog.push({
        tool: toolName,
        args: toolArgs,
        result: toolResult
      });

      // Kirim hasil tool kembali ke LLM
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult)
      });
    }
  }

  // Fallback jika loop habis
  return {
    reply: 'Maaf, saya tidak bisa menyelesaikan permintaan ini saat ini. Coba ajukan pertanyaan yang lebih spesifik.',
    toolCallLog,
    updatedHistory: conversationHistory
  };
}

module.exports = { runAgent, TOOL_DEFINITIONS };
