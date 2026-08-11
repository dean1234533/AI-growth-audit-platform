import { createElement, type ElementType, type ReactNode } from 'react';

type MotionLiteProps = Record<string, unknown> & {
  children?: ReactNode;
};

const MOTION_ONLY_PROPS = new Set([
  'animate',
  'exit',
  'initial',
  'layout',
  'transition',
  'viewport',
  'whileHover',
  'whileInView',
  'whileTap',
]);

function element(tag: ElementType) {
  return function MotionLiteElement(props: MotionLiteProps) {
    const htmlProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !MOTION_ONLY_PROPS.has(key)),
    );
    return createElement(tag, htmlProps);
  };
}

/**
 * Zero-runtime-animation stand-in for non-essential marketing transitions.
 * It preserves the rendered HTML while keeping Framer Motion out of the
 * critical homepage bundle and, importantly, never server-renders LCP text
 * at opacity: 0.
 */
export const motion = {
  div: element('div'),
  form: element('form'),
  h1: element('h1'),
  p: element('p'),
  span: element('span'),
};

export function AnimatePresence({ children }: { children: ReactNode; mode?: string }) {
  return children;
}
