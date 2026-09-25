import React from 'react';
import { MiniWidget } from './components/MiniWidget';

/**
 * MiniApp — rendered in the dedicated 68×68 mini window (loaded with ?mode=mini).
 *
 * Dragging is handled via CSS -webkit-app-region: drag on MiniWidget's outer
 * container (native Electron frameless-window drag — works even when mouse exits
 * the tiny window).
 *
 * The expand button (no-drag) restores the full HUD.
 * The X button (no-drag) quits the app.
 */
export const MiniApp: React.FC = () => {
  const handleExpand = () => {
    // Fire-and-forget IPC: main destroys mini window and restores full HUD
    window.electronAPI?.exitMiniMode?.();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow?.();
  };

  return (
    <div
      className="h-screen w-screen bg-transparent"
      style={{ padding: 0, margin: 0, boxSizing: 'border-box' }}
    >
      <MiniWidget
        isAudioCapturing={false}
        isGenerating={false}
        sttStatus="disconnected"
        onExpand={handleExpand}
        onClose={handleClose}
      />
    </div>
  );
};
