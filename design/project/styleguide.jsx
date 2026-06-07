// styleguide.jsx — design system overview + rationale
function Swatch({ c, name, hex }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ height: 56, borderRadius: 12, background: c, border: `1px solid rgba(0,0,0,0.06)` }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: VF.ink }}>{name}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: VF.ink3, fontFamily: 'ui-monospace, monospace' }}>{hex}</div>
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: VF.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function StyleGuide() {
  return (
    <div style={{ width: 880, background: VF.surface, borderRadius: 22, border: `1px solid ${VF.line}`, padding: 36, fontFamily: VF.font, color: VF.ink, display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 28, borderBottom: `1px solid ${VF.line}` }}>
        <div>
          <Logo size={48} />
          <p style={{ margin: '20px 0 0', fontSize: 15, fontWeight: 500, lineHeight: 1.6, color: VF.ink2, maxWidth: 560 }}>
            A refreshed identity for the field-service platform. The system keeps the brand's <strong style={{ color: VF.green700, fontWeight: 700 }}>botanical green</strong> but makes it richer and more confident, pairs it with warm neutrals and a single, highly legible typeface, and prioritizes <strong style={{ color: VF.ink, fontWeight: 700 }}>usability</strong> — large touch targets, high contrast for outdoor sun, and clear status at a glance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <LogoMark size={56} />
          <LogoMark size={56} bg={VF.greenDeep} />
          <LogoMark size={56} bg="#fff" leaf={VF.green} />
        </div>
      </div>

      {/* colors */}
      <Block title="Paleta">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
          <Swatch c={VF.green} name="Verde" hex="primary" />
          <Swatch c={VF.greenDeep} name="Verde profundo" hex="headers" />
          <Swatch c={VF.green50} name="Verde tinte" hex="surfaces" />
          <Swatch c={VF.clay} name="Terracota" hex="accent" />
          <Swatch c={VF.amber} name="Ámbar" hex="atención" />
          <Swatch c={VF.ink} name="Tinta" hex="texto" />
        </div>
      </Block>

      {/* type + components */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <Block title="Tipografía · Hanken Grotesk">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: VF.ink }}>Aa Visitas hoy</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: VF.ink, letterSpacing: '-0.01em' }}>Mantenimiento de jardín</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: VF.ink2 }}>Cuerpo de texto · 142 clientes activos en seis sectores.</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: VF.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>Etiqueta · sección</div>
          </div>
        </Block>
        <Block title="Componentes">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ height: 44, padding: '0 20px', borderRadius: 13, background: VF.green, color: '#fff', display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 800 }}>
              <Icon name="check" size={18} color="#fff" stroke={2.5} /> Completar
            </div>
            <div style={{ height: 44, padding: '0 20px', borderRadius: 13, background: VF.surface, color: VF.green700, border: `1.5px solid ${VF.green100}`, display: 'flex', alignItems: 'center', fontSize: 14.5, fontWeight: 800 }}>Cancelar</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <StatusPill estado="PROGRAMADA" /><StatusPill estado="EN_CURSO" /><StatusPill estado="COMPLETADA" /><StatusPill estado="INCOMPLETA" />
          </div>
        </Block>
      </div>

      {/* principles */}
      <Block title="Principios de diseño">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['pin', 'Hecho para el campo', 'Botones grandes, alto contraste y estados claros para usar bajo el sol y con guantes.'],
            ['clock', 'Una tarea a la vez', 'Cada pantalla guía la siguiente acción: llegar, ejecutar, registrar, firmar.'],
            ['layers', 'Un solo lenguaje', 'Web y móvil comparten color, tipografía y componentes para una experiencia coherente.'],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ background: VF.green50, borderRadius: 16, padding: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: VF.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon name={ic} size={19} color={VF.green700} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: VF.ink, marginBottom: 5 }}>{t}</div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: VF.ink2 }}>{d}</div>
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}

Object.assign(window, { StyleGuide });
