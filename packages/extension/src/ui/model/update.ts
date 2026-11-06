// How Foundry's update check reads on our pages.

/** Foundry's channel ids are lower case: "stable" reads "Stable". */
export const channelName = (channel: string): string =>
  channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : "";
