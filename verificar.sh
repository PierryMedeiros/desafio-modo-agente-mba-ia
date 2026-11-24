#!/usr/bin/env bash
# Uso: bash verificar.sh <pasta-do-repo> "<comando de gates>" [regra]
set -u

AQUI=$(cd "$(dirname "$0")" && pwd)
export LC_ALL=C

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  echo 'Uso: bash verificar.sh <pasta-do-repo> "<comando de gates>" [regra]' >&2
  exit 2
fi

REPO=$(cd "$1" 2>/dev/null && pwd -P) || { echo "Pasta nao encontrada: $1" >&2; exit 2; }
GATES=$2
REGRA=${3:-}

TOPO=$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null) || { echo "$REPO nao e um repositorio git." >&2; exit 2; }
TOPO=$(cd "$TOPO" && pwd -P)
if [ "$TOPO" != "$REPO" ]; then
  echo "Use a raiz do repositorio ($TOPO), nao uma subpasta." >&2
  exit 2
fi

SUJO=$(git -C "$REPO" status --porcelain)
if [ -n "$SUJO" ]; then
  echo "O repositorio precisa estar com o git status limpo. Nada foi alterado. Pendencias:" >&2
  echo "$SUJO" >&2
  exit 2
fi

LOGS=$(mktemp -d "${TMPDIR:-/tmp}/kit-gates.XXXXXX") || { echo "Nao foi possivel criar a pasta de logs." >&2; exit 2; }
RESULTADOS="$LOGS/resultados.txt"
: > "$RESULTADOS"

ARQ_CRIADOS=""
PASTAS_CRIADAS=""
PKGS_ALTERADOS=""

desfazer() {
  local p
  if [ -n "$ARQ_CRIADOS" ]; then
    while IFS= read -r p; do
      [ -n "$p" ] && rm -f "$p"
    done <<EOT
$ARQ_CRIADOS
EOT
  fi
  if [ -n "$PASTAS_CRIADAS" ]; then
    while IFS= read -r p; do
      [ -n "$p" ] && [ -d "$p" ] && find "$p" -depth -type d -empty -delete 2>/dev/null
    done <<EOT
$PASTAS_CRIADAS
EOT
  fi
  if [ -n "$PKGS_ALTERADOS" ]; then
    while IFS= read -r p; do
      [ -n "$p" ] && git -C "$REPO" checkout -q -- "$p" 2>/dev/null
    done <<EOT
$PKGS_ALTERADOS
EOT
  fi
  ARQ_CRIADOS=""
  PASTAS_CRIADAS=""
  PKGS_ALTERADOS=""
}

INTERROMPIDO=0
ao_interromper() {
  INTERROMPIDO=1
  desfazer
  echo
  echo "Interrompido: a violacao em andamento foi desfeita. Logs em $LOGS"
  exit "$1"
}
trap desfazer EXIT
trap 'ao_interromper 130' INT
trap 'ao_interromper 143' TERM

campo() {
  grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | tr -d '\r'
}

