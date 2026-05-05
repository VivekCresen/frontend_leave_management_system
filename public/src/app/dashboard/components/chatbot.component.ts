import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';
import { injectAuthService } from '../../services/auth.service';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  displayedText?: string;
  isTyping?: boolean;
  cachedHtml?: SafeHtml;       // cached so formatMessage never runs twice for the same message
  cachedTypingText?: string;   // tracks which displayedText the cached typing HTML was built from
}

interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

interface CachedChatResponse {
  response: string;
  savedAt: number;
}

interface StoredChatMeta {
  conversation_id: string;
  username: string | null;
  user_id: number | null;
  profile: string;
  response_type: string;
  chatTitle: string;
  chatDate: string;
}

interface StoredChatMessage {
  question: string;
  answer: string;
  table: { headers: string[]; rows: string[][] } | null;
  source: string;
  question_id: number;
  request_id: string;
  latency_ms: number;
  request_timestamp: string;
  response_timestamp: string;
}

interface StoredChatEntry {
  meta: StoredChatMeta;
  messages: StoredChatMessage[];
}

type StoredChatHistory = Record<string, StoredChatEntry>;

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <button
      #chatbotFab
      (click)="!isDragging && toggleChat()"
      (mousedown)="onFabMouseDown($event)"
      (document:mousemove)="onFabMouseMove($event)"
      (document:mouseup)="onFabMouseUp($event)"
      [style.bottom.px]="fabPosition.bottom"
      [style.right.px]="fabPosition.right"
      class="chatbot-fab"
      [class.chatbot-fab--dragging]="isDragging"
      [attr.aria-label]="isOpen ? 'Close chat' : 'Open chat'">
      <svg *ngIf="!isOpen" class="chatbot-fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.681L3 21l2.681-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
      </svg>
      <svg *ngIf="isOpen" class="chatbot-fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>

    <div class="chatbot-window" 
         [class.chatbot-window--open]="isOpen" 
         [style.bottom.px]="fabPosition.bottom + 64"
         [style.right.px]="fabPosition.right"
         role="dialog" 
         aria-label="Leave Assistant">

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
               [class.chatbot-bubble--bot]="!msg.isUser"
               (click)="onBubbleClick($event)">

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

    
      <!-- Table data modal -->
      <div *ngIf="tableModal" class="chatbot-table-modal-backdrop" (click)="closeTableModal()" role="dialog" aria-modal="true" aria-label="Data table">
        <div class="chatbot-table-modal" (click)="$event.stopPropagation()">
          <div class="chatbot-table-modal-header">
            <strong>{{ tableModal.title || 'Data' }}</strong>
            <div class="chatbot-table-modal-actions">
              <button type="button" class="chatbot-export-btn" (click)="exportTableAsExcel()">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Export as Excel
              </button>
              <button type="button" class="chatbot-modal-close-btn" (click)="closeTableModal()" aria-label="Close">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="chatbot-table-modal-body">
            <div class="chatbot-table-wrapper">
              <table class="chatbot-table">
                <thead>
                  <tr>
                    <th *ngFor="let h of tableModal.headers">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of tableModal.rows">
                    <td *ngFor="let cell of row">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
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
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      border: none;
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15,139,141,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 1001;
      user-select: none;
    }
    .chatbot-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(15,139,141,0.55);
    }
    .chatbot-fab--dragging {
      cursor: grabbing;
      transform: scale(1.1);
      box-shadow: 0 8px 24px rgba(15,139,141,0.65);
    }
    .chatbot-fab-icon { width: 22px; height: 22px; pointer-events: none; }

    .chatbot-window {
      position: fixed;
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
      .chatbot-window { 
        width: calc(100vw - 32px); 
        height: 70vh;
        max-width: 700px;
      }
    }

    @media (max-width: 480px) {
      .chatbot-window { 
        width: calc(100vw - 16px);
        max-width: 700px;
      }
      .chatbot-history-panel { width: 0; border-right: none; }
      .chatbot-history-panel--collapsed { display: none; }
    }

    ::ng-deep .chatbot-table-wrapper {
      overflow-x: auto;
      margin: 6px 0;
      border-radius: 8px;
      border: 1px solid rgba(148,163,184,0.4);
    }
    ::ng-deep .chatbot-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
      min-width: 300px;
    }
    ::ng-deep .chatbot-table th {
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      padding: 7px 10px;
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.25);
    }
    ::ng-deep .chatbot-table td {
      padding: 6px 10px;
      border: 1px solid rgba(148,163,184,0.45);
      color: var(--field-input-text, #0f172a);
      white-space: nowrap;
    }
    ::ng-deep .chatbot-table tr:nth-child(even) td { background: rgba(15,139,141,0.05); }
    ::ng-deep .chatbot-table tr:hover td { background: rgba(15,139,141,0.1); }

    ::ng-deep .chatbot-view-data-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--app-primary, #0f8b8d);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      padding: 4px 0;
      background: none;
      border: none;
    }
    ::ng-deep .chatbot-view-data-link:hover {
      opacity: 0.8;
    }

    .chatbot-table-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 20px;
    }
    .chatbot-table-modal {
      background: var(--surface-bg, #fff);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,0.25);
      width: min(90vw, 800px);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chatbot-table-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--surface-border, rgba(226,232,240,0.7));
      flex-shrink: 0;
    }
    .chatbot-table-modal-header strong {
      font-size: 15px;
      color: var(--shell-text, #10233d);
    }
    .chatbot-table-modal-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .chatbot-table-modal-body {
      overflow: auto;
      padding: 16px 20px;
      flex: 1;
    }
    .chatbot-table-modal-body .chatbot-table-wrapper {
      margin: 0;
      border-radius: 10px;
      border: 1px solid rgba(148,163,184,0.4);
      overflow: auto;
    }
    .chatbot-table-modal-body .chatbot-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
    }
    .chatbot-table-modal-body .chatbot-table th {
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .chatbot-table-modal-body .chatbot-table td {
      padding: 9px 14px;
      border: 1px solid rgba(148,163,184,0.35);
      color: var(--field-input-text, #0f172a);
      white-space: nowrap;
    }
    .chatbot-table-modal-body .chatbot-table tr:nth-child(even) td { background: rgba(15,139,141,0.04); }
    .chatbot-table-modal-body .chatbot-table tr:hover td { background: rgba(15,139,141,0.09); }
    .chatbot-export-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--app-primary, #0f8b8d);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
    }
    .chatbot-export-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .chatbot-modal-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(148,163,184,0.15);
      border: none;
      color: var(--shell-text, #10233d);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .chatbot-modal-close-btn:hover { background: rgba(148,163,184,0.28); }
  `]
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('chatbotFab') chatbotFab!: ElementRef;

  private http = inject(HttpClient);
  private authService = injectAuthService();
  private platformId = inject(PLATFORM_ID);
  private sanitizer = inject(DomSanitizer);
  private isBrowser = isPlatformBrowser(this.platformId);

  isOpen = false;
  fabPosition = { bottom: 28, right: 28 };
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
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
  private conversationStarted = false;

  ngOnInit() {
    this.loadResponseCache();
    this.initQuickActions();
    this.loadFabPosition();
    // Auto-create new chat for each new tab/session
    if (this.isBrowser) {
      this.loadChatHistoryStore();
      this.startNewChat();
    }
  }

  private initQuickActions() {
    const role = (this.authService.currentUser()?.role ?? '').toUpperCase();
    if (role === 'MANAGER') {
      this.quickActions = [
        { label: '📊 My Leave Balance', message: 'What is my current leave balance?' },
        { label: '👥 Team on leave today', message: 'Who is on leave today?' },
        { label: '⏳ Team pending leaves', message: 'How many pending leaves does my team have?' },
        { label: '🗓️ Upcoming Holidays', message: 'What are the upcoming holidays?' }
      ];
    } else if (role === 'EMPLOYEE') {
      this.quickActions = [
        { label: '📊 My Leave Balance', message: 'What is my current leave balance?' },
        { label: '⏳ My Pending Leaves', message: 'How many pending leaves do I have?' },
        { label: '✅ My Approved Leaves', message: 'How many approved leaves do I have?' },
        { label: '🗓️ Upcoming Holidays', message: 'What are the upcoming holidays?' }
      ];
    }

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

  onFabMouseDown(event: MouseEvent) {
    if (event.button !== 0) return; // Only left click
    this.isDragging = true;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    event.preventDefault();
  }

  onFabMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const fabSize = 52;
    
    // Calculate position from bottom-right
    const right = viewportWidth - event.clientX - (fabSize - this.dragOffset.x);
    const bottom = viewportHeight - event.clientY - (fabSize - this.dragOffset.y);
    
    // Keep within viewport bounds
    this.fabPosition = {
      right: Math.max(10, Math.min(viewportWidth - fabSize - 10, right)),
      bottom: Math.max(10, Math.min(viewportHeight - fabSize - 10, bottom))
    };
    
    event.preventDefault();
  }

  onFabMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      this.isDragging = false;
      this.saveFabPosition();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private loadFabPosition() {
    if (!this.isBrowser) return;
    try {
      const saved = localStorage.getItem('chatbot-fab-position');
      if (saved) {
        this.fabPosition = JSON.parse(saved);
      }
    } catch {}
  }

  private saveFabPosition() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem('chatbot-fab-position', JSON.stringify(this.fabPosition));
    } catch {}
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
    this.currentMessage = '';
    this.isLoading = true;

    this.ensureActiveConversation();
    const isNewConversationMessage = this.pendingNewConversation && !this.conversationStarted;
    this.conversationStarted = true;
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
          this.conversationStarted = true;
          this.shouldScrollToBottom = true;
        },
        error: (err) => {
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
    if (this.currentConversationId && this.chatHistoryStore[this.currentConversationId]) {
      this.chatHistoryStore[this.currentConversationId].messages = [];
      this.persistChatHistoryStore();
    }
  }

  startNewChat() {
    const currentEntries = this.getPersistedConversationEntries();
    // Allow creating new chat even if current is empty (for tab initialization)
    if (this.messages.length === 0 && currentEntries.length === 0 && this.currentConversationId) return;

    this.cancelCurrentRequest();
    this.messages = [];
    this.currentConversationId = this.getNextConversationId();
    this.chatHistoryStore[this.currentConversationId] = {
      meta: {
        conversation_id: this.currentConversationId,
        username: this.authService.currentUser()?.username ?? null,
        user_id: null,
        profile: globalThis.location?.hostname ?? 'localhost',
        response_type: 'text',
        chatTitle: 'New chat',
        chatDate: new Date().toLocaleDateString('en-GB')
      },
      messages: []
    };
    this.pendingNewConversation = true;
    this.conversationStarted = false;
    this.persistChatHistoryStore();
    this.buildHistorySummaries();
    this.shouldScrollToBottom = true;
  }

  stopRequest() {
    this.cancelCurrentRequest();
    const idx = this.messages.findIndex(m => m.isLoading);
    if (idx !== -1) this.messages.splice(idx, 1);
    this.isLoading = false;
  }

  private cancelCurrentRequest() {
    if (this.currentRequestId) {
      this.cancelSubject$.next();
      this.cancelSubject$.complete();
      this.http.delete(`http://localhost:8080/api/chatbot/cancel/${this.currentRequestId}`, {
        headers: { 'X-Skip-Loader': 'true' }
      }).subscribe({ error: () => {} }); 
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
    this.conversationStarted = !this.pendingNewConversation;
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

      // Don't auto-load previous conversation on new tab
      // User can manually select from history if needed
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
      const entry = this.chatHistoryStore[id];
      return {
        id,
        title: entry?.meta?.chatTitle || `Conversation ${id.replace('chat_', '')}`,
        chatDate: entry?.meta?.chatDate || '',
        count: (entry?.messages?.length ?? 0) * 2
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
    const entry = this.chatHistoryStore[conversationId];
    if (!entry) return;

    this.renameTargetId = conversationId;
    this.renameTitle = entry.meta?.chatTitle || `Conversation ${conversationId.replace('chat_', '')}`;
    this.isRenameDialogOpen = true;
  }

  cancelRename() {
    this.isRenameDialogOpen = false;
    this.renameTargetId = null;
    this.renameTitle = '';
  }

  confirmRename() {
    const newTitle = this.renameTitle.trim();
    if (!newTitle || !this.renameTargetId) return;

    const entry = this.chatHistoryStore[this.renameTargetId];
    if (!entry) return;

    entry.meta.chatTitle = newTitle;
    this.persistChatHistoryStore();
    this.buildHistorySummaries();
    this.cancelRename();
  }

  trackByIndex(index: number): number { return index; }

  // Table data store — avoids putting JSON in innerHTML (Angular sanitizer strips data-* attrs)
  private tableStore = new Map<number, TableData>();
  private tableStoreCounter = 0;
  tableModal: TableData | null = null;

  onBubbleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const btn = target.closest('.chatbot-view-data-link') as HTMLElement | null;
    if (!btn) return;
    event.preventDefault();
    const idx = Number(btn.getAttribute('data-idx'));
    const data = this.tableStore.get(idx);
    if (data) this.tableModal = { ...data };
  }

  closeTableModal(): void {
    this.tableModal = null;
  }

  exportTableAsExcel(): void {
    if (!this.tableModal) return;
    const { headers, rows, title } = this.tableModal;
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(','))
    ];
    const csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'data').replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatMessage(text: string): string {
    if (!text) return '';

    // Replace markdown tables with a "View your data" button.
    // Table data is stored in tableStore (keyed by index) — Angular's DomSanitizer
    // strips data-* attributes from [innerHTML], so we only embed the numeric index.
    const tableRegex = /(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)*)/g;
    text = text.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) return match;
      const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
      const rows = lines.slice(2).map(line =>
        line.split('|').map(c => c.trim()).filter(c => c)
      );
      const idx = this.tableStoreCounter++;
      this.tableStore.set(idx, { headers, rows, title: `Data (${rows.length} rows)` });
      return `<button class="chatbot-view-data-link" data-idx="${idx}">` +
        `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">` +
        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 6h18M3 14h18M3 18h18"/>` +
        `</svg>View your data</button>`;
    });

    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  getDisplayHtml(msg: ChatMessage): SafeHtml {
    const text = msg.isTyping ? (msg.displayedText || '') : msg.text;
    const cursor = msg.isTyping ? '<span class="chatbot-cursor"></span>' : '';

    if (!msg.isTyping) {
      // Fully received message — build and cache once
      if (!msg.cachedHtml) {
        msg.cachedHtml = this.sanitizer.bypassSecurityTrustHtml(this.formatMessage(text) + cursor);
      }
      return msg.cachedHtml;
    }

    // Typing animation — rebuild only when displayedText changes
    if (msg.cachedTypingText !== text) {
      msg.cachedTypingText = text;
      msg.cachedHtml = this.sanitizer.bypassSecurityTrustHtml(this.formatMessage(text) + cursor);
    }
    return msg.cachedHtml!;
  }

  private typeMessage(msg: ChatMessage): void {
    const fullText = msg.text;
    msg.displayedText = '';
    msg.isTyping = true;
    msg.cachedHtml = undefined;
    msg.cachedTypingText = undefined;
    let i = 0;
    // ~18ms per char ≈ ~55 chars/sec — feels like fast streaming
    const interval = setInterval(() => {
      i++;
      msg.displayedText = fullText.slice(0, i);
      this.shouldScrollToBottom = true;
      if (i >= fullText.length) {
        clearInterval(interval);
        msg.isTyping = false;
        msg.cachedHtml = undefined; // force rebuild as final (non-typing) HTML
        msg.cachedTypingText = undefined;
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
      role: this.authService.currentUser()?.role ?? null,
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

    if (this.currentConversationId) return;

    this.currentConversationId = this.getLatestConversationId() || 'chat_001';
    if (!this.chatHistoryStore[this.currentConversationId]) {
      this.chatHistoryStore[this.currentConversationId] = {
        meta: {
          conversation_id: this.currentConversationId,
          username: this.authService.currentUser()?.username ?? null,
          user_id: null,
          profile: globalThis.location?.hostname ?? 'localhost',
          response_type: 'text',
          chatTitle: 'Chat session',
          chatDate: new Date().toLocaleDateString('en-GB')
        },
        messages: []
      };
    }
    this.pendingNewConversation = (this.chatHistoryStore[this.currentConversationId]?.messages?.length ?? 0) === 0;
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

  private getPersistedConversationEntries(): StoredChatMessage[] {
    this.ensureActiveConversation();
    return this.chatHistoryStore[this.currentConversationId]?.messages ?? [];
  }

  private persistConversationEntry(
    question: string,
    answer: string,
    requestId: string,
    requestStartedAt: Date,
    responseAt: Date,
    source: string
  ): void {
    if (!this.isBrowser) return;

    this.ensureActiveConversation();
    const conversationId = this.currentConversationId;
    const username = this.authService.currentUser()?.username ?? null;
    const today = requestStartedAt.toLocaleDateString('en-GB');

    let entry = this.chatHistoryStore[conversationId];
    if (!entry) {
      entry = {
        meta: {
          conversation_id: conversationId,
          username,
          user_id: null,
          profile: globalThis.location?.hostname ?? 'localhost',
          response_type: 'text',
          chatTitle: question,
          chatDate: today
        },
        messages: []
      };
      this.chatHistoryStore[conversationId] = entry;
    }

    const questionId = entry.messages.length + 1;
    entry.messages.push({
      question,
      answer,
      table: null,
      source,
      question_id: questionId,
      request_id: requestId,
      latency_ms: responseAt.getTime() - requestStartedAt.getTime(),
      request_timestamp: requestStartedAt.toISOString(),
      response_timestamp: responseAt.toISOString()
    });

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
    const entry = this.chatHistoryStore[conversationId];
    if (!entry) return [];
    const messages = entry.messages ?? [];
    return messages.flatMap(msg => {
      const requestTime = new Date(msg.request_timestamp);
      const responseTime = new Date(msg.response_timestamp);
      // Reconstruct full answer text with table markdown for rendering
      const answerText = msg.answer ?? '';
      return [
        { text: msg.question, isUser: true, timestamp: requestTime },
        { text: answerText, isUser: false, timestamp: responseTime }
      ];
    });
  }

  private mapMessagesToStoredEntries(messages: ChatMessage[], conversationId: string): StoredChatEntry {
    const completeMessages = messages.filter(m => !m.isLoading);
    const username = this.authService.currentUser()?.username ?? null;
    const firstUser = completeMessages.find(m => m.isUser);

    const entry: StoredChatEntry = {
      meta: {
        conversation_id: conversationId,
        username,
        user_id: null,
        profile: globalThis.location?.hostname ?? 'localhost',
        response_type: 'text',
        chatTitle: firstUser?.text || 'Chat session',
        chatDate: firstUser?.timestamp.toLocaleDateString('en-GB') || ''
      },
      messages: []
    };

    for (let i = 0; i < completeMessages.length; i += 2) {
      const userMsg = completeMessages[i];
      const botMsg = completeMessages[i + 1];
      if (!userMsg?.isUser || !botMsg || botMsg.isUser) continue;

      entry.messages.push({
        question: userMsg.text,
        answer: botMsg.text,
        table: null,
        source: 'legacy',
        question_id: entry.messages.length + 1,
        request_id: `legacy_${i + 1}`,
        latency_ms: 0,
        request_timestamp: userMsg.timestamp.toISOString(),
        response_timestamp: botMsg.timestamp.toISOString()
      });
    }

    return entry;
  }
}
