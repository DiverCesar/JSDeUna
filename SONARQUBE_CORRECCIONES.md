# Correcciones de complejidad cognitiva para SonarQube

## Resumen

SonarQube reportó dos funciones cuya complejidad cognitiva superaba el límite configurado de 15:

| Archivo | Función | Complejidad reportada |
|---|---|---:|
| `src/services/clienteService.js` | `updateCliente` | 17 |
| `src/services/tarjetaService.js` | `validateTarjetaData` | 18 |

El segundo reporte señalaba la línea 11 de `tarjetaService.js`, que corresponde a `validateTarjetaData`. La refactorización de `updateTarjeta` descrita abajo fue un hallazgo anterior y no resolvía esta alerta. La función de validación reunía las reglas de cuatro campos en condicionales anidados.

## Planteamiento de la solución

Se extrajeron las comprobaciones que agregaban más ramificaciones a funciones auxiliares:

- Para clientes, `addUniqueClienteFieldUpdate` normaliza un campo único, comprueba si ya pertenece a otro cliente y lo agrega a `updateFields`.
- Para tarjetas, `getClienteIdUpdate` y `getNumeroTarjetaUpdate` mantienen separadas las comprobaciones del `updateTarjeta`.
- Para la alerta actual de tarjetas, cada campo se valida en una función pequeña y `validateTarjetaData` recorre una lista de validadores. Así se elimina la anidación repetida y se mantiene la regla de que en una actualización solo se validan los campos enviados.

Las funciones principales ahora coordinan las operaciones y conservan sus respuestas HTTP, mensajes, campos editables y validaciones existentes. No se cambiaron rutas ni contratos del API.

## Código corregido: `updateCliente`

En `src/services/clienteService.js`, se añadió el auxiliar y se simplificó `updateCliente`:

```js
async function addUniqueClienteFieldUpdate({
  clientes,
  clienteExistente,
  payload,
  updateFields,
  field,
  normalize,
  errorMessage
}) {
  if (payload[field] === undefined) return null;

  const normalizedValue = normalize(payload[field]);
  if (normalizedValue !== clienteExistente[field]) {
    const valueInUse = await clientes.findOne({
      [field]: normalizedValue,
      _id: { $ne: clienteExistente._id }
    });
    if (valueInUse) {
      return { ok: false, status: 409, error: errorMessage };
    }
  }

  updateFields[field] = normalizedValue;
  return null;
}

export async function updateCliente(param, payload = {}) {
  const { clientes } = await getCollections();
  const query = buildClienteQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de cliente no válido.' };
  }

  const clienteExistente = await clientes.findOne(query);
  if (!clienteExistente) {
    return { ok: false, status: 404, error: 'Cliente no encontrado para actualizar.' };
  }

  const errors = validateClienteData(payload, true);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: errors.join(' ') };
  }

  const updateFields = {};
  if (payload.nombre !== undefined) {
    updateFields.nombre = payload.nombre.trim();
  }

  const emailError = await addUniqueClienteFieldUpdate({
    clientes,
    clienteExistente,
    payload,
    updateFields,
    field: 'email',
    normalize: (email) => email.trim().toLowerCase(),
    errorMessage: 'El correo electrónico ya está en uso por otro cliente.'
  });
  if (emailError) return emailError;

  const telefonoError = await addUniqueClienteFieldUpdate({
    clientes,
    clienteExistente,
    payload,
    updateFields,
    field: 'telefono',
    normalize: (telefono) => telefono.trim(),
    errorMessage: 'El número de teléfono ya está en uso por otro cliente.'
  });
  if (telefonoError) return telefonoError;

  if (Object.keys(updateFields).length === 0) {
    return { ok: false, status: 400, error: 'No se enviaron campos válidos para actualizar.' };
  }

  const resultado = await clientes.findOneAndUpdate(
    { _id: clienteExistente._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  return {
    ok: true,
    status: 200,
    message: 'Cliente actualizado exitosamente',
    cliente: serialize(resultado)
  };
}
```

## Refactor previo: `updateTarjeta`

Este cambio separó la verificación del cliente asociado y del número duplicado. Se conserva porque mejora la función, pero **no era la causa de la alerta actual en la línea 11**:

