import test from 'node:test';
import WorkerMessenger from '../src/js/page/worker-messenger.js';

// `WorkerMessenger` resolves `Worker` at call time, so a stand-in installed
// before the first request is enough — no DOM, no real worker.
class FakeWorker {
  static instances = [];

  static reset() {
    this.instances = [];
  }

  static get latest() {
    return this.instances.at(-1);
  }

  constructor(url) {
    this.url = url;
    this.posted = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data) {
    this.onmessage({ data });
  }
}

// Reply to the request the messenger has just posted, by its own id.
const replyToLatest = (payload) => {
  const worker = FakeWorker.latest;
  worker.reply({ id: worker.posted.at(-1).id, ...payload });
};

test.beforeEach(() => {
  FakeWorker.reset();
  globalThis.Worker = FakeWorker;
});

test.after(() => {
  delete globalThis.Worker;
});

test('the worker is created lazily, on the first request', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  t.assert.strictEqual(FakeWorker.instances.length, 0);

  const response = messenger.requestResponse({ action: 'ping' });
  t.assert.strictEqual(FakeWorker.instances.length, 1);
  t.assert.strictEqual(FakeWorker.latest.url, 'js/test-worker.js');

  replyToLatest({ result: 'ok' });
  t.assert.strictEqual(await response, 'ok');
});

test('responses are matched to requests by id', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const first = messenger.requestResponse({ action: 'a' });
  const second = messenger.requestResponse({ action: 'b' });

  const [messageA, messageB] = FakeWorker.latest.posted;
  t.assert.notStrictEqual(messageA.id, messageB.id);

  // Out of order on purpose: the id, not arrival order, decides.
  FakeWorker.latest.reply({ id: messageB.id, result: 'B' });
  FakeWorker.latest.reply({ id: messageA.id, result: 'A' });

  t.assert.strictEqual(await first, 'A');
  t.assert.strictEqual(await second, 'B');
});

test('an error reply rejects with that message', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse({ action: 'boom' });

  replyToLatest({ error: 'it broke' });

  await t.assert.rejects(response, { message: 'it broke' });
});

test('abort rejects pending requests and replaces the worker', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse({ action: 'slow' });
  const firstWorker = FakeWorker.latest;

  messenger.abort();

  await t.assert.rejects(response, {
    name: 'AbortError',
    constructor: DOMException,
  });

  t.assert.strictEqual(firstWorker.terminated, true);
  // A fresh worker is started straight away, so the next request isn't blocked
  // behind the terminated one.
  t.assert.strictEqual(FakeWorker.instances.length, 2);
  t.assert.strictEqual(FakeWorker.latest.terminated, false);
});

test('abort with nothing pending leaves the worker alone', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse({ action: 'a' });
  replyToLatest({ result: 'A' });
  await response;

  messenger.abort();

  // `Svgo.process` calls `abort()` unconditionally; it must not churn the
  // worker when there's nothing to cancel.
  t.assert.strictEqual(FakeWorker.instances.length, 1);
  t.assert.strictEqual(FakeWorker.latest.terminated, false);
});

test('a late reply to an aborted request is ignored', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse({ action: 'slow' });
  const firstWorker = FakeWorker.latest;
  const { id } = firstWorker.posted[0];

  messenger.abort();
  await t.assert.rejects(response, { name: 'AbortError' });

  // The terminated worker's message can still be in flight; delivering it must
  // not throw, and must not resolve anything.
  firstWorker.reply({ id, result: 'too late' });
  t.assert.strictEqual(FakeWorker.instances.length, 2);
});

test('a timed-out request rejects and kills the hung worker', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse(
    { action: 'hang' },
    { timeout: 10 },
  );
  const hungWorker = FakeWorker.latest;

  await t.assert.rejects(response, {
    name: 'TimeoutError',
    constructor: DOMException,
  });

  // `release()`, not `abort()`: abort bails out once nothing is pending, which
  // would leave the hung worker running.
  t.assert.strictEqual(hungWorker.terminated, true);
  t.assert.strictEqual(FakeWorker.instances.length, 1);

  // The next request starts a fresh one.
  const next = messenger.requestResponse({ action: 'ping' });
  t.assert.strictEqual(FakeWorker.instances.length, 2);
  replyToLatest({ result: 'ok' });
  t.assert.strictEqual(await next, 'ok');
});

test('a completed request clears its timeout', async (t) => {
  const messenger = new WorkerMessenger('js/test-worker.js');
  const response = messenger.requestResponse(
    { action: 'ping' },
    { timeout: 10 },
  );

  replyToLatest({ result: 'ok' });
  t.assert.strictEqual(await response, 'ok');

  // A timer left running would terminate a worker that's busy with the next
  // request by now, so wait past the deadline and check the worker survived.
  await new Promise((resolve) => {
    setTimeout(resolve, 30);
  });
  t.assert.strictEqual(FakeWorker.latest.terminated, false);
});
