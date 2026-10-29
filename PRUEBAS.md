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

Las pruebas transversales de punta a punta están organizadas en `tests/transversales/`. Se complementan con cuatro suites CRUD, una por cada entidad, en `tests/entidades/`.

### Suites CRUD por entidad

| Entidad | Archivo | Cobertura principal |
|---|---|---|
| Clientes | `tests/entidades/cliente_crud.test.js` | Crear, consultar, actualizar, eliminar, validar integridad referencial y paginar. |
| Cuentas | `tests/entidades/cuentas_crud.test.js` | CRUD HTTP con Supertest y comprobación de cuenta por ID o número. |
| Tarjetas | `tests/entidades/tarjeta_crud.test.js` | CRUD, validaciones de formato, titular y paginación. |
| Transacciones | `tests/entidades/transaccion_crud.test.js` | Crear, consultar por ID/ObjectId, actualizar y eliminar. |

Cada uno de estos archivos cuenta como una suite de Jest.

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
  - El archivo de preparación usaba sintaxis ESM, pero Jest lo cargaba como CommonJS. Se cambió a CommonJS (`tests/setupEnv.cjs`) para evitar ese error.
  - En Node.js 22, Jest necesita ejecutarse con `--experimental-vm-modules` para cargar los archivos ESM del proyecto.
  - Las consultas de cuentas buscan primero el número de cuenta exacto y luego el ID numérico; así los números de cuenta con ceros iniciales no se interpretan erróneamente como IDs.

---

## 6. Cómo ejecutar todo

Asegúrate de contar con tus dependencias instaladas (`npm install`).

### 1. Ejecutar las seis suites de Jest
```bash
npm test
```
> Ejecuta cuatro suites CRUD (clientes, cuentas, tarjetas y transacciones) y dos suites de reglas de negocio (transferencias y recargas).

Para generar el reporte de cobertura:
```bash
npm test -- --coverage
```

También se puede ejecutar Jest directamente en Node.js 22 habilitando sus módulos ESM:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --coverage
```
> Ejecutar `npx jest --coverage` sin la opción ESM puede fallar antes de iniciar las pruebas. Ambas formas requieren MongoDB accesible y cargan la base de pruebas `deuna_test_db` desde `.env.test`.

### 2. Ejecutar la Verificación de Calidad de Código (ESLint)
```bash
npm run lint
```
> Analiza todos los archivos JavaScript del proyecto para garantizar que no existan errores de código o linter.

### 3. Ejecutar las Pruebas Unitarias / CRUD previas (Nativas de Node.js)
```bash
npm run test:native
```
> Ejecuta las pruebas restantes que usan `node:test` en `test/`. Las seis suites descritas en esta guía ahora se ejecutan con Jest.

---

## 7. Resultados Obtenidos

### Resumen de Ejecución de Pruebas

| Suite de Pruebas | Archivo | Pruebas | Estado |
| :--- | :--- | :---: | :---: |
| **Clientes** | `tests/entidades/cliente_crud.test.js` | 8 | ✅ PASÓ |
| **Cuentas** | `tests/entidades/cuentas_crud.test.js` | 9 | ✅ PASÓ |
| **Tarjetas** | `tests/entidades/tarjeta_crud.test.js` | 7 | ✅ PASÓ |
| **Transacciones** | `tests/entidades/transaccion_crud.test.js` | 4 | ✅ PASÓ |
| **Transferencias** | `tests/transversales/transferencia.test.js` | 4 | ✅ PASÓ |
| **Recargas** | `tests/transversales/recarga.test.js` | 3 | ✅ PASÓ |
| **Total Jest** | **6 suites** | **35 / 35** | **✅ PASÓ** |

### Observaciones Finales

1. **Aislamiento y limpieza de datos:** Las suites preparan y eliminan fixtures con IDs y prefijos dedicados para evitar depender de datos semilla y no alterar las colecciones habituales.
2. **Cobertura del comando:** `npx jest --coverage` debe ejecutarse con `NODE_OPTIONS=--experimental-vm-modules` en Node.js 22; `npm test -- --coverage` ya activa esa opción mediante el script existente.
