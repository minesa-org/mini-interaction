import type { APIInteraction } from 'discord-api-types/v10';
import { verifyKey } from 'discord-interactions';

export type VerifyInteractionRequest = {
  body: string | Uint8Array;
  signature: string;
  timestamp: string;
  publicKey: string;
};

export async function verifyAndParseInteraction(request: VerifyInteractionRequest): Promise<APIInteraction> {
  const valid = await verifyKey(request.body, request.signature, request.timestamp, request.publicKey);
  if (!valid) {
    throw new Error('[InteractionVerifier] invalid interaction signature');
  }

  const bodyText = typeof request.body === 'string' ? request.body : Buffer.from(request.body).toString('utf8');
  return JSON.parse(bodyText) as APIInteraction;
}
