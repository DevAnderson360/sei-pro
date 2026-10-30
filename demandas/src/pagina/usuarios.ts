/**
 * Usuários sugeridos para o "Responsável", sem nenhuma requisição ao SEI: a lista parcial (a caixa na tela, os
 * responsáveis já usados e o próprio usuário). É a do Projetos, de propósito: a chave do cache
 * (`projetos/usuarios/<host>|u:<id>`) é a mesma, então os dois módulos se ajudam.
 */

export { type DepsUsuarios, usuariosDaCaixa, usuariosDaUnidade } from "@projetos/pagina/usuarios";
