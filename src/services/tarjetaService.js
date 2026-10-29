import { ObjectId } from 'mongodb';
import { getCollections } from '../../db_service/database.js';
import { serialize } from '../../db_service/models.js';

const CARD_REGEX = /^\d{16}$/;
const EXPIRATION_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;

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

/**
 * Valida los datos obligatorios y formato de una tarjeta.
 */
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
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 6));
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