```js
async function getClienteIdUpdate(clientes, value) {
  if (value === undefined) return { value: undefined };

  const clienteId = Number(value);
  const clienteExiste = await clientes.findOne({ id: clienteId });
  if (!clienteExiste) {
    return {
      error: { ok: false, status: 400, error: `El cliente con ID ${clienteId} no existe.` }
    };
  }
  return { value: clienteId };
}

async function getNumeroTarjetaUpdate(tarjetas, tarjetaExistente, value) {
  if (value === undefined) return { value: undefined };

  const numeroNormalizado = String(value).trim();
  if (numeroNormalizado !== tarjetaExistente.numero_tarjeta) {
    const numeroEnUso = await tarjetas.findOne({
      numero_tarjeta: numeroNormalizado,
      _id: { $ne: tarjetaExistente._id }
    });
    if (numeroEnUso) {
      return {
        error: {
          ok: false,
          status: 409,
          error: 'El número de tarjeta ya está en uso por otra tarjeta.'
        }
      };
    }
  }
  return { value: numeroNormalizado };
}

export async function updateTarjeta(param, payload = {}) {
  const { clientes, tarjetas } = await getCollections();
  const query = buildTarjetaQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de tarjeta no válido.' };
  }

  const tarjetaExistente = await tarjetas.findOne(query);
  if (!tarjetaExistente) {
    return { ok: false, status: 404, error: 'Tarjeta no encontrada para actualizar.' };
  }

  const errors = validateTarjetaData(payload, true);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: errors.join(' ') };
  }

  const updateFields = {};

  const clienteIdUpdate = await getClienteIdUpdate(clientes, payload.cliente_id);
  if (clienteIdUpdate.error) return clienteIdUpdate.error;
  if (clienteIdUpdate.value !== undefined) updateFields.cliente_id = clienteIdUpdate.value;

  const numeroTarjetaUpdate = await getNumeroTarjetaUpdate(
    tarjetas,
    tarjetaExistente,
    payload.numero_tarjeta
  );
  if (numeroTarjetaUpdate.error) return numeroTarjetaUpdate.error;
  if (numeroTarjetaUpdate.value !== undefined) {
    updateFields.numero_tarjeta = numeroTarjetaUpdate.value;
  }

  if (payload.banco !== undefined) {
    updateFields.banco = payload.banco.trim();
  }

  if (payload.fecha_expiracion !== undefined) {
    updateFields.fecha_expiracion = String(payload.fecha_expiracion).trim();
  }

  if (Object.keys(updateFields).length === 0) {
    return { ok: false, status: 400, error: 'No se enviaron campos válidos para actualizar.' };
  }

  const resultado = await tarjetas.findOneAndUpdate(
    { _id: tarjetaExistente._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  return {
    ok: true,
    status: 200,
    message: 'Tarjeta actualizada exitosamente',
    tarjeta: serialize(resultado)
  };
}
```

## Código corregido para la alerta actual: `validateTarjetaData`

La lógica de cada campo se movió a su validador específico. La función exportada conserva los mismos parámetros, orden de errores y comportamiento para creación y actualización:

```js
function validateClienteId(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value)) || Number(value) <= 0) {
    return 'El cliente asociado es obligatorio y debe ser un ID válido.';
  }
  return null;
}

function validateNumeroTarjeta(value) {
  const numero = value !== undefined && value !== null ? String(value).trim() : '';
  if (!numero || !CARD_REGEX.test(numero)) {
    return 'El número de tarjeta es obligatorio y debe tener exactamente 16 dígitos numéricos.';
  }
  return null;
}

function validateBanco(value) {
  if (!value || typeof value !== 'string' || value.trim().length < 2) {
    return 'El nombre del banco es obligatorio y debe tener al menos 2 caracteres.';
  }
  return null;
}

function validateFechaExpiracion(value) {
  const fecha = value !== undefined && value !== null ? String(value).trim() : '';
  if (!fecha || !EXPIRATION_REGEX.test(fecha)) {
    return 'La fecha de expiración es inválida. Debe tener formato MM/AA (ej: 12/28).';
  }
  return null;
}

export function validateTarjetaData(data = {}, isUpdate = false) {
  const errors = [];
  const fields = [
    ['cliente_id', validateClienteId],
    ['numero_tarjeta', validateNumeroTarjeta],
    ['banco', validateBanco],
    ['fecha_expiracion', validateFechaExpiracion]
  ];

  for (const [field, validate] of fields) {
    if (!isUpdate || data[field] !== undefined) {
      const error = validate(data[field]);
      if (error) errors.push(error);
    }
  }

  return errors;
}
```

Por ejemplo, al actualizar solo `banco`, no se exigen los demás campos. Si se envía explícitamente `numero_tarjeta: null`, ese campo sí se valida y produce el error correspondiente, igual que antes.

## Verificación

Se ejecutaron las pruebas CRUD específicas:

```bash
node --test test/cliente_crud.test.js test/tarjeta_service_crud.test.js
```

**Resultado:** 17 pruebas aprobadas, 0 fallidas. También pasaron `node --check` para ambos servicios y `git diff --check`.

La complejidad final debe confirmarse ejecutando nuevamente el análisis en SonarQube; las pruebas funcionales verifican que los flujos existentes siguen comportándose como antes.

## Correcciones adicionales: recomendaciones de ubicación e imports de Node

En una ejecución posterior, SonarQube señaló tres recomendaciones:

| Archivo | Observación | Cambio |
|---|---|---|
| `public/index.html` | Mover `enmascararTarjeta` al ámbito externo | La función se movió fuera de `setup()` y sigue expuesta a la plantilla mediante el objeto retornado por `setup`. |
| `server.js` | Preferir `node:path` sobre `path` y `node:url` sobre `url` | Se añadieron los prefijos `node:` a los imports de módulos integrados. |
| `server.js` | Preferir `await` de nivel superior | Se quitó `startApp()` y se dejó la inicialización dentro de un `try/catch` de nivel superior. |

