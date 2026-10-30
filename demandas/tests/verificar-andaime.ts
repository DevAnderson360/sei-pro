import { hojeISO } from "@comum/datas/dias";
import { chaveProtocolo } from "@projetos/modelo/vinculos";
import { checar, secao } from "./util";

export function verificarAndaime(): void {
  secao("Andaime: aliases do comum e do Projetos resolvem");
  checar("hojeISO tem o formato AAAA-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(hojeISO()));
  checar("chaveProtocolo do Projetos resolve", typeof chaveProtocolo("50300.001234/2026-11") === "string");
}
