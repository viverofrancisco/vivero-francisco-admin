// admin-pages.jsx — all remaining admin web pages
const { useState: useStateP } = React;

const pcard = { background: VF.surface, borderRadius: 16, border: `1px solid ${VF.line}` };

// ── shared bits ──
function Toolbar({ children, searchPh = 'Buscar…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 14px', background: VF.surface, border: `1px solid ${VF.line}`, borderRadius: 11, width: 280 }}>
        <Icon name="search" size={18} color={VF.ink3} />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: VF.ink3 }}>{searchPh}</span>
      </div>
      {children}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 40, borderRadius: 10, background: VF.surface, border: `1px solid ${VF.line}`, fontSize: 13, fontWeight: 700, color: VF.ink2 }}>
        <Icon name="filter" size={16} color={VF.ink2} /> Filtros
      </div>
    </div>
  );
}

function Chips({ items }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {items.map((f, i) => (
        <div key={f} style={{ padding: '0 15px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: i === 0 ? VF.green : VF.surface, color: i === 0 ? '#fff' : VF.ink2, border: `1px solid ${i === 0 ? VF.green : VF.line}` }}>{f}</div>
      ))}
    </div>
  );
}

function Table({ cols, children }) {
  return (
    <div style={{ ...pcard, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: VF.green50 }}>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: c.right ? 'right' : 'left', padding: '12px 20px', fontSize: 12, fontWeight: 800, color: VF.green700, letterSpacing: '0.03em', textTransform: 'uppercase', width: c.w }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function TD({ children, right, color, weight }) {
  return <td style={{ padding: '13px 20px', textAlign: right ? 'right' : 'left', fontSize: 13.5, fontWeight: weight || 600, color: color || VF.ink2 }}>{children}</td>;
}
function TR({ children }) { return <tr style={{ borderTop: `1px solid ${VF.line2}` }}>{children}</tr>; }

function MiniStats({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 14, marginBottom: 20 }}>
      {items.map(([label, value, sub], i) => (
        <div key={i} style={{ ...pcard, padding: '15px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em' }}>{value}</span>
            {sub && <span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green }}>{sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function NameCell({ name, sub, color }) {
  return (
    <td style={{ padding: '11px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={name} size={36} bg={color ? color : VF.green100} color={color ? '#fff' : VF.green700} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{name}</div>
          {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{sub}</div>}
        </div>
      </div>
    </td>
  );
}

// ── Clientes ──
function ClientesPage() {
  const rows = [
    ...CLIENTES,
    { id: 'c6', nombre: 'Condominio', apellido: 'Las Acacias', sector: 'Cumbayá', tel: '0993 410 778', servicios: ['Áreas verdes', 'Poda'], m2: 1200 },
    { id: 'c7', nombre: 'Sofía', apellido: 'Carrión', sector: 'Nayón', tel: '0982 556 113', servicios: ['Mantenimiento'], m2: 320 },
  ];
  return (
    <div style={{ padding: 28 }}>
      <MiniStats items={[['Clientes activos', '142'], ['Cumbayá', '38'], ['Tumbaco', '29'], ['Servicios contratados', '186']]} />
      <Toolbar searchPh="Buscar cliente, sector o servicio…"><Chips items={['Todos', 'Cumbayá', 'Tumbaco', 'Nayón']} /></Toolbar>
      <Table cols={[{ label: 'Cliente' }, { label: 'Sector' }, { label: 'Servicios' }, { label: 'Teléfono' }, { label: 'm²' }, { label: 'Estado', right: true }]}>
        {rows.map(c => (
          <TR key={c.id}>
            <NameCell name={`${c.nombre} ${c.apellido}`} sub={c.dir || c.sector} color={c.color} />
            <TD>{c.sector}</TD>
            <td style={{ padding: '13px 20px' }}>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {c.servicios.slice(0, 2).map(s => <span key={s} style={{ padding: '3px 9px', borderRadius: 999, background: VF.green50, fontSize: 11.5, fontWeight: 700, color: VF.green700 }}>{s}</span>)}
              </div>
            </td>
            <TD>{c.tel}</TD>
            <TD weight={700} color={VF.ink}>{c.m2 || (c.id === 'c1' ? 540 : 280)}</TD>
            <td style={{ padding: '13px 20px', textAlign: 'right' }}><StatusPill estado="PROGRAMADA" size="sm" /></td>
          </TR>
        ))}
      </Table>
    </div>
  );
}

// ── Servicios ──
function ServiciosPage() {
  const servicios = [
    { n: 'Mantenimiento de jardín', t: 'RECURRENTE', d: 'Poda, riego, limpieza y cuidado general de jardines.', clientes: 64, precio: '$45', icon: 'leaf' },
    { n: 'Sistema de riego', t: 'RECURRENTE', d: 'Instalación y mantenimiento de aspersores y goteo.', clientes: 28, precio: '$80', icon: 'droplet' },
    { n: 'Poda de setos y árboles', t: 'RECURRENTE', d: 'Recorte de formas, setos y poda de altura.', clientes: 41, precio: '$35', icon: 'scissors' },
    { n: 'Control fitosanitario', t: 'RECURRENTE', d: 'Control de plagas y enfermedades de las plantas.', clientes: 22, precio: '$60', icon: 'wrench' },
    { n: 'Diseño de jardín', t: 'UNICO', d: 'Diseño e implementación de nuevos espacios verdes.', clientes: 9, precio: 'Cotización', icon: 'sprout' },
    { n: 'Jardinería vertical', t: 'UNICO', d: 'Muros verdes y jardines verticales a medida.', clientes: 7, precio: 'Cotización', icon: 'grid' },
  ];
  return (
    <div style={{ padding: 28 }}>
      <Toolbar searchPh="Buscar servicio…"><Chips items={['Todos', 'Recurrentes', 'Únicos']} /></Toolbar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {servicios.map(s => (
          <div key={s.n} style={{ ...pcard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={23} color={VF.green700} />
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', background: s.t === 'RECURRENTE' ? VF.green50 : VF.sky50, color: s.t === 'RECURRENTE' ? VF.green700 : VF.sky }}>{s.t === 'RECURRENTE' ? 'RECURRENTE' : 'ÚNICO'}</span>
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: VF.ink, marginTop: 14, letterSpacing: '-0.01em' }}>{s.n}</div>
            <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: VF.ink2, minHeight: 38 }}>{s.d}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${VF.line2}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="users" size={15} color={VF.ink3} />
                <span style={{ fontSize: 13, fontWeight: 700, color: VF.ink2 }}>{s.clientes} clientes</span>
              </div>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: VF.green700 }}>{s.precio}<span style={{ fontSize: 11.5, fontWeight: 600, color: VF.ink3 }}>{s.precio.startsWith('$') ? '/mes' : ''}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Personal ──
function PersonalPage() {
  const staff = [
    { n: 'Diego Salas', t: 'Jardinero', tel: '0998 112 045', grupo: 'Cuadrilla Norte', e: 'ACTIVO' },
    { n: 'Marco Tipán', t: 'Supervisor', tel: '0991 556 720', grupo: 'Cuadrilla Norte', e: 'ACTIVO' },
    { n: 'Luis Quishpe', t: 'Jardinero', tel: '0987 330 118', grupo: 'Cuadrilla Valle', e: 'ACTIVO' },
    { n: 'Pedro Caiza', t: 'Chofer', tel: '0995 204 661', grupo: 'Cuadrilla Valle', e: 'ACTIVO' },
    { n: 'Andrés Lema', t: 'Jardinero', tel: '0984 778 209', grupo: 'Cuadrilla Centro', e: 'ACTIVO' },
    { n: 'Jorge Núñez', t: 'Mecánico', tel: '0993 145 882', grupo: '—', e: 'INACTIVO' },
  ];
  const tColor = { Jardinero: VF.green, Supervisor: VF.clay, Chofer: VF.sky, 'Mecánico': VF.ink2 };
  return (
    <div style={{ padding: 28 }}>
      <MiniStats items={[['Personal activo', '24'], ['Jardineros', '15'], ['Supervisores', '4'], ['Cuadrillas', '6']]} />
      <Toolbar searchPh="Buscar personal…"><Chips items={['Todos', 'Jardineros', 'Supervisores', 'Choferes']} /></Toolbar>
      <Table cols={[{ label: 'Nombre' }, { label: 'Especialidad' }, { label: 'Teléfono' }, { label: 'Cuadrilla' }, { label: 'Estado', right: true }]}>
        {staff.map(s => (
          <TR key={s.n}>
            <NameCell name={s.n} sub={s.t} />
            <td style={{ padding: '13px 20px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: VF.ink2 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: tColor[s.t] }} /> {s.t}
              </span>
            </td>
            <TD>{s.tel}</TD>
            <TD>{s.grupo}</TD>
            <td style={{ padding: '13px 20px', textAlign: 'right' }}>
              <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: s.e === 'ACTIVO' ? VF.green50 : VF.line2, color: s.e === 'ACTIVO' ? VF.green700 : VF.ink3 }}>{s.e === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span>
            </td>
          </TR>
        ))}
      </Table>
    </div>
  );
}

// ── Grupos ──
function GruposPage() {
  const grupos = [
    { n: 'Cuadrilla Norte', sector: 'Cumbayá', miembros: ['Diego Salas', 'Marco Tipán', 'Iván Lema'], visitas: 12, color: VF.green },
    { n: 'Cuadrilla Valle', sector: 'Tumbaco', miembros: ['Luis Quishpe', 'Pedro Caiza'], visitas: 9, color: VF.sky },
    { n: 'Cuadrilla Centro', sector: 'Nayón', miembros: ['Andrés Lema', 'Saúl Toapanta'], visitas: 7, color: VF.clay },
    { n: 'Cuadrilla Sur', sector: 'Los Chillos', miembros: ['Raúl Vega', 'Carlos Ati', 'Hugo Pinto'], visitas: 6, color: 'oklch(0.55 0.1 300)' },
  ];
  return (
    <div style={{ padding: 28 }}>
      <Toolbar searchPh="Buscar cuadrilla…"><Chips items={['Todas', 'Activas']} /></Toolbar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {grupos.map(g => (
          <div key={g.n} style={{ ...pcard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 12, height: 44, borderRadius: 6, background: g.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: VF.ink }}>{g.n}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, color: VF.ink3 }}>
                  <Icon name="pin" size={13} color={VF.ink3} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.sector}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: VF.ink }}>{g.visitas}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: VF.ink3 }}>visitas/sem</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: `1px solid ${VF.line2}` }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {g.miembros.map((m, i) => (
                  <div key={m} style={{ marginLeft: i ? -10 : 0, border: '2.5px solid #fff', borderRadius: '50%' }}><Avatar name={m} size={34} /></div>
                ))}
                <span style={{ fontSize: 13, fontWeight: 700, color: VF.ink2, marginLeft: 10 }}>{g.miembros.length} miembros</span>
              </div>
              <Icon name="chevR" size={18} color={VF.ink3} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sectores ──
function SectoresPage() {
  const sectores = [
    { n: 'Cumbayá', clientes: 38, admin: 'Andrés Pérez', cuadrillas: 2 },
    { n: 'Tumbaco', clientes: 29, admin: 'María Vélez', cuadrillas: 2 },
    { n: 'Nayón', clientes: 21, admin: 'María Vélez', cuadrillas: 1 },
    { n: 'Los Chillos', clientes: 18, admin: 'Andrés Pérez', cuadrillas: 1 },
    { n: 'Samborondón', clientes: 24, admin: 'Pablo Mora', cuadrillas: 1 },
    { n: 'Quito Norte', clientes: 12, admin: 'Pablo Mora', cuadrillas: 1 },
  ];
  return (
    <div style={{ padding: 28 }}>
      <Toolbar searchPh="Buscar sector…" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {sectores.map(s => (
          <div key={s.n} style={{ ...pcard, overflow: 'hidden' }}>
            <div style={{ height: 92, position: 'relative', background: `repeating-linear-gradient(45deg, ${VF.green50}, ${VF.green50} 10px, ${VF.surface} 10px, ${VF.surface} 20px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50% 50% 50% 0', background: VF.green, transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ transform: 'rotate(45deg)', display: 'flex' }}><Icon name="pin" size={17} color="#fff" /></div>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: VF.ink }}>{s.n}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <SecMeta icon="users" label={`${s.clientes} clientes`} />
                <SecMeta icon="grid" label={`${s.cuadrillas} cuadrilla${s.cuadrillas > 1 ? 's' : ''}`} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${VF.line2}` }}>
                <Avatar name={s.admin} size={26} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>Admin: <span style={{ color: VF.ink2, fontWeight: 700 }}>{s.admin}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function SecMeta({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={15} color={VF.green700} />
      <span style={{ fontSize: 13, fontWeight: 700, color: VF.ink2 }}>{label}</span>
    </div>
  );
}

// ── Informes (web) ──
function InformesPageWeb() {
  return (
    <div style={{ padding: 28 }}>
      <Toolbar searchPh="Buscar informe o cliente…"><Chips items={['Todos', 'Este mes', 'Trimestre']} /></Toolbar>
      <Table cols={[{ label: 'Informe' }, { label: 'Cliente' }, { label: 'Período' }, { label: 'Visitas' }, { label: 'Generado' }, { label: '', right: true }]}>
        {INFORMES.map(r => (
          <TR key={r.id}>
            <td style={{ padding: '13px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 32, height: 38, borderRadius: 7, background: VF.red50, border: `1px solid oklch(0.9 0.04 25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="file" size={16} color={VF.red} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{r.titulo}</span>
              </div>
            </td>
            <TD>{r.cliente.nombre} {r.cliente.apellido}</TD>
            <TD>{r.periodo}</TD>
            <TD weight={700} color={VF.ink}>{r.visitas}</TD>
            <TD>{r.fecha}</TD>
            <td style={{ padding: '13px 20px', textAlign: 'right' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, background: VF.green50, fontSize: 12.5, fontWeight: 700, color: VF.green700, cursor: 'pointer' }}>
                <Icon name="file" size={15} color={VF.green700} /> Ver PDF
              </span>
            </td>
          </TR>
        ))}
      </Table>
    </div>
  );
}

// ── Mensajes (web, two-pane) ──
function MensajesPageWeb() {
  const [active, setActive] = useStateP('k2');
  const conv = CONVERS.find(c => c.id === active);
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* list */}
      <div style={{ width: 340, flexShrink: 0, borderRight: `1px solid ${VF.line}`, background: VF.surface, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${VF.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 13px', background: VF.bg, border: `1px solid ${VF.line}`, borderRadius: 10 }}>
            <Icon name="search" size={17} color={VF.ink3} />
            <span style={{ fontSize: 13, fontWeight: 500, color: VF.ink3 }}>Buscar conversación…</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {CONVERS.map(k => {
            const on = k.id === active;
            return (
              <div key={k.id} onClick={() => setActive(k.id)} style={{ display: 'flex', gap: 11, padding: '13px 16px', cursor: 'pointer', background: on ? VF.green50 : 'transparent', borderLeft: `3px solid ${on ? VF.green : 'transparent'}` }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar name={`${k.cliente.nombre} ${k.cliente.apellido}`} size={42} />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: statusMeta(k.estado).dot, border: '2.5px solid #fff' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: k.unread ? 800 : 700, color: VF.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.cliente.nombre} {k.cliente.apellido}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: k.unread ? VF.green : VF.ink3, flexShrink: 0 }}>{k.time}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: VF.green700, margin: '1px 0 2px' }}>{k.servicio}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: k.unread ? 600 : 500, color: k.unread ? VF.ink2 : VF.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.last}</span>
                    {k.unread > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: VF.green, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.unread}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* thread */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: VF.bg, minWidth: 0 }}>
        <div style={{ padding: '13px 22px', borderBottom: `1px solid ${VF.line}`, background: VF.surface, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={`${conv.cliente.nombre} ${conv.cliente.apellido}`} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: VF.ink }}>{conv.cliente.nombre} {conv.cliente.apellido}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{conv.servicio} · {conv.cliente.sector}</div>
          </div>
          <StatusPill estado={conv.estado} size="sm" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {THREAD.map((m, i) => {
            const prev = THREAD[i - 1];
            const showTime = !prev || prev.time.slice(0, 2) !== m.time.slice(0, 2);
            return <Bubble key={m.id} m={m} mine={m.mine} showTime={showTime} last={i === THREAD.length - 1} />;
          })}
        </div>
        <div style={{ padding: '14px 22px', background: VF.surface, borderTop: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="plus" size={21} color={VF.green700} /></div>
          <div style={{ flex: 1, height: 42, borderRadius: 12, background: VF.bg, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: VF.ink3 }}>Escribir mensaje…</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="arrowR" size={20} color="#fff" stroke={2.5} style={{ transform: 'rotate(-90deg)' }} /></div>
        </div>
      </div>
    </div>
  );
}

// ── Configuración ──
function ConfiguracionPage() {
  return (
    <div style={{ padding: 28, display: 'flex', gap: 22, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Empresa */}
        <div style={{ ...pcard, padding: 22 }}>
          <SettingHead icon="settings" title="Datos de la empresa" sub="Información visible en informes y notificaciones" />
          <div style={{ display: 'flex', gap: 16, marginTop: 18, alignItems: 'center' }}>
            <LogoMark size={64} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: VF.ink }}>Logotipo</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: VF.ink3, marginTop: 2 }}>PNG o SVG, mínimo 256×256</div>
              <span style={{ display: 'inline-block', marginTop: 8, padding: '6px 14px', borderRadius: 9, border: `1.5px solid ${VF.green100}`, fontSize: 12.5, fontWeight: 700, color: VF.green700, cursor: 'pointer' }}>Cambiar logo</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
            <Field label="Nombre comercial" value="Vivero Francisco" />
            <Field label="RUC" value="1791234567001" />
            <Field label="Teléfono" value="+593 2 289 4410" />
            <Field label="Correo" value="contacto@viverofrancisco.com" />
          </div>
        </div>
        {/* Usuarios */}
        <div style={{ ...pcard, padding: 22 }}>
          <SettingHead icon="users" title="Usuarios y permisos" sub="Quién puede acceder al panel" />
          <div style={{ marginTop: 14 }}>
            {[['Andrés Pérez', 'Administrador', VF.green], ['María Vélez', 'Admin de sector', VF.sky], ['Pablo Mora', 'Admin de sector', VF.sky], ['Lucía Ortiz', 'Staff', VF.ink2]].map(([n, r, col]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${VF.line2}` }}>
                <Avatar name={n} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{n}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{n.toLowerCase().replace(' ', '.')}@viverofrancisco.com</div>
                </div>
                <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: col === VF.ink2 ? VF.line2 : VF.green50, color: col }}>{r}</span>
              </div>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 13, fontWeight: 700, color: VF.green700, cursor: 'pointer' }}><Icon name="plus" size={16} color={VF.green700} /> Invitar usuario</span>
          </div>
        </div>
      </div>
      {/* Notificaciones */}
      <div style={{ width: 360, flexShrink: 0, ...pcard, padding: 22 }}>
        <SettingHead icon="bell" title="Notificaciones" sub="Avisos automáticos" />
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['Recordatorio de visita', 'Al cliente, 1 día antes', true], ['Confirmación de visita', 'Al completar el servicio', true], ['Resumen diario', 'A administradores, 7:00 am', true], ['Visita incompleta', 'Alerta inmediata', true], ['Mensaje entrante', 'Cuando un cliente escribe', false]].map(([t, d, on]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${VF.line2}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: VF.ink }}>{t}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: VF.ink3, marginTop: 1 }}>{d}</div>
              </div>
              <div style={{ width: 42, height: 25, borderRadius: 999, background: on ? VF.green : VF.line, position: 'relative', cursor: 'pointer', transition: 'background .15s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: 14, background: VF.green50, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="message" size={17} color={VF.green700} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: VF.green700 }}>WhatsApp conectado</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: VF.ink2, marginTop: 5, lineHeight: 1.45 }}>Las notificaciones a clientes se envían vía WhatsApp Business.</div>
        </div>
      </div>
    </div>
  );
}
function SettingHead({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={VF.green700} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: VF.ink }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{sub}</div>
      </div>
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: VF.ink3, marginBottom: 5 }}>{label}</div>
      <div style={{ height: 40, borderRadius: 10, border: `1px solid ${VF.line}`, background: VF.bg, display: 'flex', alignItems: 'center', padding: '0 13px', fontSize: 13.5, fontWeight: 600, color: VF.ink }}>{value}</div>
    </div>
  );
}

Object.assign(window, { ClientesPage, ServiciosPage, PersonalPage, GruposPage, SectoresPage, InformesPageWeb, MensajesPageWeb, ConfiguracionPage });
