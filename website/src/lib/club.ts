/**
 * Everything that belongs to one club rather than to the app.
 *
 * @module
 * @remarks
 * The app is the same for every club; what differs lives in the folder
 * `verein/` - this configuration, the start set of pieces and videos, the
 * logo and the icons. Another club copies the repository and replaces that
 * folder (see docs/neuer-verein.md). Code reads club values only through
 * this module.
 */
import type { FirebaseOptions } from "firebase/app";
import config from "@verein/config.json";

/** Which pieces Play and the archive show at first. */
type ShowDefault = "withMusic" | "all" | "withoutMusic";

/** Where a snippet starts at first. */
type StartDefault = "start" | "middle" | "random" | "peak";

/** What happens at a piece's end at first. */
type EndDefault = "repeat" | "next";

/** The club's configuration, as `verein/config.json` holds it. */
export type ClubConfig = {
  /** Name of the app, in titles and greetings - e.g. "Notenarchiv". */
  readonly appName: string;
  /** Name of the club, for the docs and the page description. */
  readonly clubName: string;
  /** One sentence for search engines and link previews. */
  readonly description: string;
  /** The web config of the club's own Firebase project; empty for local mode. */
  readonly firebase: FirebaseOptions;
  /** The shared admin account, see docs/verwaltung.md. */
  readonly admin: {
    /**
     * Email of the Firebase user the admins share; the admin page only asks
     * for its password.
     */
    readonly email: string;
  };
  /** Categories ("Sparte") left out of the app altogether. */
  readonly hiddenGenres: readonly string[];
  /** What a new visitor starts with; each can change it in the settings. */
  readonly defaults: {
    readonly show: ShowDefault;
    readonly snippetStart: StartDefault;
    readonly atEnd: EndDefault;
  };
  /** The spreadsheet the song list is imported from. */
  readonly spreadsheet: {
    /** Path from the repository root. */
    readonly file: string;
    /** The header of each column, by song field. */
    readonly columns: Readonly<Record<string, string>>;
  };
  /** Hints for the YouTube search script. */
  readonly search: {
    /** Added to a title to find band recordings, e.g. "Blasorchester". */
    readonly bandQuery: string;
    /** The same per category, e.g. "Posaunenchor" for chorales. */
    readonly bandQueryByGenre: Readonly<Record<string, string>>;
    /** The club's own arrangers, whose names are not on YouTube. */
    readonly internalArrangers: readonly string[];
    /** Titles spelled differently on YouTube than in the spreadsheet. */
    readonly spellings: Readonly<Record<string, string>>;
  };
};

/** The club this copy of the app is for. */
export const CLUB: ClubConfig = config as ClubConfig;
