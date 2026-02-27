/**
 * News Service - Agricultural news from RSS feeds (Brazil & Paraguay)
 * Simple RSS parsing without dependencies
 */

interface NewsItem {
    title: string;
    link: string;
    source: string;
}

const RSS_FEEDS = [
    { url: "https://www.canalrural.com.br/feed/", source: "Canal Rural" },
    { url: "https://www.agrolink.com.br/rss/noticias.xml", source: "Agrolink" },
];

/**
 * Simple RSS parser - extracts title and link from <item> tags
 */
function parseRSSItems(xml: string, source: string): NewsItem[] {
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 3) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);

        const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
        const link = linkMatch ? linkMatch[1] : null;

        if (title) {
            items.push({
                title: title.trim().substring(0, 100),
                link: link || "",
                source,
            });
        }
    }

    return items;
}

export async function getAgroNews(maxItems: number = 3): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];

    for (const feed of RSS_FEEDS) {
        try {
            const response = await fetch(feed.url, {
                headers: { "User-Agent": "AgroZap/1.0" },
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) continue;

            const xml = await response.text();
            const items = parseRSSItems(xml, feed.source);
            allNews.push(...items);

            if (allNews.length >= maxItems) break;
        } catch (e) {
            console.error(`[NEWS] Error fetching ${feed.source}:`, e);
        }
    }

    return allNews.slice(0, maxItems);
}

export function formatNewsMessage(news: NewsItem[]): string {
    if (news.length === 0) return "";

    let msg = "📰 *Notícias do Agro*\n";
    for (const item of news) {
        msg += `• ${item.title}\n`;
    }

    return msg;
}
