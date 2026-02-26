import { messageRepo } from '$lib/db/MessageRepository';
import { conversationRepo, isGroupConversationId } from '$lib/db/ConversationRepository';
import { profileRepo } from '$lib/db/ProfileRepository';
import { get } from 'svelte/store';
import { currentUser } from '$lib/stores/auth';
import type { Message } from '$lib/db/db';

/**
 * Resolve a display name for an npub.
 * Returns the profile name/display_name if available, otherwise a truncated npub.
 */
async function resolveDisplayName(npub: string): Promise<string> {
    const profile = await profileRepo.getProfileIgnoreTTL(npub);
    const name = profile?.metadata?.display_name || profile?.metadata?.name;
    if (name) return name;
    return npub.slice(0, 12) + '...' + npub.slice(-4);
}

/**
 * Format a timestamp (ms) into a time string like "14:32".
 */
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format a timestamp (ms) into a date string like "February 25, 2026".
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format a timestamp (ms) into a short date for the filename like "2026-02-25".
 */
function formatDateShort(timestamp: number): string {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Describe a media message as a placeholder string.
 */
function describeMedia(msg: Message): string {
    if (msg.location) {
        return `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`;
    }
    if (msg.fileType) {
        if (msg.fileType.startsWith('image/')) return '[Image]';
        if (msg.fileType.startsWith('video/')) return '[Video]';
        if (msg.fileType.startsWith('audio/')) return '[Audio]';
        return `[File: ${msg.fileType}]`;
    }
    if (msg.fileUrl) return '[File]';
    return '';
}

/**
 * Build the HTML content for a chat export.
 */
function buildHtml(
    title: string,
    messages: Message[],
    nameMap: Map<string, string>,
    selfNpub: string
): string {
    const exportDate = formatDate(Date.now());

    let messagesHtml = '';
    let lastDateLabel = '';

    for (const msg of messages) {
        const dateLabel = formatDate(msg.sentAt);
        if (dateLabel !== lastDateLabel) {
            messagesHtml += `<div class="date">${escapeHtml(dateLabel)}</div>\n`;
            lastDateLabel = dateLabel;
        }

        const time = formatTime(msg.sentAt);
        let senderName: string;
        if (msg.direction === 'sent') {
            senderName = 'You';
        } else if (msg.senderNpub) {
            senderName = nameMap.get(msg.senderNpub) ?? msg.senderNpub.slice(0, 12) + '...';
        } else {
            senderName = nameMap.get(msg.recipientNpub) ?? msg.recipientNpub.slice(0, 12) + '...';
        }

        const media = describeMedia(msg);
        const text = msg.message ? escapeHtml(msg.message) : '';
        const content = [text, media].filter(Boolean).join(' ');

        messagesHtml += `<div class="msg"><span class="meta">${time}</span> <span class="sender">${escapeHtml(senderName)}:</span> ${content || '<em>empty</em>'}</div>\n`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} - nospeak export</title>
<style>
body { font-family: monospace; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.5; }
h1 { font-size: 1.3em; margin-bottom: 0.2em; }
.info { color: #888; margin-bottom: 1em; font-size: 0.9em; }
.date { text-align: center; color: #888; margin: 16px 0 8px; font-size: 0.85em; }
.msg { margin: 4px 0; }
.meta { color: #888; font-size: 0.85em; }
.sender { font-weight: bold; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="info">Exported from nospeak on ${escapeHtml(exportDate)}</p>
${messagesHtml}
</body>
</html>`;
}

/**
 * Sanitize a string for use in a filename.
 */
function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

/**
 * Export a conversation to an HTML file and trigger browser download.
 */
export async function exportChatToHtml(conversationId: string): Promise<void> {
    const user = get(currentUser);
    if (!user) throw new Error('Not logged in');

    const isGroup = isGroupConversationId(conversationId);

    // Fetch all messages
    let messages: Message[];
    if (isGroup) {
        messages = await messageRepo.getAllMessagesByConversationId(conversationId);
    } else {
        messages = await messageRepo.getAllMessagesFor(conversationId);
    }

    // Resolve names for all participants
    const nameMap = new Map<string, string>();

    if (isGroup) {
        const conversation = await conversationRepo.getConversation(conversationId);
        const participants = conversation?.participants ?? [];
        for (const npub of participants) {
            if (npub !== user.npub) {
                nameMap.set(npub, await resolveDisplayName(npub));
            }
        }
        // Also resolve senderNpubs that might not be in participants list
        const senderNpubs = new Set(messages.map(m => m.senderNpub).filter(Boolean) as string[]);
        for (const npub of senderNpubs) {
            if (!nameMap.has(npub) && npub !== user.npub) {
                nameMap.set(npub, await resolveDisplayName(npub));
            }
        }
    } else {
        // 1-on-1: conversationId is the partner's npub
        nameMap.set(conversationId, await resolveDisplayName(conversationId));
    }

    // Build title
    let title: string;
    if (isGroup) {
        const conversation = await conversationRepo.getConversation(conversationId);
        title = conversation?.subject || 'Group Chat';
    } else {
        title = 'Chat with ' + (nameMap.get(conversationId) ?? conversationId.slice(0, 12) + '...');
    }

    // Build HTML
    const html = buildHtml(title, messages, nameMap, user.npub);

    // Trigger download
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = sanitizeFilename(isGroup ? (title) : (nameMap.get(conversationId) ?? 'chat'));
    a.download = `nospeak-${safeName}-${formatDateShort(Date.now())}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
