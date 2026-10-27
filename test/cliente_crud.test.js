import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, getCollections } from '../db_service/database.js';
import {
  createCliente,
  deleteCliente,
  getCliente,
  listAllClientes,
  updateCliente,
  validateClienteData
} from '../src/services/clienteService.js';

test('CRUD Clientes - Pruebas completas sobre la entidad clientes', async (t) => {
  t.after(async () => {
    await closeDatabase();
  });

  const { clientes } = await getCollections();

  const clientePrueba = {
    id: 8888,
    nombre: 'Cliente de Prueba',
    email: 'prueba.cliente@deuna.test',
    telefono: '0981122334'
  };

  // Limpieza preventiva
  await clientes.deleteOne({ email: clientePrueba.email });
  await clientes.deleteOne({ telefono: clientePrueba.telefono });
  await clientes.deleteOne({ id: clientePrueba.id });

  await t.test('1. CREATE - Debe registrar un nuevo cliente con datos válidos', async () => {
    const response = await createCliente(clientePrueba);
    assert.equal(response.ok, true, 'La creación debe responder ok: true');
    assert.equal(response.status, 201, 'El código de respuesta debe ser 201');
    assert.ok(response.cliente._id, 'Debe generarse un _id de MongoDB');
    assert.equal(response.cliente.nombre, clientePrueba.nombre);
    assert.equal(response.cliente.email, clientePrueba.email);
    assert.equal(response.cliente.telefono, clientePrueba.telefono);

    // Confirmación en BD
    const enDb = await clientes.findOne({ id: clientePrueba.id });
    assert.ok(enDb, 'El cliente debe existir en la base de datos');
    assert.equal(enDb.nombre, clientePrueba.nombre);
  });

  await t.test('2. CREATE NEGATIVO - Debe rechazar clientes con datos duplicados o inválidos', async () => {
    // Duplicado de email
    const dupEmail = await createCliente({
      nombre: 'Otro Nombre',
      email: clientePrueba.email,
      telefono: '0977889900'
    });
    assert.equal(dupEmail.ok, false);
    assert.equal(dupEmail.status, 409);

    // Duplicado de teléfono
    const dupTel = await createCliente({
      nombre: 'Otro Nombre',
      email: 'otro.correo@test.com',
      telefono: clientePrueba.telefono
    });
    assert.equal(dupTel.ok, false);
    assert.equal(dupTel.status, 409);

    // Campos inválidos
    const invalido = await createCliente({
      nombre: 'A',
      email: 'no-es-correo',
      telefono: '123'
    });
    assert.equal(invalido.ok, false);
    assert.equal(invalido.status, 400);
  });

  await t.test('3. READ - Debe consultar el listado general y clientes por diferentes identificadores', async () => {
    // Listar todos
    const todos = await listAllClientes();
    assert.ok(Array.isArray(todos), 'Debe retornar una lista');
    assert.ok(todos.length > 0, 'La lista no debe estar vacía');

    // Consultar por ID numérico
    const porId = await getCliente(clientePrueba.id);
    assert.ok(porId, 'Debe encontrar al cliente por su ID numérico');
    assert.equal(porId.email, clientePrueba.email);

    // Consultar por email
    const porEmail = await getCliente(clientePrueba.email);
    assert.ok(porEmail, 'Debe encontrar al cliente por su email');
    assert.equal(porEmail.id, clientePrueba.id);

    // Cliente inexistente
    const inexistente = await getCliente(9999999);
    assert.equal(inexistente, null, 'Debe retornar null si no existe');
  });

  await t.test('4. UPDATE - Debe actualizar los datos del cliente y validar duplicados', async () => {
    const updateResult = await updateCliente(clientePrueba.id, {
      nombre: 'Cliente Modificado',
      telefono: '0988776655'
    });

    assert.equal(updateResult.ok, true);
    assert.equal(updateResult.status, 200);
    assert.equal(updateResult.cliente.nombre, 'Cliente Modificado');
    assert.equal(updateResult.cliente.telefono, '0988776655');

    // Validar rechazo al intentar usar el email de otro cliente (ej: Carlos Rivera id 1)
    const dupUpdate = await updateCliente(clientePrueba.id, {
      email: 'carlos.rivera@email.com'
    });
    assert.equal(dupUpdate.ok, false);
    assert.equal(dupUpdate.status, 409);
  });

  await t.test('5. DELETE con Integridad Referencial - No debe permitir borrar cliente con cuentas/tarjetas', async () => {
    // Cliente 1 (Carlos Rivera) tiene cuentas y tarjetas en la base de datos
    const intentoBorrado = await deleteCliente(1);
    assert.equal(intentoBorrado.ok, false, 'No debe permitir borrar un cliente con productos activos');
    assert.equal(intentoBorrado.status, 409, 'Debe responder con código de conflicto 409');
    assert.match(intentoBorrado.error, /cuenta\(s\).*tarjeta\(s\)/);
  });

  await t.test('6. DELETE - Debe eliminar exitosamente un cliente sin cuentas ni tarjetas asociadas', async () => {
    // El clientePrueba no tiene cuentas ni tarjetas
    const borrado = await deleteCliente(clientePrueba.id);
    assert.equal(borrado.ok, true);
    assert.equal(borrado.status, 200);

    // Confirmación en BD
    const buscado = await clientes.findOne({ id: clientePrueba.id });
    assert.equal(buscado, null, 'El cliente ya no debe existir en la base de datos');
  });

  await t.test('7. VALIDACIÓN DE CAMPOS - Reglas de formato', () => {
    const errores = validateClienteData({
      nombre: 'Lu',
      email: 'correo_invalido',
      telefono: '0812345678'
    });
    assert.equal(errores.length, 3, 'Debe detectar los 3 errores de validación');
  });
});
