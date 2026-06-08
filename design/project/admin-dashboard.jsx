// admin-dashboard.jsx — admin web app redesign
const { useState: useStateW } = React;

const wcard = { background: VF.surface, borderRadius: 16, border: `1px solid ${VF.line}` };

function Sidebar({ page, setPage }) {
  const items = [
    { id: 'panel', label: 'Panel', icon: 'home' },
    { id: 'clientes', label: 'Clientes', icon: 'users' },
    { id: 'servicios', label: 'Servicios', icon: 'wrench' },
    { id: 'visitas', label: 'Visitas', icon: 'calendar' },
    { id: 'mensajes', label: 'Mensajes', icon: 'message', badge: 4 },
    { id: 'informes', label: 'Informes', icon: 'file' },
  ];
  const items2 = [
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'grupos', label: 'Grupos', icon: 'users' },
    { id: 'sectores', label: 'Sectores', icon: 'pin' },
    { id: 'config', label: 'Configuración', icon: 'settings' },
  ];
  const NavBtn = (it) => {
    const on = page === it.id;
    return (
      <div key={it.id} onClick={() => setPage(it.id)} style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 11, cursor: 'pointer',
        background: on ? VF.green : 'transparent', color: on ? '#fff' : VF.ink2,
        fontSize: 14, fontWeight: on ? 700 : 600, letterSpacing: '-0.01em', position: 'relative',
      }}>
        <Icon name={it.icon} size={19} color={on ? '#fff' : VF.ink3} stroke={on ? 2.3 : 2} />
        <span style={{ flex: 1 }}>{it.label}</span>
        {it.badge && <span style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: on ? 'rgba(255,255,255,0.25)' : VF.red, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.badge}</span>}
      </div>
    );
  };
  return (
    <div style={{ width: 248, flexShrink: 0, background: VF.surface, borderRight: `1px solid ${VF.line}`, display: 'flex', flexDirection: 'column', padding: '20px 14px' }}>
      <div style={{ padding: '0 6px 20px' }}><Logo size={34} sub={false} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{items.map(NavBtn)}</div>
      <div style={{ height: 1, background: VF.line, margin: '14px 6px' }} />
      <div style={{ fontSize: 11, fontWeight: 800, color: VF.ink3, letterSpacing: '0.08em', padding: '0 12px 8px' }}>ADMINISTRACIÓN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{items2.map(NavBtn)}</div>
      <div style={{ flex: 1 }} />
      <div style={{ ...wcard, padding: 12, display: 'flex', alignItems: 'center', gap: 10, background: VF.green50, border: 'none' }}>
        <Avatar name="Andrés Pérez" size={36} bg={VF.green} color="#fff" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Andrés Pérez</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: VF.ink3 }}>Administrador</div>
        </div>
        <Icon name="logout" size={17} color={VF.ink3} />
      </div>
    </div>
  );
}

