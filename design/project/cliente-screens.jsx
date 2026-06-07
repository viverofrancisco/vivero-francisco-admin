// cliente-screens.jsx — client-facing mobile app (role: cliente)
const { useState: useStateC } = React;

function ClienteTabBar({ active, onChange }) {
  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'mensajes', label: 'Mensajes', icon: 'message', badge: 1 },
    { id: 'cuenta', label: 'Cuenta', icon: 'user' },
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
          <div key={t.id} {...tap(() => onChange(t.id))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', width: 80 }}>
            <div style={{ position: 'relative' }}>
              <Icon name={t.icon} size={24} stroke={on ? 2.3 : 2} color={on ? VF.green : VF.ink3} />
              {t.badge && <span style={{ position: 'absolute', top: -4, right: -7, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: VF.red, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{t.badge}</span>}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? VF.green : VF.ink3 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Inicio ──
function ClienteInicio({ go }) {
  const next = VISITAS.find(v => v.estado === 'PROGRAMADA');
  const hist = [
    { ...VISITAS[0], fecha: '27 may' },
    { id: 'h2', cliente: CLIENTES[0], servicio: 'Poda de setos', hora: '09:00', estado: 'COMPLETADA', fecha: '13 may' },
    { id: 'h3', cliente: CLIENTES[0], servicio: 'Fertilización', hora: '10:30', estado: 'COMPLETADA', fecha: '29 abr' },
  ];
  return (
    <Screen>
      <div style={{ paddingTop: 58, background: `linear-gradient(170deg, ${VF.greenDeep}, ${VF.green700})`, borderRadius: '0 0 28px 28px', paddingBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>Hola, Carolina 👋</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: 2 }}>Tu jardín</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Icon name="bell" size={21} color="#fff" />
            <span style={{ position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 999, background: VF.amber, border: '1.5px solid ' + VF.greenDeep }} />
          </div>
        </div>
        {/* Next visit hero */}
        <div style={{ margin: '20px 18px 0', background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 18px 40px rgba(15,50,30,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: VF.green700, letterSpacing: '0.06em' }}>PRÓXIMA VISITA</span>
            <StatusPill estado="PROGRAMADA" size="sm" />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em' }}>Jardinería vertical</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            <HeroMeta icon="calendar" label="Martes 10 jun" />
            <HeroMeta icon="clock" label="13:00" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${VF.line2}` }}>
            <Avatar name="Diego Salas" size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink }}>Diego Salas</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: VF.ink3 }}>Jardinero · Cuadrilla Norte</div>
            </div>
            <div {...tap(() => go('chat'))} style={{ width: 42, height: 42, borderRadius: 13, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="message" size={20} color={VF.green700} />
            </div>
          </div>
          <div {...tap(() => go('detalle', next))} style={{ marginTop: 14 }}>
            <BigButton label="Ver detalles" icon="arrowR" variant="outline" onClick={() => go('detalle', next)} />
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 18px 0' }}>
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green }}>Ver todo</span>}>Historial</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hist.map(h => (
            <div key={h.id} {...tap(() => go('detalle', h))} style={{ ...card, padding: 13, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
              <Stripe w={50} h={50} radius={12} label="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: VF.ink }}>{h.servicio}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>{h.fecha} · Completada</div>
              </div>
              <Icon name="chevR" size={18} color={VF.ink3} />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

function HeroMeta({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon name={icon} size={16} color={VF.green700} />
      <span style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink }}>{label}</span>
    </div>
  );
}

// ── Cliente visita detail ──
function ClienteDetalle({ v, back, go }) {
  const completed = v.estado === 'COMPLETADA';
  return (
    <Screen>
      <AppBar title={v.servicio} sub="Martes, 10 de junio" onBack={back} right={<StatusPill estado={v.estado} size="sm" />} />
      <div style={{ padding: '16px 18px 0' }}>
        {completed && (
          <div style={{ ...card, padding: 15, marginBottom: 14, background: VF.green50, border: `1px solid ${VF.green100}`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="check" size={22} color="#fff" stroke={3} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: VF.green700 }}>Servicio completado</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink2, marginTop: 1 }}>Realizado el 27 de mayo · 1h 30m en sitio</div>
            </div>
          </div>
        )}

        {/* Cuándo */}
        <SectionLabel>Cuándo</SectionLabel>
        <div style={{ ...card, padding: 4, marginBottom: 18 }}>
          <InfoRow icon="calendar" label="Programada" value="Mar 10 jun" />
          <InfoRow icon="clock" label={completed ? 'Hora de entrada' : 'Hora estimada'} value="13:00" />
          {completed && <InfoRow icon="check" label="Hora de salida" value="14:30" last />}
          {!completed && <InfoRow icon="clock" label="Duración estimada" value="1h" last />}
        </div>

        {/* Equipo */}
        <SectionLabel>Equipo asignado</SectionLabel>
        <div style={{ ...card, padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Diego Salas', 'Jardinero'], ['Marco Tipán', 'Supervisor']].map(([n, r]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={n} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: VF.ink }}>{n}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{r}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trabajo realizado / Notas */}
        {completed && (
          <>
            <SectionLabel>Trabajo realizado</SectionLabel>
            <div style={{ ...card, padding: 15, marginBottom: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['Poda y recorte', 'Riego', 'Limpieza'].map(t => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: VF.green50, fontSize: 12.5, fontWeight: 700, color: VF.green700 }}>
                    <Icon name="check" size={13} color={VF.green700} stroke={3} /> {t}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: VF.ink2 }}>
                Se realizó poda del seto frontal y limpieza general. Los aspersores quedaron revisados y funcionando correctamente.
              </p>
            </div>

            {/* Fotos antes/después */}
            <SectionLabel>Antes y después</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <Stripe h={130} radius={14} label="antes" />
                <div style={{ fontSize: 11.5, fontWeight: 700, color: VF.ink3, textAlign: 'center', marginTop: 6 }}>ANTES</div>
              </div>
              <div>
                <Stripe h={130} radius={14} label="después" />
                <div style={{ fontSize: 11.5, fontWeight: 700, color: VF.green700, textAlign: 'center', marginTop: 6 }}>DESPUÉS</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px 30px', background: 'linear-gradient(to top, #fff 62%, rgba(255,255,255,0))', zIndex: 35 }}>
        <BigButton label="Enviar mensaje" icon="message" onClick={() => go('chat')} />
      </div>
    </Screen>
  );
}

// ── Cuenta ──
function ClienteCuenta() {
  return (
    <Screen>
      <AppBar big title="Cuenta" />
      <div style={{ padding: '16px 18px 0' }}>
        <div style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Avatar name="Carolina Andrade" size={56} bg={VF.green} color="#fff" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: VF.ink }}>Carolina Andrade</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>Urb. La Primavera · Cumbayá</div>
          </div>
        </div>

        <MenuGroup title="Propiedad">
          <MenuRow icon="home" label="Dirección y accesos" />
          <MenuRow icon="leaf" label="Mis servicios" detail="2 activos" />
          <MenuRow icon="file" label="Informes" last />
        </MenuGroup>
        <MenuGroup title="Preferencias">
          <MenuRow icon="bell" label="Notificaciones" />
          <MenuRow icon="message" label="Idioma" detail="Español" />
          <MenuRow icon="settings" label="Privacidad y datos" last />
        </MenuGroup>
        <div {...tap(() => {})} style={{ ...card, padding: '14px 16px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <Icon name="logout" size={20} color={VF.red} />
          <span style={{ fontSize: 15, fontWeight: 700, color: VF.red }}>Cerrar sesión</span>
        </div>
      </div>
    </Screen>
  );
}

function MenuGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ ...card, padding: 4 }}>{children}</div>
    </div>
  );
}
function MenuRow({ icon, label, detail, last }) {
  return (
    <div {...tap(() => {})} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderBottom: last ? 'none' : `1px solid ${VF.line2}`, cursor: 'pointer' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={VF.green700} />
      </div>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: VF.ink }}>{label}</span>
      {detail && <span style={{ fontSize: 13, fontWeight: 600, color: VF.ink3 }}>{detail}</span>}
      <Icon name="chevR" size={17} color={VF.ink3} />
    </div>
  );
}

// ── Shell ──
function ClienteAppShell({ initialTab = 'inicio', initialStack = [] }) {
  const [tab, setTab] = useStateC(initialTab);
  const [stack, setStack] = useStateC(initialStack);
  const top = stack[stack.length - 1];
  const go = (screen, v) => setStack([...stack, { screen, v }]);
  const back = () => setStack(stack.slice(0, -1));

  let content;
  if (top) {
    if (top.screen === 'detalle') content = <ClienteDetalle v={top.v} back={back} go={go} />;
    else if (top.screen === 'chat') content = <ChatThread back={back} clienteView />;
  } else if (tab === 'inicio') content = <ClienteInicio go={go} />;
  else if (tab === 'mensajes') content = <ChatInbox onOpen={() => go('chat')} clienteView />;
  else content = <ClienteCuenta />;

  const hideTab = top && top.screen === 'chat';
  return (
    <IOSDevice>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div style={{ height: '100%', overflowY: 'auto' }}>{content}</div>
        {!hideTab && <ClienteTabBar active={tab} onChange={(t) => { setStack([]); setTab(t); }} />}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { ClienteAppShell, ClienteInicio, ClienteDetalle, ClienteCuenta, ClienteTabBar });
