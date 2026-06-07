// mobile-screens.jsx — interactive field-crew app (role: personal)
// Exports: MobileApp

const { useState } = React;

// ── shared bits ──
const card = {
  background: VF.surface, borderRadius: 16, border: `1px solid ${VF.line}`,
  boxShadow: '0 1px 2px rgba(20,40,30,0.04)',
};
const tap = (fn) => ({ onClick: fn, role: 'button', tabIndex: 0 });

function Screen({ children, pad = true }) {
  return (
    <div style={{
      minHeight: '100%', background: VF.bg, fontFamily: VF.font,
      color: VF.ink, paddingBottom: 116, ...(pad ? {} : {}),
    }}>{children}</div>
  );
}

// Top app bar (custom, branded — replaces iOS nav)
function AppBar({ title, sub, onBack, right, big }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      borderBottom: `1px solid ${VF.line}`, paddingTop: 58,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px 14px' }}>
        {onBack && (
          <div {...tap(onBack)} style={{
            width: 40, height: 40, borderRadius: 12, background: VF.surface, border: `1px solid ${VF.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}><Icon name="chevL" size={22} color={VF.ink} /></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: big ? 26 : 19, fontWeight: 800, letterSpacing: '-0.02em', color: VF.ink, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {sub && <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 3 }}>{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

// Bottom tab bar
function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'visitas', label: 'Visitas', icon: 'calendar' },
    { id: 'clientes', label: 'Clientes', icon: 'users' },
    { id: 'informes', label: 'Informes', icon: 'file' },
    { id: 'mensajes', label: 'Mensajes', icon: 'message', badge: 2 },
    { id: 'mas', label: 'Más', icon: 'grid' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(18px) saturate(180%)',
      WebkitBackdropFilter: 'blur(18px) saturate(180%)', borderTop: `1px solid ${VF.line}`,
      paddingBottom: 26, paddingTop: 9, display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <div key={t.id} {...tap(() => onChange(t.id))} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer', width: 64, position: 'relative',
          }}>
            <div style={{ position: 'relative' }}>
              <Icon name={t.icon} size={24} stroke={on ? 2.3 : 2} color={on ? VF.green : VF.ink3} />
              {t.badge && (
                <span style={{
                  position: 'absolute', top: -4, right: -7, minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 999, background: VF.red, color: '#fff', fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
                }}>{t.badge}</span>
              )}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? VF.green : VF.ink3, letterSpacing: '-0.01em' }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Visit card ──
function VisitaCard({ v, onPress }) {
  const m = statusMeta(v.estado);
  const done = v.estado === 'COMPLETADA';
  return (
    <div {...tap(onPress)} style={{
      ...card, display: 'flex', alignItems: 'stretch', overflow: 'hidden', cursor: 'pointer',
      opacity: done ? 0.7 : 1,
    }}>
      <div style={{ width: 5, background: m.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '14px 14px 14px 15px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v.hora}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, whiteSpace: 'nowrap' }}>{v.dur}</span>
          </div>
          <StatusPill estado={v.estado} size="sm" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: VF.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {v.cliente.nombre} {v.cliente.apellido}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: VF.green700, marginTop: 2 }}>{v.servicio}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, color: VF.ink3 }}>
          <Icon name="pin" size={14} color={VF.ink3} />
          <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.cliente.sector} · {v.cliente.dir}</span>
        </div>
      </div>
    </div>
  );
}

// ── Visitas list (Hoy) ──
function VisitasScreen({ go }) {
  const hoy = VISITAS.filter(v => v.when === 'hoy');
  const manana = VISITAS.filter(v => v.when === 'manana');
  const done = hoy.filter(v => v.estado === 'COMPLETADA').length;
  const pct = Math.round((done / hoy.length) * 100);

  return (
    <Screen>
      <AppBar big title="Hoy" sub="Martes, 10 de junio" right={
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Icon name="bell" size={20} color={VF.ink} />
            <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 999, background: VF.red, border: '1.5px solid #fff' }} />
          </div>
          <Avatar name="Diego Salas" size={40} />
        </div>
      } />

      <div style={{ padding: '16px 18px 0' }}>
        {/* Progress card */}
        <div style={{ ...card, padding: 16, marginBottom: 22, background: `linear-gradient(135deg, ${VF.greenDeep}, ${VF.green700})`, border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>RUTA DE HOY</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginTop: 4, whiteSpace: 'nowrap' }}>
                {done} <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>de {hoy.length} visitas</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{pct}%</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>completado</div>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.2)', marginTop: 14, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: '#fff' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            {[['Cuadrilla Norte', 'users'], ['Cumbayá · Tumbaco', 'pin']].map(([t, ic], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name={ic} size={15} color="rgba(255,255,255,0.75)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <SectionLabel>Hoy</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {hoy.map(v => <VisitaCard key={v.id} v={v} onPress={() => go('detalle', v)} />)}
        </div>

        <SectionLabel>Mañana</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {manana.map(v => <VisitaCard key={v.id} v={v} onPress={() => go('detalle', v)} />)}
        </div>
      </div>
    </Screen>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, paddingLeft: 2 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: VF.ink3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>
      {right}
    </div>
  );
}

// ── Visit detail ──
function DetalleScreen({ v, go, back }) {
  const c = v.cliente;
  const programada = v.estado === 'PROGRAMADA';
  const enCurso = v.estado === 'EN_CURSO';
  return (
    <Screen>
      <AppBar title={`${c.nombre} ${c.apellido}`} sub={v.servicio} onBack={back} right={<StatusPill estado={v.estado} size="sm" />} />
      <div style={{ padding: '16px 18px 0' }}>
        {/* Map + location */}
        <div style={{ ...card, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: 150, position: 'relative', background: `repeating-linear-gradient(45deg, ${VF.green50}, ${VF.green50} 11px, ${VF.surface} 11px, ${VF.surface} 22px)` }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50% 50% 50% 0', background: VF.green, transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(20,80,40,0.35)' }}>
                  <div style={{ transform: 'rotate(45deg)', color: '#fff', display: 'flex' }}><Icon name="pin" size={20} color="#fff" /></div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: VF.ink }}>{c.dir}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>{c.sector}, Quito</div>
            </div>
            <CircleBtn icon="nav" label="Llegar" />
            <CircleBtn icon="phone" label="Llamar" />
          </div>
        </div>

        {/* Details */}
        <div style={{ ...card, padding: 4, marginBottom: 14 }}>
          <InfoRow icon="clock" label="Horario" value={`${v.hora} · ${v.dur}`} />
          <InfoRow icon="users" label="Cuadrilla" value={v.grupo} />
          <InfoRow icon="wrench" label="Servicio" value={v.servicio} />
          <InfoRow icon="user" label="Contacto" value={c.tel} last />
        </div>

        {/* Notas */}
        <div style={{ ...card, padding: 15, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="clipboard" size={17} color={VF.green700} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: VF.ink }}>Indicaciones</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: VF.ink2 }}>
            Revisar aspersores del jardín posterior, el cliente reportó baja presión. Podar el seto del frente a 1.20 m.
          </p>
        </div>

        {/* History */}
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green }}>Ver todo</span>}>Última visita</SectionLabel>
        <div style={{ ...card, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Stripe w={56} h={56} radius={12} label="" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>27 de mayo · Mantenimiento</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>Completada por Cuadrilla Norte</div>
          </div>
          <Icon name="chevR" size={18} color={VF.ink3} />
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px 30px',
        background: 'linear-gradient(to top, #fff 62%, rgba(255,255,255,0))', zIndex: 35,
      }}>
        <BigButton
          label={enCurso ? 'Continuar visita' : 'Iniciar visita'}
          icon={enCurso ? 'arrowR' : 'check'}
          onClick={() => go('completar', v)}
        />
      </div>
    </Screen>
  );
}

function CircleBtn({ icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: VF.green50, border: `1px solid ${VF.green100}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={VF.green700} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: VF.green700 }}>{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderBottom: last ? 'none' : `1px solid ${VF.line2}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={17} color={VF.green700} />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink3, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: VF.ink, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function BigButton({ label, icon, onClick, variant = 'primary' }) {
  const styles = variant === 'primary'
    ? { background: VF.green, color: '#fff', border: 'none', boxShadow: '0 6px 18px rgba(30,100,55,0.32)' }
    : { background: VF.surface, color: VF.green700, border: `1.5px solid ${VF.green100}`, boxShadow: 'none' };
  return (
    <div {...tap(onClick)} style={{
      height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em', cursor: 'pointer', ...styles,
    }}>
      {icon && <Icon name={icon} size={21} color={variant === 'primary' ? '#fff' : VF.green700} stroke={2.4} />}
      {label}
    </div>
  );
}

Object.assign(window, { MobileApp: null, VisitasScreen, DetalleScreen, Screen, AppBar, TabBar, SectionLabel, VisitaCard, BigButton, InfoRow, card, tap });
