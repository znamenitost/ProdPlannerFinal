/** Parse denormalized task comment preview lines. */

export function parseCommentPreviewLines(preview) {
  return String(preview || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      // First line = baseline note: never treat as `Author: text` (text itself may contain `:`).
      if (index === 0) {
        const recipientOnly = line.match(/^→\s*(.+?):\s*(.*)$/);
        if (recipientOnly) {
          return {
            author: null,
            recipient: recipientOnly[1].trim(),
            text: recipientOnly[2].trim(),
            hideAuthor: true
          };
        }
        return { author: null, recipient: null, text: line, hideAuthor: true };
      }

      const withRecipient = line.match(/^(.+?)\s*→\s*(.+?):\s*(.*)$/);
      if (withRecipient) {
        return {
          author: withRecipient[1].trim(),
          recipient: withRecipient[2].trim(),
          text: withRecipient[3].trim(),
          hideAuthor: false
        };
      }

      const authorOnly = line.match(/^(.+?):\s*(.*)$/);
      if (authorOnly) {
        return {
          author: authorOnly[1].trim(),
          recipient: null,
          text: authorOnly[2].trim(),
          hideAuthor: false
        };
      }

      return { author: null, recipient: null, text: line, hideAuthor: false };
    });
}
