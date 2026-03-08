/** Base CSS injected into every canvas render so the AI only needs to write semantic HTML */
export const CANVAS_BASE_CSS = `
/* Reset & Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #09090b;
  color: #e4e4e7;
  padding: 1.5rem;
  line-height: 1.6;
  min-height: 100vh;
}

/* Typography */
h1 { font-size: 1.75rem; font-weight: 700; color: #fafafa; margin-bottom: 0.75rem; }
h2 { font-size: 1.25rem; font-weight: 600; color: #e4e4e7; margin-bottom: 0.5rem; margin-top: 1.25rem; }
h3 { font-size: 1rem; font-weight: 600; color: #a1a1aa; margin-bottom: 0.5rem; margin-top: 1rem; }
p { color: #a1a1aa; margin-bottom: 0.5rem; }
small { color: #71717a; font-size: 0.75rem; }
a { color: #60a5fa; text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: rgba(255,255,255,0.06); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; }

/* Cards */
.card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.card-header { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 0.75rem; }

/* Grid */
.grid { display: grid; gap: 1rem; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 640px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }

/* Flex */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-1 { gap: 0.25rem; }
.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.gap-4 { gap: 1rem; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }

/* Tables */
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
thead th {
  text-align: left; padding: 0.625rem 0.75rem; font-size: 0.75rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; color: #71717a;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
tbody td {
  padding: 0.625rem 0.75rem; color: #d4d4d8;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
tbody tr:hover { background: rgba(255,255,255,0.02); }

/* Badges / Pills */
.badge {
  display: inline-flex; align-items: center; padding: 0.125rem 0.5rem;
  font-size: 0.75rem; font-weight: 500; border-radius: 9999px;
  background: rgba(255,255,255,0.06); color: #a1a1aa;
}
.badge-blue { background: rgba(96,165,250,0.15); color: #60a5fa; }
.badge-green { background: rgba(74,222,128,0.15); color: #4ade80; }
.badge-yellow { background: rgba(250,204,21,0.15); color: #facc15; }
.badge-red { background: rgba(248,113,113,0.15); color: #f87171; }
.badge-purple { background: rgba(167,139,250,0.15); color: #a78bfa; }

/* Stat blocks */
.stat { text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: #fafafa; line-height: 1; }
.stat-label { font-size: 0.75rem; color: #71717a; margin-top: 0.25rem; }

/* Progress bar */
.progress { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.progress-bar { height: 100%; border-radius: 3px; background: #60a5fa; transition: width 0.3s; }

/* Lists */
ul, ol { padding-left: 1.25rem; color: #a1a1aa; }
li { margin-bottom: 0.25rem; }
li::marker { color: #52525b; }

/* Chart container */
.chart-container { position: relative; width: 100%; max-height: 400px; }
canvas { max-width: 100%; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.animate-in { animation: fadeIn 0.3s ease-out; }
`
