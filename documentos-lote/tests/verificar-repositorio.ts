import { areaMemoria } from "@comum/armazenamento/area";
import { VALIDADE_LOTE_MS } from "../src/modelo/constantes";
import type { ConfigLote } from "../src/modelo/lote";
import { type LoteDocumentos, RepositorioLote } from "../src/repositorio";
import { checar, igual, secao } from "./util";

const CHAVE = "docslote/lote";
const HOST = "sei.exemplo.gov.br";

const config: ConfigLote = {
  camposCruzados: { nome: "Nome" },
  colunaNome: "Nome",
  modeloDescricao: "Ofício ##nome##",
  destino: { tipo: "tela" },
  pausa: 500,
  modelo: { origem: "documento", numero: "123", titulo: "Ofício", tipoId: "5", tipoNome: "Ofício", campos: ["nome"] },
};

function exemplo(login = "ana"): LoteDocumentos {
  return {
    id: "l1",
    host: HOST,
    login,
    iniciadoEm: 1000,
    atualizadoEm: 1000,
    // Cópia: os casos inválidos mutam a config, e a compartilhada contaminaria os casos seguintes.
    config: structuredClone(config),
    linhas: [0, 1, 2].map((indice) => ({ indice, dados: { Nome: `N${indice}` } })),
    itens: [{ situacao: "pendente" }, { situacao: "pendente" }, { situacao: "pendente" }],
    verificacoes: { "1/2026": { numero: "1/2026", status: "ok", idProcedimento: "9" } as LoteDocumentos["verificacoes"][string] },
  };
}

// Dado corrompido não respeita os tipos: o teste mexe nele livremente.
// biome-ignore lint/suspicious/noExplicitAny: fixture de dado corrompido
type Mutavel = any;

