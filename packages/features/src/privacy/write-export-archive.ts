import { sql } from "drizzle-orm";
import type { Database } from "../database";
import type { Zip } from "../platform";
import {
  type DataEntity,
  EXPORT_MAX_BYTES,
  EXPORT_MAX_ENTRIES,
  EXPORT_PAGE_SIZE,
  ExportSizeError,
  type ExportSubject,
} from "./domain";
import { readExportPage } from "./read-export-page";
/** Bounded pages, streamed file bodies, and 5 MiB multipart writes: no archive-wide buffering. */
export async function writeExportArchive(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly zip: Zip;
    readonly catalog: readonly DataEntity[];
  },
  subject: ExportSubject,
  input: { readonly multipart: R2MultipartUpload; readonly createdAt: string }
) {
  const parts: R2UploadedPart[] = [];
  let buffer = new Uint8Array(5 * 1024 * 1024);
  let used = 0;
  let bytes = 0;
  let entries = 0;
  const writer = deps.zip.create(async (chunk) => {
    bytes += chunk.length;
    if (bytes > EXPORT_MAX_BYTES) throw new ExportSizeError();
    let offset = 0;
    while (offset < chunk.length) {
      const size = Math.min(buffer.length - used, chunk.length - offset);
      buffer.set(chunk.subarray(offset, offset + size), used);
      used += size;
      offset += size;
      if (used === buffer.length) {
        parts.push(await input.multipart.uploadPart(parts.length + 1, buffer));
        buffer = new Uint8Array(buffer.length);
        used = 0;
      }
    }
  });
  const textStream = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  async function add(name: string, body: ReadableStream<Uint8Array>) {
    if (++entries > EXPORT_MAX_ENTRIES) throw new ExportSizeError();
    await writer.add(name, body);
  }
  try {
    await add(
      "manifest.json",
      textStream(
        JSON.stringify(
          {
            format: 1,
            createdAt: input.createdAt,
            scope: subject.scope,
            subject: subject.workspaceId ?? subject.userId,
            notes: [
              "Data is read in bounded pages during export, not a transaction-wide snapshot.",
              "Shared workspace file bytes require an owner workspace export.",
              "Credentials and secret-bearing payloads are excluded.",
            ],
            entities: deps.catalog.map((x) => ({
              table: x.table,
              columns: x.columns,
              scope: x.scope,
              erasure: x.erase,
              reason: x.reason,
            })),
          },
          null,
          2
        )
      )
    );
    for (const entity of deps.catalog) {
      let cursor = 0;
      let page = 0;
      for (;;) {
        const rows = await readExportPage(deps, entity, subject, cursor);
        if (!rows.length) break;
        cursor = Number(rows.at(-1)?._rowid);
        const text =
          rows.map(({ _rowid, ...row }) => JSON.stringify(row)).join("\n") +
          "\n";
        await add(
          `data/${entity.table}/${String(++page).padStart(6, "0")}.ndjson`,
          textStream(text)
        );
        if (rows.length < EXPORT_PAGE_SIZE) break;
      }
    }
    // Binary content is limited to personal workspaces, or the selected authorized workspace.
    const selected =
      subject.scope === "workspace"
        ? sql`workspace_id=${subject.workspaceId}`
        : sql`workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.kind='personal' AND m.user_id=${subject.userId})`;
    let cursor = 0;
    for (;;) {
      const rows = await deps.db.all<{
        _rowid: number;
        id: string;
        r2_key: string;
      }>(
        sql`SELECT rowid AS _rowid,id,r2_key FROM files WHERE (${selected}) AND rowid>${cursor} ORDER BY rowid LIMIT ${EXPORT_PAGE_SIZE}`
      );
      if (!rows.length) break;
      for (const row of rows) {
        const object = await deps.bucket.get(row.r2_key);
        if (object)
          await add(`files/${encodeURIComponent(row.id)}`, object.body);
        else
          await add(
            `missing-files/${encodeURIComponent(row.id)}.json`,
            textStream(
              JSON.stringify({
                id: row.id,
                reason:
                  "The object was unavailable or the upload was incomplete when exported.",
              })
            )
          );
      }
      cursor = Number(rows.at(-1)?._rowid);
      if (rows.length < EXPORT_PAGE_SIZE) break;
    }
    if (subject.scope === "user") {
      const [avatar] = await deps.db.all<{ avatar_key: string | null }>(
        sql`SELECT avatar_key FROM user_settings WHERE user_id=${subject.userId}`
      );
      if (avatar?.avatar_key) {
        const object = await deps.bucket.get(avatar.avatar_key);
        if (object) await add("profile/avatar", object.body);
      }
    }
    const logos =
      subject.scope === "workspace"
        ? sql`id=${subject.workspaceId}`
        : sql`kind='personal' AND id IN (SELECT workspace_id FROM workspace_members WHERE user_id=${subject.userId})`;
    for (const row of await deps.db.all<{
      id: string;
      logo_key: string | null;
    }>(sql`SELECT id,logo_key FROM workspaces WHERE ${logos}`)) {
      if (row.logo_key) {
        const object = await deps.bucket.get(row.logo_key);
        if (object)
          await add(
            `workspaces/${encodeURIComponent(row.id)}/logo`,
            object.body
          );
      }
    }
    await writer.close();
    if (used > 0)
      parts.push(
        await input.multipart.uploadPart(
          parts.length + 1,
          buffer.slice(0, used)
        )
      );
    await input.multipart.complete(parts);
    return { bytes, entries };
  } catch (error) {
    writer.abort();
    throw error;
  }
}
