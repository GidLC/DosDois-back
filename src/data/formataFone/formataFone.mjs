export const formataFone = (numero) => {
  if (!numero) return null
  
  // Remove espaços e caracteres não numéricos exceto o '+'
  let num = numero.toString().trim().replace(/[^\d+]/g, '')

  // Se já começa com +, mantém
  if (num.startsWith('+')) {
    return num
  }

  // Caso contrário, adiciona o +
  return `+${num}`
}
