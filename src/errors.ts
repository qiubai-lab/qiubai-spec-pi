export type QbErrorCode =
  | "QB_ABORTED"
  | "QB_ARCHIVE_CONFLICT"
  | "QB_AUTH_REQUIRED"
  | "QB_DOCS_NOT_FOUND"
  | "QB_DUPLICATE"
  | "QB_FRONTMATTER"
  | "QB_INCOMPATIBLE_PI"
  | "QB_INVALID_ARGUMENT"
  | "QB_INVALID_CHANGE_ID"
  | "QB_INVALID_STATE"
  | "QB_IO"
  | "QB_LOCKED"
  | "QB_NOT_FOUND"
  | "QB_PATH_UNSAFE"
  | "QB_RECOVERY_REQUIRED"
  | "QB_RECOVERY_AMBIGUOUS"
  | "QB_SOURCE_CHANGED"
  | "QB_VERIFICATION_REQUIRED";

export class QbError extends Error {
  readonly code: QbErrorCode;

  constructor(code: QbErrorCode, message: string, options?: ErrorOptions) {
    super(`[${code}] ${message}`, options);
    this.name = "QbError";
    this.code = code;
  }
}

export function qbError(
  code: QbErrorCode,
  message: string,
  cause?: unknown,
): QbError {
  return new QbError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

export function asQbError(error: unknown): QbError {
  if (error instanceof QbError) return error;
  if (error instanceof Error) return qbError("QB_IO", error.message, error);
  return qbError("QB_IO", String(error));
}
