// admin-detail.jsx — admin web detail/drill-down pages
const { useState: useStateD } = React;

const dcard = { background: VF.surface, borderRadius: 16, border: `1px solid ${VF.line}` };

function DCardBox({ title, action, children, pad = 18 }) {
  return (
    <div style={{ ...dcard, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${VF.line}` }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: VF.ink }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

function DField({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: VF.ink3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: value ? VF.ink : VF.ink3 }}>{value || '—'}</div>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{ width: 42, height: 25, borderRadius: 999, background: on ? VF.green : VF.line, position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );
}

// ── Cliente detail ──
function ClienteDetalleWeb({ c, onOpenVisita }) {
  const name = `${c.nombre} ${c.apellido || ''}`.trim();
  const servicios = [
    { n: c.servicios?.[0] || 'Mantenimiento de jardín', precio: '$45', freq: '4x/mes', estado: 'ACTIVO' },
    { n: c.servicios?.[1] || 'Poda de setos', precio: '$35', freq: '2x/mes', estado: 'ACTIVO' },
    { n: 'Control fitosanitario', precio: '$60', freq: '1x/mes', estado: 'PAUSADO' },
  ];
  const visitas = VISITAS.slice(0, 4).map((v, i) => ({ ...v, fecha: ['10 jun', '27 may', '13 may', '29 abr'][i] }));
  const sEstado = { ACTIVO: { l: 'Activo', bg: VF.green50, c: VF.green700 }, PAUSADO: { l: 'Pausado', bg: VF.amber50, c: 'oklch(0.50 0.13 60)' }, CANCELADO: { l: 'Cancelado', bg: VF.red50, c: VF.red } };
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 22, alignItems: 'start' }}>
        {/* Left: info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...dcard, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, borderBottom: `1px solid ${VF.line2}` }}>
              <Avatar name={name} size={60} bg={c.color || VF.green} color="#fff" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em' }}>{name}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: VF.green50, fontSize: 12, fontWeight: 700, color: VF.green700 }}>{c.sector}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 3 }}>Cliente desde 12 mar 2024</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ActionBtn icon="phone" label="Llamar" />
                <ActionBtn icon="message" label="Mensaje" primary />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
              <DField label="Correo" value={`${c.nombre.toLowerCase()}@correo.com`} />
              <DField label="Teléfono" value={c.tel || '0998 442 109'} />
              <DField label="Ciudad" value="Quito" />
              <DField label="Sector" value={c.sector} />
              <DField label="Dirección" value={c.dir || 'Urb. La Primavera'} full />
              <DField label="Metros cuadrados" value="540 m²" />
              <DField label="N° de casa" value="14" />
              <DField label="Referencia" value="Casa esquinera, portón verde" full />
              <DField label="Notas" value="Cliente prefiere visitas en la mañana. Tiene dos perros." full />
            </div>
          </div>
        </div>

        {/* Right: cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DCardBox title="Servicios" action={<span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green, cursor: 'pointer' }}>+ Asignar</span>} pad={4}>
            {servicios.map((s, i) => {
              const e = sEstado[s.estado];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < servicios.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{s.n}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 1 }}>{s.precio} · {s.freq}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: e.bg, color: e.c }}>{e.l}</span>
                </div>
              );
            })}
          </DCardBox>

          <DCardBox title="Visitas" action={<span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green, cursor: 'pointer' }}>Ver todas</span>} pad={4}>
            {visitas.map((v, i) => (
              <div key={v.id} onClick={() => onOpenVisita && onOpenVisita(v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < visitas.length - 1 ? `1px solid ${VF.line2}` : 'none', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{v.servicio}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 1 }}>{v.fecha} · {v.grupo}</div>
                </div>
                <StatusPill estado={v.estado} size="sm" />
              </div>
            ))}
          </DCardBox>

          <DCardBox title="Notificaciones WhatsApp">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink2 }}>Recordatorios de visita</span>
                <Toggle on={true} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink2 }}>Confirmaciones de visita</span>
                <Toggle on={true} />
              </div>
            </div>
          </DCardBox>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, primary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
      background: primary ? VF.green : VF.surface, color: primary ? '#fff' : VF.ink2, border: `1px solid ${primary ? VF.green : VF.line}`,
      fontSize: 13, fontWeight: 700 }}>
      <Icon name={icon} size={16} color={primary ? '#fff' : VF.ink2} /> {label}
    </div>
  );
}

// ── Visita detail (admin) ──
function VisitaDetalleWeb({ v }) {
  const c = v.cliente;
  const acts = [
    { n: 'Poda y recorte', done: true }, { n: 'Riego y revisión de aspersores', done: true },
    { n: 'Fertilización del césped', done: v.estado === 'COMPLETADA' }, { n: 'Limpieza y retiro de maleza', done: v.estado === 'COMPLETADA' },
  ];
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* hero */}
          <div style={{ ...dcard, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <StatusPill estado={v.estado} />
                <div style={{ fontSize: 24, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em', marginTop: 10 }}>{v.servicio}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: VF.ink2, marginTop: 3 }}>{c.nombre} {c.apellido} · {c.sector}</div>
              </div>
              <Avatar name={`${c.nombre} ${c.apellido}`} size={52} bg={c.color || VF.green} color="#fff" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${VF.line2}` }}>
              <DField label="Fecha programada" value="Martes, 10 de junio" />
              <DField label="Horario" value={`${v.hora} · ${v.dur}`} />
              <DField label="Cuadrilla" value={v.grupo} />
              <DField label="Dirección" value={c.dir} />
            </div>
          </div>
          {/* indicaciones */}
          <DCardBox title="Indicaciones">
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: VF.ink2 }}>
              Revisar aspersores del jardín posterior, el cliente reportó baja presión. Podar el seto del frente a 1.20 m. Retirar hojas secas del área de la piscina.
            </p>
          </DCardBox>
          {/* map */}
          <div style={{ ...dcard, overflow: 'hidden' }}>
            <div style={{ height: 180, position: 'relative', background: `repeating-linear-gradient(45deg, ${VF.green50}, ${VF.green50} 12px, ${VF.surface} 12px, ${VF.surface} 24px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50% 50% 50% 0', background: VF.green, transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(20,80,40,0.35)' }}>
                <div style={{ transform: 'rotate(45deg)', display: 'flex' }}><Icon name="pin" size={20} color="#fff" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DCardBox title="Actividades" pad={4}>
            {acts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderBottom: i < acts.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: a.done ? VF.green : 'transparent', border: a.done ? 'none' : `2px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.done && <Icon name="check" size={15} color="#fff" stroke={3} />}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: a.done ? VF.ink : VF.ink3 }}>{a.n}</span>
              </div>
            ))}
          </DCardBox>
          <DCardBox title="Evidencia fotográfica">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stripe h={96} radius={12} label="antes" />
              <Stripe h={96} radius={12} label="después" />
            </div>
          </DCardBox>
          <DCardBox title="Cronología" pad={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[['Programada', '5 jun, 14:20', true], ['Asignada a Cuadrilla Norte', '5 jun, 14:21', true], ['En curso', 'Hoy, 10:32', true], ['Completada', '—', v.estado === 'COMPLETADA']].map(([t, d, done], i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: done ? VF.green : VF.line, border: done ? 'none' : `2px solid ${VF.line}`, marginTop: 3 }} />
                    {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: VF.line2, minHeight: 22 }} />}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: done ? VF.ink : VF.ink3 }}>{t}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: VF.ink3 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </DCardBox>
        </div>
      </div>
    </div>
  );
}

