# Kit de teste dos gates

Este kit testa os seus gates. Ele planta violações das invariantes G1 a G10, uma de cada vez, roda o seu comando de gates, confere se a violação aparece na lista final e desfaz tudo.

## Pré-requisitos

- `git status` limpo. O kit se recusa a rodar com pendências e não mexe em nada.
- Dependências instaladas (`api/` e `web/`).
- Gates passando antes de começar. O kit roda os gates sem violação primeiro (a linha de base). Se eles falharem, o resultado final não vale.

## Como rodar

```bash
bash kit-gates/verificar.sh . "<seu comando de gates>"
bash kit-gates/verificar.sh . "<seu comando de gates>" G4
```

A regra no fim (ex.: `G4`) é opcional e roda só as violações dela. O kit usa Bash, Git e npm, e roda no Linux e no macOS. Os logs de cada rodada ficam numa pasta temporária, informada no fim. Se você apertar Ctrl+C, a violação em andamento é desfeita.

## Formato de saída esperado

O seu comando de gates precisa terminar com uma linha por violação, com o ID da regra e o arquivo, por exemplo:

```
G4 api/src/http/routes/stats.ts
```

Para dependência sem uso, a linha traz também o nome da dependência. O kit procura a linha com o ID da regra e o arquivo da violação.

## Resultados

| Resultado | Significado | O que fazer |
|---|---|---|
| `barrada` | Os gates falharam e uma linha traz o ID e o arquivo. | Nada. |
| `fora do formato` | O ID e o arquivo aparecem, mas nunca na mesma linha. | Ajuste a lista final para uma linha por violação. |
| `sem o ID` | O arquivo aparece, mas o ID da regra não. | Faça a lista final trazer o ID. |
| `sem o arquivo` | O arquivo da violação não aparece na saída. | A ferramenta não viu a violação: revise a regra. Abra o log para conferir. |
| `NÃO BARRADA` | Os gates passaram com a violação plantada. | A regra tem uma lacuna: corrija a configuração. |
| `PULADA` | O repositório já tem o arquivo ou a dependência da violação. | Renomeie ou remova o que está no caminho e rode de novo. |

O aviso `conferir: cita N regras` aparece quando a saída liga o arquivo a mais de 4 regras. Não muda o resultado; abra o log e confira se a lista não está citando regra demais.

O kit sai com código 0 só se a linha de base passou e todas as violações saíram `barrada`.

## Observações

- Os arquivos do kit terminam em `.modelo` para que nenhuma ferramenta (TypeScript, lint, testes, knip) os analise. Eles só viram código dentro do repositório durante a rodada.
- Um gate que varre o repositório inteiro deve se restringir às pastas da regra (`api/src/`, `web/src/` e as pastas fixas do enunciado), para não ler o `kit-gates/`.
- A correção usa outras violações das mesmas regras, com outros nomes e outras formas de escrever o mesmo erro. Gate que só reconhece as violações deste kit não passa.
