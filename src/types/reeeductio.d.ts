/**
 * Type declarations for reeeductio SDK
 *
 * Re-exports the types from the SDK package.
 */

declare module 'reeeductio' {
  // Types
  export type CapabilityOp = 'read' | 'create' | 'modify' | 'delete' | 'write';

  export interface Capability {
    op: CapabilityOp;
    path: string;
    must_be_owner?: boolean;
  }

  export interface Message {
    message_hash: string;
    topic_id: string;
    type: string;
    prev_hash: string | null;
    data: string;
    sender: string;
    signature: string;
    server_timestamp: number;
  }

  export interface MessageCreated {
    message_hash: string;
    server_timestamp: number;
  }

  export interface MessageQuery {
    from?: number;
    to?: number;
    limit?: number;
  }

  export interface MessagesResponse {
    messages: Message[];
    has_more: boolean;
  }

  export interface BlobCreated {
    blob_id: string;
    size: number;
  }

  export interface KeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  }

  // Crypto utilities
  export function generateKeyPair(): Promise<KeyPair>;
  export function encodeBase64(data: Uint8Array): string;
  export function decodeBase64(data: string): Uint8Array;
  export function deriveKey(key: Uint8Array, info: string): Uint8Array;
  export function computeHash(data: Uint8Array): Uint8Array;
  export function encryptAesGcm(plaintext: Uint8Array, key: Uint8Array): Uint8Array;
  export function decryptAesGcm(ciphertext: Uint8Array, key: Uint8Array): Uint8Array;

  // Space client
  export class Space {
    readonly spaceId: string;
    readonly keyPair: KeyPair;
    readonly symmetricRoot: Uint8Array;
    readonly baseUrl: string;

    constructor(options: {
      spaceId: string;
      keyPair: KeyPair;
      symmetricRoot: Uint8Array;
      baseUrl?: string;
      fetch?: typeof fetch;
    });

    getUserId(): string;
    deriveTopicKey(topicId: string): Uint8Array;
    authenticate(): Promise<string>;

    // State
    getPlaintextState(path: string): Promise<string>;
    getEncryptedState(path: string): Promise<string>;
    setPlaintextState(path: string, data: string, prevHash?: string | null): Promise<MessageCreated>;
    setEncryptedState(path: string, data: string, prevHash?: string | null): Promise<MessageCreated>;
    getStateHistory(query?: MessageQuery): Promise<MessagesResponse>;

    // Messages
    getMessages(topicId: string, query?: MessageQuery): Promise<MessagesResponse>;
    getMessage(topicId: string, messageHash: string): Promise<Message>;
    postMessage(topicId: string, msgType: string, data: Uint8Array, prevHash?: string | null): Promise<MessageCreated>;
    postEncryptedMessage(topicId: string, msgType: string, plaintext: Uint8Array, prevHash?: string | null): Promise<MessageCreated>;

    // Blobs
    uploadPlaintextBlob(data: Uint8Array): Promise<BlobCreated>;
    encryptAndUploadBlob(data: Uint8Array): Promise<BlobCreated>;
    downloadPlaintextBlob(blobId: string): Promise<Uint8Array>;
    downloadAndDecryptBlob(blobId: string): Promise<Uint8Array>;
    deleteBlob(blobId: string): Promise<void>;

    // WebSocket
    getWebSocketUrl(): string;
    getWebSocketConnectionUrl(): Promise<string>;
  }
}
