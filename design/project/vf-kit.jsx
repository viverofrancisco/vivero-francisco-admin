// vf-kit.jsx — Vivero Francisco design system: tokens, icons, atoms.
// Exports to window: VF, Icon, Logo, Stripe, Avatar, StatusDot, statusMeta

// ── Tokens ───────────────────────────────────────────────
const VF = {
  green:     'oklch(0.52 0.11 152)',
  greenDeep: 'oklch(0.33 0.055 155)',
  green700:  'oklch(0.44 0.10 153)',
  green600:  'oklch(0.50 0.11 152)',
  green100:  'oklch(0.93 0.035 150)',
  green50:   'oklch(0.965 0.018 150)',
  ink:       'oklch(0.25 0.012 152)',
  ink2:      'oklch(0.46 0.012 152)',
  ink3:      'oklch(0.60 0.010 152)',
  line:      'oklch(0.905 0.008 150)',
  line2:     'oklch(0.95 0.006 150)',
  bg:        'oklch(0.984 0.006 135)',
  canvas:    'oklch(0.965 0.008 140)',
  surface:   '#ffffff',
  amber:     'oklch(0.70 0.135 65)',
  amber50:   'oklch(0.955 0.035 75)',
  red:       'oklch(0.56 0.18 25)',
  red50:     'oklch(0.955 0.025 25)',
  clay:      'oklch(0.63 0.12 48)',
  sky:       'oklch(0.58 0.075 232)',
  sky50:     'oklch(0.955 0.02 232)',
  font: "'Hanken Grotesk', system-ui, sans-serif",
};

// ── Icon set (Lucide-style, 24×24, stroke currentColor) ──
const PATHS = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  clock: 'M12 6v6l4 2|circle:12,12,9',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|circle:12,10,3',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z|circle:12,13,4',
  chevR: 'M9 18l6-6-6-6',
  chevL: 'M15 18l-6-6 6-6',
  chevD: 'M6 9l6 6 6-6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|circle:12,7,4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75|circle:9,7,4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  message: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  more: '|circle:5,12,1|circle:12,12,1|circle:19,12,1',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6',
  plus: 'M12 5v14M5 12h14',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  nav: 'M3 11l19-9-9 19-2-8-8-2z',
  x: 'M18 6 6 18M6 6l12 12',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  pen: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586|circle:11,11,2',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  search: 'M21 21l-4.35-4.35|circle:11,11,8',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  scissors: 'M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12|circle:6,6,3|circle:6,18,3',
  droplet: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',
  sprout: 'M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6c-.9.8-1.6 2-1.9 2.7 0 0-.3.3 0 1 .4.7 1 .9 1.6.4 1.5-1.3 3.5-1.3 4.2-1.2-.6-2.1-2.4-3-3.9-2.9z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z|circle:12,12,3',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  clipboard: 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4',
  arrowR: 'M5 12h14M12 5l7 7-7 7',
  arrowL: 'M19 12H5M12 19l-7-7 7-7',
  trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
};

function Icon({ name, size = 22, stroke = 2, color = 'currentColor', style }) {
  const raw = PATHS[name] || '';
  const parts = raw.split('|');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('circle:')) {
          const [cx, cy, r] = p.slice(7).split(',');
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        return <path key={i} d={p} />;
      })}
    </svg>
  );
}

// ── Logo: minimal sprout mark + wordmark ──
function LogoMark({ size = 40, bg = VF.green, leaf = '#fff' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M12 22V11" stroke={leaf} strokeWidth="2.1" strokeLinecap="round" />
        <path d="M12 13C12 9 9.5 6.2 5 6c-.3 4 1.4 7.2 7 7.4z" fill={leaf} />
        <path d="M12.6 11.2C12.6 7.6 14.9 4.8 19 4.6c.3 3.7-1.3 7-6.4 7.1z" fill={leaf} fillOpacity="0.78" />
      </svg>
    </div>
  );
}

function Logo({ size = 40, color = VF.greenDeep, sub = true, mark = true, bg = VF.green }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      {mark && <LogoMark size={size} bg={bg} />}
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: VF.font, fontWeight: 800, fontSize: size * 0.42,
          color, letterSpacing: '-0.02em',
        }}>Vivero Francisco</div>
        {sub && <div style={{
          fontFamily: VF.font, fontWeight: 600, fontSize: size * 0.23,
          color: VF.ink3, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3,
        }}>Paisajismo & Mantenimiento</div>}
      </div>
    </div>
  );
}

// ── Striped image placeholder ──
function Stripe({ w = '100%', h = 120, label = 'foto', radius = 14, tone = VF.green }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, overflow: 'hidden', position: 'relative',
      background: `repeating-linear-gradient(135deg, ${VF.green50}, ${VF.green50} 9px, ${VF.surface} 9px, ${VF.surface} 18px)`,
      border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: VF.ink3,
        background: VF.surface, padding: '3px 8px', borderRadius: 6, border: `1px solid ${VF.line}`,
        letterSpacing: '0.02em',
      }}>{label}</span>
    </div>
  );
}

// ── Avatar (initials) ──
function Avatar({ name = '', size = 40, bg = VF.green100, color = VF.green700 }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontFamily: VF.font, fontWeight: 700, fontSize: size * 0.38, letterSpacing: '-0.01em',
    }}>{initials}</div>
  );
}

// ── Status semantics ──
function statusMeta(estado) {
  switch (estado) {
    case 'PROGRAMADA': return { label: 'Programada', color: VF.green, bg: VF.green50, dot: VF.green };
    case 'EN_CURSO':   return { label: 'En curso', color: VF.sky, bg: VF.sky50, dot: VF.sky };
    case 'COMPLETADA': return { label: 'Completada', color: VF.ink2, bg: VF.line2, dot: VF.ink3 };
    case 'INCOMPLETA': return { label: 'Incompleta', color: 'oklch(0.50 0.13 60)', bg: VF.amber50, dot: VF.amber };
    case 'CANCELADA':  return { label: 'Cancelada', color: VF.red, bg: VF.red50, dot: VF.red };
    default:           return { label: estado, color: VF.ink2, bg: VF.line2, dot: VF.ink3 };
  }
}

function StatusPill({ estado, size = 'md' }) {
  const m = statusMeta(estado);
  const pad = size === 'sm' ? '3px 9px 3px 7px' : '5px 11px 5px 9px';
  const fs = size === 'sm' ? 11.5 : 12.5;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad,
      borderRadius: 999, background: m.bg, color: m.color,
      fontFamily: VF.font, fontWeight: 700, fontSize: fs, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </span>
  );
}

Object.assign(window, { VF, Icon, Logo, LogoMark, Stripe, Avatar, statusMeta, StatusPill });
