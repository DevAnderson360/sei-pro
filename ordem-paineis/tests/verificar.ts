import { verificarModelo } from './verificar-modelo';
import { verificarControle } from './verificar-controle';
import { verificarModal } from './verificar-modal';
import { verificarPaineis } from './verificar-paineis';

let n = 0;
async function teste(nome: string, fn: () => void | Promise<void>) { await fn(); console.log(`OK ${++n}: ${nome}`); }

await verificarModelo(teste);
await verificarPaineis(teste);
await verificarModal(teste);
await verificarControle(teste);

console.log(`${n} verificações passaram.`);
