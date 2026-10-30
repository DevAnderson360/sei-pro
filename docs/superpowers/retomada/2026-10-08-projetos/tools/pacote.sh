#!/bin/bash
# uso: pacote.sh BASE HEAD SAIDA  — diff sem os bundles gerados de dist/js
B=$1; H=$2; O=$3
{ echo "# Commits"; git log --oneline $B..$H; echo; echo "# Stat (inclui dist)"; git diff --stat $B..$H; echo; echo "# Bundles gerados (dist/js) conferidos por bytes > 0x7f:"; for f in $(git diff --name-only $B..$H -- dist/js); do [ -f "$f" ] && n=$(LC_ALL=C grep -c -P '[\x80-\xff]' "$f" 2>/dev/null || LC_ALL=C perl -ne '$c++ if /[\x80-\xff]/; END{print $c+0}' "$f"); echo "$f: linhas com byte>0x7f = $n"; done; echo; echo "# Diff (sem dist/js gerado)"; git diff -U10 $B..$H -- . ':(exclude)dist/js/favoritos' ':(exclude)dist/js/historico' ':(exclude)dist/js/init_favoritos.js' ':(exclude)dist/js/init_historico.js' ':(exclude)dist/js/projetos' ':(exclude)dist/js/init_projetos.js' ':(exclude)dist/js/agente' ':(exclude)dist/js/init_agente.js' ':(exclude)dist/js/sei-nucleo.js' ':(exclude)docs/superpowers/plans'; } > "$O"
echo "$O: $(wc -c < "$O") bytes"
