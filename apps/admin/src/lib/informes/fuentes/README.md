# Fuentes del informe

Las familias que el PDF puede imprimir además de las tres estándar (Helvetica,
Times y Courier, que `@react-pdf/renderer` trae adentro). Cada carpeta lleva
las cuatro caras que hacen falta —normal, negrita, cursiva y negrita cursiva—
y la licencia con que se redistribuye (todas OFL, de Google Fonts).

Se bajaron del servidor de Google Fonts pidiendo las caras estáticas
(`fonts.googleapis.com/css2?family=…:ital,wght@0,400;0,700;1,400;1,700` con un
`User-Agent` viejo, que es lo que hace que conteste TTF y no WOFF2 por rangos).
El repositorio `google/fonts` tiene casi todas como fuente variable, que
`fontkit` no lee.

`fuentes.ts` las registra en react-pdf antes de cada render, por ruta absoluta:
por eso la carpeta entera está en `outputFileTracingIncludes` de `next.config.ts`,
como la libvips de `sharp` — el rastreo no ve archivos que se abren por ruta.
