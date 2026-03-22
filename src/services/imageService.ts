import { getFluentEmojiUrl } from "../constants/iconMapping";

export function generateIcon(word: string, label: string): string {
  const fluentUrl = getFluentEmojiUrl(label);
  if (fluentUrl) {
    return fluentUrl;
  }

  // Fallback to a placeholder image
  return `https://picsum.photos/seed/${word}/200/200`;
}
