export function classifySeason(dueDate: Date): string {
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth() + 1;
  const day = dueDate.getDate();
  
  // Soja Verão - vencimento 30/03 ou 30/04
  if ((month === 3 && day === 30) || (month === 4 && day === 30)) {
    return `Soja ${year % 100}/${(year + 1) % 100}`;
  }
  
  // Soja Safrinha - vencimento 30/06
  if (month === 6 && day === 30) {
    return `Soja Safrinha ${year}`;
  }
  
  // Milho - vencimento 30/08
  if (month === 8 && day === 30) {
    return `Milho ${year % 100}/${year % 100}`;
  }
  
  // Trigo - vencimento 30/10
  if (month === 10 && day === 30) {
    return `Trigo ${year}`;
  }
  
  // Default case
  return `Safra ${year}`;
}

export function getSeasonType(dueDate: Date): string {
  const month = dueDate.getMonth() + 1;
  const day = dueDate.getDate();
  
  if ((month === 3 && day === 30) || (month === 4 && day === 30)) {
    return "soja_verao";
  }
  
  if (month === 6 && day === 30) {
    return "soja_safrinha";
  }
  
  if (month === 8 && day === 30) {
    return "milho";
  }
  
  if (month === 10 && day === 30) {
    return "trigo";
  }
  
  return "other";
}

export function getValidCategoriesForSeason(seasonType: string): string[] {
  const commonCategories = [
    "cat-fertilizantes",
    "cat-corretivos",
    "cat-especialidades",
    "cat-agroquimicos"
  ];

  switch (seasonType) {
    case "soja_verao":
    case "soja_safrinha":
      return [...commonCategories, "cat-sem-soja"];
    
    case "milho":
      return [...commonCategories, "cat-sem-milho"];
    
    case "trigo":
      return [...commonCategories, "cat-sem-trigo"];
    
    case "other":
      return [...commonCategories, "cat-sem-diversas"];
    
    default:
      return commonCategories;
  }
}

export function getSeasonTypeFromName(seasonName: string): string {
  const nameLower = seasonName.toLowerCase();
  
  if (nameLower.includes('soja') && nameLower.includes('safrinha')) {
    return "soja_safrinha";
  }
  
  if (nameLower.includes('soja')) {
    return "soja_verao";
  }
  
  if (nameLower.includes('milho')) {
    return "milho";
  }
  
  if (nameLower.includes('trigo')) {
    return "trigo";
  }
  
  return "other";
}
