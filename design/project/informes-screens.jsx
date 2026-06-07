// informes-screens.jsx — reports: list, generate wizard, detail/preview
const { useState: useStateI } = React;

// ── Lista ──
function InformesLista({ go }) {
  return (
    <Screen>
      <AppBar big title="Informes" sub="Reportes de servicio en PDF" right={
        <div style={{ width: 40, height: 40, borderRadius: 12, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Icon name="filter" size={19} color={VF.ink} />
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 999, background: VF.green, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>1</span>
        </div>
      } />
      <div style={{ padding: '14px 18px 0' }}>
        {/* active filter strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: VF.green50, borderRadius: 11, marginBottom: 16 }}>
          <Icon name="filter" size={15} color={VF.green700} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: VF.green700 }}>Carolina Andrade · mayo 2026</span>
          <Icon name="x" size={15} color={VF.green700} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INFORMES.map(r => (
            <div key={r.id} {...tap(() => go('detalle', r))} style={{ ...card, padding: 15, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
              <div style={{ width: 46, height: 56, borderRadius: 9, background: VF.red50, border: `1px solid oklch(0.9 0.04 25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                <Icon name="file" size={20} color={VF.red} />
                <span style={{ fontSize: 8, fontWeight: 800, color: VF.red, marginTop: 2, letterSpacing: '0.03em' }}>PDF</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: VF.ink, letterSpacing: '-0.01em' }}>{r.titulo}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: VF.green700, marginTop: 2 }}>{r.cliente.nombre} {r.cliente.apellido}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, color: VF.ink3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.fecha}</span>
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: VF.ink3 }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.visitas} visitas</span>
                </div>
              </div>
              <Icon name="chevR" size={18} color={VF.ink3} />
            </div>
          ))}
        </div>
      </div>
      {/* FAB */}
      <div {...tap(() => go('generar'))} style={{ position: 'absolute', right: 20, bottom: 96, zIndex: 38, height: 54, padding: '0 22px 0 18px', borderRadius: 18, background: VF.green, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', boxShadow: '0 10px 24px rgba(30,100,55,0.4)' }}>
        <Icon name="plus" size={22} color="#fff" stroke={2.5} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Generar</span>
      </div>
    </Screen>
  );
}

// ── Generar wizard ──
function InformesGenerar({ back, onDone }) {
  const [cliente, setCliente] = useStateI(CLIENTES[0]);
  const [picked, setPicked] = useStateI({ v1: true, v2: true, v3: true, v4: false });
  const visitas = [
    { id: 'v1', s: 'Mantenimiento de jardín', d: '6 may', dur: '1h 30m' },
    { id: 'v2', s: 'Poda de setos', d: '13 may', dur: '1h' },
    { id: 'v3', s: 'Riego y fertilización', d: '20 may', dur: '45m' },
    { id: 'v4', s: 'Mantenimiento de jardín', d: '27 may', dur: '1h 30m' },
  ];
  const count = Object.values(picked).filter(Boolean).length;
  return (
    <Screen>
      <AppBar title="Generar informe" sub="Paso 1 de 1" onBack={back} />
      <div style={{ padding: '16px 18px 0' }}>
        {/* Cliente */}
        <SectionLabel>Cliente</SectionLabel>
        <div style={{ ...card, padding: '13px 15px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <Avatar name={`${cliente.nombre} ${cliente.apellido}`} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: VF.ink }}>{cliente.nombre} {cliente.apellido}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{cliente.sector}</div>
          </div>
          <Icon name="chevD" size={18} color={VF.ink3} />
        </div>

        {/* Período */}
        <SectionLabel>Período</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          {[['Desde', '1 may 2026'], ['Hasta', '31 may 2026']].map(([l, v]) => (
            <div key={l} style={{ ...card, padding: '11px 14px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: VF.ink3, letterSpacing: '0.04em' }}>{l.toUpperCase()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <Icon name="calendar" size={16} color={VF.green700} />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: VF.ink }}>{v}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['Este mes', 'Mes pasado', 'Trimestre'].map((q, i) => (
            <span key={q} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: i === 0 ? VF.green50 : VF.surface, color: i === 0 ? VF.green700 : VF.ink3, border: `1px solid ${i === 0 ? VF.green100 : VF.line}` }}>{q}</span>
          ))}
        </div>

        {/* Visitas */}
        <SectionLabel right={<span style={{ fontSize: 12.5, fontWeight: 800, color: VF.green }}>{count} de {visitas.length}</span>}>Visitas a incluir</SectionLabel>
        <div style={{ ...card, padding: 4, marginBottom: 22 }}>
          {visitas.map((v, i) => {
            const on = picked[v.id];
            return (
              <div key={v.id} {...tap(() => setPicked({ ...picked, [v.id]: !on }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderBottom: i < visitas.length - 1 ? `1px solid ${VF.line2}` : 'none', cursor: 'pointer' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: on ? VF.green : 'transparent', border: on ? 'none' : `2px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Icon name="check" size={15} color="#fff" stroke={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: VF.ink }}>{v.s}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: VF.ink3 }}>{v.d} · {v.dur}</div>
                </div>
                <StatusPill estado="COMPLETADA" size="sm" />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px 30px', background: 'linear-gradient(to top, #fff 62%, rgba(255,255,255,0))', zIndex: 35 }}>
        <BigButton label={`Generar PDF · ${count} visitas`} icon="file" onClick={onDone} />
      </div>
    </Screen>
  );
}

// ── Detalle / preview ──
function InformesDetalle({ r, back }) {
  return (
    <Screen>
      <AppBar title="Informe" onBack={back} right={
        <div style={{ width: 40, height: 40, borderRadius: 12, background: VF.surface, border: `1px solid ${VF.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="more" size={20} color={VF.ink} />
        </div>
      } />
      <div style={{ padding: '16px 18px 0' }}>
        {/* PDF preview */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 18, boxShadow: '0 12px 30px rgba(20,40,30,0.1)' }}>
          <div style={{ padding: '22px 22px 20px', background: '#fff' }}>
            {/* report header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `2px solid ${VF.green}` }}>
              <Logo size={30} sub={false} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: VF.ink3, letterSpacing: '0.08em' }}>INFORME</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>#{r.id.toUpperCase()}-2026</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: VF.ink, letterSpacing: '-0.01em' }}>{r.titulo}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink2, marginTop: 4 }}>Cliente: {r.cliente.nombre} {r.cliente.apellido} · {r.cliente.sector}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: VF.ink3, marginTop: 2 }}>Período: {r.periodo}</div>
            </div>
            {/* mini visit rows */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[['6 may', 'Mantenimiento de jardín'], ['13 may', 'Poda de setos'], ['20 may', 'Riego y fertilización'], ['27 may', 'Mantenimiento de jardín']].slice(0, r.visitas).map(([d, s], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${VF.line2}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: VF.ink3, width: 44, fontVariantNumeric: 'tabular-nums' }}>{d}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: VF.ink }}>{s}</span>
                  <Icon name="check" size={13} color={VF.green} stroke={3} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
              <Stripe h={54} radius={8} label="foto" />
              <Stripe h={54} radius={8} label="foto" />
              <Stripe h={54} radius={8} label="foto" />
            </div>
          </div>
          <div style={{ padding: '10px', background: VF.green50, textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: VF.green700 }}>Vista previa · página 1 de 3</span>
          </div>
        </div>

        {/* meta */}
        <div style={{ ...card, padding: 4, marginBottom: 18 }}>
          <InfoRow icon="calendar" label="Generado" value={r.fecha} />
          <InfoRow icon="clock" label="Período" value={r.periodo} />
          <InfoRow icon="check" label="Visitas incluidas" value={`${r.visitas}`} last />
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><BigButton label="Ver PDF" icon="file" onClick={() => {}} /></div>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: VF.surface, border: `1.5px solid ${VF.green100}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="nav" size={22} color={VF.green700} />
          </div>
        </div>
        <div {...tap(() => {})} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', cursor: 'pointer' }}>
          <Icon name="x" size={18} color={VF.red} />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: VF.red }}>Eliminar informe</span>
        </div>
      </div>
    </Screen>
  );
}

// ── Shell ──
function InformesShell({ start = 'lista' }) {
  const [stack, setStack] = useStateI(start === 'lista' ? [] : [{ screen: start, r: INFORMES[0] }]);
  const top = stack[stack.length - 1];
  const go = (screen, r) => setStack([...stack, { screen, r }]);
  const back = () => setStack(stack.slice(0, -1));
  let content;
  if (top && top.screen === 'detalle') content = <InformesDetalle r={top.r} back={back} />;
  else if (top && top.screen === 'generar') content = <InformesGenerar back={back} onDone={back} />;
  else content = <InformesLista go={go} />;
  return (
    <IOSDevice>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div style={{ height: '100%', overflowY: 'auto' }}>{content}</div>
        {!top && <TabBar active="informes" onChange={() => {}} />}
      </div>
    </IOSDevice>
  );
}

Object.assign(window, { InformesLista, InformesGenerar, InformesDetalle, InformesShell });
