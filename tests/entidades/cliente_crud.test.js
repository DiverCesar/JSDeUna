import { afterAll, beforeAll, describe, test } from '@jest/globals';
import { closeDatabase, getCollections } from '../../db_service/database.js';
import {
  createCliente,
  deleteCliente,
  getCliente,
  getClientesPaginated,
  listAllClientes,
  updateCliente,
  validateClienteData
} from '../../src/services/clienteService.js';

let clientes;
let cuentas;
let tarjetas;
const fixtureClienteIds = Array.from({ length: 10 }, (_, index) => 8890 + index);
const clienteConProductosId = 8900;

const clientePrueba = {
  id: 8888,
  nombre: 'Cliente de Prueba',
  email: 'prueba.cliente@deuna.test',
  telefono: '0981122334'
};

beforeAll(async () => {
  ({ clientes, cuentas, tarjetas } = await getCollections());
  await clientes.deleteOne({ email: clientePrueba.email });
  await clientes.deleteOne({ telefono: clientePrueba.telefono });
  await clientes.deleteOne({ id: clientePrueba.id });
  await clientes.deleteMany({ id: { $in: [...fixtureClienteIds, clienteConProductosId] } });
  await cuentas.deleteMany({ cliente_id: clienteConProductosId });
  await tarjetas.deleteMany({ cliente_id: clienteConProductosId });
  await clientes.insertMany([
    ...fixtureClienteIds.map((id) => ({
      id,
      nombre: `Cliente Fixture ${id}`,
      email: `cliente-${id}@deuna.test`,
      telefono: `09${String(id).padStart(8, '0')}`
    })),
    {
      id: clienteConProductosId,
      nombre: 'Cliente con productos',
      email: 'cliente-8900@deuna.test',
      telefono: '0999998900'
    }
  ]);
  await cuentas.insertOne({
    id: clienteConProductosId,
    cliente_id: clienteConProductosId,
    numero_cuenta: 'TEST-CTA-CLIENTE-8900',
    alias: 'cliente-con-productos',
    saldo: 10,
    estado_cuenta: 'ACTIVA'
  });
  await tarjetas.insertOne({
    id: clienteConProductosId,
    cliente_id: clienteConProductosId,
    numero_tarjeta: '9999000088888900',
    banco: 'Banco de Prueba',
    fecha_expiracion: '12/35'
  });
});

afterAll(async () => {
  await cuentas.deleteMany({ cliente_id: clienteConProductosId });
  await tarjetas.deleteMany({ cliente_id: clienteConProductosId });
  await clientes.deleteMany({ id: { $in: [...fixtureClienteIds, clienteConProductosId, clientePrueba.id] } });
  await closeDatabase();
});

