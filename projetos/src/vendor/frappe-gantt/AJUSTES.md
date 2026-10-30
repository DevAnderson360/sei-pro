# Frappe Gantt 1.2.2 -- ajustes do SEI Pro

Origem: pacote npm `frappe-gantt@1.2.2` (sha1 do tarball `36bf15e74e179ac707341b663a49493a05a7fdf5`),
pasta `src/`. Licenca MIT original em `LICENSE`. Cada arquivo `.js` daqui comeca com `// @ts-nocheck`
e um cabecalho com a origem. Spec: `docs/superpowers/specs/2026-10-06-projetos-design.md`, secao 8.

Arquivos copiados: `index.js`, `bar.js`, `arrow.js`, `svg_utils.js`, `date_utils.js`, `defaults.js`.
Fora: `popup.js` (ajuste 1f) e `styles/` (ajuste 6). `arrow.js` e `date_utils.js` ficam como vieram
(so o cabecalho).

## 1. Sem innerHTML, outerHTML nem insertAdjacentHTML

Contrato do DOM seguro do SEI Pro: nada de HTML vindo de dado. O nome da etapa (`<img onerror=...>`) vira texto. `innerText` tambem sai: o linkedom das provas nao tem o setter, e `textContent` faz o mesmo aqui.

### 1a -- `svg_utils.js`: createSVG aceita textContent (rotulos sem HTML)

Original:

```js
        } else if (attr === 'innerHTML') {
            elem.innerHTML = attrs.innerHTML;
        } else if
```

Novo:

```js
        } else if (attr === 'textContent') {
            // SEI Pro (ajuste 1a): texto entra como no de texto, nunca como HTML
            elem.textContent = attrs.textContent;
        } else if
```

### 1a -- `bar.js`: createSVG aceita textContent (rotulos sem HTML)

Original:

```js
            innerHTML: this.task.name,
```

Novo:

```js
            textContent: this.task.name, // SEI Pro (ajuste 1a)
```

### 1b -- `index.js`: Esvaziar com replaceChildren()

Original:

```js
    clear() {
        this.$svg.innerHTML = '';
```

Novo:

```js
    clear() {
        this.$svg.replaceChildren(); // SEI Pro (ajuste 1b)
```

### 1b -- `bar.js`: Esvaziar com replaceChildren()

Original:

```js
        this.bar_group.innerHTML = '';
        this.handle_group.innerHTML = '';
```

Novo:

```js
        this.bar_group.replaceChildren(); // SEI Pro (ajuste 1b)
        this.handle_group.replaceChildren();
```

### 1c -- `index.js`: Setas do botao de ajuste com textContent

Original:

```js
        this.$adjust.innerHTML = '&larr;';
    }
```

Novo:

```js
        this.$adjust.textContent = '\u2190'; // SEI Pro (ajuste 1c)
    }
```

### 1c -- `index.js`: Setas do botao de ajuste com textContent

Original:

```js
                this.$adjust.innerHTML = '&larr;';
```

Novo:

```js
                this.$adjust.textContent = '\u2190'; // SEI Pro (ajuste 1c)
```

### 1c -- `index.js`: Setas do botao de ajuste com textContent

Original:

```js
                this.$adjust.innerHTML = '&rarr;';
```

Novo:

```js
                this.$adjust.textContent = '\u2192'; // SEI Pro (ajuste 1c)
```

### 1d -- `index.js`: Padrao diagonalHatch com createElementNS

Original:

```js
        this.layers.grid.innerHTML += `<pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2
                   M0,4 l4,-4
                   M3,5 l2,-2"
                style="stroke:grey; stroke-width:0.3" />
        </pattern>`;
```

Novo:

```js
        // SEI Pro (ajuste 1d): padrao criado com createElementNS, sem HTML em texto
        const $hachura = createSVG('pattern', {
            id: 'diagonalHatch',
            patternUnits: 'userSpaceOnUse',
            width: 4,
            height: 4,
            append_to: this.layers.grid,
        });
        createSVG('path', {
            d: 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2',
            style: 'stroke:grey; stroke-width:0.3',
            append_to: $hachura,
        });
```

### 1e -- `index.js`: Textos da escala com textContent (innerText nao existe no linkedom)

Original:

```js
                $lower_text.innerText = date.lower_text;
```

Novo:

```js
                $lower_text.textContent = date.lower_text; // SEI Pro (ajuste 1e)
```

### 1e -- `index.js`: Textos da escala com textContent (innerText nao existe no linkedom)

Original:

```js
                $upper_text.innerText = date.upper_text;
```

