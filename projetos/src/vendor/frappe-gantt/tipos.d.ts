/**
 * Tipos minimos da Frappe Gantt 1.2.2 ajustada: so o que o wrapper do SEI Pro (src/gantt/) usa.
 * A biblioteca e JS puro; estes tipos descrevem o contrato, nao a implementacao inteira.
 */

export interface TarefaFrappe {
  id: string;
  name: string;
  /** "AAAA-MM-DD" (meia-noite local). */
  start: string;
  /** "AAAA-MM-DD", inclusive (a biblioteca soma 24 h). */
  end: string;
  progress: number;
  /** Ids separados por virgula. A biblioteca troca por array ao montar. */
  dependencies?: string | string[];
  /** Varias classes separadas por espaco (ajuste 2). */
  custom_class?: string;
  _start?: Date;
  _end?: Date;
  _index?: number;
}

export type TextoDaEscala = string | ((data: Date, anterior: Date | null, idioma: string) => string);

export interface ModoDeVisao {
  name: string;
  padding?: string | [string, string];
  step: string;
  column_width?: number;
  date_format?: string;
  lower_text?: TextoDaEscala;
  upper_text?: TextoDaEscala;
  thick_line?: (data: Date) => boolean;
  upper_text_frequency?: number;
  snap_at?: string;
}

export interface FeriadoFrappe {
  /** "AAAA-MM-DD". */
  date: string;
  name: string;
}

export interface OpcoesFrappe {
  language?: string;
  view_modes?: ModoDeVisao[];
  /** Respeitado mesmo com view_modes (ajuste 3). */
  view_mode?: string;
  bar_height?: number;
  padding?: number;
  upper_header_height?: number;
  lower_header_height?: number;
  bar_corner_radius?: number;
  arrow_curve?: number;
  container_height?: "auto" | number;
  today_button?: boolean;
  view_mode_select?: boolean;
  /** Sempre false: o modulo popup foi removido (ajuste 1f). */
  popup?: false;
  readonly?: boolean;
  readonly_dates?: boolean;
  readonly_progress?: boolean;
  move_dependencies?: boolean;
  infinite_padding?: boolean;
  lines?: "both" | "vertical" | "horizontal" | "none";
  /** "AAAA-MM-DD", "today", "start", "end" ou null (inicio). */
  scroll_to?: string | null;
  /** Cor CSS -> "weekend" ou lista de feriados com nome. */
  holidays?: Record<string, "weekend" | FeriadoFrappe[]>;
  on_click?: (tarefa: TarefaFrappe) => void;
  on_date_change?: (tarefa: TarefaFrappe, inicio: Date, fim: Date) => void;
  on_view_change?: (modo: ModoDeVisao) => void;
  /** Gancho pos-desenho (ajuste 4): sem barra no fim do render; com barra depois de cada atualizacao da barra. */
  after_render?: (gantt: Gantt, barra?: BarraFrappe) => void;
}

export interface BarraFrappe {
  task: TarefaFrappe;
  group: SVGGElement;
  bar_group: SVGGElement;
  $bar: SVGRectElement;
  $bar_progress?: SVGRectElement;
  /** Linha da barra (constante; o atributo y do $bar pode ter sido mudado pela decoracao). */
  y: number;
  height: number;
}

export interface UtilitariosDeData {
  parse(data: string | Date): Date;
  diff(a: Date, b: Date, escala?: string): number;
  convert_scales(periodo: string, para: string): number;
  add(data: Date, quantidade: number, escala: string): Date;
}

export declare const utilitariosDeData: UtilitariosDeData;

export default class Gantt {
  constructor(area: HTMLElement, tarefas: TarefaFrappe[], opcoes: OpcoesFrappe);
  options: OpcoesFrappe;
  config: { column_width: number; step: number; unit: string; header_height: number; view_mode: ModoDeVisao };
  gantt_start: Date;
  gantt_end: Date;
  bars: BarraFrappe[];
  tasks: TarefaFrappe[];
  $container: HTMLElement;
  $svg: SVGSVGElement;
  change_view_mode(modo?: string, manterPosicao?: boolean): void;
  scroll_current(): void;
  get_bar(id: string): BarraFrappe | undefined;
  /** Ajuste 9: tira o ouvinte do document e o conteiner da pagina. */
  destroy(): void;
}
