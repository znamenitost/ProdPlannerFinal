/**
 * Scroll the message list to a message and briefly highlight it.
 */
export function scrollToChatMessage(messageId) {
  if (!messageId) return;

  const anchor = document.querySelector(`[data-chat-message-id="${messageId}"]`);
  const article = anchor?.closest('[role="article"]');
  if (!article) return;

  article.scrollIntoView({ behavior: 'smooth', block: 'center' });
  article.setAttribute('data-chat-highlight', 'true');

  const clear = () => {
    article.removeAttribute('data-chat-highlight');
    article.removeEventListener('animationend', clear);
  };
  article.addEventListener('animationend', clear);
  window.setTimeout(clear, 1200);
}
