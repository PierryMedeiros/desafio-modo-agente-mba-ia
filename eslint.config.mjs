// Lint do Balcão (G2, G5 e regras próprias R1). Lido por scripts/gates.mjs.
// As mensagens começam com o ID da regra entre colchetes; o gates usa esse prefixo
// para dizer qual invariante falhou. Sem prefixo, a violação conta como G2.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const processEnv = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: '[G5] process.env só pode aparecer em api/src/config/. Importe a configuração de lá.',
}
const importMetaEnv = {
  selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
  message: '[G5] import.meta.env só pode aparecer em web/src/config/. Importe a configuração de lá.',
}
const fixedAddress = {
  selector: 'Literal[value=/localhost|127\\.0\\.0\\.1|\\/tmp\\//], TemplateElement[value.raw=/localhost|127\\.0\\.0\\.1|\\/tmp\\//]',
  message:
    '[R1] Endereço fixo (localhost, 127.0.0.1 ou /tmp/) fora da pasta config. Cada cópia tem as suas portas e pastas: leia da configuração.',
}

export default tseslint.config(
  // .claude/ guarda as worktrees de agentes; nunca entram no lint desta cópia.
  { ignores: ['**/node_modules/**', '**/dist/**', '.claude/**', 'blackbox/**', 'harness/**'] },
  {
    files: ['api/**/*.{ts,mts}', 'web/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: 'error', noInlineConfig: true },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  // Os dois blocos abaixo só tiram config/ do escopo de G5 e R1 (é lá que env e endereços
  // podem aparecer). Nenhum arquivo sai do lint: config/ continua no bloco geral acima (G2).
  {
    files: ['api/src/**/*.ts'],
    ignores: ['api/src/config/**'],
    rules: { 'no-restricted-syntax': ['error', processEnv, fixedAddress] },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    ignores: ['web/src/config/**'],
    rules: { 'no-restricted-syntax': ['error', importMetaEnv, fixedAddress] },
  },
)
