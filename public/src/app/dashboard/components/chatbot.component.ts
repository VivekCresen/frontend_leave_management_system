import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';
import { injectAuthService } from '../../services/auth.service';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  displayedText?: string;
  isTyping?: boolean;
}

interface CachedChatResponse {
  response: string;
  savedAt: number;
}

interface StoredChatAnswer {
  Text: string;
  Table: null;
}

interface StoredChatEntry {
  answer: StoredChatAnswer[];
  profile: string;
  user_id: string | null;
  chatDate: string;
  question: string;
  chatTitle: string;
  request_id: string;
  question_id: number;
  response_type: string;
  conversation_id: string;
  request_timestamp: string;
  response_timestamp: string;
  username: string | null;
  source: string;
}

type StoredChatHistory = Record<string, StoredChatEntry[]>;

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
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

    <div class="chatbot-window" [class.chatbot-window--open]="isOpen" role="dialog" aria-label="Leave Assistant">

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
        <div class="chatbot-header-actions">
          <button (click)="startNewChat()" class="chatbot-clear-btn" title="New chat" aria-label="New chat">
            <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button (click)="toggleHistory()" class="chatbot-clear-btn" title="Chat history" [attr.aria-expanded]="isHistoryOpen">
            <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 10a9 9 0 1118 0 9 9 0 01-18 0zm9-5v5l3 3"/>
            </svg>
          </button>
          <button (click)="clearChat()" class="chatbot-clear-btn" title="Clear chat" [disabled]="messages.length === 0">
            <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="chatbot-content-wrapper">
        <!-- History Sidebar -->
        <div class="chatbot-history-panel" role="region" aria-label="Chat history" [class.chatbot-history-panel--collapsed]="!isHistoryOpen">
          <div class="chatbot-history-panel-header">
            <div>
              <strong>Conversation history</strong>
              <p>{{ historyConversations.length }} saved {{ historyConversations.length === 1 ? 'conversation' : 'conversations' }}</p>
            </div>
            <button (click)="toggleHistory()" class="chatbot-clear-btn" aria-label="Toggle history">
              <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>
          <div class="chatbot-history-list">
            <div *ngIf="historyLoading" class="chatbot-history-empty">
              <p>Loading saved conversations…</p>
            </div>
            <div *ngFor="let conversation of historyConversations"
                 class="chatbot-history-item" [class.active]="conversation.id === currentConversationId"
                 (click)="openConversation(conversation.id)">
              <div>
                <strong>{{ conversation.title }}</strong>
                <span>{{ conversation.chatDate }} · {{ conversation.count }} messages</span>
              </div>
              <div class="chatbot-history-item-actions">
                <button type="button" class="chatbot-history-rename-btn"
                        (click)="startRenameConversation(conversation.id, $event)"
                        title="Rename conversation" aria-label="Rename conversation">
                  <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15.232 5.232l3.536 3.536M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                </button>
                <button type="button" class="chatbot-history-delete-btn"
                        (click)="deleteConversation(conversation.id, $event)"
                        title="Delete conversation" aria-label="Delete conversation">
                  <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div *ngIf="!historyLoading && historyConversations.length === 0" class="chatbot-history-empty">
              <p>No saved conversations yet.</p>
            </div>
            <div *ngIf="isRenameDialogOpen" class="chatbot-modal-backdrop" role="dialog" aria-modal="true" (click)="cancelRename()">
              <div class="chatbot-modal" (click)="$event.stopPropagation()">
                <strong class="chatbot-modal-title">Rename conversation</strong>
                <p class="chatbot-modal-description">Edit the conversation title and save it.</p>
                <input
                  class="chatbot-modal-input"
                  [(ngModel)]="renameTitle"
                  (keydown.enter)="confirmRename()"
                  aria-label="Rename conversation title"
                  placeholder="New conversation title" />
                <div class="chatbot-modal-actions">
                  <button type="button" class="chatbot-modal-btn chatbot-modal-btn--cancel" (click)="cancelRename()">Cancel</button>
                  <button type="button" class="chatbot-modal-btn chatbot-modal-btn--confirm" [disabled]="!renameTitle.trim()" (click)="confirmRename()">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages Area -->
        <div #messagesContainer class="chatbot-messages">

        <div *ngIf="messages.length === 0" class="chatbot-welcome">
          <div class="chatbot-welcome-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:28px;height:28px">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.681L3 21l2.681-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
            </svg>
          </div>
          <p class="chatbot-welcome-title">How can I help you?</p>
          <p class="chatbot-welcome-text">Ask me anything about leaves, holidays or policies.</p>
          <div class="chatbot-quick-actions">
            <button *ngFor="let action of quickActions"
                    (click)="sendQuickMessage(action.message)"
                    [disabled]="isLoading"
                    class="chatbot-quick-btn">
              <span class="chatbot-quick-btn-emoji">{{ action.label.split(' ')[0] }}</span>
              <span class="chatbot-quick-btn-text">{{ action.label.slice(action.label.indexOf(' ') + 1) }}</span>
            </button>
          </div>
        </div>

        <div *ngFor="let msg of messages; trackBy: trackByIndex"
             class="chatbot-msg-row"
             [class.chatbot-msg-row--user]="msg.isUser">
          <div class="chatbot-bubble"
               [class.chatbot-bubble--user]="msg.isUser"
               [class.chatbot-bubble--bot]="!msg.isUser">

            <div *ngIf="msg.isLoading" class="chatbot-typing">
              <span></span><span></span><span></span>
            </div>

            <div *ngIf="!msg.isLoading" [innerHTML]="getDisplayHtml(msg)"></div>

            <div *ngIf="!msg.isLoading" class="chatbot-time">
              {{ msg.timestamp | date:'shortTime' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    
      <div class="chatbot-input-area">
        <input
          #messageInput
          [(ngModel)]="currentMessage"
          (keydown.enter)="sendMessage()"
          [disabled]="isLoading"
          placeholder="Ask about leaves, holidays or policies..."
          class="chatbot-input"
          maxlength="500" />

        <!-- Stop button — shown while loading -->
        <button
          *ngIf="isLoading"
          (click)="stopRequest()"
          class="chatbot-stop-btn"
          aria-label="Stop">
          <svg class="chatbot-icon-sm" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>

        <button
          *ngIf="!isLoading"
          (click)="sendMessage()"
          [disabled]="!currentMessage.trim()"
          class="chatbot-send-btn"
          aria-label="Send">
          <svg class="chatbot-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
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

    .chatbot-window {
      position: fixed;
      bottom: 92px;
      right: 28px;
      width: 700px;
      height: 580px;
      background: var(--surface-bg, #fff);
      border: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 18px;
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

    .chatbot-content-wrapper {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

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
    .chatbot-header-actions { display: flex; align-items: center; gap: 8px; }

    .chatbot-history-panel {
      width: 240px;
      background: var(--surface-bg, #fff);
      border-right: 1px solid var(--surface-border, rgba(226,232,240,0.85));
      border-radius: 0;
      box-shadow: none;
      z-index: 10;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.3s ease, margin-right 0.3s ease;
      flex-shrink: 0;
    }
    .chatbot-history-panel--collapsed {
      width: 0;
      margin-right: 0;
      border-right: none;
    }
    .chatbot-history-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 10px;
      border-bottom: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      background: var(--surface-bg, #fff);
      flex-shrink: 0;
    }
    .chatbot-history-panel-header strong {
      display: block;
      margin-bottom: 2px;
      font-size: 12px;
    }
    .chatbot-history-panel-header p {
      margin: 0;
      font-size: 10px;
      color: var(--modal-desc, #64748b);
    }
    .chatbot-history-list {
      padding: 8px 8px 8px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }
    .chatbot-history-item {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      text-align: left;
      border: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 10px;
      background: var(--field-input-bg, #fff);
      padding: 10px 10px;
      color: var(--shell-text, #10233d);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color 0.2s, background 0.2s;
      overflow: hidden;
      min-width: 0;
    }
    .chatbot-history-item:hover {
      border-color: var(--app-primary, #0f8b8d);
      background: var(--field-focus-shadow, rgba(15,139,141,0.08));
    }
    .chatbot-history-item.active {
      border-color: var(--app-primary, #0f8b8d);
      background: rgba(15,139,141,0.08);
    }
    .chatbot-history-item strong {
      display: block;
      font-size: 12px;
      margin-bottom: 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chatbot-history-item > div:first-child {
      min-width: 0;
      overflow: hidden;
      flex: 1;
    }
    .chatbot-history-item-actions {
      display: flex;
      gap: 4px;
      align-items: center;
      flex-shrink: 0;
      justify-content: flex-end;
    }
    .chatbot-history-item span {
      display: block;
      font-size: 11px;
      color: var(--modal-desc, #64748b);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chatbot-history-rename-btn,
    .chatbot-history-delete-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.2s;
    }
    .chatbot-history-rename-btn {
      background: rgba(14,165,233,0.1);
      border: 1px solid rgba(14,165,233,0.35);
      color: #0ea5e9;
    }
    .chatbot-history-rename-btn:hover {
      background: rgba(14,165,233,0.18);
      transform: translateY(-1px);
    }
    .chatbot-history-delete-btn {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.35);
      color: #ef4444;
    }
    .chatbot-history-delete-btn:hover {
      background: rgba(239,68,68,0.18);
      transform: translateY(-1px);
    }
    .chatbot-history-delete-btn svg,
    .chatbot-history-rename-btn svg {
      width: 14px;
      height: 14px;
    }
    .chatbot-history-item > div {
      min-width: 0;
      overflow: hidden;
    }
    .chatbot-history-item span {
      display: block;
      font-size: 12px;
      color: var(--modal-desc, #64748b);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chatbot-history-delete-btn {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.35);
      color: #ef4444;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.2s;
    }
    .chatbot-history-delete-btn:hover {
      background: rgba(239,68,68,0.18);
      transform: translateY(-1px);
    }
    .chatbot-history-delete-btn svg {
      width: 14px;
      height: 14px;
    }
    .chatbot-history-item span {
      display: block;
      font-size: 12px;
      color: var(--modal-desc, #64748b);
    }
    .chatbot-history-empty {
      padding: 14px;
      color: var(--modal-desc, #64748b);
      text-align: center;
      font-size: 13px;
    }
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

    .chatbot-modal-backdrop {
      position: absolute;
      inset: 0;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      z-index: 30;
    }
    .chatbot-modal {
      width: min(100%, 360px);
      max-width: 100%;
      box-sizing: border-box;
      background: var(--surface-bg, #fff);
      border-radius: 22px;
      padding: 22px 20px 18px;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
      display: flex;
      flex-direction: column;
      gap: 14px;
      border: 1px solid rgba(148, 163, 184, 0.15);
    }
    .chatbot-modal-title {
      font-size: 15px;
      margin: 0;
      color: var(--shell-text, #10233d);
    }
    .chatbot-modal-description {
      margin: 0;
      font-size: 12px;
      color: var(--modal-desc, #64748b);
      line-height: 1.5;
    }
    .chatbot-modal-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(148,163,184,0.4);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      color: var(--field-input-text, #0f172a);
      background: var(--field-input-bg, #fff);
    }
    .chatbot-modal-input:focus {
      outline: none;
      border-color: var(--app-primary, #0f8b8d);
      box-shadow: 0 0 0 4px rgba(15, 139, 141, 0.12);
    }
    .chatbot-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .chatbot-modal-btn {
      min-width: 82px;
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }
    .chatbot-modal-btn:hover:not(:disabled) { transform: translateY(-1px); }
    .chatbot-modal-btn--cancel {
      background: var(--surface-bg, #f8fafc);
      color: var(--shell-text, #10233d);
      border: 1px solid rgba(226,232,240,0.9);
    }
    .chatbot-modal-btn--confirm {
      background: var(--app-primary, #0f8b8d);
      color: #fff;
    }
    .chatbot-modal-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--ws-bg, #f8fafc);
      min-width: 0;
    }
    .chatbot-messages::-webkit-scrollbar { width: 5px; }
    .chatbot-messages::-webkit-scrollbar-thumb {
      background: var(--surface-border, rgba(226,232,240,0.7));
      border-radius: 3px;
    }

    .chatbot-welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 24px 16px;
      text-align: center;
      height: 100%;
    }
    .chatbot-welcome-icon {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--field-focus-shadow, rgba(15,139,141,0.12));
      color: var(--app-primary, #0f8b8d);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px;
    }
    .chatbot-welcome-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--shell-text, #10233d);
      margin: 0 0 6px;
    }
    .chatbot-welcome-text {
      font-size: 12px;
      color: var(--modal-desc, #64748b);
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .chatbot-quick-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      width: 100%;
      max-width: 380px;
    }
    .chatbot-quick-btn {
      background: var(--surface-bg, #fff);
      border: 1px solid var(--surface-border, rgba(226,232,240,0.9));
      border-radius: 12px;
      padding: 12px 10px;
      font-size: 12px;
      color: var(--shell-text, #10233d);
      cursor: pointer;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
      box-shadow: 0 1px 3px rgba(15,23,42,0.06);
    }
    .chatbot-quick-btn:hover:not(:disabled) {
      border-color: var(--app-primary, #0f8b8d);
      background: rgba(15,139,141,0.05);
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(15,139,141,0.12);
    }
    .chatbot-quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chatbot-quick-btn-emoji { font-size: 20px; line-height: 1; }
    .chatbot-quick-btn-text { font-size: 12px; font-weight: 500; color: var(--shell-text, #10233d); line-height: 1.3; }

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

    .chatbot-cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background: var(--app-primary, #0f8b8d);
      margin-left: 1px;
      vertical-align: text-bottom;
      animation: cursorBlink 0.7s steps(1) infinite;
    }
    @keyframes cursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

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

    .chatbot-stop-btn {
      background: #ef4444;
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
    .chatbot-stop-btn:hover { opacity: 0.88; transform: translateY(-1px); }

    .chatbot-spin {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
      .chatbot-window { width: calc(100vw - 32px); right: 16px; bottom: 84px; height: 70vh; }
      .chatbot-fab { bottom: 20px; right: 16px; }
      .chatbot-history-panel { width: 160px; }
    }

    @media (max-width: 480px) {
      .chatbot-window { width: calc(100vw - 16px); right: 8px; bottom: 76px; }
      .chatbot-fab { bottom: 16px; right: 8px; }
      .chatbot-history-panel { width: 0; border-right: none; }
      .chatbot-history-panel--collapsed { display: none; }
    }
  `]
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private http = inject(HttpClient);
  private authService = injectAuthService();
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  isOpen = false;
  currentMessage = '';
  isLoading = false;
  messages: ChatMessage[] = [];
  isHistoryOpen = false;
  chatHistoryLoaded = false;
  historyLoading = false;
  historyConversations: Array<{ id: string; title: string; chatDate: string; count: number }> = [];
  isRenameDialogOpen = false;
  renameTargetId: string | null = null;
  renameTitle = '';

  quickActions = [
    { label: '📊 My Leave Balance', message: 'What is my current leave balance?' },
    { label: '🗓️ Upcoming Holidays', message: 'What are the upcoming holidays?' },
    { label: '👥 Who is on leave today?', message: 'Who is on leave today?' },
    { label: '📋 Leave Policies', message: 'What are the leave policies?' }
  ];

  private shouldScrollToBottom = false;
  private lastSubmissionKey = '';
  private lastSubmissionAt = 0;
  private currentRequestId: string | null = null;
  private cancelSubject$ = new Subject<void>();
  private readonly responseCache = new Map<string, CachedChatResponse>();
  private readonly chatHistoryKey = 'chatbot-history-v2';
  private readonly responseCacheKey = 'chatbot-response-cache';
  private readonly responseCacheTtlMs = 5 * 60 * 1000;
  private chatHistoryStore: StoredChatHistory = {};
  currentConversationId = '';
  private pendingNewConversation = false;

  ngOnInit() {
    this.loadResponseCache();
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

  sendMessage(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const trimmedMessage = this.currentMessage.trim();
    if (!trimmedMessage || this.isLoading) return;

    const submissionKey = `${this.authService.currentUser()?.username ?? 'anonymous'}::${trimmedMessage}`;
    const now = Date.now();
    if (submissionKey === this.lastSubmissionKey && now - this.lastSubmissionAt < 1500) {
      return;
    }

    this.lastSubmissionKey = submissionKey;
    this.lastSubmissionAt = now;

    const userMsg: ChatMessage = { text: trimmedMessage, isUser: true, timestamp: new Date() };
    const loadingMsg: ChatMessage = { text: '', isUser: false, timestamp: new Date(), isLoading: true };

    this.messages.push(userMsg, loadingMsg);
    this.shouldScrollToBottom = true;

    const messageToSend = trimmedMessage;
    const requestStartedAt = new Date();
    const isNewConversationMessage = this.pendingNewConversation || this.getPersistedConversationEntries().length === 0;
    this.currentMessage = '';
    this.isLoading = true;

    // Generate a unique requestId for this request — used to cancel it server-side
    this.ensureActiveConversation();
    this.currentRequestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const requestId = this.currentRequestId;
    this.cancelSubject$ = new Subject<void>();

    const cachedResponse = this.getCachedResponse(submissionKey);
    if (cachedResponse) {
      this.isLoading = false;
      this.currentRequestId = null;
      const idx = this.messages.findIndex(m => m.isLoading);
      if (idx !== -1) this.messages.splice(idx, 1);
      const responseAt = new Date();
      const botMsg: ChatMessage = { text: cachedResponse, isUser: false, timestamp: responseAt };
      this.messages.push(botMsg);
      this.typeMessage(botMsg);
      this.persistConversationEntry(messageToSend, cachedResponse, requestId, requestStartedAt, responseAt, 'cache');
      this.pendingNewConversation = false;
      this.shouldScrollToBottom = true;
      return;
    }

    this.callChatAPI(messageToSend, requestId, this.currentConversationId, isNewConversationMessage)
      .pipe(
        takeUntil(this.cancelSubject$),
        finalize(() => {
          this.isLoading = false;
          this.currentRequestId = null;
          const idx = this.messages.findIndex(m => m.isLoading);
          if (idx !== -1) this.messages.splice(idx, 1);
        })
      )
      .subscribe({
        next: (res) => {
          const responseText = res.response || 'Sorry, I could not process that.';
          this.cacheResponse(submissionKey, responseText);
          const responseAt = new Date();
          const botMsg: ChatMessage = { text: responseText, isUser: false, timestamp: responseAt };
          this.messages.push(botMsg);
          this.typeMessage(botMsg);
          this.persistConversationEntry(messageToSend, responseText, requestId, requestStartedAt, responseAt, 'api');
          this.pendingNewConversation = false;
          this.shouldScrollToBottom = true;
        },
        error: (err) => {
          // Don't show error message if we cancelled intentionally
          if (err?.name === 'AbortError' || err?.status === 0) return;
          const fallbackResponse = 'Sorry, I\'m having trouble connecting. Please try again.';
          const responseAt = new Date();
          const botMsg: ChatMessage = { text: fallbackResponse, isUser: false, timestamp: responseAt };
          this.messages.push(botMsg);
          this.typeMessage(botMsg);
          this.persistConversationEntry(messageToSend, fallbackResponse, requestId, requestStartedAt, responseAt, 'error');
          this.pendingNewConversation = false;
          this.shouldScrollToBottom = true;
        }
      });
  }

  sendQuickMessage(message: string) {
    this.currentMessage = message;
    this.sendMessage();
  }

  clearChat() {
    this.cancelCurrentRequest();
    this.messages = [];
    if (this.currentConversationId) {
      this.chatHistoryStore[this.currentConversationId] = [];
      this.persistChatHistoryStore();
    }
  }

  startNewChat() {
    const currentEntries = this.getPersistedConversationEntries();
    if (this.messages.length === 0 && currentEntries.length === 0) {
      return;
    }

    this.cancelCurrentRequest();
    this.messages = [];
    this.currentConversationId = this.getNextConversationId();
    this.chatHistoryStore[this.currentConversationId] = [];
    this.pendingNewConversation = true;
    this.persistChatHistoryStore();
    this.buildHistorySummaries();
    this.shouldScrollToBottom = true;
  }

  /** Stop button — cancels the current in-flight request */
  stopRequest() {
    this.cancelCurrentRequest();
    // Remove the loading bubble
    const idx = this.messages.findIndex(m => m.isLoading);
    if (idx !== -1) this.messages.splice(idx, 1);
    this.isLoading = false;
  }

  private cancelCurrentRequest() {
    if (this.currentRequestId) {
      // Tell RxJS to unsubscribe from the HTTP observable
      this.cancelSubject$.next();
      this.cancelSubject$.complete();
      // Tell the backend to cancel the Ollama Future
      this.http.delete(`http://localhost:8080/api/chatbot/cancel/${this.currentRequestId}`, {
        headers: { 'X-Skip-Loader': 'true' }
      }).subscribe({ error: () => {} }); // fire-and-forget
      this.currentRequestId = null;
    }
  }

  toggleHistory() {
    this.isHistoryOpen = !this.isHistoryOpen;
    if (this.isHistoryOpen) {
      this.lazyLoadChatHistory();
      this.buildHistorySummaries();
    }
  }

  openConversation(conversationId: string) {
    this.lazyLoadChatHistory();
    this.currentConversationId = conversationId;
    this.messages = this.mapConversationToMessages(conversationId);
    this.pendingNewConversation = this.getPersistedConversationEntries().length === 0;
    this.shouldScrollToBottom = true;
  }

  private lazyLoadChatHistory() {
    if (this.chatHistoryLoaded || this.historyLoading) {
      return;
    }

    this.historyLoading = true;
    try {
      this.loadChatHistoryStore();
      this.buildHistorySummaries();

      if (this.isOpen && this.messages.length === 0) {
        this.messages = this.mapConversationToMessages(this.currentConversationId);
        this.pendingNewConversation = this.getPersistedConversationEntries().length === 0;
        this.shouldScrollToBottom = true;
      }
    } finally {
      this.historyLoading = false;
    }
  }

  private loadChatHistoryStore() {
    if (!this.isBrowser || this.chatHistoryLoaded) {
      return;
    }

    try {
      const saved = localStorage.getItem(this.chatHistoryKey);
      if (saved) {
        this.chatHistoryStore = JSON.parse(saved) as StoredChatHistory;
        this.currentConversationId = this.getLatestConversationId();
        this.chatHistoryLoaded = true;
        return;
      }

      const legacySaved = localStorage.getItem('chatbot-history');
      if (legacySaved) {
        const legacyMessages = JSON.parse(legacySaved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) as ChatMessage[];
        this.currentConversationId = 'chat_001';
        this.chatHistoryStore = {
          [this.currentConversationId]: this.mapMessagesToStoredEntries(legacyMessages, this.currentConversationId)
        };
        this.persistChatHistoryStore();
        localStorage.removeItem('chatbot-history');
      }
    } catch {
      this.chatHistoryStore = {};
    } finally {
      this.chatHistoryLoaded = true;
    }
  }

  private buildHistorySummaries() {
    const keys = this.getSortedConversationKeys().slice().reverse();
    this.historyConversations = keys.map((id) => {
      const entries = this.chatHistoryStore[id] ?? [];
      const firstEntry = entries[0];
      return {
        id,
        title: firstEntry?.chatTitle || `Conversation ${id.replace('chat_', '')}`,
        chatDate: firstEntry?.chatDate || '',
        count: entries.length * 2
      };
    });
  }

  deleteConversation(conversationId: string, event: Event) {
    event.stopPropagation();
    delete this.chatHistoryStore[conversationId];
    this.persistChatHistoryStore();
    this.buildHistorySummaries();

    if (this.currentConversationId === conversationId) {
      this.currentConversationId = this.getLatestConversationId();
      this.messages = this.currentConversationId ? this.mapConversationToMessages(this.currentConversationId) : [];
      this.pendingNewConversation = this.messages.length === 0;
    }
  }

  startRenameConversation(conversationId: string, event: Event) {
    event.stopPropagation();
    const entries = this.chatHistoryStore[conversationId];
    if (!entries || entries.length === 0) {
      return;
    }

    this.renameTargetId = conversationId;
    this.renameTitle = entries[0].chatTitle || `Conversation ${conversationId.replace('chat_', '')}`;
    this.isRenameDialogOpen = true;
  }

  cancelRename() {
    this.isRenameDialogOpen = false;
    this.renameTargetId = null;
    this.renameTitle = '';
  }

  confirmRename() {
    const newTitle = this.renameTitle.trim();
    if (!newTitle || !this.renameTargetId) {
      return;
    }

    const entries = this.chatHistoryStore[this.renameTargetId];
    if (!entries) {
      return;
    }

    entries.forEach(entry => {
      entry.chatTitle = newTitle;
    });
    this.persistChatHistoryStore();
    this.buildHistorySummaries();
    this.cancelRename();
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

  getDisplayHtml(msg: ChatMessage): string {
    const text = msg.isTyping ? (msg.displayedText || '') : msg.text;
    const cursor = msg.isTyping ? '<span class="chatbot-cursor"></span>' : '';
    return this.formatMessage(text) + cursor;
  }

  private typeMessage(msg: ChatMessage): void {
    const fullText = msg.text;
    msg.displayedText = '';
    msg.isTyping = true;
    let i = 0;
    // ~18ms per char ≈ ~55 chars/sec — feels like fast streaming
    const interval = setInterval(() => {
      i++;
      msg.displayedText = fullText.slice(0, i);
      this.shouldScrollToBottom = true;
      if (i >= fullText.length) {
        clearInterval(interval);
        msg.isTyping = false;
      }
    }, 18);
  }

  private callChatAPI(
    message: string,
    requestId?: string | null,
    conversationId?: string | null,
    newConversation = false
  ): Observable<any> {
    return this.http.post('http://localhost:8080/api/chatbot/chat', {
      message,
      username: this.authService.currentUser()?.username ?? null,
      requestId: requestId ?? null,
      conversationId: conversationId ?? null,
      newConversation
    }, {
      headers: { 'X-Skip-Loader': 'true' }
    });
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private getCachedResponse(cacheKey: string): string | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.savedAt > this.responseCacheTtlMs) {
      this.responseCache.delete(cacheKey);
      this.persistResponseCache();
      return null;
    }

    return cached.response;
  }

  private cacheResponse(cacheKey: string, response: string): void {
    this.responseCache.set(cacheKey, {
      response,
      savedAt: Date.now()
    });
    this.persistResponseCache();
  }

  private loadResponseCache(): void {
    if (!this.isBrowser) return;
    try {
      const saved = localStorage.getItem(this.responseCacheKey);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Record<string, CachedChatResponse>;
      const now = Date.now();
      Object.entries(parsed).forEach(([key, value]) => {
        if (value && typeof value.response === 'string' && typeof value.savedAt === 'number') {
          if (now - value.savedAt <= this.responseCacheTtlMs) {
            this.responseCache.set(key, value);
          }
        }
      });
      this.persistResponseCache();
    } catch {
      this.responseCache.clear();
    }
  }

  private persistResponseCache(): void {
    if (!this.isBrowser) return;
    try {
      const serializable = Object.fromEntries(this.responseCache.entries());
      localStorage.setItem(this.responseCacheKey, JSON.stringify(serializable));
    } catch {}
  }

  private ensureActiveConversation(): void {
    this.lazyLoadChatHistory();

    if (this.currentConversationId) {
      return;
    }

    this.currentConversationId = this.getLatestConversationId() || 'chat_001';
    this.chatHistoryStore[this.currentConversationId] ??= [];
    this.pendingNewConversation = this.chatHistoryStore[this.currentConversationId].length === 0;
  }

  private getLatestConversationId(): string {
    const keys = this.getSortedConversationKeys();
    return keys.length > 0 ? keys[keys.length - 1] : '';
  }

  private getNextConversationId(): string {
    const keys = this.getSortedConversationKeys();
    const nextNumber = keys.reduce((max, key) => {
      const match = /^chat_(\d+)$/.exec(key);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    return `chat_${nextNumber.toString().padStart(3, '0')}`;
  }

  private getSortedConversationKeys(): string[] {
    return Object.keys(this.chatHistoryStore).sort((left, right) => {
      const leftNumber = Number((/^chat_(\d+)$/.exec(left)?.[1]) ?? '0');
      const rightNumber = Number((/^chat_(\d+)$/.exec(right)?.[1]) ?? '0');
      return leftNumber - rightNumber;
    });
  }

  private getPersistedConversationEntries(): StoredChatEntry[] {
    this.ensureActiveConversation();
    return this.chatHistoryStore[this.currentConversationId] ?? [];
  }

  private persistConversationEntry(
    question: string,
    answer: string,
    requestId: string,
    requestStartedAt: Date,
    responseAt: Date,
    source: string
  ): void {
    if (!this.isBrowser) {
      return;
    }

    this.ensureActiveConversation();
    const existingEntries = this.getPersistedConversationEntries();
    const questionId = existingEntries.length + 1;
    const conversationId = this.currentConversationId;
    const chatTitle = existingEntries[0]?.chatTitle || question;
    const username = this.authService.currentUser()?.username ?? null;
    const today = requestStartedAt.toLocaleDateString('en-GB');

    existingEntries.push({
      answer: [{ Text: answer, Table: null }],
      profile: globalThis.location?.hostname ?? 'localhost',
      user_id: null,
      chatDate: today,
      question,
      chatTitle,
      request_id: requestId,
      question_id: questionId,
      response_type: 'text',
      conversation_id: conversationId,
      request_timestamp: requestStartedAt.toISOString(),
      response_timestamp: responseAt.toISOString(),
      username,
      source
    });

    this.chatHistoryStore[conversationId] = existingEntries;
    this.persistChatHistoryStore();
    this.buildHistorySummaries();
  }

  private persistChatHistoryStore(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      localStorage.setItem(this.chatHistoryKey, JSON.stringify(this.chatHistoryStore));
    } catch {}
  }

  private mapConversationToMessages(conversationId: string): ChatMessage[] {
    const entries = this.chatHistoryStore[conversationId] ?? [];
    return entries.flatMap(entry => {
      const requestTime = new Date(entry.request_timestamp);
      const responseTime = new Date(entry.response_timestamp);
      return [
        { text: entry.question, isUser: true, timestamp: requestTime },
        { text: entry.answer?.[0]?.Text ?? '', isUser: false, timestamp: responseTime }
      ];
    });
  }

  private mapMessagesToStoredEntries(messages: ChatMessage[], conversationId: string): StoredChatEntry[] {
    const entries: StoredChatEntry[] = [];
    const completeMessages = messages.filter(message => !message.isLoading);

    for (let index = 0; index < completeMessages.length; index += 2) {
      const userMessage = completeMessages[index];
      const botMessage = completeMessages[index + 1];
      if (!userMessage?.isUser || !botMessage || botMessage.isUser) {
        continue;
      }

      entries.push({
        answer: [{ Text: botMessage.text, Table: null }],
        profile: globalThis.location?.hostname ?? 'localhost',
        user_id: null,
        chatDate: userMessage.timestamp.toLocaleDateString('en-GB'),
        question: userMessage.text,
        chatTitle: entries[0]?.chatTitle || userMessage.text,
        request_id: `legacy_${index + 1}`,
        question_id: entries.length + 1,
        response_type: 'text',
        conversation_id: conversationId,
        request_timestamp: userMessage.timestamp.toISOString(),
        response_timestamp: botMessage.timestamp.toISOString(),
        username: this.authService.currentUser()?.username ?? null,
        source: 'legacy'
      });
    }

    return entries;
  }
}
