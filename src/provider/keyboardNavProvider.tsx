import { type ParentComponent } from "solid-js";
import { KeyboardNavContext, createKeyboardNav } from "../hooks/useKeyboardNav";

// Provides a single keyboard-nav instance so descendant panels (the active tool
// and the PDF preview) share one focus ring instead of competing rings.
export const KeyboardNavProvider: ParentComponent = (props) => {
  const nav = createKeyboardNav();
  return <KeyboardNavContext.Provider value={nav}>{props.children}</KeyboardNavContext.Provider>;
};