// ── Personal detail ──
function PersonalDetalle({ p }) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ ...dcard, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, borderBottom: `1px solid ${VF.line2}` }}>
            <Avatar name={p.n} size={60} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: VF.ink }}>{p.n}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: VF.green700, marginTop: 2 }}>{p.t}</div>
            </div>
            <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: p.e === 'INACTIVO' ? VF.line2 : VF.green50, color: p.e === 'INACTIVO' ? VF.ink3 : VF.green700 }}>{p.e === 'INACTIVO' ? 'Inactivo' : 'Activo'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
            <DField label="Teléfono" value={p.tel} />
            <DField label="Especialidad" value={p.t} />
            <DField label="Cuadrilla" value={p.grupo} />
            <DField label="Sueldo" value="$620 / mes" />
            <DField label="Ingreso" value="3 ene 2023" />
            <DField label="Cédula" value="1718829940" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <MiniStats items={[['Visitas del mes', '38'], ['Completadas', '35'], ['Cumplimiento', '92%']]} />
          <DCardBox title="Próximas visitas" pad={4}>
            {VISITAS.slice(0, 3).map((v, i) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i < 2 ? `1px solid ${VF.line2}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{v.cliente.nombre} {v.cliente.apellido}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{v.servicio} · {v.hora}</div>
                </div>
                <StatusPill estado={v.estado} size="sm" />
              </div>
            ))}
          </DCardBox>
        </div>
      </div>
    </div>
  );
}

// ── Grupo detail ──
function GrupoDetalle({ g }) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...dcard, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 14, height: 50, borderRadius: 7, background: g.color || VF.green }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: VF.ink }}>{g.n}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, color: VF.ink3 }}>
                  <Icon name="pin" size={14} color={VF.ink3} /><span style={{ fontSize: 13, fontWeight: 600 }}>{g.sector}</span>
                </div>
              </div>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 14, fontWeight: 500, color: VF.ink2, lineHeight: 1.5 }}>
              Cuadrilla responsable del mantenimiento de jardines y áreas verdes en el sector {g.sector}.
            </p>
          </div>
          <MiniStats items={[['Miembros', g.miembros.length], ['Visitas/sem', g.visitas], ['Clientes', '18']]} />
        </div>
        <DCardBox title="Miembros" action={<span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green, cursor: 'pointer' }}>+ Añadir</span>} pad={4}>
          {g.miembros.map((m, i) => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < g.miembros.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
              <Avatar name={m} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{m}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{i === 0 ? 'Supervisor' : 'Jardinero'}</div>
              </div>
              <Icon name="phone" size={17} color={VF.green700} />
            </div>
          ))}
        </DCardBox>
      </div>
    </div>
  );
}

// ── Sector detail ──
function SectorDetalle({ s }) {
  const clientes = CLIENTES.filter(c => c.sector === s.n).concat(CLIENTES.slice(0, 2));
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...dcard, overflow: 'hidden' }}>
            <div style={{ height: 150, position: 'relative', background: `repeating-linear-gradient(45deg, ${VF.green50}, ${VF.green50} 12px, ${VF.surface} 12px, ${VF.surface} 24px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 0', background: VF.green, transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ transform: 'rotate(45deg)', display: 'flex' }}><Icon name="pin" size={18} color="#fff" /></div>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: VF.ink }}>{s.n}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Avatar name={s.admin} size={30} />
                <span style={{ fontSize: 13, fontWeight: 600, color: VF.ink3 }}>Admin: <span style={{ color: VF.ink2, fontWeight: 700 }}>{s.admin}</span></span>
              </div>
            </div>
          </div>
          <MiniStats items={[['Clientes', s.clientes], ['Cuadrillas', s.cuadrillas]]} />
        </div>
        <DCardBox title={`Clientes en ${s.n}`} pad={4}>
          {clientes.slice(0, 6).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < 5 ? `1px solid ${VF.line2}` : 'none' }}>
              <Avatar name={`${c.nombre} ${c.apellido}`} size={38} bg={c.color || VF.green100} color={c.color ? '#fff' : VF.green700} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{c.nombre} {c.apellido}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{c.servicios.length} servicios</div>
              </div>
              <Icon name="chevR" size={17} color={VF.ink3} />
            </div>
          ))}
        </DCardBox>
      </div>
    </div>
  );
}

Object.assign(window, { ClienteDetalleWeb, VisitaDetalleWeb, PersonalDetalle, GrupoDetalle, SectorDetalle });
