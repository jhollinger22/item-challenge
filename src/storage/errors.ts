export class ConflictError extends Error {
  constructor(message = 'Item was modified concurrently, retry the request') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}
