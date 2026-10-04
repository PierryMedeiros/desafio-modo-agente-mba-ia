// Único lugar do front que lê import.meta.env e que conhece endereço fixo.
// Cada cópia do Balcão passa a própria VITE_API_URL; sem ela, vale o padrão local.
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000'