function Topbar({ title, sub, onBack, cta }) {
  return (
    <div style={{ height: 68, flexShrink: 0, borderBottom: `1px solid ${VF.line}`, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <div onClick={onBack} style={{ width: 38, height: 38, borderRadius: 10, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="chevL" size={20} color={VF.ink} />
          </div>
        )}
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{title}</div>
          {sub && <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 1, whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 14px', background: VF.surface, border: `1px solid ${VF.line}`, borderRadius: 11, width: 240 }}>
          <Icon name="search" size={18} color={VF.ink3} />
          <span style={{ fontSize: 13.5, fontWeight: 500, color: VF.ink3 }}>Buscar…</span>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Icon name="bell" size={19} color={VF.ink} />
          <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 999, background: VF.red, border: '1.5px solid #fff' }} />
        </div>
        {cta && (
          <div onClick={cta.onClick} style={{ height: 40, padding: '0 16px', borderRadius: 11, background: VF.green, color: '#fff', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            <Icon name={cta.icon || 'plus'} size={18} color="#fff" stroke={2.4} /> {cta.label}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, tone, trend }) {
  return (
    <div style={{ ...wcard, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={21} color={tone.fg} />
        </div>
        {trend && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700, color: VF.green }}>
          <Icon name="trending" size={14} color={VF.green} /> {trend}
        </span>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: VF.ink, letterSpacing: '-0.03em', marginTop: 14 }}>{value}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink2, marginTop: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function DashboardPage() {
  const tones = {
    blue: { bg: VF.sky50, fg: VF.sky }, green: { bg: VF.green50, fg: VF.green700 },
    clay: { bg: 'oklch(0.95 0.03 50)', fg: VF.clay }, amber: { bg: VF.amber50, fg: 'oklch(0.50 0.13 60)' },
  };
  const route = VISITAS.filter(v => v.when === 'hoy');
  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Clientes activos" value="142" icon="users" tone={tones.blue} trend="+6" sub="38 en Cumbayá" />
        <StatCard label="Servicios" value="9" icon="wrench" tone={tones.clay} sub="Mantenimiento, poda, riego…" />
        <StatCard label="Personal" value="24" icon="user" tone={tones.green} sub="6 cuadrillas activas" />
        <StatCard label="Visitas de junio" value="318" icon="calendar" tone={tones.amber} trend="92%" sub="284 completadas" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 22 }}>
        {/* Today's route */}
        <div style={{ ...wcard, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: VF.ink }}>Visitas de hoy</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 1 }}>Martes, 10 de junio · 28 programadas</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: VF.green, cursor: 'pointer' }}>Ver todas</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {route.map((v, i) => {
                const m = statusMeta(v.estado);
                return (
                  <tr key={v.id} style={{ borderBottom: i < route.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
                    <td style={{ padding: '13px 20px', width: 70 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: VF.ink, fontVariantNumeric: 'tabular-nums' }}>{v.hora}</span>
                    </td>
                    <td style={{ padding: '13px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <Avatar name={`${v.cliente.nombre} ${v.cliente.apellido}`} size={34} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{v.cliente.nombre} {v.cliente.apellido}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{v.servicio}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 8px' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: VF.ink2 }}>{v.cliente.sector}</span>
                    </td>
                    <td style={{ padding: '13px 20px', textAlign: 'right' }}><StatusPill estado={v.estado} size="sm" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Completion ring */}
          <div style={{ ...wcard, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: VF.ink, marginBottom: 16 }}>Cumplimiento del mes</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Ring pct={92} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Legend color={VF.green} label="Completadas" value="284" />
                <Legend color={VF.amber} label="Incompletas" value="12" />
                <Legend color={VF.ink3} label="Programadas" value="22" />
              </div>
            </div>
          </div>
          {/* Crews */}
          <div style={{ ...wcard, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: VF.ink, marginBottom: 14 }}>Cuadrillas en campo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[['Cuadrilla Norte', 'Cumbayá', 4, VF.green], ['Cuadrilla Valle', 'Tumbaco', 3, VF.sky], ['Cuadrilla Centro', 'Nayón', 2, VF.clay]].map(([n, s, c, col]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink }}>{n}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: VF.ink3 }}>{s}</div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink2 }}>{c} visitas</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }) {
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 96, height: 96 }}>
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke={VF.line} strokeWidth="11" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={VF.green} strokeWidth="11" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em' }}>{pct}%</span>
      </div>
    </div>
  );
}
function Legend({ color, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: VF.ink2, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: VF.ink }}>{value}</span>
    </div>
  );
}

