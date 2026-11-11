import * as React from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { extractCleanPasteText } from '@/lib/clipboardToMarkdownLatex';

function mergeRefs<T>(
  ...refs: Array<React.ForwardedRef<T> | undefined>
): React.RefCallback<T> {
  return (instance) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }
      if (typeof ref === 'function') {
        ref(instance);
      } else {
        ref.current = instance;
      }
    }
  };
}

function setNativeTextareaValue(
  textarea: HTMLTextAreaElement,
  nextValue: string
): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  );
  if (descriptor?.set) {
    descriptor.set.call(textarea, nextValue);
  } else {
    textarea.value = nextValue;
  }
}

export const SmartPasteTextarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ onPaste, ...props }, forwardedRef) => {
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      onPaste?.(event);
      if (event.defaultPrevented) {
        return;
      }

      const clipboard = event.clipboardData;
      if (!clipboard) {
        return;
      }

      const html = clipboard.getData('text/html') ?? '';
      const plainText = clipboard.getData('text/plain') ?? '';
      if (!html && !plainText) {
        return;
      }

      const { text, transformed } = extractCleanPasteText({
        html,
        plainText,
      });

      if (!transformed) {
        return;
      }

      const textarea = localRef.current ?? event.currentTarget;
      if (textarea.disabled || textarea.readOnly) {
        return;
      }

      event.preventDefault();

      const currentValue = textarea.value;
      const start = textarea.selectionStart ?? currentValue.length;
      const end = textarea.selectionEnd ?? currentValue.length;
      const prefix = currentValue.slice(0, start);
      const suffix = currentValue.slice(end);

      let inserted = text;
      if (textarea.maxLength >= 0) {
        const available = Math.max(
          0,
          textarea.maxLength - (prefix.length + suffix.length)
        );
        inserted = text.slice(0, available);
      }

      const nextValue = `${prefix}${inserted}${suffix}`;
      const nextCursor = prefix.length + inserted.length;

      setNativeTextareaValue(textarea, nextValue);
      textarea.setSelectionRange(nextCursor, nextCursor);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [onPaste]
  );

  return (
    <Textarea
      {...props}
      ref={mergeRefs(localRef, forwardedRef)}
      onPaste={handlePaste}
    />
  );
});

SmartPasteTextarea.displayName = 'SmartPasteTextarea';
