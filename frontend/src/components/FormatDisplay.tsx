import React from 'react';

interface FormatDisplayProps {
  formatCategory?: string;
  formatSubtype?: string;
  format?: string; // Fallback for existing data
  className?: string;
  variant?: 'full' | 'compact' | 'category-only' | 'subtype-only';
}

export default function FormatDisplay({ 
  formatCategory, 
  formatSubtype, 
  format, 
  className = "",
  variant = 'full'
}: FormatDisplayProps) {
  // Use the more specific format information if available, otherwise fallback to legacy format
  const displayCategory = formatCategory || format;
  const displaySubtype = formatSubtype;
  
  // If we don't have any format information, return null
  if (!displayCategory && !displaySubtype && !format) {
    return null;
  }

  const renderContent = () => {
    switch (variant) {
      case 'category-only':
        return displayCategory || format || 'Unknown Format';
      
      case 'subtype-only':
        return displaySubtype || displayCategory || format || 'Unknown Format';
      
      case 'compact':
        if (displaySubtype && displayCategory) {
          // Show abbreviated version for compact display
          const categoryAbbr = getCategoryAbbreviation(displayCategory);
          return `${categoryAbbr}: ${displaySubtype}`;
        }
        return displayCategory || format || 'Unknown Format';
      
      case 'full':
      default:
        if (displaySubtype && displayCategory) {
          return (
            <span className="format-display">
              <span className="format-category text-gray-600">{displayCategory}</span>
              <span className="format-separator text-gray-400 mx-1">•</span>
              <span className="format-subtype font-medium">{displaySubtype}</span>
            </span>
          );
        }
        return displayCategory || format || 'Unknown Format';
    }
  };

  return (
    <span className={`format-display-wrapper ${className}`} title={getFullFormatTitle(displayCategory, displaySubtype, format)}>
      {renderContent()}
    </span>
  );
}

// Helper function to get category abbreviations for compact display
function getCategoryAbbreviation(category: string): string {
  const abbreviations: Record<string, string> = {
    'Television - Scripted': 'TV-S',
    'Television - Unscripted': 'TV-U',
    'Film': 'Film',
    'Animation (Series)': 'Anim',
    'Audio': 'Audio',
    'Digital / Emerging': 'Digital',
    'Stage-to-Screen': 'Stage',
    'Other': 'Other'
  };
  
  return abbreviations[category] || category.substring(0, 6);
}

// Helper function to get full format title for tooltip
function getFullFormatTitle(category?: string, subtype?: string, fallbackFormat?: string): string {
  if (category && subtype) {
    return `${category} - ${subtype}`;
  }
  return category || fallbackFormat || 'Format information not available';
}

// Export format categories and subtypes for reuse
export const FORMAT_CATEGORIES = {
  'Television - Scripted': [
    'Narrative Series (ongoing)',
    'Limited Series (closed-ended)',
    'Soap/Continuing Drama',
    'Anthology Series'
  ],
  'Television - Unscripted': [
    'Documentary One-off',
    'Documentary Series',
    'Docudrama / Hybrid',
    'Reality Series (competition, dating, makeover, Docu-reality)',
    'Game / Quiz Show',
    'Talk / Variety / Sketch Show',
    'Lifestyle / Factual Entertainment'
  ],
  'Film': [
    'Feature Narrative (live action)',
    'Feature Documentary',
    'Feature Animation',
    'Anthology / Omnibus Film',
    'Short Film / Short Documentary'
  ],
  'Animation (Series)': [
    'Kids Series',
    'Adult Series',
    'Limited Series / Specials'
  ],
  'Audio': [
    'Podcast - Drama (scripted fiction)',
    'Podcast - Documentary (non-fiction)',
    'Podcast - Hybrid / Docudrama'
  ],
  'Digital / Emerging': [
    'Web Series / Digital-first Series',
    'Interactive / Immersive (VR/AR, choose-your-own path)'
  ],
  'Stage-to-Screen': [
    'Recorded Theatre',
    'Comedy Specials',
    'Performance Hybrids'
  ],
  'Other': [
    'Custom Format (please specify)'
  ]
};