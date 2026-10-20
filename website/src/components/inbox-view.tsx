/**
 * The inbox: the archive's news chat, and what the others liked, rated,
 * wrote and added.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";
import { useArchive } from "@/lib/archive-store";
import { markSeen, newsItems, useLastSeen, type NewsItem } from "@/lib/news";
import { timeAgo } from "@/lib/social";
import { ModeNotice } from "./mode-notice";
import { NewsCard, NewsChat } from "./news-chat";

/** Longest comment shown in full; the rest is cut. */
const MAX_TEXT = 140;

/** Stars a rating can have at most. */
const MAX_STARS = 5;

/** Icon of each kind of news. */
const ICONS: Readonly<Record<NewsItem["kind"], string>> = {
  like: "❤️",
  rating: "⭐",
  comment: "💬",
  added: "🆕",
};

/**
 * Renders the inbox.
 *
 * @returns the news, newest first
 * @remarks
 * Opening it counts everything shown as seen; the entries that were new
 * keep their mark until the page is left.
 */
export function InboxView(): ReactElement {
  const archive = useArchive();
  const lastSeen = useLastSeen();
  const items = newsItems(archive);
  const newest = Math.max(
    items[0]?.at ?? 0,
    archive.announcements.at(-1)?.at ?? 0,
  );
  const [chatOpen, setChatOpen] = useState(false);
  // What was new when the page opened, kept while it is open.
  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  if (seenBefore === null && lastSeen > 0) {
    // Set while rendering, as React allows for state derived from props.
    setSeenBefore(lastSeen);
  }

  useEffect(() => {
    if (archive.ready && seenBefore !== null) {
      markSeen(newest);
    }
  }, [archive.ready, newest, seenBefore]);

  return chatOpen ? (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <NewsChat
        messages={archive.announcements}
        now={now}
        seenBefore={seenBefore}
        onBack={() => setChatOpen(false)}
      />
    </div>
  ) : (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-black tracking-tight">
          Posteingang
        </h1>
        <ModeNotice mode={archive.mode} />
      </div>

      <NewsCard
        messages={archive.announcements}
        unread={archive.announcements.some(
          (message) => seenBefore !== null && message.at > seenBefore,
        )}
        now={now}
        onOpen={() => setChatOpen(true)}
      />

      {archive.ready && items.length === 0 && (
        <p className="text-white/60">
          Noch nichts Neues. Hier erscheint, was die anderen liken, bewerten,
          kommentieren und neu ins Archiv bringen.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={`/#${item.song.id}`}
              className={`flex gap-3 rounded-2xl p-3 hover:bg-white/10 ${
                seenBefore !== null && item.at > seenBefore
                  ? "bg-amber-400/10"
                  : "bg-white/5"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {ICONS[item.kind]}
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block">
                  <strong>{item.name}</strong> {sentence(item)}
                </span>
                {item.text !== undefined && (
                  <span className="block text-sm text-white/70">
                    „{cut(item.text)}“
                  </span>
                )}
                <span className="block text-xs text-white/40">
                  {timeAgo(item.at, now)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the person did, after their name. */
function sentence(item: NewsItem): string {
  const title = `„${item.song.title}“`;
  let text: string;
  switch (item.kind) {
    case "like":
      text = `gefällt ${title}`;
      break;
    case "rating":
      text =
        item.stars === 0
          ? `hat ${title} mit 0 Sternen bewertet`
          : `hat ${title} mit ${"★".repeat(Math.min(item.stars ?? 0, MAX_STARS))} bewertet`;
      break;
    case "comment":
      text = `hat ${title} kommentiert:`;
      break;
    default:
      text = `hat ${title} neu ins Archiv gebracht`;
  }
  return text;
}

/** A long comment cut to a preview. */
function cut(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)} …` : text;
}