### `enmascararTarjeta` en el ámbito externo

Antes la función estaba declarada dentro de `setup()`. Ahora está en el ámbito del script principal, pero se mantiene en `return` para que la plantilla Vue continúe utilizándola:

```js
function enmascararTarjeta(num) {
  if (!num) return '**** **** **** ****';
  const clean = String(num).replace(/\s+/g, '');
  const last4 = clean.slice(-4);
  return `**** **** **** ${last4}`;
}

const app = createApp({
  setup() {
    // Estado y otras funciones de la interfaz
    return {
      enmascararTarjeta
    };
  }
});
```

### Imports y arranque de `server.js`

Los imports ahora especifican que `path` y `url` son módulos integrados de Node:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

La conexión, el seed y el inicio del servidor usan `await` directamente en el módulo ESM. El `try/catch` conserva el registro del error y el código de salida ante un fallo:

```js
try {
  await connectToDatabase();
  await seedDatabase();
  app.listen(port, () => {
    console.log(`Deuna API running on http://localhost:${port}`);
  });
} catch (error) {
  console.error('Failed to start app:', error.message);
  process.exit(1);
}
```

### Verificación de esta tanda

Se validó la sintaxis de `server.js` y del script principal del frontend, se ejecutó la suite con `npm test` y se verificó el diff con `git diff --check`. La ejecución actual de SonarQube queda pendiente para confirmar que sus tres observaciones se actualizaron.

## Correcciones adicionales: conversiones numéricas y errores capturados

En la siguiente revisión se corrigieron las recomendaciones de consistencia reportadas en las rutas, servicios y frontend:

| Archivos | Observación | Corrección |
|---|---|---|
| `api_delete_service/routes.js`, `api_get_service/routes.js`, `api_post_service/routes.js`, `api_put_service/routes.js` | Preferir `Number.isNaN` sobre `isNaN` | Se reemplazó `!isNaN(Number(valor))` por `!Number.isNaN(Number(valor))`, conservando la detección de identificadores numéricos. |
| `src/services/clienteService.js`, `src/services/tarjetaService.js` | Preferir `Number.parseInt` | Se usó `Number.parseInt` para convertir la página y el límite de paginación. |
| `public/index.html` | Preferir `Number.parseFloat` | Se usó `Number.parseFloat` para convertir montos de transferencia, recarga y saldo. |
| `api_delete_service/routes.js`, `api_put_service/routes.js` | Firma de `ObjectId` marcada como obsoleta | Se convirtió explícitamente el parámetro a texto al construir el ObjectId: `new ObjectId(String(param))`. |
| `public/index.html` | Capturas de excepciones sin usar el error | En las operaciones de interfaz se agregó `console.error` con el contexto de la acción y el error capturado. La notificación visible sigue indicando el problema de conexión sin exponer detalles técnicos. |

Ejemplos de las conversiones aplicadas:

```js
if (!Number.isNaN(Number(param))) {
  query = { id: Number(param) };
}

const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
const monto = Number.parseFloat(transferForm.monto);
const objectId = new ObjectId(String(param));
```

En el frontend, el manejo de excepciones ahora conserva el aviso al usuario y registra el objeto de error para facilitar el diagnóstico:

```js
} catch (error) {
  console.error('Error al realizar la transferencia:', error);
  showNotification('Error de conexión', 'error');
}
```

### Verificación de esta tanda

Se revisaron las capturas del frontend, se ejecutó `npm test`, se validó la sintaxis de los módulos modificados y se comprobó el formato con `git diff --check`. Debe volver a ejecutarse SonarQube para confirmar que los avisos quedaron cerrados.

## Integración de cambios del equipo

Al integrar los cambios recibidos de los compañeros, Git encontró un conflicto en `server.js`. Se combinaron las dos necesidades sin descartar cambios:

- Se conservó `app.disable('x-powered-by')`, agregado por seguridad.
- Se conservaron los imports `node:path` y `node:url`, además del `await` de nivel superior.
- El servidor solo conecta a MongoDB y escucha cuando `NODE_ENV !== 'test'`, para que Jest pueda importar `app` y ejecutar pruebas con Supertest sin abrir un listener.
- Se exporta `app` como exportación nombrada y por defecto, como esperan las pruebas del equipo.

También se conservaron las nuevas pruebas transversales con Jest, la configuración de ESLint y la suite nativa CRUD existente, incluida la prueba de Transacciones. Desde este cambio, `npm test` ejecuta las pruebas Jest que están bajo `tests/`; las pruebas CRUD basadas en `node:test` se ejecutan con:

```bash
npm run test:native
```

### Verificación de la integración

- `npm test`: 2 suites y 7 pruebas Jest aprobadas.
- `npm run test:native`: 31 pruebas CRUD/unitarias aprobadas, incluida Transacciones.
- `npm run lint`: aprobado.
- `node --check` para los módulos modificados y `git diff --check`: aprobados.
