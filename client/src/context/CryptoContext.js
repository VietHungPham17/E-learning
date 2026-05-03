import { createContext } from "react";

// Provides the AES-256-GCM CryptoKey for the currently active channel.
// Populated by ChannelContainer when the user switches channels.
export const CryptoContext = createContext({ channelCryptoKey: null, keyError: false });
