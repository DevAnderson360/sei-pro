import { readFileSync } from "node:fs";
import { parDePortas } from "@comum/ponte/parDePortas";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { ATRIBUTO_ATIVO, EVENTO_ABRIR } from "@lp/modelo/constantes";
import type { ContextoLink } from "@lp/pagina/contexto";
import { tratadoresLinkPermanente } from "@lp/pagina/executor";
import { marcarAtivo } from "@lp/pagina/marca";
import { CONFIG_MODAL } from "@lp/pagina/modal";
import { type CodigoErro, ErroSei } from "@nucleo/sessao/erros";
import { checar, instalarDom, secao } from "./util";

const BASE = "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_controlar&infra_hash=zzz";
const CTX: ContextoLink = { host: "sei.x.gov.br", login: "ana", temaEscuro: true, base: BASE };

function seiFalso(f: (ref: string) => Promise<{ idProcedimento: string; idDocumento?: string; linkArvore: string }>) {
  return { localizar: f } as never;
}

export async function verificarPagina(): Promise<void> {
  secao("Pagina: marca");
  const d0 = instalarDom();
  marcarAtivo(d0);
  checar("marca o html", d0.documentElement.getAttribute(ATRIBUTO_ATIVO) === "1");

  secao("Pagina: selecionados");
  const doc = instalarDom(readFileSync(new URL("./fixtures/controle.html", import.meta.url), "utf8"));
  const ok = seiFalso(async () => ({ idProcedimento: "10", linkArvore: "x" }));
  let fechou = 0;
  const t = tratadoresLinkPermanente({ doc, sei: ok, ctx: CTX, fechar: () => void fechou++, minimizar: () => {} });
  const sel = (await t.selecionados(undefined)) as string[];
  checar("numeros sem repeticao, em ordem", JSON.stringify(sel) === JSON.stringify(["00001.000001/2026-11", "00001.000002/2026-22"]), sel);
  const vazio = tratadoresLinkPermanente({ doc: instalarDom(), sei: ok, ctx: CTX });
  checar("sem tabela: lista vazia", JSON.stringify(await vazio.selecionados(undefined)) === "[]");

  secao("Pagina: contexto");
  const c = (await t.contexto(undefined)) as Record<string, unknown>;
  checar("contexto sem base", c.host === "sei.x.gov.br" && c.login === "ana" && c.temaEscuro === true && !("base" in c), c);

  secao("Pagina: localizar");
  checar(
    "ok com link",
    JSON.stringify(await t.localizar({ ref: "1" })) ===
      JSON.stringify({
        situacao: "ok",
        idProcedimento: "10",
        link: "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=10",
      }),
  );
  const comDoc = tratadoresLinkPermanente({
    doc,
    ctx: CTX,
    sei: seiFalso(async () => ({ idProcedimento: "10", idDocumento: "20", linkArvore: "x" })),
  });
  const rd = (await comDoc.localizar({ ref: "1" })) as { idDocumento?: string; link: string };
  checar("documento no link", rd.idDocumento === "20" && rd.link.endsWith("&id_documento=20"), rd);
  const falha = (codigo: CodigoErro) =>
    tratadoresLinkPermanente({
      doc,
      ctx: CTX,
      sei: seiFalso(async () => {
        throw new ErroSei(codigo, "m");
      }),
    }).localizar({ ref: "1" });
  const sit = async (codigo: CodigoErro) => (await falha(codigo)) as { situacao: string; parar?: boolean };
  checar("nao encontrado", (await sit("SEI_NAO_ENCONTRADO")).situacao === "nao-encontrado");
  checar("sigiloso", (await sit("SEI_SIGILOSO")).situacao === "sem-acesso");
  checar("acao indisponivel", (await sit("SEI_ACAO_INDISPONIVEL")).situacao === "sem-acesso");
  const exp = await sit("SEI_SESSAO_EXPIRADA");
  checar("sessao expirada: erro + parar", exp.situacao === "erro" && exp.parar === true, exp);
  const rede = await sit("SEI_REDE");
  checar("demais: erro sem parar", rede.situacao === "erro" && !rede.parar, rede);
  const generico = (await tratadoresLinkPermanente({
    doc,
    ctx: CTX,
    sei: seiFalso(async () => {
      throw new Error("boom");
    }),
  }).localizar({ ref: "1" })) as { situacao: string };
  checar("erro nao-Sei: erro", generico.situacao === "erro");

  secao("Pagina: fechar e minimizar");
  checar("fechar com funcao", (await t.fechar(undefined)) === true && fechou === 1);
  checar("fechar sem funcao", (await vazio.fechar(undefined)) === false);
  let min: boolean | null = null;
  const tm = tratadoresLinkPermanente({
    doc,
    ctx: CTX,
    sei: ok,
    minimizar: (m) => {
      min = m;
    },
  });
  await tm.minimizar({ minimizado: true });
  checar("minimizar repassa", min === true);
  checar("minimizar sem funcao: false", (await vazio.minimizar({ minimizado: true })) === false);

  secao("Pagina: modal e aviso");
  const dm = instalarDom();
  const Ev = (dm.defaultView as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent;
  const pedir = () => dm.dispatchEvent(new Ev(EVENTO_ABRIR));
  const ctl = criarControleModal(dm, CONFIG_MODAL, {
    urlApp: () => "chrome-extension://x/html/link-permanente.html#modo=modal",
    temaEscuro: false,
    conectar: () => parDePortas()[0],
    tratadores: (fechar, minimizar) => tratadoresLinkPermanente({ doc: dm, sei: ok, ctx: CTX, fechar, minimizar }),
    agendar: () => () => {},
  });
  pedir();
  checar("evento abre o modal", ctl.aberto && !!dm.querySelector("iframe[data-spro-link-permanente-modal]"));
  ctl.desligar();
  const da = instalarDom();
  ligarAvisoSemModal(da, CONFIG_MODAL);
  da.dispatchEvent(new (da.defaultView as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent(EVENTO_ABRIR));
  const aviso = da.querySelector(".spro-link-permanente-aviso");
  checar("sem contexto: aviso", !!aviso && (aviso.textContent ?? "").includes("Recarregue a página (F5)"), aviso?.textContent);
  checar(
    "config do modal",
    CONFIG_MODAL.titulo === "Pesquisar Link Permanente" && CONFIG_MODAL.seletorItemMenu === "#pesquisaLinkPermanentePro",
  );
}
