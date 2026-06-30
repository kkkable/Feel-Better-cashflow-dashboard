import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const CARD_WIDTH = 360;
const CARD_HEIGHT = 250;
const EDGE_GAP = 16;
const TARGET_GAP = 28;
const ARROW_TARGET_GAP = 12;
const ARROW_HEAD_LENGTH = 18;
const ARROW_HEAD_ANGLE = Math.PI / 7;
const RETRY_DELAYS = [80, 180, 360, 700, 1200];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTargetRect(targetSelector, secondaryTargetSelector) {
  if (!targetSelector) return null;

  const targets = [targetSelector, secondaryTargetSelector]
    .filter(Boolean)
    .map((selector) => document.querySelector(selector))
    .filter(Boolean)
    .map((element) => element.getBoundingClientRect());

  if (targets.length === 0) return null;

  const left = Math.min(...targets.map((rect) => rect.left));
  const top = Math.min(...targets.map((rect) => rect.top));
  const right = Math.max(...targets.map((rect) => rect.right));
  const bottom = Math.max(...targets.map((rect) => rect.bottom));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
  };
}

function getPrimaryTarget(targetSelector) {
  if (!targetSelector) return null;
  return document.querySelector(targetSelector);
}

function getCardPosition(targetRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - CARD_WIDTH - EDGE_GAP);
  const maxTop = Math.max(EDGE_GAP, viewportHeight - CARD_HEIGHT - EDGE_GAP);

  if (!targetRect) {
    return {
      left: clamp(viewportWidth - CARD_WIDTH - EDGE_GAP, EDGE_GAP, maxLeft),
      top: clamp(112, EDGE_GAP, maxTop),
    };
  }

  if (viewportWidth < 720) {
    return {
      left: EDGE_GAP,
      top: clamp(targetRect.bottom + EDGE_GAP, EDGE_GAP, maxTop),
    };
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const hasRoomRight = targetRect.right + TARGET_GAP + CARD_WIDTH < viewportWidth - EDGE_GAP;
  const hasRoomLeft = targetRect.left - TARGET_GAP - CARD_WIDTH > EDGE_GAP;
  let left;

  if (targetCenterX < viewportWidth / 2 && hasRoomRight) {
    left = targetRect.right + TARGET_GAP;
  } else if (hasRoomLeft) {
    left = targetRect.left - CARD_WIDTH - TARGET_GAP;
  } else {
    left = clamp(targetRect.left, EDGE_GAP, maxLeft);
  }

  return {
    left: clamp(left, EDGE_GAP, maxLeft),
    top: clamp(targetRect.top - 12, EDGE_GAP, maxTop),
  };
}

function getTargetEdgePoint(cardRect, targetRect) {
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const cardCenterX = cardRect.left + cardRect.width / 2;
  const cardCenterY = cardRect.top + cardRect.height / 2;
  const dx = cardCenterX - targetCenterX;
  const dy = cardCenterY - targetCenterY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx < 0 ? targetRect.left - ARROW_TARGET_GAP : targetRect.right + ARROW_TARGET_GAP,
      y: clamp(cardCenterY, targetRect.top + ARROW_TARGET_GAP, targetRect.bottom - ARROW_TARGET_GAP),
    };
  }

  return {
    x: clamp(cardCenterX, targetRect.left + ARROW_TARGET_GAP, targetRect.right - ARROW_TARGET_GAP),
    y: dy < 0 ? targetRect.top - ARROW_TARGET_GAP : targetRect.bottom + ARROW_TARGET_GAP,
  };
}

function getCardEdgePoint(cardRect, targetPoint) {
  const cardCenterX = cardRect.left + cardRect.width / 2;
  const cardCenterY = cardRect.top + cardRect.height / 2;
  const dx = targetPoint.x - cardCenterX;
  const dy = targetPoint.y - cardCenterY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx > 0 ? cardRect.right : cardRect.left,
      y: clamp(targetPoint.y, cardRect.top + ARROW_TARGET_GAP, cardRect.bottom - ARROW_TARGET_GAP),
    };
  }

  return {
    x: clamp(targetPoint.x, cardRect.left + ARROW_TARGET_GAP, cardRect.right - ARROW_TARGET_GAP),
    y: dy > 0 ? cardRect.bottom : cardRect.top,
  };
}

function getArrowHead(start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  return {
    left: {
      x: end.x - ARROW_HEAD_LENGTH * Math.cos(angle - ARROW_HEAD_ANGLE),
      y: end.y - ARROW_HEAD_LENGTH * Math.sin(angle - ARROW_HEAD_ANGLE),
    },
    right: {
      x: end.x - ARROW_HEAD_LENGTH * Math.cos(angle + ARROW_HEAD_ANGLE),
      y: end.y - ARROW_HEAD_LENGTH * Math.sin(angle + ARROW_HEAD_ANGLE),
    },
  };
}

