"use client";

import { useState, useCallback } from "react";
import type { Source, ArtifactState } from "../types";

const INITIAL_STATE: ArtifactState = {
  isOpen: false,
  sources: [],
  activeSourceId: null,
  messageId: null,
};

export function useArtifactPanel() {
  const [artifactState, setArtifactState] = useState<ArtifactState>(INITIAL_STATE);

  const openArtifact = useCallback((sources: Source[], messageId: string) => {
    if (sources.length === 0) return;
    setArtifactState({
      isOpen: true,
      sources,
      activeSourceId: sources[0].id,
      messageId,
    });
  }, []);

  const closeArtifact = useCallback(() => {
    setArtifactState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const selectSource = useCallback((sourceId: string) => {
    setArtifactState(prev => ({ ...prev, activeSourceId: sourceId }));
  }, []);

  const updateSources = useCallback((sources: Source[], messageId: string) => {
    setArtifactState(prev => {
      if (prev.isOpen && sources.length > 0) {
        return {
          isOpen: true,
          sources,
          activeSourceId: sources[0].id,
          messageId,
        };
      }
      return prev;
    });
  }, []);

  const resetArtifact = useCallback(() => {
    setArtifactState(INITIAL_STATE);
  }, []);

  return {
    artifactState,
    setArtifactState,
    openArtifact,
    closeArtifact,
    selectSource,
    updateSources,
    resetArtifact,
  };
}
