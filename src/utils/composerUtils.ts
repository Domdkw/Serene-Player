export interface ParsedComposer {
  name: string;
  original: string;
}

export const parseComposers = (composerString: string): ParsedComposer[] => {
  if (!composerString || typeof composerString !== 'string') {
    return [];
  }

  const composers: ParsedComposer[] = [];
  
  const parts = composerString.split(/[,;&]/);
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed) {
      composers.push({
        name: trimmed,
        original: trimmed
      });
    }
  });

  return composers;
};

export const getUniqueComposers = (composerString: string): string[] => {
  const parsed = parseComposers(composerString);
  const uniqueNames = new Set(parsed.map(c => c.name.toLowerCase()));
  return Array.from(uniqueNames).map(name => 
    parsed.find(c => c.name.toLowerCase() === name)?.name || name
  );
};

export const formatComposers = (composers: string[], separator: string = ', '): string => {
  return composers.join(separator);
};

export const hasMultipleComposers = (composerString: string): boolean => {
  const parsed = parseComposers(composerString);
  return parsed.length > 1;
};

export const getPrimaryComposer = (composerString: string): string => {
  const parsed = parseComposers(composerString);
  return parsed.length > 0 ? parsed[0].name : '';
};

export const getComposerCount = (composerString: string): number => {
  return parseComposers(composerString).length;
};

export const normalizeComposerName = (name: string): string => {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
};

export const groupComposersByInitial = (composers: string[]): Record<string, string[]> => {
  const groups: Record<string, string[]> = {};
  
  composers.forEach(composer => {
    const normalized = normalizeComposerName(composer);
    const initial = normalized.charAt(0).toUpperCase();
    
    if (!groups[initial]) {
      groups[initial] = [];
    }
    
    if (!groups[initial].includes(normalized)) {
      groups[initial].push(normalized);
    }
  });
  
  Object.keys(groups).forEach(key => {
    groups[key].sort();
  });
  
  return groups;
};
