/**
 * Lightweight chat preview for testing an agent's persona + tools.
 * Opens as a bottom sheet / modal from AgentSection.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2 } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  getAIConfig,
  streamChat,
  type AIProvider,
  type ChatMessage,
} from '../../lib/ai-client';
import { buildFilteredToolsPrompt } from '../../app/ai-tools';
import type { AgentConfig } from '../../lib/agent-types';

interface Props {
  open: boolean;
  onClose: () => void;
  agent: AgentConfig;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function AgentTestPanel({ open, onClose, agent }: Props) {
  const { t, lang } = useT();
  const { settings } = useAppSettings();
  const operatorName = useSettingsStore((s) => s.operatorName) || 'Andy';
  const currency = useSettingsStore((s) => s.currency) || 'USD';
  const sym = currency === 'CNY' ? '¥' : '$';

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Build system prompt for test
  const buildTestPrompt = useCallback(() => {
    const toolsPrompt = buildFilteredToolsPrompt(lang, agent.tools);
    const parts: string[] = [];
    if (lang === 'zh') {
      parts.push(`你是 ${agent.name}，${operatorName} 的 AI 助手。`);
      parts.push(`货币单位：${currency}（金额前使用 ${sym} 符号，禁止使用其他货币符号）`);
      if (agent.role) parts.push(`\n## 角色\n${agent.role}`);
      if (agent.personality) parts.push(`\n## 性格\n${agent.personality}`);
      if (agent.rules) parts.push(`\n## 规则\n${agent.rules}`);
      parts.push('\n⚠️ 这是测试模式 — 不要真正执行工具，只展示你会如何回复。');
    } else {
      parts.push(`You are ${agent.name}, ${operatorName}'s AI assistant.`);
      parts.push(`Currency: ${currency} (use ${sym} symbol before amounts, never use other currency symbols)`);
      if (agent.role) parts.push(`\n## Role\n${agent.role}`);
      if (agent.personality) parts.push(`\n## Personality\n${agent.personality}`);
      if (agent.rules) parts.push(`\n## Rules\n${agent.rules}`);
      parts.push('\n⚠️ This is TEST MODE — do NOT execute tools, just show how you would reply.');
    }
    if (toolsPrompt) parts.push('\n' + toolsPrompt);
    return parts.join('\n');
  }, [agent, lang, operatorName]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const config = getAIConfig(settings);
    if (!config) return;

    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    // Build messages with system prompt
    const chatHistory: ChatMessage[] = [
      { role: 'system', content: buildTestPrompt() },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text.trim() },
    ];

    const assistantMsg: Msg = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await streamChat(
        config.provider as AIProvider,
        config.apiKey,
        chatHistory,
        (chunk) => {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: last.content + chunk, streaming: true };
            }
            return copy;
          });
        },
        controller.signal,
      );

      // Finalize — mark as not streaming
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: result.text || last.content };
        }
        return copy;
      });
    } catch {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = { role: 'assistant', content: t('settings.agents.test.failed') };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, settings, buildTestPrompt, lang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    if (e.key === 'Escape') onClose();
  };

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setMessages([]);
      setInput('');
      setStreaming(false);
    }
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-end lg:items-center justify-center"
          style={{ zIndex: 'var(--layer-dialog)' } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />

          {/* Panel */}
          <motion.div
            className="relative w-full lg:max-w-md lg:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              background: 'var(--color-bg-primary)',
              maxHeight: 'min(80vh, 600px)',
            }}
            initial={{ y: 40, opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{ height: 48, borderBottom: '1px solid var(--color-line-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{agent.avatar}</span>
                <span className="text-[14px]" style={{ fontWeight: 'var(--font-weight-semibold)' } as React.CSSProperties}>
                  {t('settings.agents.test.title').replace('{name}', agent.name)}
                </span>
              </div>
              <button onClick={onClose} className="btn-icon-sm">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 200 }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                  <span className="text-3xl">{agent.avatar}</span>
                  <p className="text-[13px] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t('settings.agents.test.empty')}
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap"
                    style={msg.role === 'user' ? {
                      background: 'var(--color-accent)',
                      color: 'var(--color-brand-text)',
                      borderBottomRightRadius: 4,
                    } : {
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-primary)',
                      borderBottomLeftRadius: 4,
                    }}
                  >
                    {msg.content || (msg.streaming ? '...' : '')}
                  </div>
                </div>
              ))}
            </div>

            {/* Starters (when empty) */}
            {messages.length === 0 && agent.conversation_starters?.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 justify-center">
                {agent.conversation_starters.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                    style={{
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-translucent)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div
              className="shrink-0 px-3 pb-3 pt-2"
              style={{
                borderTop: '1px solid var(--color-line-secondary)',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('settings.agents.test.placeholder')}
                  rows={1}
                  className="input-base flex-1 px-3 py-2.5 text-[14px] resize-none"
                  style={{ maxHeight: 80, minHeight: 40 }}
                  disabled={streaming}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || streaming}
                  className="shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--color-accent)',
                    color: 'var(--color-brand-text)',
                  }}
                >
                  {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
