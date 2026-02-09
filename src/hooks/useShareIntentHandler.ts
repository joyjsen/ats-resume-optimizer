import { useEffect, useState } from "react";
import { useShareIntent } from "expo-share-intent";

export const useShareIntentHandler = () => {
    const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
    const [sharedUrl, setSharedUrl] = useState<string | null>(null);
    const [sharedContent, setSharedContent] = useState<string | null>(null);

    useEffect(() => {
        if (hasShareIntent && (shareIntent.type === "text" || shareIntent.type === "weburl")) {
            const value = shareIntent.type === "weburl" ? shareIntent.webUrl : shareIntent.text;

            // Accept any URL or text content
            if (value) {
                setSharedUrl(value);

                // If we have meta data with pageContent (from Safari share), capture it
                if (shareIntent.type === "weburl" && shareIntent.meta) {
                    try {
                        const metaObj = typeof shareIntent.meta === 'string' ? JSON.parse(shareIntent.meta) : shareIntent.meta;
                        if (metaObj.pageContent) {
                            console.log("[ShareIntent] Captured page content length:", metaObj.pageContent.length);
                            setSharedContent(metaObj.pageContent);
                        }
                    } catch (e) {
                        console.warn("[ShareIntent] Failed to parse meta:", e);
                    }
                }
            }
        }
    }, [hasShareIntent, shareIntent]);

    const clearSharedUrl = () => {
        setSharedUrl(null);
        setSharedContent(null);
        resetShareIntent();
    };

    return {
        sharedUrl,
        sharedContent,
        clearSharedUrl,
        error
    };
};
