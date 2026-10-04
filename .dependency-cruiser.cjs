// Regras de dependência do Balcão (G4, G6, G7, G8, G9 e R2). Lido por scripts/gates.mjs.
// O nome de cada regra começa com o ID da invariante; o gates usa esse prefixo.
// tsPreCompilationDeps: true faz o cruiser enxergar também `import type`, que o
// compilador apagaria (G6 e G8 contam imports só de tipo).
const node = '(^|/)node_modules/'

module.exports = {
  forbidden: [
    {
      name: 'G4-http-sem-prisma-nem-repositories',
      comment: 'A camada http fala com services, nunca com o banco.',
      severity: 'error',
      from: { path: '^api/src/http/' },
      to: { path: [`${node}(@prisma/client|\\.prisma)/`, '^api/src/repositories/', '^@prisma/client$'] },
    },
    {
      name: 'G6-services-sem-express-multer-http',
      comment: 'Regra de negócio não conhece o transporte HTTP, nem por tipo.',
      severity: 'error',
      from: { path: '^api/src/services/' },
      to: {
        path: [`${node}(express|multer|@types/express|@types/multer|express-serve-static-core|@types/express-serve-static-core)/`, '^api/src/http/', '^(express|multer)$'],
      },
    },
    {
      name: 'G7-openai-so-em-integrations',
      comment: 'O SDK da OpenAI fica atrás do cliente de IA em api/src/integrations/.',
      severity: 'error',
      from: { pathNot: '^api/src/integrations/' },
      to: { path: [`${node}openai/`, '^openai(/|$)'] },
    },
    {
      name: 'G8-web-sem-api',
      comment: 'O front não importa nada de api/, nem tipos: o contrato é o HTTP.',
      severity: 'error',
      from: { path: '^web/' },
      to: { path: '^api/' },
    },
    {
      name: 'G9-sem-ciclo',
      comment: 'Nenhum import circular em api/src nem em web/src.',
      severity: 'error',
      from: { path: '^(api|web)/src/' },
      to: { circular: true },
    },
    {
      name: 'R2-prisma-so-em-repositories',
      comment:
        'Só api/src/repositories/ (e a seed) usa o Prisma. O worker criava o próprio PrismaClient lendo process.env e ignorava a configuração da cópia.',
      severity: 'error',
      from: { path: '^api/src/', pathNot: '^api/src/repositories/' },
      to: { path: [`${node}(@prisma/client|\\.prisma)/`, '^@prisma/client$'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
}
