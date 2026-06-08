// admin-forms.jsx — servicio/informe detail + new/edit forms
const { useState: useStateF } = React;

const fcard = { background: VF.surface, borderRadius: 16, border: `1px solid ${VF.line}` };

// ── form primitives ──
function FInput({ label, value, ph, focus, full, suffix }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', height: 42, borderRadius: 10, padding: '0 13px', background: VF.surface,
        border: `1.5px solid ${focus ? VF.green : VF.line}`, boxShadow: focus ? `0 0 0 3px ${VF.green50}` : 'none' }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: value ? VF.ink : VF.ink3 }}>{value || ph}</span>
        {focus && <span style={{ width: 1.5, height: 18, background: VF.green, marginLeft: 2 }} />}
        {suffix && <span style={{ fontSize: 13, fontWeight: 600, color: VF.ink3 }}>{suffix}</span>}
      </div>
    </div>
  );
}
function FSelect({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', height: 42, borderRadius: 10, padding: '0 13px', background: VF.surface, border: `1.5px solid ${VF.line}` }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: value ? VF.ink : VF.ink3 }}>{value}</span>
        <Icon name="chevD" size={17} color={VF.ink3} />
      </div>
    </div>
  );
}
function FArea({ label, value, ph, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink2, marginBottom: 6 }}>{label}</div>
      <div style={{ minHeight: 70, borderRadius: 10, padding: '11px 13px', background: VF.surface, border: `1.5px solid ${VF.line}`, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: value ? VF.ink2 : VF.ink3 }}>{value || ph}</div>
    </div>
  );
}
function FSection({ title, sub, children, cols = 2 }) {
  return (
    <div style={{ ...fcard, padding: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: VF.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>{children}</div>
    </div>
  );
}
function FormFooter({ saveLabel = 'Guardar', onBack }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
      <div onClick={onBack} style={{ height: 42, padding: '0 20px', borderRadius: 11, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700, color: VF.ink2, cursor: 'pointer' }}>Cancelar</div>
      <div style={{ height: 42, padding: '0 22px', borderRadius: 11, background: VF.green, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,100,55,0.28)' }}>
        <Icon name="check" size={18} color="#fff" stroke={2.5} /> {saveLabel}
      </div>
    </div>
  );
}

// ── New / edit client ──
function ClienteForm({ editData, onBack }) {
  const e = editData || {};
  return (
    <div style={{ padding: 28, maxWidth: 920 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <FSection title="Datos del cliente" sub="Información de contacto principal">
          <FInput label="Nombre" value={e.nombre || ''} ph="Ej. Carolina" focus={!editData} />
          <FInput label="Apellido" value={e.apellido || ''} ph="Ej. Andrade" />
          <FInput label="Correo electrónico" value={editData ? 'carolina@correo.com' : ''} ph="correo@ejemplo.com" />
          <FInput label="Teléfono" value={e.tel || ''} ph="09XX XXX XXX" />
        </FSection>

        <FSection title="Ubicación" sub="Dónde se realizan los servicios">
          <FSelect label="Ciudad" value="Quito" />
          <FSelect label="Sector" value={e.sector || 'Selecciona un sector'} />
          <FInput label="Dirección" value={e.dir || ''} ph="Urbanización, calle…" full />
          <FInput label="N° de casa" value={editData ? '14' : ''} ph="14" />
          <FInput label="Metros cuadrados" value={editData ? '540' : ''} ph="0" suffix="m²" />
          <FInput label="Referencia" value="" ph="Punto de referencia cercano" full />
        </FSection>

        <FSection title="Notas y preferencias" cols={1}>
          <FArea label="Notas internas" value="" ph="Indicaciones especiales, horarios preferidos, mascotas…" full />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {[['Recibir recordatorios de visita por WhatsApp', true], ['Recibir confirmaciones de servicio', true]].map(([t, on]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: VF.ink2 }}>{t}</span>
                <Toggle on={on} />
              </div>
            ))}
          </div>
        </FSection>

        <FormFooter saveLabel={editData ? 'Guardar cambios' : 'Crear cliente'} onBack={onBack} />
      </div>
    </div>
  );
}

// ── Schedule visit ──
function NuevaVisitaForm({ onBack }) {
  const [freq, setFreq] = useStateF('unica');
  return (
    <div style={{ padding: 28, maxWidth: 920 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <FSection title="Cliente y servicio" sub="Selecciona a quién y qué se va a atender">
          <FSelect label="Cliente" value="Carolina Andrade" />
          <FSelect label="Servicio contratado" value="Mantenimiento de jardín" />
        </FSection>

        <FSection title="Programación" cols={2}>
          <FInput label="Fecha" value="Martes, 10 de junio 2026" focus />
          <FInput label="Hora estimada" value="08:30" />
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink2, marginBottom: 8 }}>Frecuencia</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['unica', 'Única'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']].map(([id, l]) => (
                <div key={id} onClick={() => setFreq(id)} style={{ flex: 1, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
                  background: freq === id ? VF.green : VF.surface, color: freq === id ? '#fff' : VF.ink2, border: `1.5px solid ${freq === id ? VF.green : VF.line}` }}>{l}</div>
              ))}
            </div>
          </div>
        </FSection>

        <FSection title="Asignación" sub="Cuadrilla responsable de la visita" cols={1}>
          <FSelect label="Cuadrilla" value="Cuadrilla Norte · Cumbayá" full />
          <FArea label="Indicaciones para el equipo" value="" ph="Detalles del trabajo, herramientas necesarias…" full />
        </FSection>

        <FormFooter saveLabel="Programar visita" onBack={onBack} />
      </div>
    </div>
  );
}

