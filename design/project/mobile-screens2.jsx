// mobile-screens2.jsx — completar flow, clientes, app shell
const { useState: useStateB } = React;

// ── Completar visita ──
function CompletarScreen({ v, back, onDone }) {
  const c = v.cliente;
  const [acts, setActs] = useStateB(ACTIVIDADES.map(a => ({ ...a })));
  const [notas, setNotas] = useStateB('');
  const [fotos, setFotos] = useStateB([true, true, false]);
  const [firmado, setFirmado] = useStateB(false);
  const doneCount = acts.filter(a => a.done).length;
  const ready = doneCount > 0 && firmado;

  const toggle = (id) => setActs(acts.map(a => a.id === id ? { ...a, done: !a.done } : a));

  return (
    <Screen>
      <AppBar title="Completar visita" sub={`${c.nombre} ${c.apellido} · ${v.hora}`} onBack={back} />
      <div style={{ padding: '16px 18px 0' }}>

        {/* time card */}
        <div style={{ ...card, padding: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: VF.sky50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={22} color={VF.sky} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: VF.ink3 }}>Tiempo en sitio</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: VF.ink, letterSpacing: '-0.01em' }}>Entrada 10:32 · <span style={{ color: VF.sky }}>1h 14m</span></div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: VF.sky, background: VF.sky50, padding: '5px 10px', borderRadius: 999 }}>En curso</span>
        </div>

        {/* Actividades checklist */}
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: VF.green }}>{doneCount}/{acts.length}</span>}>Actividades realizadas</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {acts.map(a => (
            <div key={a.id} {...tap(() => toggle(a.id))} style={{
              ...card, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              borderColor: a.done ? VF.green : VF.line, background: a.done ? VF.green50 : VF.surface,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.done ? VF.green : VF.line2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={a.icon} size={19} color={a.done ? '#fff' : VF.ink3} />
              </div>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: a.done ? VF.green700 : VF.ink }}>{a.nombre}</span>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                border: a.done ? 'none' : `2px solid ${VF.line}`, background: a.done ? VF.green : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {a.done && <Icon name="check" size={16} color="#fff" stroke={3} />}
              </div>
            </div>
          ))}
        </div>

        {/* Fotos */}
        <SectionLabel>Evidencia fotográfica</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {fotos.map((has, i) => has
            ? <div key={i} style={{ position: 'relative' }}>
                <Stripe h={92} radius={14} label={i === 0 ? 'antes' : 'después'} />
                <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={13} color="#fff" stroke={3} />
                </div>
              </div>
            : <div key={i} style={{ height: 92, borderRadius: 14, border: `1.5px dashed ${VF.green}`, background: VF.green50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}>
                <Icon name="camera" size={22} color={VF.green700} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: VF.green700 }}>Añadir</span>
              </div>
          )}
        </div>

        {/* Notas */}
        <SectionLabel>Observaciones</SectionLabel>
        <div style={{ ...card, padding: 14, marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: notas ? VF.ink : VF.ink3, lineHeight: 1.5, minHeight: 44 }}>
            {notas || 'Aspersores del jardín posterior reparados. Se recomienda revisar el sistema de drenaje en la próxima visita.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${VF.line2}` }}>
            <Chip icon="message" label="Dictar nota" />
            <Chip icon="plus" label="Plantilla" />
          </div>
        </div>

        {/* Firma */}
        <SectionLabel>Firma del cliente</SectionLabel>
        <div {...tap(() => setFirmado(!firmado))} style={{
          ...card, height: 120, marginBottom: 18, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
          borderStyle: firmado ? 'solid' : 'dashed', borderColor: firmado ? VF.green : VF.line,
          background: firmado ? VF.green50 : VF.surface, position: 'relative', overflow: 'hidden',
        }}>
          {firmado ? (
            <>
              <svg width="160" height="48" viewBox="0 0 160 48" fill="none" style={{ color: VF.greenDeep }}>
                <path d="M6 30c10-16 16 8 24-2s10-20 16-6 8 18 16 6 12-14 20-6 10 14 22 4 14-12 24-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green700 }}>Carolina Andrade · firmado</span>
            </>
          ) : (
            <>
              <Icon name="pen" size={24} color={VF.ink3} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink3 }}>Toca para firmar</span>
            </>
          )}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px 30px',
        background: 'linear-gradient(to top, #fff 62%, rgba(255,255,255,0))', zIndex: 35,
      }}>
        {!ready && <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: VF.ink3, marginBottom: 9 }}>
          {doneCount === 0 ? 'Marca al menos una actividad' : 'Falta la firma del cliente'}
        </div>}
        <div style={{ opacity: ready ? 1 : 0.5, pointerEvents: ready ? 'auto' : 'none' }}>
          <BigButton label="Guardar y completar" icon="checkCircle" onClick={onDone} />
        </div>
      </div>
    </Screen>
  );
}

