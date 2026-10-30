import { LIMITES } from "../src/modelo/constantes";
import type { Registro } from "../src/modelo/tipos";
import { entidadeValida } from "../src/repositorio";
import { comOsDoFuturo } from "../src/sincronia/textoPadrao";
import { appDeTeste, nova } from "./apoioApp";
import { repoDeTeste, T0 } from "./apoioRepositorio";
import { demanda, registro } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { checar, secao, tique } from "./util";

const AG = T0 + 30_000;
const DIA = 86_400_000;

const reg = (i: number, quando: number): Registro => registro({ id: `r${i}`, demanda: "d1", quando, atualizadoEm: T0 });

export async function verificarRevisaoFinal(): Promise<void> {
  secao("Revisao final: o historico cheio fica com os mais recentes");
  const R = repoDeTeste();
  const antigos = Array.from({ length: LIMITES.historicoLocal }, (_, i) => reg(i, T0 - 1_000_000 + i));
  await R.repo.importar({ d: [], h: antigos }, AG);
  checar("o historico local chegou ao teto", (await R.repo.entidades()).h.length === LIMITES.historicoLocal);
  const novos = Array.from({ length: 10 }, (_, i) => reg(10_000 + i, T0 + 1_000 + i));
  const res = await R.repo.importar({ d: [], h: novos }, AG);
  const h = (await R.repo.entidades()).h;
  const ids = new Set(h.map((x) => x.id));
  checar(
    "os 10 novos do colega entram",
    novos.every((x) => ids.has(x.id)),
  );
  checar("os 10 mais antigos saem", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every((i) => !ids.has(`r${i}`)) && ids.has("r10"));
  checar("o total continua no teto", h.length === LIMITES.historicoLocal);
  checar("nada e contado como excedente", res.excedentes === 0 && res.novos === 10);

  secao("Revisao final: quando no futuro e recusado");
  checar("registro com quando no ano 9999 e invalido", !entidadeValida(reg(1, Date.UTC(9999, 0, 1)), "h", AG));
  checar("registro com quando a 2 dias e invalido", !entidadeValida(reg(1, AG + 2 * DIA), "h", AG));
  checar("registro com quando a 1 hora e valido", entidadeValida(reg(1, AG + 3_600_000), "h", AG));
  const R2 = repoDeTeste();
  const r2 = await R2.repo.importar({ d: [], h: [reg(1, Date.UTC(9999, 0, 1)), reg(2, T0)] }, AG);
  checar("o forjado conta como ignorado e o bom entra", r2.ignorados === 1 && r2.novos === 1);

  secao("Revisao final: comOsDoFuturo limpa e limita");
  const F = repoDeTeste();
  await F.repo.criar({ titulo: "Nota", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
  const base = await F.repo.exportarTabela("d", AG);
  const remotoCom = (d: unknown[]) => ({ ...base, entidades: { d: d as never, h: [] } });
  const forjado = { ...demanda({ id: "ano9999", atualizadoEm: Date.UTC(9999, 0, 1) }), lixo: "x".repeat(90_000) };
  const l1 = comOsDoFuturo(base, remotoCom([forjado]), AG);
  checar("carimbo no ano 9999 nao vai ao envelope", !l1.entidades.d.some((x) => x.id === "ano9999"));
  const adiantado = { ...demanda({ id: "adiantado", atualizadoEm: AG + 2 * DIA }), lixo: "y".repeat(90_000) };
  const l2 = comOsDoFuturo(base, remotoCom([adiantado]), AG);
  const levado = l2.entidades.d.find((x) => x.id === "adiantado");
  checar("carimbo a 2 dias continua indo adiante", !!levado);
  checar("e vai limpo, sem campo oculto", !!levado && !("lixo" in levado));
  const trinta = demanda({ id: F.repo ? "idreal" : "", atualizadoEm: AG + 30 * DIA, titulo: "Versao forjada" });
  const l3 = comOsDoFuturo(base, remotoCom([trinta]), AG);
  checar("carimbo a 30 dias e descartado", !l3.entidades.d.some((x) => x.id === "idreal"));
  const propria = base.entidades.d[0]!;
  const l4 = comOsDoFuturo(base, remotoCom([{ ...propria, titulo: "Versao forjada", atualizadoEm: AG + 30 * DIA }]), AG);
  checar(
    "id real com carimbo forjado a 30 dias nao prende a edicao local",
    l4.entidades.d.find((x) => x.id === propria.id)?.titulo === propria.titulo,
  );

  secao("Revisao final: o Gantt estica ao redimensionar (ResizeObserver)");
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  const antes = g.ResizeObserver;
  const obs: Array<{ cb: () => void; alvo: Element | null; desligado: boolean }> = [];
  g.ResizeObserver = class {
    o = { cb: (() => undefined) as () => void, alvo: null as Element | null, desligado: false };
    constructor(cb: () => void) {
      this.o.cb = cb;
      obs.push(this.o);
    }
    observe(el: Element) {
      this.o.alvo = el;
    }
    disconnect() {
      this.o.desligado = true;
    }
  };
  try {
    const m = { colunas: 10, largura: 0 };
    const gf = ganttFalso({ medidas: m });
    const t = appDeTeste({ montarGantt: gf.montar });
    await nova(t, "unidade", "Alfa");
    const app = await t.montar();
    (t.raiz.querySelector('[data-aba="cronograma"]') as HTMLElement).click();
    await tique(20);
    checar("um observador na area do Gantt", obs.length === 1 && !!obs[0]?.alvo?.classList.contains("dem-cron-gantt"));
    checar("montado com largura 0: nada desenhado de novo", gf.a.renders === 0);
    m.largura = 1000;
    obs[0]!.cb();
    obs[0]!.cb();
    obs[0]!.cb();
    await tique(60);
    checar("ao ganhar largura, estica uma vez so (debounce de um quadro)", gf.a.renders === 1);
    obs[0]!.cb();
    await tique(60);
    checar("sem mudanca, sem laco de render", gf.a.renders === 1);
    app.destruir();
    checar("destruir desliga o observador", obs[0]!.desligado);
    obs[0]!.cb();
    await tique(60);
    checar("e um aviso tardio nao renderiza", gf.a.renders === 1);
  } finally {
    g.ResizeObserver = antes;
  }
}