function getLinePoints(cardRect, targetRect) {
  if (!cardRect || !targetRect || window.innerWidth < 720) return null;

  const end = getTargetEdgePoint(cardRect, targetRect);
  const start = getCardEdgePoint(cardRect, end);
  const midX = start.x + (end.x - start.x) * 0.62;
  const bendY = start.y + (end.y - start.y) * 0.18;
  const head = getArrowHead(start, end);

  return {
    d: `M ${start.x} ${start.y} L ${midX} ${bendY} L ${end.x} ${end.y}`,
    end,
    head,
  };
}

export default function TutorialGuide({
  backLabel,
  body,
  canGoBack = false,
  gotItLabel,
  isFinalStep = false,
  nextLabel,
  onBack,
  onNext,
  onSkip,
  secondaryTargetSelector,
  showArrow = true,
  skipLabel,
  stepLabel,
  targetSelector,
  title,
}) {
  const cardRef = useRef(null);
  const [layout, setLayout] = useState({
    card: { left: EDGE_GAP, top: 112 },
    line: null,
    ready: false,
    target: null,
  });
  const finalText = gotItLabel || "Got it";
  const nextText = nextLabel || "Next";
  const skipText = skipLabel || "Skip tips";
  const backText = backLabel || "Back";

  const updateLayout = useCallback(() => {
    const target = getTargetRect(targetSelector, secondaryTargetSelector);

    if (targetSelector && !target) {
      setLayout((previousLayout) => ({
        ...previousLayout,
        line: null,
        ready: false,
        target: null,
      }));
      return false;
    }

    const card = getCardPosition(target);

    setLayout((previousLayout) => ({
      ...previousLayout,
      card,
      ready: true,
      target,
    }));

    window.requestAnimationFrame(() => {
      const cardRect = cardRef.current?.getBoundingClientRect();
      setLayout({
        card,
        line: showArrow ? getLinePoints(cardRect, target) : null,
        ready: true,
        target,
      });
    });
    return true;
  }, [secondaryTargetSelector, showArrow, targetSelector]);

  const scrollTargetIntoView = useCallback(() => {
    const target = getPrimaryTarget(targetSelector);
    if (!target) return false;
    target?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    return true;
  }, [targetSelector]);

  useLayoutEffect(() => {
    scrollTargetIntoView();
    updateLayout();
    const firstFrame = window.requestAnimationFrame(updateLayout);
    const retries = RETRY_DELAYS.map((delay) =>
      window.setTimeout(() => {
        scrollTargetIntoView();
        updateLayout();
      }, delay),
    );

    return () => {
      window.cancelAnimationFrame(firstFrame);
      retries.forEach((retry) => window.clearTimeout(retry));
    };
  }, [body, scrollTargetIntoView, stepLabel, title, updateLayout]);

  useEffect(() => {
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    const observer = new MutationObserver(() => {
      scrollTargetIntoView();
      updateLayout();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
      observer.disconnect();
    };
  }, [scrollTargetIntoView, updateLayout]);

  if (!layout.ready) return null;

  return (
    <div className="finance-tutorial-overlay" role="presentation">
      {layout.target && (
        <div
          aria-hidden="true"
          className="finance-tutorial-target"
          style={{
            height: `${layout.target.height}px`,
            left: `${layout.target.left}px`,
            top: `${layout.target.top}px`,
            width: `${layout.target.width}px`,
          }}
        />
      )}

      {layout.line && (
        <svg aria-hidden="true" className="finance-tutorial-arrow-layer" focusable="false">
          <path className="finance-tutorial-arrow-path" d={layout.line.d} />
          <path
            className="finance-tutorial-arrow-head"
            d={`M ${layout.line.head.left.x} ${layout.line.head.left.y} L ${layout.line.end.x} ${layout.line.end.y} L ${layout.line.head.right.x} ${layout.line.head.right.y}`}
          />
        </svg>
      )}

      <aside
        aria-label={stepLabel}
        className="finance-tutorial-guide"
        ref={cardRef}
        style={{
          left: `${layout.card.left}px`,
          top: `${layout.card.top}px`,
        }}
      >
        <div className="finance-tutorial-card">
          <p className="finance-label">{stepLabel}</p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight">{title}</h3>
          <p className="finance-muted mt-2">{body}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {canGoBack && (
                <button className="finance-tutorial-back" onClick={onBack} type="button">
                  {backText}
                </button>
              )}
              <button className="finance-tutorial-skip" onClick={onSkip} type="button">
                {skipText}
              </button>
            </div>
            <button className="finance-tutorial-primary" onClick={onNext} type="button">
              {isFinalStep ? finalText : nextText}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