// ── Servicio detail ──
function ServicioDetalleWeb({ s }) {
  const clientes = CLIENTES.slice(0, 5);
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...fcard, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 15, background: VF.green50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon || 'leaf'} size={26} color={VF.green700} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 21, fontWeight: 800, color: VF.ink, letterSpacing: '-0.02em' }}>{s.n}</div>
                <span style={{ display: 'inline-block', marginTop: 5, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.t === 'UNICO' ? VF.sky50 : VF.green50, color: s.t === 'UNICO' ? VF.sky : VF.green700 }}>{s.t === 'UNICO' ? 'ÚNICO' : 'RECURRENTE'}</span>
              </div>
            </div>
            <p style={{ margin: '18px 0 0', fontSize: 14.5, fontWeight: 500, lineHeight: 1.55, color: VF.ink2 }}>{s.d}</p>
          </div>
          <FSection title="Precio de referencia">
            <FInput label="Precio base" value={s.precio?.startsWith('$') ? s.precio.slice(1) : '0'} suffix="USD" />
            <FInput label="IVA" value="15" suffix="%" />
            <FSelect label="Facturación" value={s.t === 'UNICO' ? 'Pago único' : 'Mensual'} />
            <FInput label="Frecuencia sugerida" value={s.t === 'UNICO' ? '1' : '4'} suffix="visitas/mes" />
          </FSection>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <MiniStats items={[['Clientes', s.clientes || 64], ['Visitas/mes', '256']]} />
          <DCardBox title={`Clientes con este servicio`} pad={4}>
            {clientes.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < clientes.length - 1 ? `1px solid ${VF.line2}` : 'none' }}>
                <Avatar name={`${c.nombre} ${c.apellido}`} size={36} bg={c.color || VF.green100} color={c.color ? '#fff' : VF.green700} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: VF.ink }}>{c.nombre} {c.apellido}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{c.sector}</div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: VF.green700 }}>{s.precio}</span>
              </div>
            ))}
          </DCardBox>
        </div>
      </div>
    </div>
  );
}

// ── Informe detail (web) ──
function InformeDetalleWeb({ r }) {
  const visitas = [['6 may', 'Mantenimiento de jardín', 'Cuadrilla Norte'], ['13 may', 'Poda de setos', 'Cuadrilla Norte'], ['20 may', 'Riego y fertilización', 'Cuadrilla Norte'], ['27 may', 'Mantenimiento de jardín', 'Cuadrilla Norte']].slice(0, r.visitas);
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 22, alignItems: 'start' }}>
        {/* PDF preview */}
        <div style={{ ...fcard, overflow: 'hidden', boxShadow: '0 12px 30px rgba(20,40,30,0.1)' }}>
          <div style={{ padding: '26px 26px 22px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `2px solid ${VF.green}` }}>
              <Logo size={32} sub={false} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: VF.ink3, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>INFORME DE SERVICIO</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>#{r.id.toUpperCase()}-2026</div>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: VF.ink, letterSpacing: '-0.01em' }}>{r.titulo}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink2, marginTop: 5 }}>Cliente: {r.cliente.nombre} {r.cliente.apellido} · {r.cliente.sector}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>Período: {r.periodo}</div>
            </div>
            <div style={{ marginTop: 18 }}>
              {visitas.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${VF.line2}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: VF.ink3, width: 50, fontVariantNumeric: 'tabular-nums' }}>{v[0]}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: VF.ink }}>{v[1]}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: VF.ink3 }}>{v[2]}</span>
                  <Icon name="check" size={14} color={VF.green} stroke={3} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Stripe h={64} radius={8} label="foto" />
              <Stripe h={64} radius={8} label="foto" />
              <Stripe h={64} radius={8} label="foto" />
              <Stripe h={64} radius={8} label="foto" />
            </div>
          </div>
          <div style={{ padding: 11, background: VF.green50, textAlign: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: VF.green700 }}>Vista previa · página 1 de 3</span>
          </div>
        </div>

        {/* meta + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DCardBox title="Detalles del informe">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <DField label="Cliente" value={`${r.cliente.nombre} ${r.cliente.apellido}`} />
              <DField label="Generado" value={r.fecha} />
              <DField label="Período" value={r.periodo} />
              <DField label="Visitas incluidas" value={`${r.visitas}`} />
              <DField label="Generado por" value="Andrés Pérez" />
              <DField label="Formato" value="PDF · 3 páginas" />
            </div>
          </DCardBox>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, height: 46, borderRadius: 12, background: VF.green, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,100,55,0.28)' }}>
              <Icon name="file" size={18} color="#fff" /> Ver PDF
            </div>
            <div style={{ height: 46, padding: '0 18px', borderRadius: 12, background: VF.surface, border: `1.5px solid ${VF.green100}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: VF.green700, cursor: 'pointer' }}>
              <Icon name="nav" size={17} color={VF.green700} /> Compartir
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', cursor: 'pointer' }}>
            <Icon name="x" size={17} color={VF.red} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: VF.red }}>Eliminar informe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ClienteForm, NuevaVisitaForm, ServicioDetalleWeb, InformeDetalleWeb });
