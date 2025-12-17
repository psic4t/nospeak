import type { Message } from '$lib/db/db';

export function isCaptionMessage(messages: Message[], index: number): boolean {
  const msg = messages[index];
  if (!msg || msg.rumorKind !== 14 || !msg.parentRumorId) return false;

  const parentIndex = messages.findIndex(
    (m) => m.rumorId === msg.parentRumorId
  );
  if (parentIndex === -1) return false;

  const parent = messages[parentIndex];
  if (!parent || parent.rumorKind !== 15) return false;
  if (parent.direction !== msg.direction) return false;

  // Require that the caption appears immediately after its parent in the local timeline
  if (index !== parentIndex + 1) return false;

  return true;
}

export function getCaptionForParent(messages: Message[], index: number): Message | null {
  const msg = messages[index];
  if (!msg || msg.rumorKind !== 15) return null;

  const nextIndex = index + 1;
  const next = messages[nextIndex];
  if (!next || next.rumorKind !== 14 || !next.parentRumorId) return null;
  if (next.parentRumorId !== msg.rumorId) return null;
  if (next.direction !== msg.direction) return null;

  return next;
}
