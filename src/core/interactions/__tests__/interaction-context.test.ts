import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractionContext } from '../InteractionContext.js';
import { DiscordRestClient } from '../../http/DiscordRestClient.js';

function createRest() {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = (async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  return {
    calls,
    rest: new DiscordRestClient({ token: 'x', applicationId: 'app', fetchImplementation: fetchImpl }),
  };
}

const interaction = { id: '1', application_id: 'a', type: 2, token: 'tok', version: 1 } as any;

test('reply/defer lifecycle', () => {
  const { rest } = createRest();
  const ctx = new InteractionContext({ interaction, rest });
  const response = ctx.reply({ content: 'ok' });
  assert.equal(response.type, 4);
  assert.equal(ctx.hasResponded, true);
});

test('editReply and followUp call webhook endpoints', async () => {
  const { rest, calls } = createRest();
  const ctx = new InteractionContext({ interaction, rest });
  await ctx.editReply({ content: 'edit' });
  await ctx.followUp({ content: 'next' });
  assert.equal(calls.length, 2);
  assert.match(calls[0], /messages\/\@original/);
});

test('auto-ack diagnostics callback fires for slow handler', async () => {
  let message = '';
  const { rest } = createRest();
  new InteractionContext({ interaction, rest, autoAck: { enabled: true, delayMs: 5 }, onDiagnostic: (m) => (message = m) });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(message, /auto-ack triggered/);
});
