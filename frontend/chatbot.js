/**
 * SustainAI – Floating AI Chatbot Widget
 * 
 * Self-contained chatbot UI that can be injected into any dashboard page.
 * Features:
 *   - Floating action button with pulse animation
 *   - Slide-up chat window with dark glassmorphism theme
 *   - Markdown-like bold text rendering
 *   - Auto-scroll, typing indicator, keyboard support
 *   - Quick-action suggestion chips
 */

(function () {
    'use strict';

    const API = 'http://localhost:3000';

    // ── Inject Chatbot HTML ──
    function injectChatbotUI() {
        const chatbotHTML = `
        <!-- Floating Chat Button -->
        <div id="chatbot-fab" title="AI Assistant">
            <span class="chatbot-fab-icon">🤖</span>
            <span class="chatbot-fab-pulse"></span>
        </div>

        <!-- Chat Window -->
        <div id="chatbot-window" class="chatbot-hidden">
            <div class="chatbot-header">
                <div class="chatbot-header-info">
                    <div class="chatbot-avatar">🤖</div>
                    <div>
                        <div class="chatbot-title">SustainAI Assistant</div>
                        <div class="chatbot-subtitle">
                            <span class="chatbot-status-dot"></span> Online — AI Powered
                        </div>
                    </div>
                </div>
                <button id="chatbot-close" class="chatbot-close-btn">✕</button>
            </div>

            <div id="chatbot-messages" class="chatbot-messages">
                <!-- Welcome message injected by JS -->
            </div>

            <div id="chatbot-suggestions" class="chatbot-suggestions">
                <button class="chatbot-chip" data-msg="How do I donate food?">🍽️ Donate food</button>
                <button class="chatbot-chip" data-msg="What should I do with expiring food?">⏰ Expiring food</button>
                <button class="chatbot-chip" data-msg="How to reduce waste?">♻️ Reduce waste</button>
                <button class="chatbot-chip" data-msg="Show nearby NGOs">📍 Nearby NGOs</button>
            </div>

            <div class="chatbot-input-area">
                <input type="text" id="chatbot-input" placeholder="Type a message..." autocomplete="off" />
                <button id="chatbot-send" class="chatbot-send-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
        `;

        const container = document.createElement('div');
        container.id = 'chatbot-container';
        container.innerHTML = chatbotHTML;
        document.body.appendChild(container);
    }

    // ── Inject Chatbot CSS ──
    function injectChatbotStyles() {
        const styles = `
        /* ============================
           CHATBOT FLOATING BUTTON
           ============================ */
        #chatbot-fab {
            position: fixed;
            bottom: 28px;
            right: 28px;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 6px 25px rgba(99, 102, 241, 0.45);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        }
        #chatbot-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 35px rgba(99, 102, 241, 0.6);
        }
        #chatbot-fab:active {
            transform: scale(0.95);
        }
        .chatbot-fab-icon {
            font-size: 28px;
            line-height: 1;
            z-index: 1;
        }
        .chatbot-fab-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.4);
            animation: chatbot-pulse 2s ease-in-out infinite;
        }
        @keyframes chatbot-pulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.35); opacity: 0; }
        }

        /* ============================
           CHAT WINDOW
           ============================ */
        #chatbot-window {
            position: fixed;
            bottom: 105px;
            right: 28px;
            width: 400px;
            max-width: calc(100vw - 40px);
            height: 560px;
            max-height: calc(100vh - 140px);
            background: rgba(17, 24, 39, 0.97);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 10001;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15);
            transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            transform-origin: bottom right;
        }
        #chatbot-window.chatbot-hidden {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
            pointer-events: none;
        }

        /* ── Header ── */
        .chatbot-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 18px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .chatbot-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .chatbot-avatar {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .chatbot-title {
            font-family: 'Inter', sans-serif;
            font-size: 15px;
            font-weight: 700;
            color: #f1f5f9;
        }
        .chatbot-subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .chatbot-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
            display: inline-block;
        }
        .chatbot-close-btn {
            background: rgba(255, 255, 255, 0.06);
            border: none;
            color: #94a3b8;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .chatbot-close-btn:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }

        /* ── Messages Area ── */
        .chatbot-messages {
            flex: 1;
            overflow-y: auto;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            scroll-behavior: smooth;
        }
        .chatbot-messages::-webkit-scrollbar {
            width: 4px;
        }
        .chatbot-messages::-webkit-scrollbar-track {
            background: transparent;
        }
        .chatbot-messages::-webkit-scrollbar-thumb {
            background: rgba(99, 102, 241, 0.3);
            border-radius: 4px;
        }

        /* Message Bubbles */
        .chatbot-msg {
            max-width: 88%;
            padding: 12px 16px;
            border-radius: 16px;
            font-family: 'Inter', sans-serif;
            font-size: 13.5px;
            line-height: 1.6;
            color: #e2e8f0;
            word-wrap: break-word;
            animation: chatbot-msg-in 0.3s ease-out;
        }
        @keyframes chatbot-msg-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .chatbot-msg.bot {
            align-self: flex-start;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-bottom-left-radius: 4px;
        }
        .chatbot-msg.user {
            align-self: flex-end;
            background: linear-gradient(135deg, #6366f1, #7c3aed);
            color: #ffffff;
            border-bottom-right-radius: 4px;
        }
        .chatbot-msg .msg-time {
            font-size: 10px;
            color: rgba(148, 163, 184, 0.6);
            margin-top: 6px;
            display: block;
        }
        .chatbot-msg.user .msg-time {
            color: rgba(255, 255, 255, 0.5);
            text-align: right;
        }

        /* Typing Indicator */
        .chatbot-typing {
            display: flex;
            gap: 4px;
            padding: 14px 18px;
            align-self: flex-start;
        }
        .chatbot-typing span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #6366f1;
            animation: chatbot-bounce 1.4s infinite;
        }
        .chatbot-typing span:nth-child(2) { animation-delay: 0.2s; }
        .chatbot-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes chatbot-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-8px); opacity: 1; }
        }

        /* ── Suggestion Chips ── */
        .chatbot-suggestions {
            display: flex;
            gap: 8px;
            padding: 8px 18px 4px;
            flex-wrap: wrap;
            border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        .chatbot-chip {
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.25);
            color: #a5b4fc;
            padding: 6px 14px;
            border-radius: 20px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .chatbot-chip:hover {
            background: rgba(99, 102, 241, 0.25);
            border-color: rgba(99, 102, 241, 0.5);
            color: #c7d2fe;
            transform: translateY(-1px);
        }

        /* ── Input Area ── */
        .chatbot-input-area {
            display: flex;
            gap: 10px;
            padding: 14px 18px 18px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(10, 14, 26, 0.5);
        }
        #chatbot-input {
            flex: 1;
            padding: 12px 16px;
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            color: #f1f5f9;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            margin-bottom: 0;
        }
        #chatbot-input:focus {
            border-color: rgba(99, 102, 241, 0.5);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        #chatbot-input::placeholder {
            color: #475569;
        }
        .chatbot-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: linear-gradient(135deg, #6366f1, #7c3aed);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        .chatbot-send-btn:hover {
            filter: brightness(1.15);
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        .chatbot-send-btn:active {
            transform: scale(0.95);
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
            #chatbot-window {
                width: calc(100vw - 20px);
                right: 10px;
                bottom: 90px;
                height: calc(100vh - 120px);
                border-radius: 16px;
            }
            #chatbot-fab {
                width: 56px;
                height: 56px;
                bottom: 20px;
                right: 20px;
            }
        }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'chatbot-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    // ── Format Bot Replies ──
    // Render **bold** and newlines for markdown-like display
    function formatBotReply(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
            .replace(/\n/g, '<br>');                            // Newlines
    }

    // ── Get Current Time String ──
    function getTimeStr() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ── Add Message to Chat ──
    function addMessage(text, sender) {
        const msgArea = document.getElementById('chatbot-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-msg ${sender}`;

        const content = sender === 'bot' ? formatBotReply(text) : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        msgDiv.innerHTML = `${content}<span class="msg-time">${getTimeStr()}</span>`;

        msgArea.appendChild(msgDiv);
        msgArea.scrollTop = msgArea.scrollHeight;
    }

    // ── Show/Hide Typing Indicator ──
    function showTyping() {
        const msgArea = document.getElementById('chatbot-messages');
        const typing = document.createElement('div');
        typing.className = 'chatbot-typing';
        typing.id = 'chatbot-typing-indicator';
        typing.innerHTML = '<span></span><span></span><span></span>';
        msgArea.appendChild(typing);
        msgArea.scrollTop = msgArea.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('chatbot-typing-indicator');
        if (typing) typing.remove();
    }

    // ── Send Message to Backend ──
    async function sendMessage(text) {
        if (!text.trim()) return;

        // Add user message
        addMessage(text, 'user');

        // Hide suggestion chips after first message
        const suggestionsEl = document.getElementById('chatbot-suggestions');
        if (suggestionsEl) suggestionsEl.style.display = 'none';

        // Show typing indicator
        showTyping();

        try {
            const response = await fetch(`${API}/chatbot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            hideTyping();

            if (data.success && data.reply) {
                addMessage(data.reply, 'bot');
            } else {
                addMessage("⚠️ Sorry, I couldn't process that. Please try again.", 'bot');
            }
        } catch (err) {
            hideTyping();
            addMessage("⚠️ Network error. Make sure the backend server is running on port 3000.", 'bot');
            console.error('Chatbot error:', err);
        }
    }

    // ── Initialize Chatbot ──
    function initChatbot() {
        injectChatbotStyles();
        injectChatbotUI();

        const fab = document.getElementById('chatbot-fab');
        const chatWindow = document.getElementById('chatbot-window');
        const closeBtn = document.getElementById('chatbot-close');
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send');

        let isOpen = false;
        let welcomeSent = false;

        // Toggle chat window
        fab.addEventListener('click', () => {
            isOpen = !isOpen;
            if (isOpen) {
                chatWindow.classList.remove('chatbot-hidden');
                fab.style.transform = 'scale(0)';
                fab.style.pointerEvents = 'none';
                input.focus();

                // Send welcome message on first open
                if (!welcomeSent) {
                    setTimeout(() => {
                        addMessage(
                            "👋 Hello! I'm the **SustainAI Assistant**.\n\n" +
                            "I can help you with:\n" +
                            "• 🕐 Food expiry management\n" +
                            "• 🍽️ Donation guidance\n" +
                            "• 📍 Finding nearby NGOs\n" +
                            "• ♻️ Waste reduction tips\n" +
                            "• 📊 Analytics & tracking\n\n" +
                            "Try the quick options below or just type your question!",
                            'bot'
                        );
                        welcomeSent = true;
                    }, 300);
                }
            } else {
                chatWindow.classList.add('chatbot-hidden');
                fab.style.transform = 'scale(1)';
                fab.style.pointerEvents = 'auto';
            }
        });

        // Close button
        closeBtn.addEventListener('click', () => {
            isOpen = false;
            chatWindow.classList.add('chatbot-hidden');
            fab.style.transform = 'scale(1)';
            fab.style.pointerEvents = 'auto';
        });

        // Send button click
        sendBtn.addEventListener('click', () => {
            const msg = input.value.trim();
            if (msg) {
                sendMessage(msg);
                input.value = '';
                input.focus();
            }
        });

        // Enter key to send
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const msg = input.value.trim();
                if (msg) {
                    sendMessage(msg);
                    input.value = '';
                }
            }
        });

        // Suggestion chip clicks
        document.querySelectorAll('.chatbot-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const msg = chip.getAttribute('data-msg');
                if (msg) {
                    sendMessage(msg);
                    input.value = '';
                }
            });
        });
    }

    // ── Boot on DOM ready ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }

})();
