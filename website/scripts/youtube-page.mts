/**
 * Loads a YouTube page and reads the data the page is built from.
 *
 * @module
 * @remarks
 * Shared by the scripts that find and describe the archive's videos. No API
 * key is needed: every YouTube page carries its content as one JSON object
 * (`ytInitialData`), plus the player data (`ytInitialPlayerResponse`) on a
 * watch page.
 */

/** Pause between two page loads, to stay a polite visitor. */
export const PAUSE_MS = 1200;

/** What a browser would send. */
const HEADERS = {
  "Accept-Language": "de-DE,de;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

/**
 * Loads a page's HTML.
 *
 * @param url - the YouTube address
 * @returns the HTML, or an empty string if loading failed
 */
export async function loadPage(url: string): Promise<string> {
  let html = "";
  try {
    html = await (await fetch(url, { headers: HEADERS })).text();
  } catch (error) {
    console.warn(`Laden fehlgeschlagen: ${url}`, error);
  }
  return html;
}

/**
 * Reads a JSON object a page assigns to a variable.
 *
 * @param html - the page
 * @param name - the variable, e.g. `ytInitialData`
 * @returns the parsed object, or null if the page has none
 */
export function pageData(html: string, name: string): unknown {
  const marker = `var ${name} = `;
  const from = html.indexOf(marker);
  const json = from < 0 ? null : balancedObject(html, from + marker.length);
  let data: unknown = null;
  try {
    data = json === null ? null : JSON.parse(json);
  } catch {
    // A page layout this script does not know - treat as empty.
  }
  return data;
}

/**
 * Waits a while.
 *
 * @param ms - how long, in milliseconds
 * @returns a promise that resolves after that time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The JSON object starting at a position, up to its matching brace.
 *
 * @remarks
 * Counts braces outside of strings. A pattern like `\{.*?\});</script>`
 * is not enough: video descriptions may contain that very text and cut the
 * object short.
 */
function balancedObject(text: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = from; index < text.length && end < 0; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      end = depth === 0 ? index + 1 : -1;
    }
  }
  return end < 0 ? null : text.slice(from, end);
}
