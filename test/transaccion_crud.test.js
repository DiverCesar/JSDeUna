import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, getCollections } from '../db_service/database.js';
import {
  createTransaccion,
  deleteTransaccion,
  getTransaccion,
  listAllTransacciones,
  updateTransaccion
} from '../src/services/transaccionService.js';

test('CRUD Transacciones - Pruebas sobre la entidad transacciones', async (t) => {
  const { transacciones } = await getCollections();
  const id = Date.now();
  await transacciones.deleteOne({ id });

  t.after(async () => {
    await transacciones.deleteOne({ id });
    await closeDatabase();
  });

  const payload = {
    id,
    quien: 'Prueba CRUD',
    origen: 'origen-prueba',
    destino: 'destino-prueba',
    monto: 25,
    comision: 0.4,
    tipo: 'transferencia',
    estado: 'CONFIRMADA'
  };

  await t.test('CREATE - registra una transacción y rechaza datos inválidos', async () => {
    const response = await createTransaccion(payload);
    assert.equal(response.ok, true);
    assert.equal(response.status, 201);
    assert.ok(response.transaccion._id);
    assert.equal(response.transaccion.id, id);

    const incompleta = await createTransaccion({ quien: 'Prueba' });
    assert.equal(incompleta.status, 400);
    const montoInvalido = await createTransaccion({ ...payload, id: id + 1, monto: 0 });
    assert.equal(montoInvalido.status, 400);
  });

  await t.test('READ - lista y consulta por ID numérico o _id', async () => {
    const list = await listAllTransacciones();
    assert.ok(list.some((transaccion) => transaccion.id === id));

    const byId = await getTransaccion(id);
    assert.equal(byId.origen, payload.origen);

    const byObjectId = await getTransaccion(byId._id);
    assert.equal(byObjectId.id, id);
    assert.equal(await getTransaccion(99999999), null);
  });

  await t.test('UPDATE - modifica campos y rechaza valores numéricos inválidos', async () => {
    const response = await updateTransaccion(id, { monto: 30, estado: 'FALLIDA' });
    assert.equal(response.ok, true);
    assert.equal(response.transaccion.monto, 30);
    assert.equal(response.transaccion.estado, 'FALLIDA');

    const invalid = await updateTransaccion(id, { monto: 'no-numérico' });
    assert.equal(invalid.status, 400);
    const empty = await updateTransaccion(id, {});
    assert.equal(empty.status, 400);
  });

  await t.test('DELETE - elimina por ID y devuelve 404 si ya no existe', async () => {
    const response = await deleteTransaccion(id);
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(await transacciones.findOne({ id }), null);

    const missing = await deleteTransaccion(id);
    assert.equal(missing.status, 404);
  });
});
