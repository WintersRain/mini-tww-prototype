// Contents of the new js/feed.js

// Get feed elements - assumes these IDs exist in the HTML
const damageFeedEl = document.getElementById('damageFeed');
const killFeedEl = document.getElementById('killFeed');
const MAX_FEED_MESSAGES = 15;

// --- Feed Logging Function ---
export function logToFeed(feedElement, message) {
    if (!feedElement) {
        console.error("Feed element not found for logging:", message);
        return;
    }

    const messageEl = document.createElement('p');
    // Simple timestamp
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    messageEl.textContent = `[${time}] ${message}`;

    // Insert after the h4 title (assuming h4 is the first child)
    if (feedElement.children.length > 0) {
        feedElement.insertBefore(messageEl, feedElement.children[1]);
    } else {
        // Fallback if feed is empty (shouldn't happen with h4)
        feedElement.appendChild(messageEl);
    }


    // Limit number of messages
    while (feedElement.children.length > MAX_FEED_MESSAGES + 1) { // +1 for the h4
        feedElement.removeChild(feedElement.lastChild);
    }
}

// Export the elements as well, so other modules can use them if needed
export { damageFeedEl, killFeedEl };
