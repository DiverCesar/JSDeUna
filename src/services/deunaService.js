import { getCollections } from '../db/index.js';
import { calculateCommission, isCardExpired, serializeDocument } from '../lib/logic.js';

export async function createTransfer(payload = {}, clientIp = 'unknown') {
  try {
    const { cuentas, clientes, transacciones } = await getCollections();
    const origen = payload.origen;
    const destino = payload.destino;
    const monto = Number(payload.monto || 0);

    if (!origen || !destino || Number.isNaN(monto) || monto <= 0) {
      return { ok: false, error: 'Datos incompletos o monto inválido' };
    }

    const cuentaOrigen = await cuentas.findOne({ numero_cuenta: origen }) || await cuentas.findOne({ alias: origen });
    if (!cuentaOrigen) return { ok: false, error: 'Cuenta origen no encontrada' };
    if (cuentaOrigen.estado_cuenta === 'BLOQUEADA') return { ok: false, error: 'La cuenta origen está bloqueada' };

    const cuentaDestino = await cuentas.findOne({ $or: [{ numero_cuenta: destino }, { alias: destino }] });
    if (!cuentaDestino) return { ok: false, error: 'Cuenta destino no encontrada' };

    const clienteOrigen = await clientes.findOne({ id: cuentaOrigen.cliente_id });
    const quien = clienteOrigen ? clienteOrigen.nombre : 'Desconocido';

    const comision = calculateCommission(cuentaOrigen.banco, cuentaDestino.banco);
    const montoTotal = monto + comision;

    if (cuentaOrigen.saldo < montoTotal) {
      const transaccionFallida = {
        quien,
        origen,
        destino,
        monto,
        comision,
        cuando: new Date().toISOString(),
        desde_donde: clientIp,
        estado: 'FALLIDA',
        tipo: 'transferencia',
        motivo: 'Saldo insuficiente'
      };
      await transacciones.insertOne(transaccionFallida);
      return { ok: false, error: 'Saldo insuficiente (incluyendo comisiones)' };
    }

    await cuentas.updateOne({ _id: cuentaOrigen._id }, { $inc: { saldo: -montoTotal } });
    await cuentas.updateOne({ _id: cuentaDestino._id }, { $inc: { saldo: monto } });

    const transaccion = {
      quien,
      origen,
      destino,
      monto,
      comision,
      cuando: new Date().toISOString(),
      desde_donde: clientIp,
      estado: 'CONFIRMADA',
      tipo: 'transferencia'
    };

    await transacciones.insertOne(transaccion);
    return { ok: true, message: 'Transferencia realizada con éxito', transaccion: serializeDocument(transaccion) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function createRecharge(payload = {}, clientIp = 'unknown') {
  try {
    const { cuentas, tarjetas, clientes, transacciones } = await getCollections();
    const numeroCuenta = payload.numero_cuenta;
    const numeroTarjeta = payload.numero_tarjeta;
    const monto = Number(payload.monto || 0);

    if (!numeroCuenta || !numeroTarjeta || Number.isNaN(monto) || monto <= 0) {
      return { ok: false, error: 'Datos incompletos o monto inválido' };
    }

    const cuenta = await cuentas.findOne({ numero_cuenta: numeroCuenta });
    if (!cuenta) return { ok: false, error: 'Cuenta no encontrada' };

    const tarjeta = await tarjetas.findOne({ numero_tarjeta: numeroTarjeta, cliente_id: cuenta.cliente_id });
    if (!tarjeta) return { ok: false, error: 'Tarjeta no encontrada o no pertenece al cliente de la cuenta' };

    const clienteOrigen = await clientes.findOne({ id: cuenta.cliente_id });
    const quien = clienteOrigen ? clienteOrigen.nombre : 'Desconocido';

    if (isCardExpired(tarjeta.fecha_expiracion)) {
      const transaccionFallida = {
        quien,
        origen: numeroTarjeta,
        destino: numeroCuenta,
        monto,
        comision: 0,
        cuando: new Date().toISOString(),
        desde_donde: clientIp,
        estado: 'FALLIDA',
        tipo: 'recarga',
        motivo: 'Tarjeta expirada'
      };
      await transacciones.insertOne(transaccionFallida);
      return { ok: false, error: 'Tarjeta expirada' };
    }

    await cuentas.updateOne({ _id: cuenta._id }, { $inc: { saldo: monto } });

    const transaccion = {
      quien,
      origen: numeroTarjeta,
      destino: numeroCuenta,
      monto,
      comision: 0,
      cuando: new Date().toISOString(),
      desde_donde: clientIp,
      estado: 'CONFIRMADA',
      tipo: 'recarga'
    };

    await transacciones.insertOne(transaccion);
    return { ok: true, message: 'Recarga realizada con éxito', transaccion: serializeDocument(transaccion) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function listData() {
  const { cuentas, tarjetas, transacciones } = await getCollections();
  return {
    cuentas: await cuentas.find({}).toArray(),
    tarjetas: await tarjetas.find({}).toArray(),
    transacciones: await transacciones.find({}).sort({ cuando: -1 }).toArray()
  };
}
