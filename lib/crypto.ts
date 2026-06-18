const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: ArrayBuffer | Uint8Array) => {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  values.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const fromBase64Url = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

export const generateRoomKey = () => {
  return crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  );
};

export const exportRoomKey = async (key: CryptoKey) => {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(rawKey);
};

export const importRoomKey = async (encodedKey: string) => {
  return crypto.subtle.importKey(
    "raw",
    fromBase64Url(encodedKey),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
};

export const readRoomKeyFromHash = () => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("key");
};

export const encryptMessageText = async ({
  key,
  roomId,
  text,
}: {
  key: CryptoKey;
  roomId: string;
  text: string;
}) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      additionalData: encoder.encode(roomId),
    },
    key,
    encoder.encode(text),
  );

  return {
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
  };
};

export const decryptMessageText = async ({
  ciphertext,
  iv,
  key,
  roomId,
}: {
  ciphertext: string;
  iv: string;
  key: CryptoKey;
  roomId: string;
}) => {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: fromBase64Url(iv),
      additionalData: encoder.encode(roomId),
    },
    key,
    fromBase64Url(ciphertext),
  );

  return decoder.decode(plaintext);
};
