// Obtener preguntas de seguridad desde la base de datos
export interface SecurityQuestion {
  id: number
  question: string
}

// Obtener una pregunta aleatoria del array de preguntas
export function getRandomSecurityQuestion(questions: SecurityQuestion[]): SecurityQuestion {
  const randomIndex = Math.floor(Math.random() * questions.length)
  return questions[randomIndex]
}
