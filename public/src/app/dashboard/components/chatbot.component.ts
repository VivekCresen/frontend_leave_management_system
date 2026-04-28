import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- FAB Toggle Button -->
    <button
      (click)="toggleChat()"
      class="chatbot-fab"
      [attr.aria-label]="isOpen ? 'Close chat' : 'Open chat'">
      <svg *ngIf="!isOpen" class="chatbot-fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.681L3 21l2.681-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
      </svg>
      <svg *ngIf="isOpen" class="chatbot-fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>

    <!-- Chat Window -->
    <div class="chatbot-window" [class.chatbot-window--open]="isOpen" role="dialog" aria-label="Leave Assistant">

      <!-- Header -->
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-avatar">
            <svg class="chatbot-avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div>
            <strong class="chatbot-title">Leave Assistant</strong>
            <span class="chatbot-subtitle">Ask about leaves, holidays &amp; policies</span>
          </div>
        </div>
        <button (click)="clearChat()" class="chatbot-clear-btn" title="Clear chat" [disabled]="messages.length === 0">
          <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div #messagesContainer class="chatbot-messages">

        <!-- Welcome state -->
        <div *ngIf="messages.length === 0" class="chatbot-welcome">
          <div class="chatbot-welcome-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:32px;height:32px">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.681L3 21l2.681-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
            </svg>
          </div>
          <p class="chatbot-welcome-text">Hi! I can help you with leave balances, holidays, policies and more.</p>
          <div class="chatbot-quick-actions">
            <button *ngFor="let action of quickActions"
                    (click)="sendQuickMessage(action.message)"
                    [disabled]="isLoading"
                    class="chatbot-quick-btn">
              {{ action.label }}
            </button>
          </div>
        </div>

        <!-- Message list -->
        <div *ngFor="let msg of messages; trackBy: trackByIndex"
             class="chatbot-msg-row"
             [class.chatbot-msg-row--user]="msg.isUser">
          <div class="chatbot-bubble"
               [class.chatbot-bubble--user]="msg.isUser"
               [class.chatbot-bubble--bot]="!msg.isUser">

            <!-- Typing dots -->
            <div *ngIf="msg.isLoading" class="chatbot-typing">
              <span></span><span></span><span></span>
            </div>

            <!-- Text -->
            <div *ngIf="!msg.isLoading" [innerHTML]="formatMessage(msg.text)"></div>

            <!-- Time -->
            <div *ngIf="!msg.isLoading" class="chatbot-time">
              {{ msg.timestamp | date:'shortTime' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="chatbot-input-area">
        <input
          #messageInput
          [(ngModel)]="currentMessage"
          (keydown.enter)="sendMessage()"
          [disabled]="isLoading"
          placeholder="Ask about leaves, holidays or policies..."
          class="chatbot-input"
          maxlength="500" />
        <button
          (click)="sendMessage()"
          [disabled]="!currentMessage.trim() || isLoading"
          class="chatbot-send-btn"
          aria-label="Send">
          <svg *ngIf="!isLoading" class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
          <svg *ngIf="isLoading" class="chatbot-icon-sm chatbot-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: 0;
      right: 0;
      z-index: 1000;
      pointer-events: none;
    }
    :host > * { pointer-events: all; }

    /* FAB */
    .chatbot-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15,139,141,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 1001;
    }
    .chatbot-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(15,139,141,0.55);
    }
    .chatbot-fab-icon { width: 22px; height: 22px; }

    /* Window */
    .chatbot-window {
      position: fixed;
      bottom: 92px;
      right: 28px;
      width: 380px;
      height: 520px;
      background: var(--surface-bg, #fff);
      border: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(15,23,42,0.18);
      opacity: 0;
      transform: translateY(16px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
      overflow: hidden;
    }
    .chatbot-window--open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .chatbot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      flex-shrink: 0;
    }
    .chatbot-header-info { display: flex; align-items: center; gap: 10px; }
    .chatbot-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .chatbot-avatar-icon { width: 18px; height: 18px; }
    .chatbot-title { display: block; font-size: 14px; font-weight: 600; }
    .chatbot-subtitle { font-size: 11px; opacity: 0.85; }
    .chatbot-clear-btn {
      background: rgba(255,255,255,0.15);
      border: none; color: #fff; cursor: pointer;
      padding: 7px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .chatbot-clear-btn:hover:not(:disabled) { background: rgba(255,255,255,0.28); }
    .chatbot-clear-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .chatbot-icon-sm { width: 16px; height: 16px; }

    /* Messages */
    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--ws-bg, #f8fafc);
    }
    .chatbot-messages::-webkit-scrollbar { width: 5px; }
    .chatbot-messages::-webkit-scrollbar-thumb {
      background: var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 3px;
    }

    /* Welcome */
    .chatbot-welcome { text-align: center; padding: 16px 8px; }
    .chatbot-welcome-icon {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--field-focus-shadow, rgba(15,139,141,0.12));
      color: var(--app-primary, #0f8b8d);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px;
    }
    .chatbot-welcome-text {
      font-size: 13px;
      color: var(--modal-desc, #64748b);
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .chatbot-quick-actions { display: flex; flex-direction: column; gap: 6px; }
    .chatbot-quick-btn {
      background: var(--surface-bg, #fff);
      border: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 8px;
      padding: 9px 14px;
      font-size: 12px;
      color: var(--shell-text, #10233d);
      cursor: pointer;
      text-align: left;
      transition: border-color 0.2s, background 0.2s;
    }
    .chatbot-quick-btn:hover:not(:disabled) {
      border-color: var(--app-primary, #0f8b8d);
      background: var(--field-focus-shadow, rgba(15,139,141,0.06));
      color: var(--app-primary, #0f8b8d);
    }
    .chatbot-quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Message rows */
    .chatbot-msg-row { display: flex; }
    .chatbot-msg-row--user { justify-content: flex-end; }

    .chatbot-bubble {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.55;
    }
    .chatbot-bubble--user {
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      border-radius: 14px 14px 4px 14px;
    }
    .chatbot-bubble--bot {
      background: var(--surface-bg, #fff);
      color: var(--shell-text, #10233d);
      border: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 14px 14px 14px 4px;
    }
    .chatbot-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }
    .chatbot-msg-row--user .chatbot-time { text-align: right; }

    /* Typing dots */
    .chatbot-typing { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
    .chatbot-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--app-primary, #0f8b8d);
      animation: chatDot 1.3s infinite ease-in-out;
    }
    .chatbot-typing span:nth-child(2) { animation-delay: 0.18s; }
    .chatbot-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes chatDot {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    /* Input area */
    .chatbot-input-area {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      background: var(--surface-bg, #fff);
      flex-shrink: 0;
    }
    .chatbot-input {
      flex: 1;
      background: var(--field-input-bg, #fff);
      border: 1px solid var(--field-input-border, rgba(148,163,184,0.45));
      border-radius: 10px;
      padding: 9px 12px;
      color: var(--field-input-text, #0f172a);
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit;
    }
    .chatbot-input:focus {
      border-color: var(--app-primary, #0f8b8d);
      box-shadow: 0 0 0 3px var(--field-focus-shadow, rgba(15,139,141,0.12));
    }
    .chatbot-input::placeholder { color: var(--modal-desc, #94a3b8); }
    .chatbot-input:disabled { opacity: 0.55; cursor: not-allowed; }

    .chatbot-send-btn {
      background: var(--app-primary, #0f8b8d);
      border: none;
      border-radius: 10px;
      color: #fff;
      width: 38px;
      height: 38px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.2s, transform 0.2s;
    }
    .chatbot-send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .chatbot-send-btn:not(:disabled):hover { opacity: 0.88; transform: translateY(-1px); }

    .chatbot-spin {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 480px) {
      .chatbot-window { width: calc(100vw - 32px); right: 16px; bottom: 84px; height: 70vh; }
      .chatbot-fab { bottom: 20px; right: 16px; }
    }
  `]
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  isOpen = false;
  currentMessage = '';
  isLoading = false;
  messages: ChatMessage[] = [];

  quickActions = [
    { label: '📊 My Leave Balance', message: 'What is my current leave balance?' },
    { label: '🗓️ Upcoming Holidays', message: 'What are the upcoming holidays?' },
    { label: '👥 Who is on leave today?', message: 'Who is on leave today?' },
    { label: '📋 Leave Policies', message: 'What are the leave policies?' }
  ];

  private shouldScrollToBottom = false;

  ngOnInit() {
    this.loadChatHistory();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
    }
  }

  sendMessage() {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMsg: ChatMessage = { text: this.currentMessage.trim(), isUser: true, timestamp: new Date() };
    const loadingMsg: ChatMessage = { text: '', isUser: false, timestamp: new Date(), isLoading: true };

    this.messages.push(userMsg, loadingMsg);
    this.shouldScrollToBottom = true;

    const messageToSend = this.currentMessage;
    this.currentMessage = '';
    this.isLoading = true;

    this.callChatAPI(messageToSend)
      .pipe(finalize(() => {
        this.isLoading = false;
        const idx = this.messages.findIndex(m => m.isLoading);
        if (idx !== -1) this.messages.splice(idx, 1);
      }))
      .subscribe({
        next: (res) => {
          this.messages.push({ text: res.response || 'Sorry, I could not process that.', isUser: false, timestamp: new Date() });
          this.shouldScrollToBottom = true;
          this.saveChatHistory();
        },
        error: () => {
          this.messages.push({ text: 'Sorry, I\'m having trouble connecting. Please try again.', isUser: false, timestamp: new Date() });
          this.shouldScrollToBottom = true;
          this.saveChatHistory();
        }
      });
  }

  sendQuickMessage(message: string) {
    this.currentMessage = message;
    this.sendMessage();
  }

  clearChat() {
    this.messages = [];
    this.saveChatHistory();
  }

  trackByIndex(index: number): number { return index; }

  formatMessage(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private callChatAPI(message: string): Observable<any> {
    return this.http.post('http://localhost:8080/api/chatbot/chat', { message }, {
      headers: { 'X-Skip-Loader': 'true' }
    });
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private saveChatHistory() {
    if (!this.isBrowser) return;
    try {
      const toSave = this.messages.slice(-20).filter(m => !m.isLoading);
      localStorage.setItem('chatbot-history', JSON.stringify(toSave));
    } catch {}
  }

  private loadChatHistory() {
    if (!this.isBrowser) return;
    try {
      const saved = localStorage.getItem('chatbot-history');
      if (saved) {
        this.messages = JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {
      this.messages = [];
    }
  }
}
