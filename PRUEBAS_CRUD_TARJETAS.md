# Plan y Guía de Pruebas: CRUD de Tarjetas (JSDeUna)

**Materia:** Pruebas de Software  
**Entorno:** Node.js + Express + MongoDB Atlas (`deuna_db`)  
**Colección / Tabla:** `tarjetas`  

---

## 1. Estructura del Documento (`tarjeta`)

Cada registro en la colección `tarjetas` tiene la siguiente estructura:

| Campo | Tipo de Dato | Descripción | Ejemplo |
|---|---|---|---|
| `_id` | ObjectId | Identificador único interno generado por MongoDB | `ObjectId("67...abc")` |
| `id` | Number | Identificador numérico secuencial del sistema | `11` |
| `cliente_id` | Number | ID del cliente propietario de la tarjeta | `1` |
| `numero_tarjeta` | String (16 dígitos) | Número de la tarjeta bancaria | `"4111222233334444"` |
| `banco` | String | Nombre de la entidad bancaria emisora | `"Banco Pichincha"` |
| `fecha_expiracion`| String (MM/YY) | Mes y año de expiración | `"12/28"` |

---

## 2. Matriz de Casos de Prueba (CRUD)

| ID | Operación | Objetivo del Caso de Prueba | Entrada / Precondición | Resultado Esperado | Estado |
|---|---|---|---|---|:---:|
| **CP-01** | **CREATE** | Registrar una nueva tarjeta con datos válidos | Tarjeta con datos completos | Se inserta con éxito en la BD, genera `_id` y código HTTP 201 | **PASÓ** |
| **CP-02** | **READ** | Listar todas las tarjetas registradas | Ninguna | Arreglo JSON con todas las tarjetas activas y código 200 | **PASÓ** |
| **CP-03** | **READ** | Consultar una tarjeta específica por ID o número | ID existente (ej: `9999`) | Retorna el objeto de la tarjeta con todos sus atributos | **PASÓ** |
| **CP-04** | **UPDATE** | Modificar el banco y vigencia de una tarjeta | `banco: "Banco del Austro"`, `fecha_expiracion: "10/35"` | `modifiedCount = 1`, campos actualizados en BD | **PASÓ** |
| **CP-05** | **DELETE** | Eliminar una tarjeta existente | ID o número de la tarjeta de prueba | `deletedCount = 1`, documento removido de la BD | **PASÓ** |
| **CP-06** | **DELETE (Verif.)** | Confirmar que la tarjeta eliminada ya no existe | Buscar por la tarjeta eliminada | Retorna `null` o código HTTP 404 Not Found | **PASÓ** |
| **CP-07** | **NEGOCIO** | Validar detección de tarjetas vencidas | Fechas `"01/20"` (vencida) vs `"12/35"` (válida) | `isCardExpired` retorna `true` para la primera y `false` para la segunda | **PASÓ** |
| **CP-08** | **NEGATIVO** | Intentar crear tarjeta con campos faltantes | Payload sin `numero_tarjeta` o `banco` | Error 400 Bad Request con mensaje descriptivo | **PASÓ** |

---

## 3. Pruebas a Nivel de Base de Datos (MongoDB Atlas / mongosh / Compass)

Puedes ejecutar estos comandos directamente en la consola interactiva de MongoDB (`mongosh`) o en **MongoDB Compass**:

### 3.1. [C] CREATE - Insertar Tarjeta
```javascript
use deuna_db;

db.tarjetas.insertOne({
  id: 9999,
  cliente_id: 1,
  numero_tarjeta: "9999888877776666",
  banco: "Banco Internacional",
  fecha_expiracion: "12/32"
});
```
* **Verificación:** MongoDB devuelve `{ acknowledged: true, insertedId: ObjectId(...) }`.

### 3.2. [R] READ - Consultar Tarjetas
```javascript
// Consultar todas las tarjetas
db.tarjetas.find().pretty();

// Consultar la tarjeta recién creada
db.tarjetas.findOne({ numero_tarjeta: "9999888877776666" });
```
* **Verificación:** Se visualizan los datos exactos del banco, cliente y fecha.

### 3.3. [U] UPDATE - Actualizar Tarjeta
```javascript
db.tarjetas.updateOne(
  { numero_tarjeta: "9999888877776666" },
  { 
    $set: { 
      banco: "Banco del Austro",
      fecha_expiracion: "10/35"
    } 
  }
);
```
* **Verificación:** MongoDB devuelve `{ matchedCount: 1, modifiedCount: 1 }`.

### 3.4. [D] DELETE - Eliminar Tarjeta
```javascript
db.tarjetas.deleteOne({ numero_tarjeta: "9999888877776666" });

// Confirmar que ya no existe
db.tarjetas.findOne({ numero_tarjeta: "9999888877776666" });
```
* **Verificación:** `deletedCount: 1` y la búsqueda posterior retorna `null`.

---

## 4. Pruebas a Nivel de API REST (HTTP / cURL / Postman)

Asegúrate de tener el servidor corriendo con:
```bash
npm start
```
*(Disponible en `http://localhost:5000`)*

---

### 4.1. [CREATE] Crear Tarjeta
* **Método:** `POST`
* **URL:** `http://localhost:5000/api/deuna/tarjetas`
* **Headers:** `Content-Type: application/json`

