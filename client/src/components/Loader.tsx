import type { ReactNode } from "react";
import "../styles/components/Loader.css";

export type LoaderVariant = "inline" | "overlay" | "fullscreen";
export type LoaderSize = "sm" | "md" | "lg";

export interface LoaderProps {
  /** Text shown under the spinner */
  message?: string;
  /** `inline` — centered in parent; `overlay` — covers parent; `fullscreen` — viewport modal */
  variant?: LoaderVariant;
  size?: LoaderSize;
  className?: string;
  children?: ReactNode;
}

function classNames(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Loader({
  message,
  variant = "inline",
  size = "md",
  className,
  children,
}: LoaderProps) {
  const body = (
    <>
      <div
        className={classNames("app-loader-spinner", `app-loader-spinner--${size}`)}
        role="status"
        aria-label={message || "Loading"}
      />
      {message ? <p className="app-loader-message">{message}</p> : null}
      {children}
    </>
  );

  if (variant === "inline") {
    return (
      <div className={classNames("app-loader", "app-loader--inline", className)}>
        <div className="app-loader-body">{body}</div>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={classNames("app-loader", "app-loader--overlay", className)}
        role="presentation"
      >
        <div className="app-loader-panel">{body}</div>
      </div>
    );
  }

  return (
    <div
      className={classNames("app-loader", "app-loader--fullscreen", className)}
      role="presentation"
    >
      <div className="app-loader-panel app-loader-panel--card">{body}</div>
    </div>
  );
}
