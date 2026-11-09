import type {
  AnalyticsReader,
  AnalyticsReaderRow,
} from "../../ports/analytics-reader";

export interface MemoryAnalyticsReader extends AnalyticsReader {
  /** Every statement and query asked, in order. */
  readonly asked: readonly string[];
}

/**
 * An AnalyticsReader with canned answers: `sql` answers each statement with what
 * `answer` returns for it, `graphql` with `webAnalytics` (or throws what they throw).
 */
export function createMemoryAnalyticsReader(options: {
  readonly answer: (
    statement: string
  ) => readonly AnalyticsReaderRow[] | Promise<readonly AnalyticsReaderRow[]>;
  readonly webAnalytics?: (
    query: string,
    variables: Readonly<Record<string, unknown>>
  ) => unknown;
}): MemoryAnalyticsReader {
  const asked: string[] = [];
  return {
    asked,
    async sql(statement) {
      asked.push(statement);
      return options.answer(statement);
    },
    async graphql(query, variables) {
      asked.push(query);
      return options.webAnalytics
        ? options.webAnalytics(query, variables)
        : null;
    },
  };
}