**Comando cURL:**
```bash
curl -X POST http://localhost:5000/api/deuna/tarjetas \
  -H "Content-Type: application/json" \
  -d '{
    "id": 9999,
    "cliente_id": 1,
    "numero_tarjeta": "9999888877776666",
    "banco": "Banco Internacional",
    "fecha_expiracion": "12/32"
  }'
```

**Respuesta Esperada (HTTP 201 Created):**
```json
{
  "ok": true,
  "message": "Tarjeta creada exitosamente",
  "tarjeta": {
    "id": 9999,
    "cliente_id": 1,
    "numero_tarjeta": "9999888877776666",
    "banco": "Banco Internacional",
    "fecha_expiracion": "12/32",
    "_id": "67..."
  }
}
```

---

### 4.2. [READ] Obtener Todas las Tarjetas
* **Método:** `GET`
* **URL:** `http://localhost:5000/api/deuna/tarjetas`

**Comando cURL:**
```bash
curl -X GET http://localhost:5000/api/deuna/tarjetas
```

**Respuesta Esperada (HTTP 200 OK):**
```json
[
  {
    "id": 1,
    "cliente_id": 1,
    "numero_tarjeta": "4111222233334444",
    "banco": "Banco Pichincha",
    "fecha_expiracion": "12/28"
  },
  ...
]
```

---

### 4.3. [READ] Obtener Tarjeta por ID o Número
* **Método:** `GET`
* **URL:** `http://localhost:5000/api/deuna/tarjetas/9999`

**Comando cURL:**
```bash
curl -X GET http://localhost:5000/api/deuna/tarjetas/9999
```

**Respuesta Esperada (HTTP 200 OK):**
```json
{
  "id": 9999,
  "cliente_id": 1,
  "numero_tarjeta": "9999888877776666",
  "banco": "Banco Internacional",
  "fecha_expiracion": "12/32"
}
```

---

### 4.4. [UPDATE] Actualizar Datos de la Tarjeta
* **Método:** `PUT`
* **URL:** `http://localhost:5000/api/deuna/tarjetas/9999`
* **Headers:** `Content-Type: application/json`

**Comando cURL:**
```bash
curl -X PUT http://localhost:5000/api/deuna/tarjetas/9999 \
  -H "Content-Type: application/json" \
  -d '{
    "banco": "Banco del Austro",
    "fecha_expiracion": "10/35"
  }'
```

**Respuesta Esperada (HTTP 200 OK):**
```json
{
  "ok": true,
  "message": "Tarjeta actualizada exitosamente",
  "tarjeta": {
    "id": 9999,
    "cliente_id": 1,
    "numero_tarjeta": "9999888877776666",
    "banco": "Banco del Austro",
    "fecha_expiracion": "10/35"
  }
}
```

---

### 4.5. [DELETE] Eliminar Tarjeta
* **Método:** `DELETE`
* **URL:** `http://localhost:5000/api/deuna/tarjetas/9999`

**Comando cURL:**
```bash
curl -X DELETE http://localhost:5000/api/deuna/tarjetas/9999
```

**Respuesta Esperada (HTTP 200 OK):**
```json
{
  "ok": true,
  "message": "Tarjeta eliminada exitosamente"
}
```

---

### 4.6. [VERIFICACIÓN] Intentar Consultar Tarjeta Eliminada
* **Método:** `GET`
* **URL:** `http://localhost:5000/api/deuna/tarjetas/9999`

**Comando cURL:**
```bash
curl -X GET http://localhost:5000/api/deuna/tarjetas/9999
```

**Respuesta Esperada (HTTP 404 Not Found):**
```json
{
  "ok": false,
  "error": "Tarjeta no encontrada"
}
```

---

## 5. Pruebas Automatizadas con Node.js Test Runner

El proyecto cuenta con la suite automatizada ubicada en:
[test/tarjetas_crud.test.js](file:///Users/enriqueo/Documents/Ing%20Software%20ESPE/5.Semestre/PRUEBAS%20DE%20SOFTWARE/JSDeUna/test/tarjetas_crud.test.js)

### Ejecución:
```bash
npm test
```

### Salida de la Prueba:
```
> jsdeuna@1.0.0 test
> node --test

✔ calculateCommission charges 0.40 when banks differ (0.59ms)
✔ calculateCommission charges 0 when banks are the same (0.07ms)
✔ isCardExpired detects expired cards (0.79ms)
▶ CRUD Tarjetas - Pruebas completas sobre la tabla/colección
  ✔ 1. CREATE - Debe insertar una nueva tarjeta exitosamente (291.79ms)
  ✔ 2. READ - Debe consultar la tarjeta insertada y el listado de tarjetas (288.65ms)
  ✔ 3. UPDATE - Debe actualizar los datos de la tarjeta (banco y vigencia) (293.74ms)
  ✔ 4. DELETE - Debe eliminar la tarjeta de prueba de la base de datos (292.89ms)
  ✔ 5. VALIDACIÓN DE NEGOCIO - Regla de expiración de tarjetas (1.99ms)
✔ CRUD Tarjetas - Pruebas completas sobre la tabla/colección (2906.47ms)

ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
```

---

## 6. Conclusiones de las Pruebas

1. **Integridad de Datos:** Las operaciones C-R-U-D sobre la colección `tarjetas` en MongoDB Atlas se completan sin discrepancias de tipos de datos.
2. **Resiliencia:** El sistema valida la existencia previa antes de actualizar o eliminar documentos, retornando códigos HTTP semánticos (200, 201, 400, 404).
3. **Reglas de Negocio:** La validación de tarjetas expiradas protege las operaciones financieras de recarga en el simulador.