describe('CRUD Clientes - Pruebas completas sobre la entidad clientes', () => {
  test('1. CREATE - Debe registrar un nuevo cliente con datos válidos', async () => {
    const response = await createCliente(clientePrueba);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    expect(response.cliente._id).toBeTruthy();
    expect(response.cliente.nombre).toBe(clientePrueba.nombre);
    expect(response.cliente.email).toBe(clientePrueba.email);
    expect(response.cliente.telefono).toBe(clientePrueba.telefono);

    // Confirmación en BD
    const enDb = await clientes.findOne({ id: clientePrueba.id });
    expect(enDb).toBeTruthy();
    expect(enDb.nombre).toBe(clientePrueba.nombre);
  });

  test('2. CREATE NEGATIVO - Debe rechazar clientes con datos duplicados o inválidos', async () => {
    // Duplicado de email
    const dupEmail = await createCliente({
      nombre: 'Otro Nombre',
      email: clientePrueba.email,
      telefono: '0977889900'
    });
    expect(dupEmail.ok).toBe(false);
    expect(dupEmail.status).toBe(409);

    // Duplicado de teléfono
    const dupTel = await createCliente({
      nombre: 'Otro Nombre',
      email: 'otro.correo@test.com',
      telefono: clientePrueba.telefono
    });
    expect(dupTel.ok).toBe(false);
    expect(dupTel.status).toBe(409);

    // Campos inválidos
    const invalido = await createCliente({
      nombre: 'A',
      email: 'no-es-correo',
      telefono: '123'
    });
    expect(invalido.ok).toBe(false);
    expect(invalido.status).toBe(400);
  });

  test('3. READ - Debe consultar el listado general y clientes por diferentes identificadores', async () => {
    // Listar todos
    const todos = await listAllClientes();
    expect(Array.isArray(todos)).toBe(true);
    expect(todos.length).toBeGreaterThan(0);

    // Consultar por ID numérico
    const porId = await getCliente(clientePrueba.id);
    expect(porId).toBeTruthy();
    expect(porId.email).toBe(clientePrueba.email);

    // Consultar por email
    const porEmail = await getCliente(clientePrueba.email);
    expect(porEmail).toBeTruthy();
    expect(porEmail.id).toBe(clientePrueba.id);

    // Cliente inexistente
    const inexistente = await getCliente(9999999);
    expect(inexistente).toBeNull();
  });

  test('4. UPDATE - Debe actualizar los datos del cliente y validar duplicados', async () => {
    const updateResult = await updateCliente(clientePrueba.id, {
      nombre: 'Cliente Modificado',
      telefono: '0988776655'
    });

    expect(updateResult.ok).toBe(true);
    expect(updateResult.status).toBe(200);
    expect(updateResult.cliente.nombre).toBe('Cliente Modificado');
    expect(updateResult.cliente.telefono).toBe('0988776655');

    // Validar rechazo al intentar usar el email de otro cliente (ej: Carlos Rivera id 1)
    const dupUpdate = await updateCliente(clientePrueba.id, {
      email: 'cliente-8890@deuna.test'
    });
    expect(dupUpdate.ok).toBe(false);
    expect(dupUpdate.status).toBe(409);
  });

  test('5. DELETE con Integridad Referencial - No debe permitir borrar cliente con cuentas/tarjetas', async () => {
    const intentoBorrado = await deleteCliente(clienteConProductosId);
    expect(intentoBorrado.ok).toBe(false);
    expect(intentoBorrado.status).toBe(409);
    expect(intentoBorrado.error).toMatch(/cuenta\(s\).*tarjeta\(s\)/);
  });

  test('6. DELETE - Debe eliminar exitosamente un cliente sin cuentas ni tarjetas asociadas', async () => {
    // El clientePrueba no tiene cuentas ni tarjetas
    const borrado = await deleteCliente(clientePrueba.id);
    expect(borrado.ok).toBe(true);
    expect(borrado.status).toBe(200);

    // Confirmación en BD
    const buscado = await clientes.findOne({ id: clientePrueba.id });
    expect(buscado).toBeNull();
  });

  test('7. VALIDACIÓN DE CAMPOS - Reglas de formato', () => {
    const errores = validateClienteData({
      nombre: 'Lu',
      email: 'correo_invalido',
      telefono: '0812345678'
    });
    expect(errores.length).toBe(3);
    expect(validateClienteData({ email: 'usuario@dominio.com' }, true)).toEqual([]);
    expect(validateClienteData({ email: 'usuario@dominio' }, true).length).toBeGreaterThan(0);
    expect(validateClienteData({ email: 'usuario@dominio.' }, true).length).toBeGreaterThan(0);
  });

  test('8. PAGINACIÓN - Debe paginar registros de 6 en 6 con total y páginas', async () => {
    const resP1 = await getClientesPaginated({ page: 1, limit: 6 });
    expect(Array.isArray(resP1.clientes)).toBe(true);
    expect(resP1.currentPage).toBe(1);
    expect(resP1.limit).toBe(6);
    expect(resP1.total).toBeGreaterThanOrEqual(10);
    expect(resP1.totalPages).toBe(Math.ceil(resP1.total / 6));
    expect(resP1.clientes.length).toBe(6);

    const resP2 = await getClientesPaginated({ page: 2, limit: 6 });
    expect(Array.isArray(resP2.clientes)).toBe(true);
    expect(resP2.currentPage).toBe(2);
    // Verificar que los IDs de la página 2 sean distintos de la página 1
    const idsP1 = new Set(resP1.clientes.map(c => c.id));
    const haySolapamiento = resP2.clientes.some(c => idsP1.has(c.id));
    expect(haySolapamiento).toBe(false);
  });
});