// ── Visitas table page ──
function VisitasPage({ onOpen }) {
  const all = [...VISITAS, ...VISITAS.map((v, i) => ({ ...v, id: 'x' + i, estado: ['COMPLETADA', 'PROGRAMADA', 'INCOMPLETA', 'CANCELADA'][i % 4] }))].slice(0, 9);
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {['Todas', 'Programadas', 'Completadas', 'Incompletas'].map((f, i) => (
          <div key={f} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: i === 0 ? VF.green : VF.surface, color: i === 0 ? '#fff' : VF.ink2, border: `1px solid ${i === 0 ? VF.green : VF.line}` }}>{f}</div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, background: VF.surface, border: `1px solid ${VF.line}`, fontSize: 13, fontWeight: 700, color: VF.ink2 }}>
          <Icon name="filter" size={16} color={VF.ink2} /> Filtros
        </div>
      </div>
      <div style={{ ...wcard, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: VF.green50 }}>
              {['Cliente', 'Servicio', 'Sector', 'Fecha', 'Cuadrilla', 'Estado'].map(h => (
                <th key={h} style={{ textAlign: h === 'Estado' ? 'right' : 'left', padding: '12px 20px', fontSize: 12, fontWeight: 800, color: VF.green700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((v, i) => (
              <tr key={v.id} onClick={() => onOpen && onOpen('visita', v)} style={{ borderTop: `1px solid ${VF.line2}`, cursor: 'pointer' }}>
                <td style={{ padding: '13px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={`${v.cliente.nombre} ${v.cliente.apellido}`} size={32} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink }}>{v.cliente.nombre} {v.cliente.apellido}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: VF.ink2 }}>{v.servicio}</td>
                <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: VF.ink2 }}>{v.cliente.sector}</td>
                <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: VF.ink2, fontVariantNumeric: 'tabular-nums' }}>10 jun · {v.hora}</td>
                <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: VF.ink2 }}>{v.grupo}</td>
                <td style={{ padding: '13px 20px', textAlign: 'right' }}><StatusPill estado={v.estado} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminApp({ initialPage = 'panel', initialDetail = null }) {
  const [page, setPageRaw] = useStateW(initialPage);
  const [detail, setDetail] = useStateW(initialDetail);
  const setPage = (p) => { setDetail(null); setPageRaw(p); };
  const open = (type, item) => setDetail({ type, item });
  const back = () => setDetail(null);

  const meta = {
    panel: ['Panel', 'Resumen general del vivero'],
    clientes: ['Clientes', 'Directorio de clientes y sus servicios'],
    servicios: ['Servicios', 'Catálogo de servicios ofrecidos'],
    visitas: ['Visitas', 'Programación y seguimiento de servicios'],
    mensajes: ['Mensajes', 'Conversaciones con clientes'],
    informes: ['Informes', 'Reportes de servicio en PDF'],
    personal: ['Personal', 'Equipo de jardineros y supervisores'],
    grupos: ['Grupos', 'Cuadrillas de trabajo'],
    sectores: ['Sectores', 'Zonas de cobertura'],
    config: ['Configuración', 'Empresa, usuarios y notificaciones'],
  };
  const pages = {
    panel: DashboardPage, visitas: VisitasPage, clientes: ClientesPage, servicios: ServiciosPage,
    informes: InformesPageWeb, personal: PersonalPage, grupos: GruposPage, sectores: SectoresPage,
    config: ConfiguracionPage,
  };

  // Detail routing
  let title, sub, body, cta;
  if (detail) {
    const it = detail.item;
    if (detail.type === 'cliente') {
      title = `${it.nombre} ${it.apellido || ''}`.trim(); sub = 'Detalle de cliente';
      body = <ClienteDetalleWeb c={it} onOpenVisita={(v) => open('visita', v)} />;
      cta = { label: 'Editar', icon: 'pen', onClick: () => open('editar-cliente', it) };
    } else if (detail.type === 'visita') {
      title = `${it.cliente.nombre} ${it.cliente.apellido}`; sub = it.servicio;
      body = <VisitaDetalleWeb v={it} />;
    } else if (detail.type === 'personal') {
      title = it.n; sub = 'Detalle de personal'; body = <PersonalDetalle p={it} />;
    } else if (detail.type === 'grupo') {
      title = it.n; sub = it.sector; body = <GrupoDetalle g={it} />;
    } else if (detail.type === 'sector') {
      title = it.n; sub = 'Detalle de sector'; body = <SectorDetalle s={it} />;
    } else if (detail.type === 'servicio') {
      title = it.n; sub = 'Detalle de servicio'; body = <ServicioDetalleWeb s={it} />;
    } else if (detail.type === 'informe') {
      title = it.titulo; sub = 'Informe de servicio'; body = <InformeDetalleWeb r={it} />;
    } else if (detail.type === 'nuevo-cliente') {
      title = 'Nuevo cliente'; sub = 'Registra un cliente y sus preferencias'; body = <ClienteForm onBack={back} />;
    } else if (detail.type === 'editar-cliente') {
      title = 'Editar cliente'; sub = `${it.nombre} ${it.apellido || ''}`.trim(); body = <ClienteForm editData={it} onBack={back} />;
    } else if (detail.type === 'nueva-visita') {
      title = 'Programar visita'; sub = 'Agenda un nuevo servicio'; body = <NuevaVisitaForm onBack={back} />;
    }
  } else {
    [title, sub] = meta[page] || [page[0].toUpperCase() + page.slice(1), 'Sección del panel'];
    const Page = pages[page];
    if (page === 'mensajes') body = <MensajesPageWeb />;
    else body = <Page onOpen={open} />;
    // context-aware primary action
    if (page === 'clientes') cta = { label: 'Nuevo cliente', onClick: () => open('nuevo-cliente') };
    else if (page === 'servicios') cta = { label: 'Nuevo servicio', onClick: () => open('nuevo-cliente') };
    else if (page === 'personal') cta = { label: 'Nuevo personal', onClick: () => open('nuevo-cliente') };
    else if (page !== 'config' && page !== 'mensajes') cta = { label: 'Nueva visita', onClick: () => open('nueva-visita') };
  }

  const fullBleed = !detail && page === 'mensajes';
  return (
    <div style={{ display: 'flex', height: '100%', background: VF.bg, fontFamily: VF.font, color: VF.ink }}>
      <Sidebar page={page} setPage={setPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title={title} sub={sub} onBack={detail ? back : null} cta={cta} />
        {fullBleed ? (
          <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>{body}</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AdminApp, DashboardPage, VisitasPage });
