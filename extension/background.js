// VerifyIQ V2 — Background Service Worker
// Handles context menus and URL scanning

const DEFAULT_API_URL = 'http://localhost:3000';

// ===== SETTINGS =====
async function getApiUrl() {
    try {
        const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
        return apiUrl || DEFAULT_API_URL;
    } catch (e) {
        return DEFAULT_API_URL;
    }
}

async function getApiKey() {
    try {
        const { apiKey } = await chrome.storage.local.get(['apiKey']);
        return apiKey || '';
    } catch (e) {
        return '';
    }
}

// ===== CONTEXT MENUS =====
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'verifyiq-scan-link',
        title: 'Scan with VerifyIQ',
        contexts: ['link'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-scan-page',
        title: 'Scan this page with VerifyIQ',
        contexts: ['page'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-detect-ai',
        title: 'Check for AI content',
        contexts: ['selection'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-verify-email',
        title: 'Verify email: "%s"',
        contexts: ['selection'],
    });
});

// ===== CONTEXT MENU HANDLER =====
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const apiUrl = await getApiUrl();
    const apiKey = await getApiKey();

    const headers = { 'Content-Type': 'application/json', 'X-Source': 'extension' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    try {
        if (info.menuItemId === 'verifyiq-scan-link') {
            const url = info.linkUrl;
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url });

            const response = await fetch(`${apiUrl}/api/scan-url`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'SCAN_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-scan-page') {
            const url = tab.url;
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url });

            const response = await fetch(`${apiUrl}/api/scan-url`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'SCAN_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-detect-ai') {
            const text = info.selectionText;
            if (!text || text.length < 20) {
                await sendToTab(tab.id, { type: 'ERROR', error: 'Please select at least 20 characters' });
                return;
            }

            await sendToTab(tab.id, { type: 'AI_LOADING' });

            const response = await fetch(`${apiUrl}/api/detect-ai`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'AI_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-verify-email') {
            const email = info.selectionText?.trim();
            if (!email || !email.includes('@')) {
                await sendToTab(tab.id, { type: 'ERROR', error: 'Please select a valid email address' });
                return;
            }

            await sendToTab(tab.id, { type: 'EMAIL_LOADING' });

            const response = await fetch(`${apiUrl}/api/verify-email`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'EMAIL_RESULT', data: result });
        }
    } catch (error) {
        console.error('VerifyIQ context menu error:', error);
        await sendToTab(tab.id, {
            type: 'ERROR',
            error: `Connection failed. Is the API running at ${apiUrl}?`,
        });
    }
});

// ===== MESSAGE HANDLER =====
async function sendToTab(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
        // Content script may not be injected yet — try to inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js'],
            });
            await chrome.scripting.insertCSS({
                target: { tabId },
                files: ['content.css'],
            });
            // Retry sending the message
            setTimeout(async () => {
                try {
                    await chrome.tabs.sendMessage(tabId, message);
                } catch (e2) {
                    console.error('Failed to send message after injection:', e2);
                }
            }, 300);
        } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
        }
    }
}
