import { ObjectId } from 'mongodb';
import { getCollections } from '../../db_service/database.js';
import { serialize } from '../../db_service/models.js';

export function buildTransaccionQuery(param) {
  if (param === null || param === undefined) return null;

  const value = String(param).trim();
  if (!value) return null;
  if (/^[a-f\d]{24}$/i.test(value)) return { _id: new ObjectId(value) };
  if (Number.isFinite(Number(value))) return { id: Number(value) };
  return null;
}

export async function listAllTransacciones() {
  const { transacciones } = await getCollections();
  const data = await transacciones.find({}).sort({ cuando: -1 }).toArray();
  return data.map(serialize);
}

export async function getTransaccion(param) {
  const query = buildTransaccionQuery(param);
  if (!query) return null;

  const { transacciones } = await getCollections();
  return serialize(await transacciones.findOne(query));
}

export async function createTransaccion(payload = {}) {
  if (!payload.quien || !payload.origen || !payload.destino || !payload.tipo) {
    return {
      ok: false,
      status: 400,
      error: 'Faltan campos requeridos: quien, origen, destino, tipo'
    };
  }

  const monto = Number(payload.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, status: 400, error: 'El monto debe ser mayor a cero' };
  }
  const comision = Number(payload.comision || 0);
  if (!Number.isFinite(comision) || comision < 0) {
    return { ok: false, status: 400, error: 'La comisión debe ser un valor válido' };
  }

  const { transacciones } = await getCollections();
  let id = payload.id;
  if (id === undefined || id === null || id === '') {
    const last = await transacciones.find({ id: { $exists: true } }).sort({ id: -1 }).limit(1).toArray();
    id = last.length > 0 ? Number(last[0].id) + 1 : 1;
  } else {
    id = Number(id);
    if (!Number.isFinite(id) || await transacciones.findOne({ id })) {
      return { ok: false, status: 409, error: 'El ID de transacción ya existe o no es válido' };
    }
  }

  const nuevaTransaccion = {
    id,
    quien: String(payload.quien),
    origen: String(payload.origen),
    destino: String(payload.destino),
    monto,
    comision,
    cuando: String(payload.cuando || new Date().toISOString()),
    desde_donde: String(payload.desde_donde || 'manual'),
    estado: String(payload.estado || 'CONFIRMADA'),
    tipo: String(payload.tipo),
    ...(payload.motivo !== undefined ? { motivo: String(payload.motivo) } : {})
  };

  const result = await transacciones.insertOne(nuevaTransaccion);
  return {
    ok: true,
    status: 201,
    message: 'Transacción creada exitosamente',
    transaccion: serialize({ ...nuevaTransaccion, _id: result.insertedId })
  };
}

export async function updateTransaccion(param, payload = {}) {
  const query = buildTransaccionQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de transacción no válido' };
  }

  const { transacciones } = await getCollections();
  const existing = await transacciones.findOne(query);
  if (!existing) {
    return { ok: false, status: 404, error: 'Transacción no encontrada para actualizar' };
  }

  const updateFields = {};
  for (const field of ['quien', 'origen', 'destino', 'cuando', 'desde_donde', 'estado', 'tipo', 'motivo']) {
    if (payload[field] !== undefined) updateFields[field] = String(payload[field]);
  }
  for (const field of ['monto', 'comision']) {
    if (payload[field] !== undefined) {
      const value = Number(payload[field]);
      if (!Number.isFinite(value) || (field === 'monto' && value <= 0) || (field === 'comision' && value < 0)) {
        return { ok: false, status: 400, error: `El campo ${field} debe tener un valor válido` };
      }
      updateFields[field] = value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return { ok: false, status: 400, error: 'No se enviaron campos para actualizar' };
  }

  const result = await transacciones.findOneAndUpdate(
    { _id: existing._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );
  return {
    ok: true,
    status: 200,
    message: 'Transacción actualizada exitosamente',
    transaccion: serialize(result)
  };
}

export async function deleteTransaccion(param) {
  const query = buildTransaccionQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de transacción no válido' };
  }

  const { transacciones } = await getCollections();
  const result = await transacciones.deleteOne(query);
  if (result.deletedCount === 0) {
    return { ok: false, status: 404, error: 'Transacción no encontrada para eliminar' };
  }

  return { ok: true, status: 200, message: 'Transacción eliminada exitosamente' };
}
