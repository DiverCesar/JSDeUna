import request from 'supertest';
import app from '../../server.js';
import { getCollections, closeDatabase } from '../../src/db/index.js';
import { closeDatabase as closeServiceDatabase } from '../../db_service/database.js';

describe('Pruebas Transversales: Flujo de Transferencia de Dinero', () => {
  let dbCollections;

  const CLIENTE_ORIGEN_ID = 901;
  const CLIENTE_DESTINO_ID = 902;
  const CUENTA_ORIGEN_NUM = 'TEST-CTA-ORIGEN-01';
  const CUENTA_DESTINO_NUM = 'TEST-CTA-DESTINO-02';
  const CUENTA_BLOQUEADA_NUM = 'TEST-CTA-BLOQ-03';

  beforeAll(async () => {
    dbCollections = await getCollections();
  });

  afterAll(async () => {
    await closeDatabase();
    await closeServiceDatabase();
  });

  beforeEach(async () => {
    const { clientes, cuentas, transacciones } = dbCollections;

    // Limpiar datos previos de prueba
    await clientes.deleteMany({ id: { $in: [CLIENTE_ORIGEN_ID, CLIENTE_DESTINO_ID] } });
    await cuentas.deleteMany({ numero_cuenta: { $in: [CUENTA_ORIGEN_NUM, CUENTA_DESTINO_NUM, CUENTA_BLOQUEADA_NUM] } });
    await transacciones.deleteMany({
      $or: [
        { origen: { $in: [CUENTA_ORIGEN_NUM, CUENTA_BLOQUEADA_NUM] } },
        { destino: { $in: [CUENTA_DESTINO_NUM] } }
      ]
    });

    // Sembrar entidades de prueba
    await clientes.insertMany([
      { id: CLIENTE_ORIGEN_ID, nombre: 'Ana Prueba Origen', email: 'ana.prueba@email.com', telefono: '0990001111' },
      { id: CLIENTE_DESTINO_ID, nombre: 'Beto Prueba Destino', email: 'beto.prueba@email.com', telefono: '0990002222' }
    ]);

    await cuentas.insertMany([
      {
        id: 901,
        cliente_id: CLIENTE_ORIGEN_ID,
        numero_cuenta: CUENTA_ORIGEN_NUM,
        alias: 'ana_origen',
        banco: 'Banco Pichincha',
        saldo: 300.0,
        estado_cuenta: 'ACTIVA'
      },
      {
        id: 902,
        cliente_id: CLIENTE_DESTINO_ID,
        numero_cuenta: CUENTA_DESTINO_NUM,
        alias: 'beto_destino',
        banco: 'Banco Guayaquil',
        saldo: 100.0,
        estado_cuenta: 'ACTIVA'
      },
      {
        id: 903,
        cliente_id: CLIENTE_ORIGEN_ID,
        numero_cuenta: CUENTA_BLOQUEADA_NUM,
        alias: 'ana_bloqueada',
        banco: 'Banco Pichincha',
        saldo: 500.0,
        estado_cuenta: 'BLOQUEADA'
      }
    ]);
  });

  afterEach(async () => {
    const { clientes, cuentas, transacciones } = dbCollections;
    await clientes.deleteMany({ id: { $in: [CLIENTE_ORIGEN_ID, CLIENTE_DESTINO_ID] } });
    await cuentas.deleteMany({ numero_cuenta: { $in: [CUENTA_ORIGEN_NUM, CUENTA_DESTINO_NUM, CUENTA_BLOQUEADA_NUM] } });
    await transacciones.deleteMany({
      $or: [
        { origen: { $in: [CUENTA_ORIGEN_NUM, CUENTA_BLOQUEADA_NUM] } },
        { destino: { $in: [CUENTA_DESTINO_NUM] } }
      ]
    });
  });

  test('debe transferir el monto con comisión entre bancos distintos, actualizar saldos y registrar la transacción confirmada', async () => {
    const montoTransferir = 50.0;
    const comisionEsperada = 0.4; // Bancos distintos: Pichincha -> Guayaquil

    const response = await request(app)
      .post('/api/deuna/transferencia')
      .send({
        origen: CUENTA_ORIGEN_NUM,
        destino: CUENTA_DESTINO_NUM,
        monto: montoTransferir
      });

    // 1. Verificar respuesta HTTP del controlador
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.message).toBe('Transferencia realizada con éxito');
    expect(response.body.transaccion).toBeDefined();

    // 2. Verificar actualización directa en base de datos (Cuenta Origen)
    const cuentaOrigenActualizada = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_ORIGEN_NUM });
    expect(cuentaOrigenActualizada.saldo).toBeCloseTo(300.0 - (montoTransferir + comisionEsperada), 2);

    // 3. Verificar actualización directa en base de datos (Cuenta Destino)
    const cuentaDestinoActualizada = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_DESTINO_NUM });
    expect(cuentaDestinoActualizada.saldo).toBeCloseTo(100.0 + montoTransferir, 2);

    // 4. Verificar registro de auditoría en la colección de transacciones
    const transaccionRegistrada = await dbCollections.transacciones.findOne({
      origen: CUENTA_ORIGEN_NUM,
      destino: CUENTA_DESTINO_NUM,
      estado: 'CONFIRMADA'
    });
    expect(transaccionRegistrada).toBeTruthy();
    expect(transaccionRegistrada.quien).toBe('Ana Prueba Origen');
    expect(transaccionRegistrada.monto).toBe(montoTransferir);
    expect(transaccionRegistrada.comision).toBe(comisionEsperada);
    expect(transaccionRegistrada.tipo).toBe('transferencia');
  });

  test('debe rechazar la transferencia por saldo insuficiente, mantener los saldos intactos y registrar la transacción fallida', async () => {
    const montoExcesivo = 500.0; // Saldo disponible es 300.0

    const response = await request(app)
      .post('/api/deuna/transferencia')
      .send({
        origen: CUENTA_ORIGEN_NUM,
        destino: CUENTA_DESTINO_NUM,
        monto: montoExcesivo
      });

    // 1. Verificar respuesta HTTP de error
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toMatch(/Saldo insuficiente/i);

    // 2. Verificar que los saldos en base de datos NO fueron modificados
    const cuentaOrigenSinCambios = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_ORIGEN_NUM });
    expect(cuentaOrigenSinCambios.saldo).toBe(300.0);

    const cuentaDestinoSinCambios = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_DESTINO_NUM });
    expect(cuentaDestinoSinCambios.saldo).toBe(100.0);

    // 3. Verificar registro de fallo en auditoría
    const transaccionFallida = await dbCollections.transacciones.findOne({
      origen: CUENTA_ORIGEN_NUM,
      destino: CUENTA_DESTINO_NUM,
      estado: 'FALLIDA'
    });
    expect(transaccionFallida).toBeTruthy();
    expect(transaccionFallida.motivo).toBe('Saldo insuficiente');
  });

  test('debe rechazar la transferencia cuando la cuenta origen está bloqueada y no alterar saldos', async () => {
    const response = await request(app)
      .post('/api/deuna/transferencia')
      .send({
        origen: CUENTA_BLOQUEADA_NUM,
        destino: CUENTA_DESTINO_NUM,
        monto: 20.0
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe('La cuenta origen está bloqueada');

    // Saldos intactos
    const cuentaBloqueada = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_BLOQUEADA_NUM });
    expect(cuentaBloqueada.saldo).toBe(500.0);

    const cuentaDestino = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_DESTINO_NUM });
    expect(cuentaDestino.saldo).toBe(100.0);
  });

  test('debe rechazar la transferencia si la cuenta destino no existe y no debitar saldo origen', async () => {
    const response = await request(app)
      .post('/api/deuna/transferencia')
      .send({
        origen: CUENTA_ORIGEN_NUM,
        destino: 'CTA-INEXISTENTE-999',
        monto: 30.0
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe('Cuenta destino no encontrada');

    // Saldo origen intacto
    const cuentaOrigen = await dbCollections.cuentas.findOne({ numero_cuenta: CUENTA_ORIGEN_NUM });
    expect(cuentaOrigen.saldo).toBe(300.0);
  });
});
