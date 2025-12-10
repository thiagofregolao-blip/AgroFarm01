export type VisitStatus = "PLANEJADA"|"PRONTA"|"EM_DESLOCAMENTO"|"NO_LOCAL"|"CONCLUIDA";

const transitions: Record<VisitStatus, VisitStatus[]> = {
  PLANEJADA: ["PRONTA","EM_DESLOCAMENTO"],
  PRONTA: ["EM_DESLOCAMENTO","PLANEJADA"],
  EM_DESLOCAMENTO: ["NO_LOCAL","PLANEJADA"],
  NO_LOCAL: ["CONCLUIDA","EM_DESLOCAMENTO"],
  CONCLUIDA: []
};

export function canTransition(from: VisitStatus, to: VisitStatus) {
  return transitions[from]?.includes(to);
}
