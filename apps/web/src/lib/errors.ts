/** An expected business-rule failure whose message is safe to show the user. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** The resource doesn't exist or the viewer may not know it exists. Pages render a 404. */
export class NotFoundError extends DomainError {
  constructor(message = "We couldn't find that.") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

/** The viewer can see the resource but may not perform this action on it. */
export class ForbiddenError extends DomainError {
  constructor(message = "You don't have permission to do that.") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}
