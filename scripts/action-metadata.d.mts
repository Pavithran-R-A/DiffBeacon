/** Top-level scalar keys and one-level nested blocks of a GitHub Action metadata file. */
export interface ActionMetadata {
  scalars: Record<string, string>;
  blocks: Record<string, Record<string, string>>;
}

/** Parse the restricted `action.yml` shape DiffBeacon ships, failing on anything richer. */
export function readActionMetadata(source: string): ActionMetadata;

/** Absolute path to the JavaScript file `runs.main` names, or a clear error. */
export function actionEntrypoint(metadata: ActionMetadata, repositoryRoot?: string): string;
