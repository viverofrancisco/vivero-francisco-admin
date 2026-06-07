// mensajes-screens.jsx — inbox + chat thread (shared by staff & client)
const { useState: useStateM } = React;

// ── Inbox ──
function ChatInbox({ onOpen, clienteView }) {
  return (
    <Screen>
      <AppBar big title="Mensajes" sub={clienteView ? 'Conversaciones con tu equipo' : '5 conversaciones · 3 sin leer'} right={
        !clienteView ? <div style={{ width: 40, height: 40, borderRadius: 12, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="filter" size={19} color={VF.ink} /></div> : null
      } />
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: VF.surface, border: `1px solid ${VF.line}`, borderRadius: 14, marginBottom: 18 }}>
          <Icon name="search" size={19} color={VF.ink3} />
          <span style={{ fontSize: 15, fontWeight: 500, color: VF.ink3 }}>Buscar conversación…</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CONVERS.map((k, i) => (
            <div key={k.id} {...tap(onOpen)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 6px', cursor: 'pointer', borderBottom: i < CONVERS.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar name={clienteView ? 'Vivero Francisco' : `${k.cliente.nombre} ${k.cliente.apellido}`} size={50} bg={k.unread ? VF.green100 : VF.line2} color={k.unread ? VF.green700 : VF.ink3} />
                <span style={{ position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: '50%', background: statusMeta(k.estado).dot, border: '2.5px solid #fff' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: k.unread ? 800 : 700, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {clienteView ? k.servicio : `${k.cliente.nombre} ${k.cliente.apellido}`}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: k.unread ? VF.green : VF.ink3, flexShrink: 0 }}>{k.time}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.green700, margin: '1px 0 3px' }}>{clienteView ? '' : k.servicio}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: k.unread ? 600 : 500, color: k.unread ? VF.ink2 : VF.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {k.mine && <Icon name="check" size={13} color={VF.ink3} stroke={2.5} />}
                    {k.hasMedia && <Icon name="camera" size={13} color={VF.ink3} />}
                    {k.last}
                  </span>
                  {k.unread > 0 && <span style={{ minWidth: 19, height: 19, padding: '0 6px', borderRadius: 999, background: VF.green, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ── Chat thread ──
function ChatThread({ back, clienteView }) {
  const peer = clienteView ? 'Vivero Francisco' : 'Hacienda El Olivar';
  const sub = clienteView ? 'Cuadrilla Norte' : 'Sistema de riego';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: VF.bg, fontFamily: VF.font }}>
      {/* header */}
      <div style={{ paddingTop: 58, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${VF.line}`, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 14px 12px' }}>
          <div {...tap(back)} style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="chevL" size={24} color={VF.ink} />
          </div>
          <Avatar name={peer} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{peer}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{sub}</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="search" size={20} color={VF.ink} />
          </div>
        </div>
        {/* visit banner */}
        <div {...tap(() => {})} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 14px 12px', padding: '10px 14px', background: VF.green50, borderRadius: 13, cursor: 'pointer' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusMeta('EN_CURSO').dot, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sistema de riego · Hacienda El Olivar</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: VF.ink3 }}>Hoy, 10:30 · En curso</div>
          </div>
          <Icon name="chevR" size={16} color={VF.green700} />
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DayDivider label="Hoy" />
        {THREAD.map((m, i) => {
          const mine = clienteView ? !m.mine : m.mine;
          const prev = THREAD[i - 1];
          const showTime = !prev || prev.time.slice(0, 2) !== m.time.slice(0, 2);
          return <Bubble key={m.id} m={m} mine={mine} showTime={showTime} last={i === THREAD.length - 1} />;
        })}
      </div>

      {/* composer */}
      <div style={{ padding: '10px 14px 30px', background: 'rgba(255,255,255,0.95)', borderTop: `1px solid ${VF.line}`, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="plus" size={22} color={VF.green700} />
        </div>
        <div style={{ flex: 1, minHeight: 42, borderRadius: 21, background: VF.surface, border: `1px solid ${VF.line}`, padding: '11px 16px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14.5, fontWeight: 500, color: VF.ink3 }}>Escribir mensaje…</span>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 12px rgba(30,100,55,0.3)' }}>
          <Icon name="arrowR" size={20} color="#fff" stroke={2.5} style={{ transform: 'rotate(-90deg)' }} />
        </div>
      </div>
    </div>
  );
}

function DayDivider({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: VF.ink3, background: VF.line2, padding: '4px 12px', borderRadius: 999 }}>{label}</span>
    </div>
  );
}

function Bubble({ m, mine, showTime, last }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginTop: showTime ? 8 : 0 }}>
      {showTime && <div style={{ fontSize: 11, fontWeight: 600, color: VF.ink3, margin: '4px 0 8px', alignSelf: 'center' }}>{m.time}</div>}
      {!mine && <div style={{ fontSize: 11.5, fontWeight: 700, color: VF.green700, marginLeft: 14, marginBottom: 3 }}>{m.author}</div>}
      <div style={{
        maxWidth: '78%', padding: m.media ? 5 : '10px 14px', borderRadius: 20,
        borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6,
        background: mine ? VF.green : VF.surface, border: mine ? 'none' : `1px solid ${VF.line}`,
        boxShadow: mine ? '0 1px 2px rgba(30,100,55,0.2)' : '0 1px 2px rgba(20,40,30,0.04)',
      }}>
        {m.media && (
          <div style={{ display: 'flex', gap: 4, marginBottom: m.body ? 6 : 0 }}>
            {m.media.map((lbl, i) => <Stripe key={i} w={108} h={108} radius={15} label={lbl} />)}
          </div>
        )}
        {m.body && <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4, color: mine ? '#fff' : VF.ink, display: 'block', padding: m.media ? '4px 8px 6px' : 0 }}>{m.body}</span>}
      </div>
      {mine && last && <div style={{ fontSize: 11, fontWeight: 700, color: VF.green, marginTop: 4, marginRight: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Icon name="check" size={12} color={VF.green} stroke={3} /> Leído
      </div>}
    </div>
  );
}

// Standalone shell wrapper for inbox/chat artboards (staff side)
function MensajesShell({ start = 'inbox' }) {
  const [view, setView] = useStateM(start);
  return (
    <IOSDevice>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div style={{ height: '100%', overflowY: 'auto' }}>
          {view === 'inbox'
            ? <ChatInbox onOpen={() => setView('chat')} />
            : <ChatThread back={() => setView('inbox')} />}
        </div>
        {view === 'inbox' && <TabBar active="mensajes" onChange={() => {}} />}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { ChatInbox, ChatThread, Bubble, DayDivider, MensajesShell });
