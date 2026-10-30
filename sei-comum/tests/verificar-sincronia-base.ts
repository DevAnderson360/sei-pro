import { assinaturaEstavel, jsonEstavel, porId } from "../src/sincronia/assinatura";
import { codificar, paraParagrafos } from "../src/sincronia/codec";
import { podarLapides } from "../src/sincronia/entidade";
import {
  gerarConteudoTexto,
  LIMITE_NOME_TEXTO,
  lerConteudoTexto,
  nomeDeTextoInterno,
  PREFIXO_TEXTO_INTERNO,
  versaoMaisNova,
} from "../src/sincronia/textoPadraoCodec";
import { checar, secao } from "./util";

const DIA = 86_400_000;

export async function verificarSincroniaBase(): Promise<void> {
  secao("sincronia: assinatura estavel");
  checar("ordem das chaves nao muda a assinatura", assinaturaEstavel({ a: 1, b: [2, 3] }) === assinaturaEstavel({ b: [2, 3], a: 1 }));
  checar("campo undefined e o mesmo que ausente", assinaturaEstavel({ a: 1, b: undefined }) === assinaturaEstavel({ a: 1 }));
  checar("valor diferente, assinatura diferente", assinaturaEstavel({ a: 1 }) !== assinaturaEstavel({ a: 2 }));
  checar("16 hexadecimais", /^[0-9a-f]{16}$/.test(assinaturaEstavel([1, "x"])));
  const lista = [{ id: "b" }, { id: "a" }];
  checar(
    "porId ordena sem mexer na original",
    porId(lista)
      .map((x) => x.id)
      .join() === "a,b" && lista[0]?.id === "b",
  );
  checar("jsonEstavel", jsonEstavel({ z: [1, { y: 2, x: 1 }], a: "t" }) === '{"a":"t","z":[1,{"x":1,"y":2}]}');

  secao("sincronia: nome do Texto Padrao");
  checar("Favoritos: login curto", nomeDeTextoInterno("FAV", "pedro.soares") === "[_SEIPRO_FAV_pedro.soares]");
  const longo = nomeDeTextoInterno("FAV", `${"a".repeat(30)}@orgao.gov.br`);
  checar(
    "login longo: 27 + ~ + 8 hex, cabe em 50 (o formato dos Favoritos)",
    longo.length === LIMITE_NOME_TEXTO && /^\[_SEIPRO_FAV_a{27}~[0-9a-f]{8}\]$/.test(longo),
    longo,
  );
  checar(
    "logins longos diferentes nao colidem",
    nomeDeTextoInterno("PRJ", `${"a".repeat(30)}@x.gov.br`) !== nomeDeTextoInterno("PRJ", `${"a".repeat(30)}@y.gov.br`),
  );
  checar("Projetos: texto da unidade", nomeDeTextoInterno("PRJ", "UNIDADE") === "[_SEIPRO_PRJ_UNIDADE]");
  checar("todo nome comeca pelo prefixo interno", nomeDeTextoInterno("PRJ", "x").startsWith(PREFIXO_TEXTO_INTERNO));

  secao("sincronia: conteudo do Texto Padrao");
  const env = { formato: "teste", versao: 1, itens: [{ id: "1", nome: "Ação <b>&" }] };
  const html = await gerarConteudoTexto("Dados internos do SEI Pro <não edite> & obrigado", env);
  checar("paragrafo legivel primeiro, escapado", html.startsWith("<p>Dados internos do SEI Pro &lt;não edite&gt; &amp; obrigado</p>"));
  const volta = await lerConteudoTexto(html);
  checar("ida e volta", "bruto" in volta && JSON.stringify(volta.bruto) === JSON.stringify(env), volta);
  const editado = html.replace(/<\/p>\n<p>/, "</p>\n<p>colega escreveu aqui</p>\n<p>");
  const r1 = await lerConteudoTexto(editado);
  checar("bloco editado por colega: invalido", "invalido" in r1 && /editado/.test(r1.invalido), r1);
  checar("vazio: invalido", "invalido" in (await lerConteudoTexto("")));
  const corrompido = paraParagrafos("Dados internos", "QUFBQUFB");
  const r2 = await lerConteudoTexto(corrompido);
  checar("base64 valido que nao e gzip: corrompido", "invalido" in r2 && /corrompidos/.test(r2.invalido), r2);
  const sei5 = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  checar("conteudo escapado mais uma vez (SEI 5) ainda le", "bruto" in (await lerConteudoTexto(sei5)));
  checar("codec continua o mesmo do pacote", (await codificar({ a: 1 })).length > 0);

  secao("sincronia: versao mais nova");
  checar("mesmo formato, versao maior", versaoMaisNova({ formato: "seipro-projetos", versao: 2 }, "seipro-projetos", 1));
  checar("mesma versao: nao", !versaoMaisNova({ formato: "seipro-projetos", versao: 1 }, "seipro-projetos", 1));
  checar(
    "outro formato: nao (e invalido, nao mais novo)",
    !versaoMaisNova({ formato: "seipro-favoritos", versao: 9 }, "seipro-projetos", 1),
  );
  checar("lixo: nao", !versaoMaisNova(null, "x", 1) && !versaoMaisNova("texto", "x", 1));

  secao("sincronia: lapides com prazo por escopo");
  const agora = 1000 * DIA;
  const vivo = { id: "a", atualizadoEm: 1, dispositivo: "A" };
  const de120 = { id: "b", atualizadoEm: agora - 120 * DIA, dispositivo: "A", removidoEm: agora - 120 * DIA };
  const de200 = { id: "c", atualizadoEm: agora - 200 * DIA, dispositivo: "A", removidoEm: agora - 200 * DIA };
  const unidade = podarLapides({ p: [vivo, de120, de200], e: [de200] }, agora, 180);
  checar(
    "180 dias (unidade): fica a de 120, sai a de 200, em todas as listas",
    unidade.p.map((x) => x.id).join() === "a,b" && unidade.e.length === 0,
    unidade,
  );
  const pessoal = podarLapides({ p: [vivo, de120, de200] }, agora, 90);
  checar("90 dias (pessoal): so o vivo", pessoal.p.map((x) => x.id).join() === "a", pessoal);
}
