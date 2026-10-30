/**
 * API pública do núcleo do gestor de projetos (fase P2). É a entrada do build
 * de verificação (`build.mjs`) e o índice do que o app (P3), a sincronia (P4)
 * e a integração com o SEI e o Agente (P5) consomem. Os módulos importam uns
 * aos outros pelo caminho; este arquivo só junta tudo.
 */

export * from "./gantt/decorar";
export * from "./gantt/escalas";
export * from "./gantt/linhas";
export * from "./gantt/montar";
export * from "./gantt/tarefas";
export * from "./modelo/alertas";
export * from "./modelo/calendario";
export * from "./modelo/constantes";
export * from "./modelo/dependencias";
export * from "./modelo/escopo";
export * from "./modelo/filtro";
export * from "./modelo/historico";
export * from "./modelo/linhaDeBase";
export * from "./modelo/operacoes";
export * from "./modelo/progresso";
export * from "./modelo/resumo";
export * from "./modelo/situacao";
export type * from "./modelo/tipos";
export * from "./modelo/validacao";
export * from "./modelo/vinculos";
export * from "./modelos/aplicar";
export * from "./modelos/embutidos";
export * from "./modelos/salvar";
export * from "./repositorio";
