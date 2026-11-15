/**
 * "I'm not sure, teach me": a quiet link under the prompt of every scored question.
 * It opens an inline card with the step's `teach` text (or its `hint`), so the reader can still answer.
 */
import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Text } from "./Text";
import { IconBulb, IconChevronLeft } from "./icons";

export interface TeachProps {
  open: boolean;
  /** false once the question is answered: the link hides, an open card stays */
  canOpen: boolean;
  onOpen: () => void;
  text?: string;
  /** go back one step (used when the step has no teaching text) */
  onBack?: () => void;
  reduced: boolean;
}

export function Teach({ open, canOpen, onOpen, text, onBack, reduced }: TeachProps) {
  const id = useId();
  if (!open && !canOpen) return null;
  return (
    <div className="lp-teach-slot">
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div key="card" id={id} className="lp-teach" role="note" aria-label="Teaching card"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 30 }}>
            <div className="lp-teach-label"><IconBulb size={16} />Here is the idea</div>
            {text ? <Text text={text} className="lp-teach-body" /> : (
              <>
                <p className="lp-teach-body">Look back at the last few steps. The idea you need is there.</p>
                {onBack && (
                  <button type="button" data-own-enter="" className="lp-teach-back" onClick={onBack}>
                    <IconChevronLeft size={16} />Go back a step
                  </button>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.button key="link" type="button" data-own-enter="" className="lp-teach-link" onClick={onOpen}
            aria-expanded={false} aria-controls={id} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            <IconBulb size={17} />
            <span>I'm not sure, teach me</span>
            <kbd className="lp-teach-kbd" aria-hidden="true">T</kbd>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
