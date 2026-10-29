# Guía de Pruebas Transversales y Calidad de Código (DeUna)

Este documento explica de forma clara y sencilla cómo se diseñaron, configuraron y ejecutaron las pruebas transversales de punta a punta y la revisión de calidad de código en la aplicación **DeUna**.

---

## 1. ¿Qué se probó?

Se probó el comportamiento integral del sistema simulando peticiones HTTP reales de clientes y verificando que los datos viajen correctamente a través de todas las capas de la aplicación:
**Petición HTTP → Rutas de Express → Controladores / Servicios → Base de Datos (MongoDB) → Respuesta HTTP**.

El objetivo principal es asegurar que los procesos que involucran varias entidades al mismo tiempo (como mover dinero o recargar saldo) cumplan estrictamente las reglas del negocio, sin dejar datos a medias ni inconsistencias ante errores.

---

## 2. Herramientas usadas

| Herramienta | ¿Qué hace? |
| :--- | :--- |
| **Jest** | Es el motor que ejecuta las pruebas automatizadas, evalúa las afirmaciones (`expect`) y reporta si pasaron o fallaron. |
| **Supertest** | Permite hacer peticiones HTTP simuladas (GET, POST, etc.) directamente a nuestra aplicación de Express sin necesidad de levantar el servidor manualmente en un puerto. |
| **ESLint** | Es una herramienta de análisis estático que revisa nuestro código fuente para detectar errores de sintaxis, variables sin usar y asegurar buenas prácticas de programación. |

---

## 3. Entidades y Reglas de Negocio Encontradas

### Entidades del Sistema

* **Clientes (`clientes`)**: Almacena los datos personales de los usuarios registrados (ID numérico, nombre, correo electrónico y teléfono).
* **Cuentas (`cuentas`)**: Representa las cuentas bancarias asociadas a un cliente (número de cuenta, alias, banco, saldo disponible y estado `ACTIVA` o `BLOQUEADA`).
* **Tarjetas (`tarjetas`)**: Tarjetas de débito o crédito vinculadas al cliente (ID, ID del cliente titular, 16 dígitos, banco emisor y fecha de expiración `MM/AA`).
* **Transacciones (`transacciones`)**: Registro histórico y de auditoría de todas las operaciones realizadas (quién operó, origen, destino, monto, comisión, fecha ISO, IP del cliente, estado `CONFIRMADA` o `FALLIDA` y motivo).

### Reglas de Negocio del Código

1. **Transferencia entre cuentas (`/api/deuna/transferencia`)**:
   - Requiere cuenta origen activa y cuenta destino existente.
   - Si la cuenta origen está en estado `BLOQUEADA`, se rechaza la operación.
   - Aplica comisión de `$0.40` si los bancos de origen y destino son diferentes; comisión `$0.00` si pertenecen al mismo banco.
   - Debe existir saldo suficiente para cubrir el `monto + comisión`.
   - Si no alcanza el saldo, no se descuenta dinero y se registra una transacción con estado `FALLIDA` y motivo `'Saldo insuficiente'`.
   - Si es exitosa, descuenta de la cuenta origen, abona a la cuenta destino y registra una transacción `CONFIRMADA`.

2. **Recarga de cuenta con tarjeta (`/api/deuna/recarga`)**:
   - La tarjeta utilizada debe pertenecer obligatoriamente al mismo cliente titular de la cuenta destino.
   - La tarjeta debe estar vigente (no expirada según su fecha `MM/AA`).
   - Si la tarjeta está vencida, no se suma saldo a la cuenta y se guarda una transacción `FALLIDA` con motivo `'Tarjeta expirada'`.
   - Si la recarga es válida, se incrementa el saldo de la cuenta y se genera el registro `CONFIRMADA`.

3. **Integridad referencial y validaciones CRUD**:
   - No se permite eliminar un cliente si mantiene cuentas o tarjetas asociadas.
   - Validación de formato en números de teléfono (10 dígitos), tarjetas (16 dígitos) y vigencias (`MM/AA`).
   - Paginación del lado del servidor de 6 en 6 registros para clientes y tarjetas.

---

## 4. Pruebas Transversales Realizadas

Se implementaron pruebas de punta a punta organizadas en el directorio `tests/transversales/`:

### Regla 1: Transferencia de Dinero entre Cuentas
**Archivo:** `tests/transversales/transferencia.test.js`

* **Entidades que recorre:** `cuentas` (origen y destino), `clientes` (titular) y `transacciones` (auditoría).
* **Paso a paso de la prueba:**
  1. Se preparan en la base de datos dos clientes y dos cuentas activas de diferentes bancos con saldo inicial conocido.
  2. Mediante Supertest se envía una petición `POST /api/deuna/transferencia` con los números de cuenta y el monto.
  3. El sistema valida la cuenta origen, la cuenta destino y calcula la comisión interbancaria ($0.40).
  4. En el caso exitoso: descuenta `monto + comisión` en la cuenta origen y suma `monto` a la cuenta destino.
  5. Se inserta el comprobante en la colección `transacciones`.
  6. La prueba consulta directamente la base de datos para certificar que ambos saldos y la transacción quedaron exactamente como se esperaba.
