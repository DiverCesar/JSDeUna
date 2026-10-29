# JSDeUna

Aplicación web para simular operaciones bancarias inmediatas. El backend está construido con Node.js, Express y MongoDB; el frontend utiliza Vue 3 y Tailwind CSS.

## Contenido

- [Funcionalidades](#funcionalidades)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación y configuración](#instalación-y-configuración)
- [Ejecución](#ejecución)
- [API REST](#api-rest)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Estructura del proyecto](#estructura-del-proyecto)

## Funcionalidades

- CRUD REST para Clientes, Cuentas, Tarjetas y Transacciones.
- Paginación de Clientes y Tarjetas (6 registros por defecto).
- Transferencias entre cuentas con comisión interbancaria y validación de saldo.
- Recargas de cuentas con tarjeta y validación de vigencia y titularidad.
- Historial de transacciones confirmadas y fallidas.
- Datos semilla para iniciar la aplicación con información de ejemplo.

## Tecnologías

- Node.js (el proyecto declara Node.js 22+).
- Express 4.
- MongoDB y el driver oficial `mongodb`.
- Vue 3 y Tailwind CSS desde CDN.
- Jest para las suites CRUD y transversales; Supertest para las solicitudes HTTP de integración.
- `node:test` para las pruebas nativas que permanecen en `test/`.
- ESLint para análisis estático.

## Requisitos

- Node.js 22 o superior.
- npm.
- MongoDB local o una URL válida de MongoDB Atlas accesible desde la máquina.

## Instalación y configuración

Instala dependencias:

```bash
npm install
```

Crea el archivo local de variables de entorno:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configura `.env` según la conexión de MongoDB que vayas a utilizar:

| Variable | Uso | Valor de ejemplo |
|---|---|---|
| `PORT` | Puerto HTTP de la aplicación | `3000` |
| `MONGO_URI` | URI de conexión a MongoDB | `mongodb://localhost:27017/` |
| `DB_NAME` | Nombre de la base de datos de la aplicación | `deuna_db` |
| `IP_ADDRESS` | IP usada por la configuración de la aplicación | `127.0.0.1` |

No subas `.env` al repositorio. Usa `.env.example` como plantilla.

Las pruebas transversales cargan `.env.test` y usan por defecto la base `deuna_test_db`. Requieren una instancia MongoDB accesible. Evita configurar la base de pruebas con el mismo nombre que tu base con información importante: las pruebas crean y borran datos de prueba.

## Ejecución

Iniciar normalmente:

```bash
npm start
```

Modo desarrollo con reinicio al cambiar archivos:

```bash
npm run dev
```

Abre la dirección correspondiente al valor de `PORT`, por defecto:

```text
http://localhost:3000
```

La aplicación ejecuta la conexión a MongoDB y la carga semilla al iniciar. El seed inserta los datos de ejemplo cuando las colecciones están vacías.

## API REST

### URL base y formato

Todos los endpoints usan el prefijo:

```text
/api/deuna
```

Los endpoints que reciben datos esperan JSON con el encabezado:

```http
Content-Type: application/json
```

Los identificadores en rutas se escriben como `:id`. Según la entidad, se aceptan IDs numéricos y/o identificadores alternativos indicados en las tablas.

### Resumen de endpoints

| Entidad / operación | Método | Endpoint | Descripción |
|---|---|---|---|
| Clientes | GET | `/api/deuna/clientes` | Lista clientes paginados. |
| Clientes | GET | `/api/deuna/clientes?all=true` | Lista todos los clientes. |
| Clientes | GET | `/api/deuna/clientes/:id` | Busca por ID, ObjectId, email o teléfono. |
| Clientes | POST | `/api/deuna/clientes` | Crea un cliente. |
| Clientes | PUT | `/api/deuna/clientes/:id` | Actualiza campos de un cliente. |
| Clientes | DELETE | `/api/deuna/clientes/:id` | Elimina si no tiene cuentas ni tarjetas asociadas. |
| Cuentas | GET | `/api/deuna/cuentas` | Lista todas las cuentas. |
| Cuentas | GET | `/api/deuna/cuentas/:id` | Busca por ID numérico o número de cuenta. |
| Cuentas | POST | `/api/deuna/cuentas` | Crea una cuenta. |
| Cuentas | PUT | `/api/deuna/cuentas/:id` | Actualiza alias, saldo o estado. |
| Cuentas | DELETE | `/api/deuna/cuentas/:id` | Elimina por ID numérico o número de cuenta. |
| Tarjetas | GET | `/api/deuna/tarjetas` | Lista tarjetas paginadas. |
| Tarjetas | GET | `/api/deuna/tarjetas?all=true` | Lista todas las tarjetas. |
| Tarjetas | GET | `/api/deuna/tarjetas/:id` | Busca por ID, ObjectId o número de tarjeta. |
| Tarjetas | POST | `/api/deuna/tarjetas` | Crea una tarjeta. |
| Tarjetas | PUT | `/api/deuna/tarjetas/:id` | Actualiza campos de una tarjeta. |
| Tarjetas | DELETE | `/api/deuna/tarjetas/:id` | Elimina por ID, ObjectId o número de tarjeta. |
| Transacciones | GET | `/api/deuna/transacciones` | Lista transacciones, de más reciente a más antigua. |
| Transacciones | GET | `/api/deuna/transacciones/:id` | Busca por ID numérico u ObjectId. |
| Transacciones | POST | `/api/deuna/transacciones` | Crea un registro de transacción. |
| Transacciones | PUT | `/api/deuna/transacciones/:id` | Actualiza campos de una transacción. |
| Transacciones | DELETE | `/api/deuna/transacciones/:id` | Elimina por ID numérico u ObjectId. |
| Semilla | POST | `/api/deuna/seed` | Inserta datos de ejemplo en colecciones vacías. |
| Transferencias | POST | `/api/deuna/transferencia` | Ejecuta transferencia entre cuentas. |
| Recargas | POST | `/api/deuna/recarga` | Recarga una cuenta usando una tarjeta. |

### Clientes

El listado paginado acepta `page` (entero desde 1) y `limit` (entero entre 1 y 100). El valor predeterminado es `page=1&limit=6`. Para obtener toda la colección, usa `?all=true`.

Campos para crear:

| Campo | Tipo | Reglas principales |
|---|---|---|
| `nombre` | String | Obligatorio, mínimo 3 caracteres. |
| `email` | String | Obligatorio, formato de correo válido y único. |
| `telefono` | String | Obligatorio, formato `09XXXXXXXX` y único. |

Ejemplos:

```bash
curl "http://localhost:3000/api/deuna/clientes?page=1&limit=6"
curl "http://localhost:3000/api/deuna/clientes?all=true"
curl "http://localhost:3000/api/deuna/clientes/1"
```

Crear:

```bash
curl -X POST http://localhost:3000/api/deuna/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Valeria Morales","email":"valeria.morales@email.com","telefono":"0998877665"}'
```

Actualizar únicamente los campos enviados:

```bash
curl -X PUT http://localhost:3000/api/deuna/clientes/11 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Valeria M. Morales","telefono":"0998877660"}'
```

Eliminar:

```bash
curl -X DELETE http://localhost:3000/api/deuna/clientes/11
```

La eliminación devuelve `409 Conflict` si el cliente tiene cuentas o tarjetas asociadas.

### Cuentas

El listado de cuentas devuelve todas las cuentas. La consulta individual acepta el ID numérico o el número de cuenta.

Campos principales:

| Campo | Tipo | Uso |
|---|---|---|
| `cliente_id` | Number | ID numérico del cliente titular. |
| `numero_cuenta` | String | Número único usado para identificar la cuenta. |
| `alias` | String | Alias de la cuenta. |
| `saldo` | Number | Saldo inicial o actualizado. |
| `estado_cuenta` | String | Estado, normalmente `ACTIVA` o `BLOQUEADA`. |

Crear:

```bash
curl -X POST http://localhost:3000/api/deuna/cuentas \
  -H "Content-Type: application/json" \
  -d '{"cliente_id":1,"numero_cuenta":"0998877665","alias":"valeria","saldo":250,"estado_cuenta":"ACTIVA"}'
```

Actualizar (por ejemplo, por ID numérico):

```bash
curl -X PUT http://localhost:3000/api/deuna/cuentas/11 \
  -H "Content-Type: application/json" \
  -d '{"alias":"valeria-ahorros","saldo":300,"estado_cuenta":"ACTIVA"}'
```

Eliminar por ID o número de cuenta:

```bash
curl -X DELETE http://localhost:3000/api/deuna/cuentas/11
```

### Tarjetas

El listado paginado usa `page` y `limit` con los mismos valores permitidos que Clientes; también acepta `?all=true`. La búsqueda individual acepta ID numérico, ObjectId o número de tarjeta.

Campos para crear:

| Campo | Tipo | Reglas principales |
|---|---|---|
| `cliente_id` | Number | ID de un cliente existente. |
| `numero_tarjeta` | String | 16 dígitos. |
| `banco` | String | Nombre del banco, mínimo 2 caracteres. |
| `fecha_expiracion` | String | Formato `MM/AA`. |

Ejemplos:

```bash
curl "http://localhost:3000/api/deuna/tarjetas?page=1&limit=6"
curl "http://localhost:3000/api/deuna/tarjetas?all=true"
curl "http://localhost:3000/api/deuna/tarjetas/1"
```

Crear:

```bash
curl -X POST http://localhost:3000/api/deuna/tarjetas \
  -H "Content-Type: application/json" \
  -d '{"cliente_id":1,"numero_tarjeta":"4111222233334444","banco":"Banco Pichincha","fecha_expiracion":"12/28"}'
```

Actualizar y eliminar:

```bash
curl -X PUT http://localhost:3000/api/deuna/tarjetas/1 \
  -H "Content-Type: application/json" \
  -d '{"banco":"Banco Guayaquil","fecha_expiracion":"10/29"}'

curl -X DELETE http://localhost:3000/api/deuna/tarjetas/1
```

### Transacciones

Las transacciones pueden generarse automáticamente al realizar transferencias y recargas, o registrarse directamente mediante el CRUD. Las creadas por las operaciones del negocio pueden no tener un ID numérico; para esas se utiliza el ObjectId devuelto en `_id`.

Campos para crear:

| Campo | Tipo | Reglas / valor predeterminado |
|---|---|---|
| `quien` | String | Obligatorio. |
| `origen` | String | Obligatorio. |
| `destino` | String | Obligatorio. |
| `monto` | Number | Obligatorio, mayor que cero. |
| `tipo` | String | Obligatorio, por ejemplo `transferencia` o `recarga`. |
| `comision` | Number | Opcional, predeterminado `0`, no negativa. |
| `estado` | String | Opcional, predeterminado `CONFIRMADA`. |
| `cuando` | String | Opcional, predeterminado a la fecha/hora actual en ISO. |
| `desde_donde` | String | Opcional, predeterminado `manual`. |
| `motivo` | String | Opcional; puede describir una operación fallida. |

Ejemplos:

```bash
curl http://localhost:3000/api/deuna/transacciones
curl http://localhost:3000/api/deuna/transacciones/1
```

Crear:

```bash
curl -X POST http://localhost:3000/api/deuna/transacciones \
  -H "Content-Type: application/json" \
  -d '{"quien":"Valeria Morales","origen":"0998877665","destino":"0987654321","monto":25,"comision":0.4,"tipo":"transferencia","estado":"CONFIRMADA"}'
```

Actualizar y eliminar:

```bash
curl -X PUT http://localhost:3000/api/deuna/transacciones/1 \
  -H "Content-Type: application/json" \
  -d '{"monto":30,"estado":"CONFIRMADA"}'

curl -X DELETE http://localhost:3000/api/deuna/transacciones/1
```

### Operaciones de negocio y semilla

Crear datos de ejemplo:

```bash
curl -X POST http://localhost:3000/api/deuna/seed
```

Transferir entre cuentas. Si los bancos son distintos, se aplica una comisión de `$0.40`; el saldo origen debe cubrir monto y comisión:

```bash
curl -X POST http://localhost:3000/api/deuna/transferencia \
  -H "Content-Type: application/json" \
  -d '{"origen":"0991234567","destino":"0987654321","monto":25}'
```

Recargar una cuenta con una tarjeta vigente perteneciente al titular de la cuenta:

```bash
curl -X POST http://localhost:3000/api/deuna/recarga \
  -H "Content-Type: application/json" \
  -d '{"numero_cuenta":"0991234567","numero_tarjeta":"4111222233334444","monto":50}'
```

Las respuestas exitosas de transferencia/recarga usan HTTP `200`; errores de validación o reglas de negocio usan HTTP `400`. Los registros fallidos de las reglas que generan auditoría se conservan en `transacciones`.

### Códigos HTTP comunes

| Código | Significado |
|---|---|
| `200 OK` | Consulta, actualización, eliminación u operación completada. |
| `201 Created` | Registro creado correctamente. |
| `400 Bad Request` | Datos inválidos o regla de negocio incumplida. |
| `404 Not Found` | No existe el registro solicitado. |
| `409 Conflict` | Dato duplicado o eliminación impedida por integridad referencial. |
| `500 Internal Server Error` | Error inesperado del servidor o base de datos. |

## Pruebas y calidad

### Jest: seis suites CRUD y de reglas de negocio

Jest descubre seis archivos en `tests/`: una suite para cada entidad (clientes, cuentas, tarjetas y transacciones) y dos suites para las reglas de negocio (transferencias y recargas). Antes aparecían solo dos suites porque Jest estaba configurado para buscar en `tests/`, mientras que los archivos CRUD estaban en `test/` y usaban `node:test`. Las pruebas CRUD validan las operaciones de cada entidad; las transversales usan Supertest y verifican también los cambios en MongoDB.

```bash
# Ejecutar las seis suites
npm test

# Ejecutar las seis suites y generar el reporte de cobertura en coverage/
npm test -- --coverage

# Ejecutar Jest directamente (Node.js 22 necesita habilitar los módulos ESM)
NODE_OPTIONS=--experimental-vm-modules npx jest --coverage
```

En Windows PowerShell, configura la variable antes de invocar Jest:

```powershell
$env:NODE_OPTIONS="--experimental-vm-modules"
npx jest --coverage
```

El comando `npx jest --coverage` sin esa opción puede fallar en Node.js 22 antes de ejecutar las pruebas, porque el proyecto usa módulos ESM. La alternativa `npm test -- --coverage` ya activa el soporte ESM.

Las suites cargan `.env.test`, que por defecto usa la base `deuna_test_db`. MongoDB debe estar activo y accesible; usa una base dedicada a pruebas, ya que las pruebas crean y borran registros de prueba.

| Tipo | Archivo |
|---|---|
| CRUD de clientes | `tests/entidades/cliente_crud.test.js` |
| CRUD de cuentas | `tests/entidades/cuentas_crud.test.js` |
| CRUD de tarjetas | `tests/entidades/tarjeta_crud.test.js` |
| CRUD de transacciones | `tests/entidades/transaccion_crud.test.js` |
| Regla de transferencia | `tests/transversales/transferencia.test.js` |
| Regla de recarga | `tests/transversales/recarga.test.js` |

### Node.js Test Runner

Las pruebas nativas que aún están en `test/` se ejecutan por separado con `node:test`:

```bash
npm run test:native
```

### ESLint

Analizar el código del repositorio:

```bash
npm run lint
```

## Estructura del proyecto

```text
api_get_service/       Rutas GET de cuentas y rutas antiguas de consulta
api_post_service/      Rutas POST de operaciones y CRUD de cuentas
api_put_service/       Ruta antigua PUT de tarjetas
api_delete_service/    Ruta antigua DELETE de tarjetas
db_service/            Conexión MongoDB, colecciones y seed del servidor Express
public/                Interfaz web Vue 3 y Tailwind CSS
src/routes/            Rutas CRUD actuales de clientes, tarjetas y transacciones
src/services/          Lógica CRUD y lógica de las operaciones bancarias
test/                  Pruebas restantes con node:test
tests/entidades/       Cuatro suites CRUD con Jest
tests/transversales/   Dos suites de reglas de negocio con Jest y Supertest
```
