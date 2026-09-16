"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
};

export function ChatFormPanel({ title, description, children, testId }: Props) {
  return (
    <div
      className="card border border-base-300 bg-base-100 shadow-md"
      data-testid={testId}
    >
      <div className="card-body gap-4 p-4 sm:p-5">
        <div>
          <p className="text-base font-semibold text-base-content">{title}</p>
          {description ? (
            <p className="mt-1 text-sm text-base-content/60">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
