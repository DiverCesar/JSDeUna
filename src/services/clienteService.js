import { ObjectId } from 'mongodb';
import { getCollections } from '../../db_service/database.js';
import { serialize } from '../../db_service/models.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^09\d{8}$/;

/**
 * Valida los datos obligatorios y formato de un cliente.
 */
export function validateClienteData(data = {}, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.nombre !== undefined) {
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim().length < 3) {
      errors.push('El nombre es obligatorio y debe tener al menos 3 caracteres.');
    }
  }

  if (!isUpdate || data.email !== undefined) {
    if (!data.email || typeof data.email !== 'string' || !EMAIL_REGEX.test(data.email.trim())) {
      errors.push('El email es inválido o no tiene un formato correcto.');
    }
  }

  if (!isUpdate || data.telefono !== undefined) {
    if (!data.telefono || typeof data.telefono !== 'string' || !PHONE_REGEX.test(data.telefono.trim())) {
      errors.push('El teléfono es inválido. Debe comenzar con 09 y tener 10 dígitos.');
    }
  }

  return errors;
}

/**
 * Construye la query de búsqueda según el parámetro (id numérico, _id ObjectId, email o teléfono).
 */
export function buildClienteQuery(param) {
  if (param === null || param === undefined) return null;
  const str = String(param).trim();

  if (!Number.isNaN(Number(str))) {
    return { id: Number(str) };
  }
  if (ObjectId.isValid(str) && str.length === 24) {
    return { _id: new ObjectId(str) };
  }
  if (EMAIL_REGEX.test(str)) {
    return { email: str.toLowerCase() };
  }
  return { telefono: str };
}

/**
 * Obtener clientes paginados con cálculo de total y páginas.
 */
export async function getClientesPaginated({ page = 1, limit = 6 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 6));
  const skip = (pageNum - 1) * limitNum;

  const { clientes } = await getCollections();
  const [total, list] = await Promise.all([
    clientes.countDocuments(),
    clientes.find({}).sort({ id: 1 }).skip(skip).limit(limitNum).toArray()
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limitNum));

  return {
    clientes: list.map(serialize),
    data: list.map(serialize),
    total,
    totalPages,
    currentPage: pageNum,
    limit: limitNum
  };
}

/**
 * Obtener todos los clientes (o paginados si se pasan opciones).
 */
export async function listAllClientes(options) {
  if (options && (options.page !== undefined || options.limit !== undefined)) {
    return getClientesPaginated(options);
  }
  const { clientes } = await getCollections();
  const list = await clientes.find({}).sort({ id: 1 }).toArray();
  return list.map(serialize);
}

/**
 * Obtener un cliente por su id numérico, _id de Mongo, email o teléfono.
 */
export async function getCliente(param) {
  const { clientes } = await getCollections();
  const query = buildClienteQuery(param);
  if (!query) return null;

  const cliente = await clientes.findOne(query);
  return serialize(cliente);
}

/**
 * Crear un nuevo cliente con validaciones y auto-incremento de ID.
 */
export async function createCliente(payload = {}) {
  const errors = validateClienteData(payload, false);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: errors.join(' ') };
  }

  const { clientes } = await getCollections();
  const nombre = payload.nombre.trim();
  const email = payload.email.trim().toLowerCase();
  const telefono = payload.telefono.trim();

  // Validar duplicados de email o teléfono
  const existeDuplicado = await clientes.findOne({
    $or: [{ email }, { telefono }]
  });

  if (existeDuplicado) {
    if (existeDuplicado.email === email) {
      return { ok: false, status: 409, error: 'Ya existe un cliente registrado con ese correo electrónico.' };
    }
    return { ok: false, status: 409, error: 'Ya existe un cliente registrado con ese número de teléfono.' };
  }

  // Generar ID numérico secuencial
  let newId = payload.id;
  if (!newId || Number.isNaN(Number(newId))) {
    const ultimo = await clientes.find({}).sort({ id: -1 }).limit(1).toArray();
    newId = ultimo.length > 0 && typeof ultimo[0].id === 'number' ? ultimo[0].id + 1 : 1;
  } else {
    newId = Number(newId);
    const existeId = await clientes.findOne({ id: newId });
    if (existeId) {
      return { ok: false, status: 409, error: `Ya existe un cliente con el ID ${newId}.` };
    }
  }

  const nuevoCliente = {
    id: newId,
    nombre,
    email,
    telefono
  };

  const result = await clientes.insertOne(nuevoCliente);

  return {
    ok: true,
    status: 201,
    message: 'Cliente creado exitosamente',
    cliente: serialize({ ...nuevoCliente, _id: result.insertedId })
  };
}

/**
 * Actualizar los datos de un cliente existente.
 */
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

  if (payload.email !== undefined) {
    const emailNormalizado = payload.email.trim().toLowerCase();
    if (emailNormalizado !== clienteExistente.email) {
      const emailEnUso = await clientes.findOne({
        email: emailNormalizado,
        _id: { $ne: clienteExistente._id }
      });
      if (emailEnUso) {
        return { ok: false, status: 409, error: 'El correo electrónico ya está en uso por otro cliente.' };
      }
    }
    updateFields.email = emailNormalizado;
  }

  if (payload.telefono !== undefined) {
    const telefonoNormalizado = payload.telefono.trim();
    if (telefonoNormalizado !== clienteExistente.telefono) {
      const telEnUso = await clientes.findOne({
        telefono: telefonoNormalizado,
        _id: { $ne: clienteExistente._id }
      });
      if (telEnUso) {
        return { ok: false, status: 409, error: 'El número de teléfono ya está en uso por otro cliente.' };
      }
    }
    updateFields.telefono = telefonoNormalizado;
  }

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

/**
 * Eliminar un cliente con verificación de integridad referencial.
 */
export async function deleteCliente(param) {
  const { clientes, cuentas, tarjetas } = await getCollections();
  const query = buildClienteQuery(param);
  if (!query) {
    return { ok: false, status: 400, error: 'Identificador de cliente no válido.' };
  }

  const cliente = await clientes.findOne(query);
  if (!cliente) {
    return { ok: false, status: 404, error: 'Cliente no encontrado para eliminar.' };
  }

  // Comprobar integridad referencial: ¿Tiene cuentas o tarjetas activas?
  const [totalCuentas, totalTarjetas] = await Promise.all([
    cuentas.countDocuments({ cliente_id: cliente.id }),
    tarjetas.countDocuments({ cliente_id: cliente.id })
  ]);

  if (totalCuentas > 0 || totalTarjetas > 0) {
    return {
      ok: false,
      status: 409,
      error: `No se puede eliminar el cliente porque tiene ${totalCuentas} cuenta(s) y ${totalTarjetas} tarjeta(s) vinculadas.`
    };
  }

  const result = await clientes.deleteOne({ _id: cliente._id });
  if (result.deletedCount === 0) {
    return { ok: false, status: 404, error: 'No se pudo eliminar el cliente.' };
  }

  return {
    ok: true,
    status: 200,
    message: 'Cliente eliminado exitosamente'
  };
}