export async function verificarRepositorio(): Promise<void> {
  secao("RepositorioLote");
  const area = areaMemoria();
  let relogio = 5000;
  const repo = new RepositorioLote(area, () => relogio);

  igual("vazio carrega null", await repo.carregar(HOST, "ana"), null);
  await repo.gravar(exemplo());
  checar("chave docslote/lote", CHAVE in (await area.obter()));
  igual("ida e volta (atualizadoEm da gravação)", await repo.carregar(HOST, "ana"), { ...exemplo(), atualizadoEm: 5000 });
  igual("outro login não carrega", await repo.carregar(HOST, "bia"), null);
  checar("outro login não apaga o lote da ana", (await repo.carregar(HOST, "ana")) !== null);
  igual("outro host não carrega", await repo.carregar("outro.gov.br", "ana"), null);

  // marcar: só o índice pedido muda; as demais linhas e itens ficam como estavam.
  relogio = 6000;
  const criado = { numero: "10/2026", idDocumento: "77", link: "https://x/?acao=procedimento_trabalhar&id_documento=77" };
  await repo.marcar("l1", 1, { situacao: "criada", criado });
  const l = await repo.carregar(HOST, "ana");
  igual(
    "marcar só o índice",
    l?.itens.map((i) => i.situacao),
    ["pendente", "criada", "pendente"],
  );
  igual("marcar guarda criado", l?.itens[1]?.criado, criado);
  igual("marcar não mexe nas linhas", l?.linhas, exemplo().linhas);
  igual("marcar não mexe na config nem nas verificações", [l?.config, l?.verificacoes], [config, exemplo().verificacoes]);
  igual("marcar renova atualizadoEm", l?.atualizadoEm, 6000);
  await repo.marcar("outro", 0, { situacao: "erro", erro: "x" });
  igual("marcar de outro lote (id) não grava", (await repo.carregar(HOST, "ana"))?.itens[0], { situacao: "pendente" });
  await repo.marcar("l1", 9, { situacao: "erro", erro: "x" });
  igual("marcar índice fora não grava", (await repo.carregar(HOST, "ana"))?.itens.length, 3);
  await repo.marcar("l1", 2, { situacao: "erro", erro: "falhou", incerto: true, idDocumento: "88" });
  igual("erro incerto guarda o que se sabe", (await repo.carregar(HOST, "ana"))?.itens[2], {
    situacao: "erro",
    erro: "falhou",
    incerto: true,
    idDocumento: "88",
  });
  await repo.marcar("l1", 0, { situacao: "fora" });
  igual("situação fora é válida", (await repo.carregar(HOST, "ana"))?.itens[0]?.situacao, "fora");

  // marcar diz se gravou (o executor para quando o lote sumiu ou é de outro id).
  igual("marcar devolve true ao gravar", await repo.marcar("l1", 0, { situacao: "pendente" }), true);
  igual("marcar de outro id devolve false", await repo.marcar("outro", 0, { situacao: "pendente" }), false);
  igual("marcar com índice fora devolve false", await repo.marcar("l1", 9, { situacao: "pendente" }), false);
  // Processo de destino criado pela linha (novo processo): guardado mesmo com o documento falho.
  const comProcesso = {
    situacao: "erro" as const,
    erro: "x",
    processo: "99.000001/2026-01",
    linkProcesso: "https://x/?acao=procedimento_trabalhar&id_procedimento=5",
  };
  await repo.marcar("l1", 0, comProcesso);
  igual("item guarda processo e linkProcesso", (await repo.carregar(HOST, "ana"))?.itens[0], comProcesso);
  await repo.gravar({ ...exemplo(), protocoloTela: "00001.000001/2026-11" });
  igual("lote guarda o protocolo da tela", (await repo.carregar(HOST, "ana"))?.protocoloTela, "00001.000001/2026-11");
  // A ordem das colunas da planilha (D4): lista, porque o chrome.storage reordena as chaves dos objetos.
  await repo.gravar({ ...exemplo(), colunas: ["Nome", "Cargo"] });
  igual("lote guarda a lista de colunas", (await repo.carregar(HOST, "ana"))?.colunas, ["Nome", "Cargo"]);
  await repo.gravar(exemplo());
  checar("lote sem colunas (versão anterior) continua válido", (await repo.carregar(HOST, "ana")) !== null);

  // linkArvore nunca é guardado (ruling 13), mesmo que venha na verificação.
  const comLink = exemplo();
  (comLink.verificacoes["1/2026"] as Mutavel).linkArvore = "https://x/?infra_hash=abc";
  await repo.gravar(comLink);
  igual("gravar remove linkArvore das verificações", (await repo.carregar(HOST, "ana"))?.verificacoes, exemplo().verificacoes);

  // O texto do modelo (só da prévia) nunca vai para o storage, mesmo se quem grava esquecer de tirá-lo.
  const comTexto = exemplo();
  (comTexto.config.modelo as Mutavel).texto = "Texto longo do modelo ".repeat(500);
  await repo.gravar(comTexto);
  const cru = JSON.stringify((await area.obter(CHAVE))[CHAVE]);
  checar("gravar remove config.modelo.texto", !cru.includes("Texto longo do modelo") && !cru.includes('"texto"'), cru.slice(0, 200));
  checar("gravar não muda o lote de quem chamou", typeof (comTexto.config.modelo as Mutavel).texto === "string");

  // Validade: 7 dias.
  await repo.gravar(exemplo());
  relogio = 5000 + VALIDADE_LOTE_MS - 1;
  checar("dentro da validade carrega", (await repo.carregar(HOST, "ana")) !== null);
  relogio = 5000 + VALIDADE_LOTE_MS + 1;
  await area.gravar({ [CHAVE]: { ...exemplo(), iniciadoEm: 5000, atualizadoEm: 5000 } });
  igual("lote de mais de 7 dias é descartado", await repo.carregar(HOST, "ana"), null);
  checar("lote vencido é removido", !(CHAVE in (await area.obter())));
  // A validade conta da última escrita: lote retomado e marcado há pouco continua vivo.
  relogio = 1000 + VALIDADE_LOTE_MS + 1;
  await area.gravar({ [CHAVE]: { ...exemplo(), atualizadoEm: relogio - 1000 } });
  checar("validade conta da última escrita", (await repo.carregar(HOST, "ana")) !== null);

  // Forma inválida: descarta e apaga.
  relogio = 7000;
  const invalidos: Array<[string, (v: Mutavel) => void]> = [
    ["criada sem criado", (v) => (v.itens[1] = { situacao: "criada" })],
    ["criada sem número", (v) => (v.itens[1] = { situacao: "criada", criado: { idDocumento: "1", link: "l" } })],
    ["criada com número vazio", (v) => (v.itens[1] = { situacao: "criada", criado: { numero: "", idDocumento: "1", link: "l" } })],
    ["criada sem idDocumento", (v) => (v.itens[1] = { situacao: "criada", criado: { numero: "1", link: "l" } })],
    ["situação desconhecida", (v) => (v.itens[0].situacao = "ok")],
    ["itens de outro tamanho", (v) => v.itens.pop()],
    ["sem config", (v) => (v.config = undefined)],
    ["config sem colunaNome", (v) => (v.config.colunaNome = 3)],
    ["pausa não numérica", (v) => (v.config.pausa = "500")],
    ["sem verificações", (v) => (v.verificacoes = null)],
    ["linhas não é lista", (v) => (v.linhas = {})],
    ["erro incerto com tipo errado", (v) => (v.itens[0] = { situacao: "erro", incerto: "sim" })],
    ["id vazio", (v) => (v.id = "")],
    ["processo com tipo errado", (v) => (v.itens[0] = { situacao: "erro", processo: 5 })],
    ["linkProcesso com tipo errado", (v) => (v.itens[0] = { situacao: "erro", linkProcesso: {} })],
    ["protocoloTela com tipo errado", (v) => (v.protocoloTela = 1)],
    ["colunas que não é lista", (v) => (v.colunas = "nome")],
    ["colunas com item que não é texto", (v) => (v.colunas = ["Nome", 3])],
  ];
  for (const [nome, mutar] of invalidos) {
    const v: Mutavel = exemplo();
    mutar(v);
    await area.gravar({ [CHAVE]: v });
    igual(`inválido (${nome}) carrega null`, await repo.carregar(HOST, "ana"), null);
    checar(`inválido (${nome}) é apagado`, !(CHAVE in (await area.obter())));
  }
  await area.gravar({ [CHAVE]: "texto" });
  igual("valor que não é objeto carrega null", await repo.carregar(HOST, "ana"), null);

  // apagar.
  await repo.gravar(exemplo());
  await repo.apagar("outro");
  checar("apagar de outro lote não remove", CHAVE in (await area.obter()));
  await repo.apagar("l1");
  checar("apagar remove a chave", !(CHAVE in (await area.obter())));

  // assumir (retomada, Tarefa 14b): troca o id do lote guardado; quem ainda executa com o id antigo para no marcar.
  relogio = 8000;
  await repo.gravar({ ...exemplo(), idProcedimentoTela: "77" });
  const assumido = await repo.assumir("l1", "l2");
  igual(
    "assumir devolve o lote fresco com o id novo",
    [assumido?.id, assumido?.atualizadoEm, assumido?.idProcedimentoTela],
    ["l2", 8000, "77"],
  );
  igual("o guardado tem o id novo", (await repo.carregar(HOST, "ana"))?.id, "l2");
  checar("marcar com o id antigo devolve false", (await repo.marcar("l1", 0, { situacao: "erro", erro: "x" })) === false);
  igual("assumir de id que não é o guardado: null", await repo.assumir("l1", "l3"), null);
  await repo.apagar("l2");
  igual("assumir sem lote: null", await repo.assumir("l2", "l4"), null);
  {
    const v: Mutavel = exemplo();
    v.idProcedimentoTela = 9;
    await area.gravar({ [CHAVE]: v });
    igual("inválido (idProcedimentoTela com tipo errado) carrega null", await repo.carregar(HOST, "ana"), null);
  }
}