* **Resultados esperados:**
  - **Camino Exitoso:** Respuesta HTTP 200 con `ok: true`. El saldo de origen disminuye en `monto + 0.40`, el saldo de destino aumenta en `monto`, y existe un registro `CONFIRMADA` con el nombre del titular.
  - **Casos de Error Probados:**
    - *Saldo insuficiente:* Respuesta HTTP 400. Ninguno de los dos saldos cambia en la base de datos y se registra una transacción `FALLIDA` con motivo `'Saldo insuficiente'`.
    - *Cuenta origen bloqueada:* Respuesta HTTP 400 informando `'La cuenta origen está bloqueada'`, sin alterar ningún saldo.
    - *Cuenta destino inexistente:* Respuesta HTTP 400 informando `'Cuenta destino no encontrada'`, sin debitar dinero de origen.

---

### Regla 2: Recarga de Saldo con Tarjeta
**Archivo:** `tests/transversales/recarga.test.js`

* **Entidades que recorre:** `tarjetas` (medio de pago), `cuentas` (cuenta de destino), `clientes` (titular) y `transacciones` (auditoría).
* **Paso a paso de la prueba:**
  1. Se crean en la base de datos un cliente titular con una cuenta y dos tarjetas (una vigente y una expirada), además de un segundo cliente ajeno con su propia tarjeta.
  2. Mediante Supertest se envía `POST /api/deuna/recarga` indicando la cuenta, la tarjeta y el monto.
  3. El sistema busca la cuenta y verifica que la tarjeta pertenezca al titular de dicha cuenta (`cliente_id`).
  4. Valida si la fecha de expiración de la tarjeta sigue vigente frente a la fecha actual.
  5. En el caso exitoso: incrementa el saldo de la cuenta receptora y genera la transacción en MongoDB.
  6. La prueba lee directamente de MongoDB para confirmar la actualización del saldo y el registro histórico.
* **Resultados esperados:**
  - **Camino Exitoso:** Respuesta HTTP 200 con `ok: true`. El saldo de la cuenta aumenta exactamente en el valor recargado y se crea una transacción `CONFIRMADA` de tipo `'recarga'`.
  - **Casos de Error Probados:**
    - *Tarjeta expirada:* Respuesta HTTP 400 con error `'Tarjeta expirada'`. El saldo de la cuenta queda intacto y se registra una transacción `FALLIDA` con motivo `'Tarjeta expirada'`.
    - *Tarjeta ajena (otro cliente):* Respuesta HTTP 400 con error `'Tarjeta no encontrada o no pertenece al cliente de la cuenta'`. El saldo no sufre ninguna modificación.

---

## 5. Revisión con ESLint

* **¿Qué revisa?** Sintaxis de ECMAScript Modules (ESM), variables declaradas sin utilizar, variables globales de Node.js y globals de Jest en el entorno de pruebas.
* **Configuración aplicada (`eslint.config.js`):**
  - Configuración plana (Flat Config) moderna compatible con ESLint v9/v10.
  - Entornos configurados: Node.js, ES2024 y plugin de Jest para los archivos dentro de `tests/`.
  - Ignora carpetas de dependencias y reportes (`node_modules/`, `.scannerwork/`, `public/`).
* **Problemas encontrados y correcciones:**
  - El proyecto base se encontraba limpio de errores de sintaxis críticos.
  - Se configuró la tolerancia para argumentos descartados que inicien con guión bajo (`_req`, `_`) en `no-unused-vars`.
  - Se añadió la exportación condicional limpia en `server.js` (`startApp` solo cuando `NODE_ENV !== 'test'`) para permitir pruebas con Supertest sin dejar puertos bloqueados ni conexiones huérfanas.
  - No hubo necesidad de alterar la lógica interna del negocio.

---

## 6. Cómo ejecutar todo

Asegúrate de contar con tus dependencias instaladas (`npm install`).

### 1. Ejecutar las Pruebas Transversales (Jest + Supertest)
```bash
npm test
```
> Ejecuta la suite de pruebas transversales de Jest (`tests/transversales/`) comunicándose con MongoDB y validando las respuestas de Supertest.

### 2. Ejecutar la Verificación de Calidad de Código (ESLint)
```bash
npm run lint
```
> Analiza todos los archivos JavaScript del proyecto para garantizar que no existan errores de código o linter.

### 3. Ejecutar las Pruebas Unitarias / CRUD previas (Nativas de Node.js)
```bash
npm run test:native
```
> Conserva intactas las 31 pruebas unitarias y CRUD existentes en la carpeta `test/`.

---

## 7. Resultados Obtenidos

### Resumen de Ejecución de Pruebas

| Suite de Pruebas | Archivo | Pruebas | Estado |
| :--- | :--- | :---: | :---: |
| **Transferencias** | `tests/transversales/transferencia.test.js` | 4 / 4 | ✅ PASÓ |
| **Recargas** | `tests/transversales/recarga.test.js` | 3 / 3 | ✅ PASÓ |
| **Total Transversales** | **2 Suites** | **7 / 7** | **100% Exitoso** |
| **Pruebas Nativas Previas** | `test/**/*.test.js` | 31 / 31 | ✅ PASÓ |
| **Revisión ESLint** | Todo el proyecto | 0 Errores | ✅ LIMPIO |

### Observaciones Finales

1. **Aislamiento y limpieza de datos:** Cada prueba utiliza identificadores y prefijos aislados (`TEST-CTA-...`, `TEST-CARD-...`, IDs `901+`), limpiando antes (`beforeEach`) y después (`afterEach`) de cada ejecución para no alterar los datos semilla predeterminados del sistema.
2. **Sin cambios disruptivos en producción:** `server.js` únicamente adaptó la invocación a `startApp()` condicionada a `NODE_ENV !== 'test'` para que Supertest pueda consumir la app de Express sin generar conflictos de puerto. La lógica de negocio permaneció 100% fiel a la implementación original.
