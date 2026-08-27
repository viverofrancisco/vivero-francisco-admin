-- Separar "lo usaron" de "lo dimos de baja".
--
-- Hasta ahora las dos cosas marcaban `usedAt`, así que a quien abría un enlace
-- anulado —porque se emitió uno más nuevo o porque se le revocó el acceso— la
-- página le decía "este enlace ya se usó", que es falso y lo manda a
-- preguntarse quién entró con él.
--
-- Los que ya están marcados se quedan como `usedAt`: no hay forma de saber
-- cuáles fueron cuáles, y suponer que se usaron es la lectura más conservadora.
ALTER TABLE "SetPasswordToken" ADD COLUMN "anuladoEl" TIMESTAMP(3);
