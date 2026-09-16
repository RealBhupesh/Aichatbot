"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

function normalizeContent(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/₹\s?(\d[\d,]*)/g, "**₹$1**")
    .trim();
}

export function AssistantMessageContent({ content }: Props) {
  const normalized = normalizeContent(content);

  if (!normalized) {
    return null;
  }

  return (
    <div className="chat-rich-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-base font-semibold tracking-tight text-base-content">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-base-content/70">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-[15px] leading-6 text-base-content/90">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-base-content">{children}</strong>
          ),
          em: ({ children }) => <em className="text-base-content/80 italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-base-content/90">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="link link-primary font-medium" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <figure className="my-3 overflow-hidden rounded-xl border border-base-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src ?? ""} alt={alt ?? ""} className="aspect-[4/3] w-full object-cover" />
              {alt ? <figcaption className="px-3 py-2 text-xs text-base-content/60">{alt}</figcaption> : null}
            </figure>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-base-300 bg-base-100">
              <table className="table table-zebra table-sm w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-base-200 text-xs uppercase tracking-wide">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-base-content/80">{children}</th>
          ),
          td: ({ children }) => {
            const text = String(children ?? "");
            const isPrice = /₹|inr/i.test(text);
            const isIncluded = /included/i.test(text);
            const isNotIncluded = /not included|add-on/i.test(text);

            if (isPrice) {
              return <td className="px-3 py-2 font-semibold text-primary">{children}</td>;
            }

            if (isIncluded) {
              return (
                <td className="px-3 py-2">
                  <span className="badge badge-success badge-sm">Included</span>
                </td>
              );
            }

            if (isNotIncluded) {
              return (
                <td className="px-3 py-2">
                  <span className="badge badge-ghost badge-sm">Add-on</span>
                </td>
              );
            }

            return <td className="px-3 py-2 text-base-content/85">{children}</td>;
          },
          code: ({ children }) => (
            <code className="rounded-md bg-base-300/60 px-1.5 py-0.5 text-[13px]">{children}</code>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
