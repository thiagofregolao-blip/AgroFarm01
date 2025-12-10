import type { Category } from "@shared/schema";

export interface CommissionCalculation {
  tier: "verde" | "amarela" | "vermelha" | "abaixo_lista";
  rate: number;
}

export function calculateCommission(category: Category, margin: number): CommissionCalculation {
  const greenMarginMin = parseFloat(category.greenMarginMin);
  const yellowMarginMin = parseFloat(category.yellowMarginMin);
  const yellowMarginMax = parseFloat(category.yellowMarginMax);
  const redMarginMin = parseFloat(category.redMarginMin);
  const redMarginMax = parseFloat(category.redMarginMax);
  
  // Verde (Green tier) - above green margin minimum
  if (margin >= greenMarginMin) {
    return {
      tier: "verde",
      rate: parseFloat(category.greenCommission),
    };
  }
  
  // Amarela (Yellow tier) - between yellow margin min and max
  if (margin >= yellowMarginMin && margin <= yellowMarginMax) {
    return {
      tier: "amarela", 
      rate: parseFloat(category.yellowCommission),
    };
  }
  
  // Vermelha (Red tier) - between red margin min and max
  if (margin >= redMarginMin && margin <= redMarginMax) {
    return {
      tier: "vermelha",
      rate: parseFloat(category.redCommission),
    };
  }
  
  // Below list - anything below red minimum
  return {
    tier: "abaixo_lista",
    rate: parseFloat(category.belowListCommission),
  };
}

export function getCommissionColor(tier: string): string {
  switch (tier) {
    case "verde":
      return "text-verde";
    case "amarela":
      return "text-amarela";
    case "vermelha":
      return "text-vermelha";
    case "abaixo_lista":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

export function getCommissionBadgeClass(tier: string): string {
  switch (tier) {
    case "verde":
      return "badge-verde";
    case "amarela":
      return "badge-amarela";
    case "vermelha":
      return "badge-vermelha";
    case "abaixo_lista":
      return "bg-muted text-muted-foreground";
    default:
      return "badge-verde";
  }
}
