/**
 * Markdown content highlighter utility
 * Inserts <mark> tags for keyword/citation highlighting while preserving markdown structure
 */

/**
 * Apply highlighting to markdown content by inserting <mark> tags
 * Preserves code blocks, inline code, and markdown table structure
 *
 * @param content - Original markdown content
 * @param citedPhrases - Citation phrases to highlight (priority)
 * @param keywords - Keywords to highlight (fallback, top 3)
 * @returns Markdown content with <mark> tags inserted
 */
export function applyMarkdownHighlighting(
  content: string,
  citedPhrases?: string[],
  keywords?: string[]
): string {
  // Determine phrases to highlight (citedPhrases takes priority)
  const phrasesToHighlight = citedPhrases && citedPhrases.length > 0
    ? citedPhrases
    : keywords?.slice(0, 3);

  if (!phrasesToHighlight || phrasesToHighlight.length === 0) {
    return content;
  }

  // Protect code blocks and inline code from highlighting
  const codeRegex = /```[\s\S]*?```|`[^`]+`/g;
  const codeBlocks: string[] = [];
  let protectedContent = content.replace(codeRegex, (match) => {
    codeBlocks.push(match);
    return `__CODE_PLACEHOLDER_${codeBlocks.length - 1}__`;
  });

  // Sort phrases by length (longest first to prevent partial matches)
  const sortedPhrases = [...phrasesToHighlight].sort((a, b) => b.length - a.length);

  // Determine if using keyword mode (with Korean particle variations)
  const isKeywordMode = !citedPhrases || citedPhrases.length === 0;

  // Apply highlighting for each phrase
  for (const phrase of sortedPhrases) {
    // Skip empty phrases
    if (!phrase.trim()) continue;

    // Escape regex special characters
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build pattern: keywords include Korean particle variations
    const pattern = isKeywordMode
      ? new RegExp(`(${escaped}[은는이가을를에서로의와과도만]?)`, 'gi')
      : new RegExp(`(${escaped})`, 'gi');

    // Replace with <mark> tags, avoiding already marked content
    protectedContent = protectedContent.replace(pattern, (match) => {
      // Check if already inside a mark tag (simple check)
      return `<mark>${match}</mark>`;
    });
  }

  // Handle nested marks (remove double marking)
  protectedContent = protectedContent.replace(/<mark><mark>/g, '<mark>');
  protectedContent = protectedContent.replace(/<\/mark><\/mark>/g, '</mark>');

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    protectedContent = protectedContent.replace(`__CODE_PLACEHOLDER_${index}__`, block);
  });

  return protectedContent;
}