function Chip({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, background: VF.green50, cursor: 'pointer' }}>
      <Icon name={icon} size={15} color={VF.green700} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green700 }}>{label}</span>
    </div>
  );
}

// ── Success ──
function SuccessScreen({ onClose }) {
  return (
    <div style={{ minHeight: '100%', background: `linear-gradient(160deg, ${VF.greenDeep}, ${VF.green700})`, fontFamily: VF.font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: 120 }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={38} color={VF.green} stroke={3} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', textAlign: 'center' }}>Visita completada</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>
        El informe fue enviado a Carolina Andrade y al panel de administración.
      </div>
      <div style={{ display: 'flex', gap: 28, marginTop: 30, marginBottom: 36 }}>
        {[['Actividades', '2'], ['Fotos', '2'], ['Duración', '1h 14m']].map(([l, n], i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{n}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <div {...tap(onClose)} style={{ width: '100%', maxWidth: 320, height: 54, borderRadius: 16, background: '#fff', color: VF.green700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
        Siguiente visita
      </div>
    </div>
  );
}

// ── Clientes ──
function ClientesScreen({ go }) {
  return (
    <Screen>
      <AppBar big title="Clientes" sub="38 activos en tus sectores" right={
        <div style={{ width: 40, height: 40, borderRadius: 12, background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={22} color="#fff" stroke={2.4} />
        </div>
      } />
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: VF.surface, border: `1px solid ${VF.line}`, borderRadius: 14, marginBottom: 18 }}>
          <Icon name="search" size={19} color={VF.ink3} />
          <span style={{ fontSize: 15, fontWeight: 500, color: VF.ink3 }}>Buscar cliente o sector…</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['Todos', 'Cumbayá', 'Tumbaco', 'Nayón'].map((f, i) => (
            <div key={f} style={{ padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: i === 0 ? VF.green : VF.surface, color: i === 0 ? '#fff' : VF.ink2, border: `1px solid ${i === 0 ? VF.green : VF.line}` }}>{f}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CLIENTES.map(c => (
            <div key={c.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
              <Avatar name={`${c.nombre} ${c.apellido}`} size={46} bg={VF.green100} color={VF.green700} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre} {c.apellido}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: VF.ink3 }}>
                  <Icon name="pin" size={13} color={VF.ink3} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.sector}</span>
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: VF.ink3 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.servicios.length} servicio{c.servicios.length > 1 ? 's' : ''}</span>
                </div>
              </div>
              <Icon name="chevR" size={18} color={VF.ink3} />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// Simple placeholder tab
function SimpleTab({ title, sub, icon }) {
  return (
    <Screen>
      <AppBar big title={title} sub={sub} />
      <div style={{ padding: '80px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={34} color={VF.green700} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: VF.ink }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: VF.ink3, lineHeight: 1.5, maxWidth: 240 }}>Esta sección sigue el mismo lenguaje visual del flujo de visitas.</div>
      </div>
    </Screen>
  );
}

// ── App shell ──
function MobileAppShell({ initialTab = 'visitas', initialStack = [] }) {
  const [tab, setTab] = useStateB(initialTab);
  const [stack, setStack] = useStateB(initialStack); // {screen, v}
  const top = stack[stack.length - 1];

  const go = (screen, v) => setStack([...stack, { screen, v }]);
  const back = () => setStack(stack.slice(0, -1));
  const reset = () => setStack([]);

  let content;
  if (top) {
    if (top.screen === 'detalle') content = <DetalleScreen v={top.v} go={go} back={back} />;
    else if (top.screen === 'completar') content = <CompletarScreen v={top.v} back={back} onDone={() => go('success', top.v)} />;
    else if (top.screen === 'success') content = <SuccessScreen onClose={reset} />;
  } else if (tab === 'visitas') content = <VisitasScreen go={go} />;
  else if (tab === 'clientes') content = <ClientesScreen go={go} />;
  else if (tab === 'informes') content = <SimpleTab title="Informes" sub="Reportes de servicio" icon="file" />;
  else if (tab === 'mensajes') content = <SimpleTab title="Mensajes" sub="Chats con clientes y equipo" icon="message" />;
  else content = <SimpleTab title="Más" sub="Servicios, perfil y ajustes" icon="grid" />;

  const hideTab = top && top.screen === 'success';

  return (
    <IOSDevice>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {content}
        </div>
        {!hideTab && <TabBar active={tab} onChange={(t) => { setStack([]); setTab(t); }} />}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { MobileAppShell, CompletarScreen, ClientesScreen, SuccessScreen, SimpleTab });
