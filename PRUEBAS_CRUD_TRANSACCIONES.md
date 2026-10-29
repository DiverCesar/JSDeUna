# Plan y Guía de Pruebas: CRUD de Transacciones (JSDeUna)

**Materia:** Pruebas de Software  
**Entorno:** Node.js + Express + MongoDB (`deuna_db`)  
**Colección:** `transacciones`

## 1. Estructura del documento

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `_id` | ObjectId | Sí (auto) | Identificador interno de MongoDB |
| `id` | Number | Sí (auto) | Identificador numérico de la transacción creada desde el CRUD |
| `quien` | String | Sí | Persona que realizó la operación |
| `origen` | String | Sí | Cuenta o tarjeta de origen |
| `destino` | String | Sí | Cuenta de destino |
| `monto` | Number | Sí | Valor de la transacción, mayor a cero |
| `comision` | Number | No | Comisión de la operación |
| `cuando` | String | No | Fecha y hora; se genera automáticamente |
| `desde_donde` | String | No | Origen de la solicitud; por defecto `manual` |
| `estado` | String | No | Estado; por defecto `CONFIRMADA` |
| `tipo` | String | Sí | Tipo de operación, por ejemplo `transferencia` o `recarga` |
| `motivo` | String | No | Motivo adicional, usado en transacciones fallidas |

Las transferencias y recargas ya existentes también aparecen en el listado. Al no tener necesariamente un `id` numérico, pueden consultarse, editarse y eliminarse usando su `_id` de MongoDB.

## 2. Casos de prueba

| ID | Operación | Objetivo | Resultado esperado |
|---|---|---|---|
| CP-TRA-01 | CREATE | Crear una transacción con propietario, origen, destino, monto y tipo | HTTP 201, inserción en MongoDB y generación de identificadores |
| CP-TRA-02 | CREATE negativo | Enviar datos requeridos incompletos o monto no válido | HTTP 400 con mensaje de error |
| CP-TRA-03 | READ | Listar todas las transacciones | HTTP 200 y arreglo JSON ordenado por fecha descendente |
| CP-TRA-04 | READ por ID | Consultar una transacción por ID numérico o `_id` | HTTP 200 con la transacción encontrada |
| CP-TRA-05 | READ inexistente | Consultar un identificador que no existe | HTTP 404 |
| CP-TRA-06 | UPDATE | Cambiar uno o más campos de una transacción | HTTP 200 y datos actualizados en MongoDB |
| CP-TRA-07 | UPDATE negativo | Enviar campos no numéricos para monto/comisión o no enviar campos | HTTP 400 |
| CP-TRA-08 | DELETE | Eliminar una transacción por ID numérico o `_id` | HTTP 200 y documento eliminado |
| CP-TRA-09 | DELETE inexistente | Eliminar un identificador que no existe | HTTP 404 |

## 3. Pruebas desde MongoDB

```javascript
use deuna_db;

db.transacciones.insertOne({
  id: 8888,
  quien: "Prueba CRUD",
  origen: "cuenta-origen",
  destino: "cuenta-destino",
  monto: 25,
  comision: 0.4,
  cuando: new Date().toISOString(),
  desde_donde: "manual",
  estado: "CONFIRMADA",
  tipo: "transferencia"
});

db.transacciones.find({ id: 8888 });
db.transacciones.updateOne({ id: 8888 }, { $set: { estado: "FALLIDA" } });
db.transacciones.deleteOne({ id: 8888 });
```

## 4. Pruebas de endpoints HTTP

### CREATE

```bash
curl -X POST http://localhost:5000/api/deuna/transacciones \
  -H "Content-Type: application/json" \
  -d '{"quien":"Valeria Morales","origen":"0998877665","destino":"0987654321","monto":25,"comision":0.4,"tipo":"transferencia","estado":"CONFIRMADA"}'
```

Respuesta esperada: HTTP 201, `ok: true` y la transacción creada en `transaccion`.

### READ

```bash
curl http://localhost:5000/api/deuna/transacciones
curl http://localhost:5000/api/deuna/transacciones/1
```

### UPDATE

```bash
curl -X PUT http://localhost:5000/api/deuna/transacciones/1 \
  -H "Content-Type: application/json" \
  -d '{"monto":30,"estado":"CONFIRMADA"}'
```

### DELETE

```bash
curl -X DELETE http://localhost:5000/api/deuna/transacciones/1
```

## 5. Interfaz y ejecución de pruebas

En la aplicación, abre **Transacciones (CRUD)** para registrar, editar y eliminar registros. La actividad reciente continúa mostrando las diez transacciones más recientes.

Para ejecutar las pruebas automatizadas:

```bash
npm test
```
