/**
 * Ponto de entrada do módulo do balão (`js/projetos/balao.js`, T11): o pacote
 * da página o importa só quando o usuário abre o primeiro balão
 * (pagina/sobDemanda.ts). É o único módulo do content script que importa CSS
 * (o `base.css` como texto, com o loader "text" do build, para o Shadow DOM).
 */

import cssBase from "@comum/ui/base.css";
import { abrirBalaoProcesso } from "./balaoProcesso";
import type { ModuloBalao } from "./sobDemanda";

export const abrirBalao: ModuloBalao["abrirBalao"] = (ancora, processo, d) => abrirBalaoProcesso(ancora, processo, { ...d, cssBase });
