/** One-shot handoff: search picks a term, the glossary page scrolls to it. */
let pending: string | null = null;
export const setGlossaryFocus = (term: string) => { pending = term; };
export const takeGlossaryFocus = () => { const t = pending; pending = null; return t; };
