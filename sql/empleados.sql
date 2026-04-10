-- ─── Empleados ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleados (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid    REFERENCES businesses(id) ON DELETE CASCADE,
  nombre      text    NOT NULL,
  rol         text    NOT NULL CHECK (rol IN ('admin','gerente','cajero','mesero','cocina')),
  pin         text    NOT NULL,   -- 4 dígitos numéricos
  activo      boolean DEFAULT true,
  created_at  timestamp DEFAULT now()
);

-- ─── Turnos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS turnos (
  id               uuid           DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id      uuid           REFERENCES empleados(id) ON DELETE CASCADE,
  business_id      uuid           REFERENCES businesses(id) ON DELETE CASCADE,
  entrada          timestamp      NOT NULL,
  salida           timestamp,
  horas_trabajadas decimal(5,2)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_empleados_business ON empleados(business_id);
CREATE INDEX IF NOT EXISTS idx_turnos_empleado    ON turnos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_turnos_business    ON turnos(business_id);
CREATE INDEX IF NOT EXISTS idx_turnos_entrada     ON turnos(entrada);
