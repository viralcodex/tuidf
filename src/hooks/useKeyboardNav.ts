import { createSignal, createMemo } from "solid-js";
import { useBindings } from "@opentui/keymap/solid";
import type { FocusableElement } from "../model/models";

export type { FocusableElement };

export function useKeyboardNav() {
  const [focusIndex, setFocusIndex] = createSignal(0);
  const [elements, setElements] = createSignal<FocusableElement[]>([]);
  const [isInputMode, setIsInputMode] = createSignal(false);

  // Memoize valid elements to avoid recalculating on every render
  const validElements = createMemo(() => elements().filter((el) => !el.canFocus || el.canFocus()));

  // Memoize current focused element
  const focusedElement = createMemo(() => {
    const valid = validElements();
    const idx = Math.min(focusIndex(), valid.length - 1);
    return valid[Math.max(0, idx)] ?? null;
  });

  const registerElement = (element: FocusableElement) => {
    setElements((prev) => {
      if (prev.some((e) => e.id === element.id)) return prev;
      return [...prev, element];
    });
  };

  const unregisterElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
  };

  const clampIndex = (idx: number, length: number) =>
    length === 0 ? 0 : ((idx % length) + length) % length;

  const focusNext = () => {
    if (isInputMode()) return;
    const len = validElements().length;
    if (len === 0) return;
    setFocusIndex((prev) => clampIndex(prev + 1, len));
  };

  const focusPrev = () => {
    if (isInputMode()) return;
    const len = validElements().length;
    if (len === 0) return;
    setFocusIndex((prev) => clampIndex(prev - 1, len));
  };

  const focusById = (id: string) => {
    const idx = validElements().findIndex((el) => el.id === id);
    if (idx !== -1) setFocusIndex(idx);
  };

  const executeCurrentAction = () => {
    if (isInputMode()) return;
    focusedElement()?.onEnter?.();
  };

  const isFocused = (id: string) => focusedElement()?.id === id;

  const getFocusedId = () => focusedElement()?.id ?? null;

  const clearElements = () => {
    setElements([]);
    setFocusIndex(0);
  };

  useBindings(() => ({
    priority: 100,
    bindings: isInputMode()
      ? [
          // Let escape bubble to the app-level double-esc handler in src/index.tsx
          {
            key: "escape",
            cmd: () => setIsInputMode(false),
            preventDefault: false,
          },
          {
            key: "tab",
            cmd: () => {
              setIsInputMode(false);
              focusNext();
            },
          },
          {
            key: "shift+tab",
            cmd: () => {
              setIsInputMode(false);
              focusPrev();
            },
          },
        ]
      : [
          { key: "tab", cmd: focusNext },
          { key: "shift+tab", cmd: focusPrev },
          { key: "return", cmd: executeCurrentAction },
          { key: "down", cmd: focusNext },
          { key: "j", cmd: focusNext },
          { key: "up", cmd: focusPrev },
          { key: "k", cmd: focusPrev },
        ],
  }));

  return {
    registerElement,
    unregisterElement,
    isFocused,
    getFocusedId,
    focusById,
    focusIndex,
    clearElements,
    isInputMode,
    setIsInputMode,
  };
}
