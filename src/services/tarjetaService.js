import { ObjectId } from 'mongodb';
import { getCollections } from '../../db_service/database.js';
import { serialize } from '../../db_service/models.js';

const CARD_REGEX = /^\d{16}$/;
const EXPIRATION_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;

/**
 * Valida los datos obligatorios y formato de una tarjeta.
 */
export function validateTarjetaData(data = {}, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.cliente_id !== undefined) {
    if (data.cliente_id === undefined || data.cliente_id === null || Number.isNaN(Number(data.cliente_id)) || Number(data.cliente_id) <= 0) {
      errors.push('El cliente asociado es obligatorio y debe ser un ID válido.');
    }
  }

  if (!isUpdate || data.numero_tarjeta !== undefined) {
    const num = data.numero_tarjeta !== undefined && data.numero_tarjeta !== null ? String(data.numero_tarjeta).trim() : '';
    if (!num || !CARD_REGEX.test(num)) {
      errors.push('El número de tarjeta es obligatorio y debe tener exactamente 16 dígitos numéricos.');
    }
  }

  if (!isUpdate || data.banco !== undefined) {
    if (!data.banco || typeof data.banco !== 'string' || data.banco.trim().length < 2) {
      errors.push('El nombre del banco es obligatorio y debe tener al menos 2 caracteres.');
    }
  }

  if (!isUpdate || data.fecha_expiracion !== undefined) {
    const fecha = data.fecha_expiracion !== undefined && data.fecha_expiracion !== null ? String(data.fecha_expiracion).trim() : '';
    if (!fecha || !EXPIRATION_REGEX.test(fecha)) {
      errors.push('La fecha de expiración es inválida. Debe tener formato MM/AA (ej: 12/28).');
    }
  }

  return errors;
}

/**
 * Construye la query de búsqueda según el parámetro (id numérico, _id ObjectId o número de tarjeta).
 */
export function buildTarjetaQuery(param) {
  if (param === null || param === undefined) return null;
  const str = String(param).trim();

  if (ObjectId.isValid(str) && str.length === 24) {
    return { _id: new ObjectId(str) };
  }

  if (str.length === 16 && CARD_REGEX.test(str)) {
    return { numero_tarjeta: str };
  }

  if (!Number.isNaN(Number(str))) {
    return { id: Number(str) };
  }

  return { numero_tarjeta: str };
}

/**
 * Obtener tarjetas paginadas con cálculo de total y páginas.
 */
export async function getTarjetasPaginated({ page = 1, limit = 6 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 6));
  const skip = (pageNum - 1) * limitNum;

  const { tarjetas } = await getCollections();
  const [total, list] = await Promise.all([
    tarjetas.countDocuments(),
    tarjetas.find({}).sort({ id: 1 }).skip(skip).limit(limitNum).toArray()
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limitNum));

  return {
    tarjetas: list.map(serialize),
    data: list.map(serialize),
    total,
    totalPages,
    currentPage: pageNum,
    limit: limitNum
  };
}

/**
 * Obtener todas las tarjetas (o paginadas si se pasan opciones).
 */
export async function listAllTarjetas(options) {
  if (options && (options.page !== undefined || options.limit !== undefined)) {
    return getTarjetasPaginated(options);
  }
  const { tarjetas } = await getCollections();
  const list = await tarjetas.find({}).sort({ id: 1 }).toArray();
  return list.map(serialize);
}

/**
 * Obtener una tarjeta por su id numérico, _id de Mongo o número de tarjeta.
 */
export async function getTarjeta(param) {
  const { tarjetas } = await getCollections();
  const query = buildTarjetaQuery(param);
  if (!query) return null;

  const tarjeta = await tarjetas.findOne(query);
  return serialize(tarjeta);
}

/**
 * Crear una nueva tarjeta con validaciones, verificación de cliente y auto-incremento de ID.
 */
export async function createTarjeta(payload = {}) {
  const errors = validateTarjetaData(payload, false);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: errors.join(' ') };
  }

  const { clientes, tarjetas } = await getCollections();
  const clienteId = Number(payload.cliente_id);
  const numeroTarjeta = String(payload.numero_tarjeta).trim();
  const banco = payload.banco.trim();
  const fechaExpiracion = String(payload.fecha_expiracion).trim();

  // Validar existencia del cliente asociado
  const clienteExiste = await clientes.findOne({ id: clienteId });
  if (!clienteExiste) {
    return { ok: false, status: 400, error: `El cliente con ID ${clienteId} no existe.` };
  }

  // Validar duplicado de número de tarjeta
  const existeDuplicado = await tarjetas.findOne({ numero_tarjeta: numeroTarjeta });
  if (existeDuplicado) {
    return { ok: false, status: 409, error: 'Ya existe una tarjeta registrada con ese número de tarjeta.' };
  }

  // Generar ID numérico secuencial si no se envía
  let newId = payload.id;
  if (!newId || Number.isNaN(Number(newId))) {
    const ultimo = await tarjetas.find({}).sort({ id: -1 }).limit(1).toArray();
    newId = ultimo.length > 0 && typeof ultimo[0].id === 'number' ? ultimo[0].id + 1 : 1;
  } else {
    newId = Number(newId);
    const existeId = await tarjetas.findOne({ id: newId });
    if (existeId) {
      return { ok: false, status: 409, error: `Ya existe una tarjeta con el ID ${newId}.` };
    }
  }

  const nuevaTarjeta = {
    id: newId,
    cliente_id: clienteId,
    numero_tarjeta: numeroTarjeta,
    banco,
    fecha_expiracion: fechaExpiracion
  };

  const result = await tarjetas.insertOne(nuevaTarjeta);

  return {
    ok: true,
    status: 201,
    message: 'Tarjeta creada exitosamente',
    tarjeta: serialize({ ...nuevaTarjeta, _id: result.insertedId })
  };
}

/**
 * Actualizar los datos de una tarjeta existente.
 */
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

  if (payload.cliente_id !== undefined) {
    const clienteId = Number(payload.cliente_id);
    const clienteExiste = await clientes.findOne({ id: clienteId });
    if (!clienteExiste) {
      return { ok: false, status: 400, error: `El cliente con ID ${clienteId} no existe.` };
    }
    updateFields.cliente_id = clienteId;
  }

  if (payload.numero_tarjeta !== undefined) {
    const numeroNormalizado = String(payload.numero_tarjeta).trim();
    if (numeroNormalizado !== tarjetaExistente.numero_tarjeta) {
      const numEnUso = await tarjetas.findOne({
        numero_tarjeta: numeroNormalizado,
        _id: { $ne: tarjetaExistente._id }
      });
      if (numEnUso) {
        return { ok: false, status: 409, error: 'El número de tarjeta ya está en uso por otra tarjeta.' };
      }
    }
    updateFields.numero_tarjeta = numeroNormalizado;
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

/**
 * Eliminar una tarjeta.
 */
export async function deleteTarjeta(param) {
  const { tarjetas } = await getCollections();
  const query = buildTarjetaQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de tarjeta no válido.' };
  }

  const tarjeta = await tarjetas.findOne(query);
  if (!tarjeta) {
    return { ok: false, status: 404, error: 'Tarjeta no encontrada para eliminar.' };
  }

  const result = await tarjetas.deleteOne({ _id: tarjeta._id });
  if (result.deletedCount === 0) {
    return { ok: false, status: 404, error: 'No se pudo eliminar la tarjeta.' };
  }

  return {
    ok: true,
    status: 200,
    message: 'Tarjeta eliminada exitosamente'
  };
}
