import { afterAll, beforeAll, describe, test } from '@jest/globals';
import { closeDatabase, getCollections } from '../../db_service/database.js';
import {
  createTransaccion,
  deleteTransaccion,
  getTransaccion,
  listAllTransacciones,
  updateTransaccion
} from '../../src/services/transaccionService.js';

let transacciones;
const id = Date.now();

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

beforeAll(async () => {
  ({ transacciones } = await getCollections());
  await transacciones.deleteOne({ id });
});

afterAll(async () => {
  await transacciones.deleteOne({ id });
  await closeDatabase();
});

describe('CRUD Transacciones - Pruebas sobre la entidad transacciones', () => {
  test('CREATE - registra una transacción y rechaza datos inválidos', async () => {
    const response = await createTransaccion(payload);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.transaccion._id).toBeTruthy();
    expect(response.transaccion.id).toBe(id);

    const incompleta = await createTransaccion({ quien: 'Prueba' });
    expect(incompleta.status).toBe(400);
    const montoInvalido = await createTransaccion({ ...payload, id: id + 1, monto: 0 });
    expect(montoInvalido.status).toBe(400);
  });

  test('READ - lista y consulta por ID numérico o _id', async () => {
    const list = await listAllTransacciones();
    expect(list.some((transaccion) => transaccion.id === id)).toBe(true);

    const byId = await getTransaccion(id);
    expect(byId.origen).toBe(payload.origen);

    const byObjectId = await getTransaccion(byId._id);
    expect(byObjectId.id).toBe(id);
    expect(await getTransaccion(99999999)).toBeNull();
  });

  test('UPDATE - modifica campos y rechaza valores numéricos inválidos', async () => {
    const response = await updateTransaccion(id, { monto: 30, estado: 'FALLIDA' });
    expect(response.ok).toBe(true);
    expect(response.transaccion.monto).toBe(30);
    expect(response.transaccion.estado).toBe('FALLIDA');

    const invalid = await updateTransaccion(id, { monto: 'no-numérico' });
    expect(invalid.status).toBe(400);
    const empty = await updateTransaccion(id, {});
    expect(empty.status).toBe(400);
  });

  test('DELETE - elimina por ID y devuelve 404 si ya no existe', async () => {
    const response = await deleteTransaccion(id);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(await transacciones.findOne({ id })).toBeNull();

    const missing = await deleteTransaccion(id);
    expect(missing.status).toBe(404);
  });
});
