# Kit do corretor: desafio 2 (Balcão)

Kit privado. Nunca vai para o aluno nem para a `main`.

Ele planta 23 violações das invariantes G1 a G10, uma de cada vez, roda o comando de gates do aluno, confere a linha com o ID e o arquivo e desfaz tudo. As violações são outras formas dos mesmos erros do kit público do aluno (`kit-gates/`), com outros nomes de arquivo.

## Como usar

Use sempre o script desta branch, nunca o do repositório do aluno, que pode ter sido alterado.

Rode no passo 5 do Fluxo do avaliador, na `copia-a` já no ar e com `git status` limpo:

```bash
bash verificar.sh <copia-a> "<comando de gates do README do aluno>"
bash verificar.sh <copia-a> "<comando de gates do README do aluno>" G5
```

A regra no fim é opcional. O script usa Bash, Git e npm, e roda no Linux e no macOS. Os logs ficam numa pasta temporária, informada no fim.

## Critério

- A linha de base (gates sem violação) passa.
- Todas as violações saem `barrada`. O script sai com código 0 só nesse caso.

## Resultados

| Resultado | Significado |
|---|---|
| `barrada` | Os gates falharam e uma linha traz o ID e o arquivo. |
| `fora do formato` | ID e arquivo aparecem, mas nunca na mesma linha: reprova o formato da lista. |
| `sem o ID` | O arquivo aparece, o ID não. |
| `sem o arquivo` | O arquivo não aparece na saída. |
| `NÃO BARRADA` | Os gates passaram com a violação plantada. |
| `PULADA` | O repositório já tinha o arquivo ou a dependência. |

O aviso "conferir: cita N regras" não muda o resultado: abra o log da violação e confira. Os logs ficam na pasta informada no fim.

## Tempo

Uma rodada completa leva cerca de 2 minutos quando os gates do aluno levam de 4 a 8 segundos (medido numa solução de teste: 23 violações em 1min55). Conte a linha de base mais cerca de 5 segundos por violação.

## Conteúdo

- `verificar.sh`: o mesmo script do kit do aluno.
- `violacoes/`: uma pasta por violação, com `manifesto` e `arquivos/` (sufixo `.modelo`).
