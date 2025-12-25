"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";
import type { ChatSettings } from "../types";

const SETTINGS_STORAGE_KEY = "chat-settings";

const DEFAULT_SETTINGS: ChatSettings = {
  model: "gpt-oss-20b",
  reasoningLevel: "medium",
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  topK: 5,
  frequencyPenalty: 0,
  presencePenalty: 0,
  streamMode: true,
  useReranking: true,
};

function getInitialSettings(): ChatSettings {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("[Settings] Failed to load initial settings:", e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function useChatSettings() {
  const [settings, setSettings] = useState<ChatSettings>(getInitialSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [defaultReasoningLevel, setDefaultReasoningLevel] = useState<string>("medium");
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);

  // localStorage 저장
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("[Settings] Failed to save to localStorage:", e);
    }
  }, [settings, settingsLoaded]);

  // 백엔드 기본 설정 로드
  useEffect(() => {
    const loadDefaultSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/default-settings`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setDefaultReasoningLevel(data.reasoning_level);
          setSettings(prev => ({
            ...prev,
            model: data.model,
            reasoningLevel: data.reasoning_level,
            temperature: data.temperature,
            maxTokens: data.max_tokens,
            topP: data.top_p,
            topK: data.top_k,
            useReranking: data.use_reranking,
          }));
          setSettingsLoaded(true);
          toast.success(`설정 로드 완료 (max_tokens: ${data.max_tokens})`);
        } else {
          console.error('[Settings] Failed to load, using fallback defaults');
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('[Settings] Error loading settings:', error);
        toast.error('설정 로드 실패 - 기본값 사용');
        setSettingsLoaded(true);
      }
    };

    loadDefaultSettings();
  }, []);

  // deepThinking 토글 연동
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      reasoningLevel: deepThinkingEnabled ? "medium" : defaultReasoningLevel,
    }));
  }, [deepThinkingEnabled, defaultReasoningLevel]);

  return {
    settings,
    setSettings,
    settingsLoaded,
    deepThinkingEnabled,
    setDeepThinkingEnabled,
  };
}