Novo:

```js
                $upper_text.textContent = date.upper_text; // SEI Pro (ajuste 1e)
```

### 1f -- `index.js`: Modulo popup fora (popup: false e balao proprio)

Original:

```js
import Popup from './popup';
```

Novo:

```js
(linha removida)
```

### 1f -- `index.js`: Modulo popup fora (popup: false e balao proprio)

Original:

```js
    show_popup(opts) {
        if (this.options.popup === false) return;
        if (!this.popup) {
            this.popup = new Popup(
                this.$popup_wrapper,
                this.options.popup,
                this,
            );
        }
        this.popup.show(opts);
    }
```

Novo:

```js
    // SEI Pro (ajuste 1f): modulo popup removido (o SEI Pro usa balao proprio)
    show_popup() {}
```

### 1f -- `defaults.js`: Modulo popup fora (popup: false e balao proprio)

Original:

```js
    popup: (ctx) => {
        ctx.set_title(ctx.task.name);
        if (ctx.task.description) ctx.set_subtitle(ctx.task.description);
        else ctx.set_subtitle('');

        const start_date = date_utils.format(
            ctx.task._start,
            'MMM D',
            ctx.chart.options.language,
        );
        const end_date = date_utils.format(
            date_utils.add(ctx.task._end, -1, 'second'),
            'MMM D',
            ctx.chart.options.language,
        );
        const word = ctx.task.actual_duration === 1 ? 'day' : 'days';

        ctx.set_details(
            `${start_date} - ${end_date} (${ctx.task.actual_duration} ${word}${ctx.task.ignored_duration ? ' + ' + ctx.task.ignored_duration + ' excluded' : ''})<br/>Progress: ${Math.floor(ctx.task.progress * 100) / 100}%`,
        );
    },
```

Novo:

```js
    popup: false, // SEI Pro (ajuste 1f): sem popup da biblioteca
```

## 2. custom_class com varias classes

A 1.2.2 faz `classList.add(custom_class)`, e o navegador lanca `InvalidCharacterError` com espaco no token. O wrapper manda `st-marco st-atrasada`.

### 2 -- `bar.js`: custom_class com varias classes separadas por espaco

Original:

```js
        if (this.task.custom_class) {
            this.group.classList.add(this.task.custom_class);
        } else {
            this.group.classList = ['bar-wrapper'];
        }
```

Novo:

```js
        // SEI Pro (ajuste 2): custom_class aceita varias classes separadas por espaco
        this.group.setAttribute('class', 'bar-wrapper');
        for (const cls of String(this.task.custom_class || '')
            .split(/\s+/)
            .filter(Boolean))
            this.group.classList.add(cls);
```

## 3. view_mode informado e respeitado

A 1.2.2 forca `view_modes[0]` sempre que `view_modes` e passado (a tela de referencia precisava de um `change_view_mode` extra, que desenha duas vezes).

### 3 -- `index.js`: view_mode informado e respeitado com view_modes

Original:

```js
            // automatically set the view mode to the first option
            options.view_mode = options.view_modes[0];
```

Novo:

```js
            // SEI Pro (ajuste 3): respeita o view_mode informado; so cai no primeiro se ele nao existir
            const pedido =
                typeof options.view_mode === 'string'
                    ? options.view_mode
                    : options.view_mode?.name;
            options.view_mode =
                options.view_modes.find((m) => m && m.name === pedido) ||
                options.view_modes[0];
```

## 4. Gancho after_render(gantt, barra?)

As decoracoes (losango do marco, fase fina, linha de base) precisam rodar depois do desenho e depois de cada `update_label_position`, que a Frappe chama num `requestAnimationFrame` e a cada passo do arraste (senao o rotulo volta para o lugar dela).

### 4 -- `index.js`: Gancho after_render(gantt, barra?)

Original:

```js
        this.set_dimensions();
        this.set_scroll_position(this.options.scroll_to);
    }
```

Novo:

```js
        this.set_dimensions();
        this.set_scroll_position(this.options.scroll_to);
        this.notificar_desenho(); // SEI Pro (ajuste 4)
    }

    // SEI Pro (ajuste 4): gancho pos-desenho. Sem barra: fim do render (desenho inteiro).
    // Com barra: fim de Bar.update_label_position (depois do desenho da barra, do refresh e de cada passo de arraste).
    notificar_desenho(bar) {
        if (typeof this.options.after_render === 'function')
            this.options.after_render(this, bar);
    }
```

### 4 -- `bar.js`: Gancho after_render(gantt, barra?)

Original:

