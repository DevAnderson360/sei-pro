/**
 * Fuso de Brasília em TODAS as provas (importado primeiro pelo verificar.ts):
 * as provas de data usam 23h30, quando `toISOString()` já está no dia seguinte.
 */
process.env.TZ = "America/Sao_Paulo";