# Lista de violacoes a rodar
LISTA="$LOGS/lista.txt"
: > "$LISTA"
for v in "$AQUI"/violacoes/*/; do
  [ -f "${v}manifesto" ] || continue
  v=${v%/}
  if [ -n "$REGRA" ] && [ "$(campo regra "$v/manifesto")" != "$REGRA" ]; then
    continue
  fi
  echo "$v" >> "$LISTA"
done
TOTAL=$(wc -l < "$LISTA" | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  echo "Nenhuma violacao encontrada${REGRA:+ para a regra $REGRA}." >&2
  exit 2
fi

cd "$REPO" || exit 2

echo "Repositorio: $REPO"
echo "Comando de gates: $GATES"
echo "Violacoes: $TOTAL"
echo

echo "Linha de base: rodando os gates sem violacao..."
INICIO=$SECONDS
bash -c "$GATES" < /dev/null > "$LOGS/linha-de-base.log" 2>&1
BASE_RC=$?
if [ "$BASE_RC" -eq 0 ]; then
  echo "Linha de base: gates passaram ($((SECONDS - INICIO))s)."
else
  echo "AVISO: os gates falharam sem nenhuma violacao (codigo $BASE_RC). O resultado final so vale com os gates passando; seguindo mesmo assim. Veja $LOGS/linha-de-base.log"
fi
echo

limpa_ansi() {
  sed $'s/\x1b\\[[0-9;]*[A-Za-z]//g' "$1"
}

classificar() {
  # $1 log, $2 codigo, $3 regra, $4 termos (separados por |)
  local log=$1 rc=$2 id=$3 termos=$4 t viu_termo=0 mesma=0 viu_id=0 n=0 res
  EXTRA=""
  local limpo="$LOGS/limpo.tmp"
  limpa_ansi "$log" > "$limpo"
  local IFS_ANT=$IFS
  IFS='|'
  # shellcheck disable=SC2086
  set -- $termos
  IFS=$IFS_ANT
  local linhas="$LOGS/linhas.tmp"
  : > "$linhas"
  for t in "$@"; do
    if grep -qF -- "$t" "$limpo"; then
      viu_termo=1
      grep -F -- "$t" "$limpo" >> "$linhas"
      if grep -F -- "$t" "$limpo" | grep -qw -- "$id"; then
        mesma=1
      fi
    fi
  done
  if grep -qw -- "$id" "$limpo"; then viu_id=1; fi

  if [ "$rc" -eq 0 ]; then
    res="NÃO BARRADA"
  elif [ "$mesma" -eq 1 ]; then
    res="barrada"
  elif [ "$viu_termo" -eq 1 ] && [ "$viu_id" -eq 1 ]; then
    res="fora do formato"
  elif [ "$viu_termo" -eq 1 ]; then
    res="sem o ID"
  else
    res="sem o arquivo"
  fi

  if [ "$viu_termo" -eq 1 ]; then
    n=$(tr -c 'A-Za-z0-9_' '\n' < "$linhas" | grep -xE 'G(10|[1-9])' | sort -u | wc -l | tr -d ' ')
    if [ "$n" -gt 4 ]; then
      EXTRA=" (conferir: cita $n regras)"
    fi
  fi
  RESULTADO=$res
}

IDX=0
SUJOU=0
while IFS= read -r VDIR; do
  IDX=$((IDX + 1))
  NOME=$(basename "$VDIR")
  ID=$(campo regra "$VDIR/manifesto")
  TERMOS=$(campo cita "$VDIR/manifesto")
  DEP=$(campo dependencia "$VDIR/manifesto")
  PROG="[$IDX/$TOTAL] $NOME"

  ARQUIVOS="$LOGS/arquivos.tmp"
  : > "$ARQUIVOS"
  if [ -d "$VDIR/arquivos" ]; then
    find "$VDIR/arquivos" -type f -name '*.modelo' | sort > "$ARQUIVOS"
  fi

  PULAR=0
  while IFS= read -r F; do
    [ -n "$F" ] || continue
    REL=${F#"$VDIR/arquivos/"}
    if [ -e "$REPO/${REL%.modelo}" ]; then PULAR=1; fi
  done < "$ARQUIVOS"
  if [ -n "$DEP" ]; then
    set -- $DEP
    if [ -f "$REPO/$1/package.json" ] && grep -q "\"$2\"" "$REPO/$1/package.json"; then PULAR=1; fi
  fi
  if [ "$PULAR" -eq 1 ]; then
    echo "$PROG ... PULADA (o repositorio ja tem esse arquivo ou dependencia)"
    echo "PULADA|$NOME|" >> "$RESULTADOS"
    continue
  fi

  while IFS= read -r F; do
    [ -n "$F" ] || continue
    REL=${F#"$VDIR/arquivos/"}
    DEST="$REPO/${REL%.modelo}"
    D=$(dirname "$DEST")
    TOPO_NOVO=""
    while [ ! -d "$D" ]; do
      TOPO_NOVO=$D
      D=$(dirname "$D")
    done
    mkdir -p "$(dirname "$DEST")"
    if [ -n "$TOPO_NOVO" ]; then
      PASTAS_CRIADAS="$PASTAS_CRIADAS$TOPO_NOVO
"
    fi
    cp "$F" "$DEST"
    ARQ_CRIADOS="$ARQ_CRIADOS$DEST
"
  done < "$ARQUIVOS"

  if [ -n "$DEP" ]; then
    set -- $DEP
    PKG="$1/package.json"
    PKGS_ALTERADOS="$PKGS_ALTERADOS$PKG
"
    (cd "$REPO/$1" && npm pkg set "dependencies.$2=$3" < /dev/null > "$LOGS/$NOME.npm.log" 2>&1)
  fi

  INICIO=$SECONDS
  bash -c "$GATES" < /dev/null > "$LOGS/$NOME.log" 2>&1
  RC=$?
  DUR=$((SECONDS - INICIO))

  desfazer

  RESULTADO=""
  EXTRA=""
  classificar "$LOGS/$NOME.log" "$RC" "$ID" "$TERMOS"
  echo "$PROG ... $RESULTADO$EXTRA (${DUR}s, codigo $RC)"
  echo "$RESULTADO|$NOME|$EXTRA" >> "$RESULTADOS"

  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    SUJOU=1
    echo "    AVISO: o repositorio nao voltou limpo depois desta violacao."
  fi
done < "$LISTA"

echo
echo "Resumo:"
for R in "barrada" "fora do formato" "sem o ID" "sem o arquivo" "NÃO BARRADA" "PULADA"; do
  N=$(grep -c "^$R|" "$RESULTADOS")
  [ "$N" -gt 0 ] && echo "  $R: $N"
done
CONFERIR=$(grep -c 'conferir' "$RESULTADOS")
[ "$CONFERIR" -gt 0 ] && echo "  para conferir no log: $CONFERIR"
echo "Logs: $LOGS"

FINAL=$(git -C "$REPO" status --porcelain)
LIMPO=1
if [ -n "$FINAL" ]; then
  LIMPO=0
  echo
  echo "AVISO: o repositorio nao voltou limpo:"
  echo "$FINAL"
fi

SAIDA=0
if [ "$BASE_RC" -ne 0 ]; then
  echo "Resultado: a linha de base falhou, entao o resultado nao vale."
  SAIDA=1
fi
if grep -qv '^barrada|' "$RESULTADOS"; then
  SAIDA=1
fi
[ "$LIMPO" -eq 1 ] || SAIDA=1
if [ "$SAIDA" -eq 0 ]; then
  echo "Resultado: todas as violacoes foram barradas."
fi
exit "$SAIDA"
