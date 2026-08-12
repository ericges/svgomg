export default class WorkerMessenger {
  _requestId = 0;

  constructor(url) {
    // worker jobs awaiting response { [requestId]: [ resolve, reject ] }
    this._pending = {};
    this._url = url;
    this._worker = null;
  }

  release() {
    this._abortPending();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }

  requestResponse(message, { timeout } = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this._requestId;
      message.id = id;

      // The work inside the worker is synchronous and uninterruptible, so a
      // deadline can only be enforced by killing the worker. `release()` rather
      // than `abort()`: abort bails out once `_pending` is empty, which it is
      // by the time we've rejected this request, leaving the hung worker alive.
      const timer =
        timeout === undefined
          ? null
          : setTimeout(() => {
              this._fulfillPending(
                id,
                null,
                new DOMException(
                  `Timed out after ${timeout}ms`,
                  'TimeoutError',
                ),
              );
              this.release();
            }, timeout);

      this._pending[id] = [resolve, reject, timer];

      if (!this._worker) this._startWorker();
      this._worker.postMessage(message);
    });
  }

  abort() {
    if (Object.keys(this._pending).length === 0) return;

    this._abortPending();
    if (this._worker) this._worker.terminate();
    this._startWorker();
  }

  _abortPending() {
    for (const key of Object.keys(this._pending)) {
      this._fulfillPending(
        key,
        null,
        new DOMException('AbortError', 'AbortError'),
      );
    }
  }

  _startWorker() {
    this._worker = new Worker(this._url);
    this._worker.onmessage = (event) => this._onMessage(event);
  }

  _onMessage(event) {
    if (!event.data.id) {
      console.log('Unexpected message', event);
      return;
    }

    this._fulfillPending(
      event.data.id,
      event.data.result,
      event.data.error && new Error(event.data.error),
    );
  }

  _fulfillPending(id, result, error) {
    const resolver = this._pending[id];

    if (!resolver) {
      console.log('No resolver for', { id, result, error });
      return;
    }

    delete this._pending[id];
    if (resolver[2]) clearTimeout(resolver[2]);

    if (error) {
      resolver[1](error);
      return;
    }

    resolver[0](result);
  }
}