```js
                label.setAttribute(
                    'x',
                    bar.getX() + barWidth / 2 - labelWidth / 2,
                );
            }
        }
    }
```

Novo:

```js
                label.setAttribute(
                    'x',
                    bar.getX() + barWidth / 2 - labelWidth / 2,
                );
            }
        }
        this.gantt.notificar_desenho(this); // SEI Pro (ajuste 4)
    }
```

## 5. Idioma pt-BR

`language: "pt-BR"` ja funciona (meses por `Intl`). As escalas em portugues (Dia, Semana, Mes, Ano) ficam no wrapper, em `src/gantt/escalas.ts`. Nenhuma mudanca no fonte.

## 6. Licenca, cabecalho e CSS

Licenca MIT preservada em `LICENSE`; cabecalho de origem em cada arquivo. O `import './styles/gantt.css'` sai do `index.js`: o CSS da biblioteca (de `dist/frappe-gantt.css`) vai para `projetos/estatico/gantt.css`, junto dos tokens `--spro-*`.

### 6 -- `index.js`: CSS fora do JS (vai para projetos/estatico/gantt.css)

Original:

```js
import './styles/gantt.css';
```

Novo:

```js
(linha removida)
```

## 7. Tipos minimos

`tipos.d.ts` descreve so o que o wrapper usa; `index.d.ts` e `date_utils.d.ts` reexportam dele para o TypeScript achar os tipos ao importar os `.js`. O Biome ignora `src/vendor/`.

## 8. Rolagem tolerante a escala sem texto superior

Na escala Ano o texto superior e vazio; a 1.2.2 procura o elemento pelo texto e quebra com `TypeError` em `$el.clientWidth` (no render e na rolagem).

### 8 -- `index.js`: Rolagem tolerante a escala sem texto superior (Ano)

Original:

```js
        let $el = this.upperTexts.find(
            (el) => el.textContent === current_upper,
        );

        // Recalculate
        this.current_date = date_utils.add(
```

Novo:

```js
        let $el = this.upperTexts.find(
            (el) => el.textContent === current_upper,
        );
        if (!$el) return; // SEI Pro (ajuste 8): escala sem texto superior nesta data

        // Recalculate
        this.current_date = date_utils.add(
```

### 8 -- `index.js`: Rolagem tolerante a escala sem texto superior (Ano)

Original:

```js
        $el = this.upperTexts.find((el) => el.textContent === current_upper);
        $el.classList.add('current-upper');
        this.$current = $el;
```

Novo:

```js
        $el = this.upperTexts.find((el) => el.textContent === current_upper);
        if (!$el) return; // SEI Pro (ajuste 8)
        $el.classList.add('current-upper');
        this.$current = $el;
```

### 8 -- `index.js`: Rolagem tolerante a escala sem texto superior (Ano)

Original:

```js
                ((e.currentTarget.scrollLeft + $el.clientWidth) /
```

Novo:

```js
                ((e.currentTarget.scrollLeft + ($el ? $el.clientWidth : 0)) / // SEI Pro (ajuste 8)
```

### 8 -- `index.js`: Rolagem tolerante a escala sem texto superior (Ano)

Original:

```js
            if ($el !== this.$current) {
```

Novo:

```js
            if ($el && $el !== this.$current) { // SEI Pro (ajuste 8)
```

## 9. destroy() sem ouvinte esquecido

A 1.2.2 poe um ouvinte anonimo de `mouseup` no `document` e nunca tira; o painel recria o Gantt a cada mudanca, e os ouvintes (com o Gantt antigo preso neles) se acumulariam.

### 9 -- `index.js`: destroy() sem ouvinte esquecido no document

Original:

```js
        document.addEventListener('mouseup', () => {
            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
            this.$container
                .querySelector('.visible')
                ?.classList?.remove?.('visible');
        });
```

Novo:

```js
        // SEI Pro (ajuste 9): ouvinte guardado para o destroy() tirar do document
        this._ao_soltar_documento = () => {
            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
            this.$container
                .querySelector('.visible')
                ?.classList?.remove?.('visible');
        };
        document.addEventListener('mouseup', this._ao_soltar_documento);
```

### 9 -- `index.js`: destroy() sem ouvinte esquecido no document

Original:

```js
        this.popup?.hide?.();
    }
}
```

Novo:

```js
        this.popup?.hide?.();
    }

    // SEI Pro (ajuste 9): desmonta sem deixar ouvinte no document (o painel recria o Gantt a cada mudanca)
    destroy() {
        document.removeEventListener('mouseup', this._ao_soltar_documento);
        this.$container.remove();
    }
}
```
