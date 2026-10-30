/**
 * Ponto de entrada do módulo do balão (`js/demandas/balao.js`, D17): o pacote da página o importa só quando o usuário
 * abre o primeiro balão (pagina/sobDemanda.ts). É o único módulo do content script que importa CSS (o `base.css` como
 * texto, com o loader "text" do build, para o Shadow DOM).
 */

import cssBase from "@comum/ui/base.css";
import { abrirBalaoDemandas } from "./balaoDemandas";
import type { ModuloBalao } from "./sobDemanda";

export const abrirBalao: ModuloBalao["abrirBalao"] = (ancora, detectado, d) => abrirBalaoDemandas(ancora, detectado, { ...d, cssBase });
