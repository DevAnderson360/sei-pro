import { pedidosDaAba } from "../src/app/pedidos";
import type { TipoAlerta } from "../src/ponte/tipos";
import { checar, secao } from "./util";

/** O app de mentira: anota o que a aba pediu, na ordem. */
function appFalso() {
  const feitos: string[] = [];
  return {
    feitos,
    aplicarAlerta: (t: TipoAlerta) => void feitos.push(`alerta:${t}`),
    focarProjeto: (id: string, etapa?: string) => {
      feitos.push(`focar:${id}:${etapa ?? "-"}`);
      return true;
    },
  };
}

export async function verificarAppEntrada(): Promise<void> {
  secao("app: pedidos da aba (pilula do titulo, abrir no painel)");
  const p = pedidosDaAba();
  const alerta = p.tratadores.alerta!;
  const focar = p.tratadores.focarProjeto!;
  const r1 = await alerta({ tipo: "semana" });
  const r2 = await focar({ id: "p1", etapa: "e1" });
  const app = appFalso();
  checar("antes de o app ficar pronto, o pedido espera (e a aba ouve que foi aceito)", r1 === true && r2 === true && !app.feitos.length);
  p.pronto(app);
  checar("pronto: os pedidos da fila rodam na ordem em que chegaram", app.feitos.join() === "alerta:semana,focar:p1:e1", app.feitos);
  await alerta({ tipo: "atrasadas" });
  await focar({ id: "p2" });
  checar("depois de pronto, roda na hora", app.feitos.slice(2).join() === "alerta:atrasadas,focar:p2:-", app.feitos);
  const antes = app.feitos.length;
  const recusados = await Promise.all([
    alerta({ tipo: "<img src=x onerror=alert(1)>" }),
    alerta(null),
    focar({}),
    focar({ id: 42 }),
    focar({ id: "x".repeat(201) }),
    focar(null),
  ]);
  checar(
    "pedido malformado (tipo desconhecido, id ausente, nao texto ou longo demais) e recusado e nao chega ao app",
    recusados.every((r) => r === false) && app.feitos.length === antes,
    recusados,
  );
  await focar({ id: "p3", etapa: 7 });
  checar("etapa que nao e texto vira 'sem etapa' (abre o projeto)", app.feitos.at(-1) === "focar:p3:-", app.feitos);

  const p2 = pedidosDaAba();
  for (let i = 0; i < 40; i++) await p2.tratadores.alerta!({ tipo: "semana" });
  const app2 = appFalso();
  p2.pronto(app2);
  checar(
    "a fila tem teto (app que nunca abre nao acumula sem fim)",
    app2.feitos.length > 0 && app2.feitos.length <= 20,
    app2.feitos.length,
  );
}
