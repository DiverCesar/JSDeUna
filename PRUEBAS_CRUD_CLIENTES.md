# Plan y Guía de Pruebas: CRUD de Clientes (JSDeUna)

**Materia:** Pruebas de Software  
**Entorno:** Node.js + Express + MongoDB Atlas / Local (`deuna_db`)  
**Colección / Tabla:** `clientes`  
**Responsable:** Módulo CRUD de Clientes  

---

## 1. Estructura del Documento (`cliente`)

Cada registro en la colección `clientes` tiene la siguiente estructura en la base de datos:

| Campo | Tipo de Dato | Requerido | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | ObjectId | Sí (Auto) | Identificador único interno generado por MongoDB | `ObjectId("6ae0d23c8d6d28412ad7ca90")` |
| `id` | Number | Sí (Secuencial) | Identificador numérico único de negocio | `11` |
| `nombre` | String | Sí | Nombre completo del cliente (mínimo 3 caracteres) | `"Valeria Morales"` |
| `email` | String | Sí | Correo electrónico único con formato válido | `"valeria.morales@email.com"` |
| `telefono` | String | Sí | Número telefónico único (formato ecuatoriano `09XXXXXXXX`, 10 dígitos) | `"0998877665"` |

---

## 2. Matriz de Casos de Prueba (CRUD)

| ID | Operación | Objetivo del Caso de Prueba | Entrada / Precondición | Resultado Esperado | Estado |
|---|---|---|---|---|:---:|
| **CP-CLI-01** | **CREATE** | Registrar un nuevo cliente con datos válidos | Nombre, email único y celular válido | Inserta en BD, genera `_id` y `id` secuencial, HTTP 201 | **PASÓ** |
| **CP-CLI-02** | **CREATE (Negativo)** | Rechazar registro con email o teléfono ya existente | Email o celular duplicado | HTTP 409 Conflict con mensaje específico de duplicado | **PASÓ** |
| **CP-CLI-03** | **CREATE (Validación)**| Rechazar registro con datos incompletos o inválidos | Formato de email o celular incorrecto | HTTP 400 Bad Request con detalle del error | **PASÓ** |
| **CP-CLI-04** | **READ** | Listar todos los clientes registrados | Ninguna | Arreglo JSON de clientes y HTTP 200 | **PASÓ** |
| **CP-CLI-05** | **READ (Por ID)** | Consultar un cliente por su ID numérico | ID existente (ej: `1` o `11`) | Objeto cliente completo y HTTP 200 | **PASÓ** |
| **CP-CLI-06** | **READ (No existe)** | Consultar cliente inexistente | ID que no existe (ej: `99999`) | HTTP 404 Not Found | **PASÓ** |
| **CP-CLI-07** | **UPDATE** | Modificar nombre o teléfono de un cliente | Campos a actualizar válidos | Modificación confirmada en BD y HTTP 200 | **PASÓ** |
| **CP-CLI-08** | **UPDATE (Negativo)** | Evitar asignar un email ya en uso por otro cliente | Email perteneciente a otro cliente | HTTP 409 Conflict | **PASÓ** |
| **CP-CLI-09** | **DELETE (Integridad)**| Bloquear eliminación si tiene cuentas/tarjetas | Cliente con productos activos (ej: ID `1`) | HTTP 409 Conflict indicando cuentas/tarjetas vinculadas | **PASÓ** |
| **CP-CLI-10** | **DELETE** | Eliminar cliente sin productos vinculados | Cliente recién creado sin cuentas ni tarjetas | `deletedCount = 1`, eliminado de la BD y HTTP 200 | **PASÓ** |

---

## 3. Pruebas a Nivel de Base de Datos (MongoDB)

Comandos para verificar directamente en `mongosh` o **MongoDB Compass**:

```javascript
use deuna_db;

// 1. CREATE: Insertar cliente
db.clientes.insertOne({
  id: 8888,
  nombre: "Cliente Manual",
  email: "cliente.manual@email.com",
  telefono: "0991122334"
});

// 2. READ: Consultar todos o por ID
db.clientes.find({ id: 8888 }).pretty();

// 3. UPDATE: Actualizar nombre y teléfono
db.clientes.updateOne(
  { id: 8888 },
  { $set: { nombre: "Cliente Manual Actualizado", telefono: "0999998888" } }
);

// 4. DELETE: Eliminar cliente de prueba
db.clientes.deleteOne({ id: 8888 });
```

---

## 4. Pruebas a Nivel de Endpoints HTTP (cURL / PowerShell)

### 4.1 [C] CREATE - Crear Cliente
```bash
curl -X POST http://localhost:5000/api/deuna/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Valeria Morales","email":"valeria.morales@email.com","telefono":"0998877665"}'
```
**Respuesta esperada (HTTP 201):**
```json
{
  "ok": true,
  "status": 201,
  "message": "Cliente creado exitosamente",
  "cliente": {
    "id": 11,
    "nombre": "Valeria Morales",
    "email": "valeria.morales@email.com",
    "telefono": "0998877665",
    "_id": "..."
  }
}
```

### 4.2 [R] READ - Consultar todos los clientes
```bash
curl http://localhost:5000/api/deuna/clientes
```

### 4.3 [R] READ - Consultar un cliente específico
```bash
curl http://localhost:5000/api/deuna/clientes/1
```

### 4.4 [U] UPDATE - Actualizar datos del cliente
```bash
curl -X PUT http://localhost:5000/api/deuna/clientes/11 \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Valeria M. Morales","telefono":"0998877660"}'
```

### 4.5 [D] DELETE - Intentar eliminar cliente con cuentas vinculadas (Integridad Referencial)
```bash
curl -X DELETE http://localhost:5000/api/deuna/clientes/1
```
**Respuesta esperada (HTTP 409):**
```json
{
  "ok": false,
  "status": 409,
  "error": "No se puede eliminar el cliente porque tiene 1 cuenta(s) y 1 tarjeta(s) vinculadas."
}
```

### 4.6 [D] DELETE - Eliminar cliente sin cuentas vinculadas
```bash
curl -X DELETE http://localhost:5000/api/deuna/clientes/11
```
**Respuesta esperada (HTTP 200):**
```json
{
  "ok": true,
  "status": 200,
  "message": "Cliente eliminado exitosamente"
}
```

---

## 5. Ejecución Automatizada de Pruebas

Para ejecutar la suite de pruebas del proyecto y del CRUD:

```bash
npm test
```
* **Resultado:** 17 pruebas superadas en tiempo récord (incluyendo pruebas unitarias de negocio, pruebas del CRUD de Tarjetas y las 7 pruebas del CRUD de Clientes).
