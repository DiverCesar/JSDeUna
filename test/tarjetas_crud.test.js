import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, getCollections } from '../db_service/database.js';
import { isCardExpired } from '../src/lib/logic.js';

test('CRUD Tarjetas - Pruebas completas sobre la tabla/colección', async (t) => {
  t.after(async () => {
    await closeDatabase();
  });
  const { tarjetas } = await getCollections();

  const tarjetaPrueba = {
    id: 9999,
    cliente_id: 1,
    numero_tarjeta: '9999888877776666',
    banco: 'Banco Internacional',
    fecha_expiracion: '12/32'
  };

  // Limpieza preventiva previa por si existía de ejecuciones anteriores
  await tarjetas.deleteOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });

  await t.test('1. CREATE - Debe insertar una nueva tarjeta exitosamente', async () => {
    const insertResult = await tarjetas.insertOne(tarjetaPrueba);
    assert.ok(insertResult.acknowledged, 'La inserción debe ser confirmada por MongoDB');
    assert.ok(insertResult.insertedId, 'Debe generarse un _id para el nuevo documento');

    const creada = await tarjetas.findOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
    assert.ok(creada, 'La tarjeta debe existir en la base de datos');
    assert.equal(creada.banco, 'Banco Internacional');
    assert.equal(creada.fecha_expiracion, '12/32');
  });

  await t.test('2. READ - Debe consultar la tarjeta insertada y el listado de tarjetas', async () => {
    // Lectura individual por número de tarjeta
    const tarjeta = await tarjetas.findOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
    assert.ok(tarjeta, 'Debe encontrar la tarjeta creada');
    assert.equal(tarjeta.id, 9999);
    assert.equal(tarjeta.cliente_id, 1);

    // Lectura general (todas las tarjetas)
    const todas = await tarjetas.find({}).toArray();
    assert.ok(Array.isArray(todas), 'El resultado debe ser un arreglo');
    assert.ok(todas.length > 0, 'Debe haber tarjetas en la colección');
    const encontradaEnLista = todas.some(t => t.numero_tarjeta === tarjetaPrueba.numero_tarjeta);
    assert.equal(encontradaEnLista, true, 'La tarjeta de prueba debe estar en el listado general');
  });

  await t.test('3. UPDATE - Debe actualizar los datos de la tarjeta (banco y vigencia)', async () => {
    const updateResult = await tarjetas.updateOne(
      { numero_tarjeta: tarjetaPrueba.numero_tarjeta },
      { $set: { banco: 'Banco del Austro', fecha_expiracion: '10/35' } }
    );

    assert.equal(updateResult.matchedCount, 1, 'Debe coincidir 1 documento');
    assert.equal(updateResult.modifiedCount, 1, 'Debe haberse modificado 1 documento');

    // Verificar en BD que los cambios se persistieron
    const actualizada = await tarjetas.findOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
    assert.equal(actualizada.banco, 'Banco del Austro');
    assert.equal(actualizada.fecha_expiracion, '10/35');
  });

  await t.test('4. DELETE - Debe eliminar la tarjeta de prueba de la base de datos', async () => {
    const deleteResult = await tarjetas.deleteOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
    assert.equal(deleteResult.deletedCount, 1, 'Debe haberse eliminado exactamente 1 registro');

    // Confirmar que ya no existe
    const borrada = await tarjetas.findOne({ numero_tarjeta: tarjetaPrueba.numero_tarjeta });
    assert.equal(borrada, null, 'La tarjeta ya no debe existir tras el DELETE');
  });

  await t.test('5. VALIDACIÓN DE NEGOCIO - Regla de expiración de tarjetas', () => {
    assert.equal(isCardExpired('01/20'), true, 'Tarjeta con fecha pasada debe considerarse expirada');
    assert.equal(isCardExpired('12/35'), false, 'Tarjeta con fecha futura no debe considerarse expirada');
  });
});
