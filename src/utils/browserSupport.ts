export type BrowserSupportNotice = {
  appName: string;
  shouldRecommendExternalBrowser: boolean;
};

const KNOWN_IN_APP_BROWSERS: Array<{ pattern: RegExp; appName: string }> = [
  { pattern: / line\//i, appName: "LINE" },
  { pattern: /fbav|fban|fb_iab/i, appName: "Facebook" },
  { pattern: /instagram/i, appName: "Instagram" },
  { pattern: /micromessenger/i, appName: "WeChat" },
  { pattern: /twitter|x-client/i, appName: "X" },
  { pattern: /linkedinapp/i, appName: "LinkedIn" },
  { pattern: /kakaotalk/i, appName: "KakaoTalk" },
  { pattern: /snapchat/i, appName: "Snapchat" },
  { pattern: /discord/i, appName: "Discord" }
];

function isKnownMajorBrowser(userAgent: string) {
  const lowerUserAgent = userAgent.toLowerCase();
  const isEdge = /edg|edga|edgios/.test(lowerUserAgent);
  const isChrome =
    /chrome|crios/.test(lowerUserAgent) &&
    !isEdge &&
    !/opr|opera|samsungbrowser|whale|yabrowser/.test(lowerUserAgent);
  const isSafari =
    /safari/.test(lowerUserAgent) &&
    !isChrome &&
    !isEdge &&
    !/fxios|firefox|focus/.test(lowerUserAgent);

  return isChrome || isSafari || isEdge;
}

export function detectBrowserSupportNotice(userAgent: string): BrowserSupportNotice {
  if (!userAgent) {
    return { appName: "", shouldRecommendExternalBrowser: false };
  }

  const knownInAppBrowser = KNOWN_IN_APP_BROWSERS.find(({ pattern }) => pattern.test(userAgent));
  if (knownInAppBrowser) {
    return {
      appName: knownInAppBrowser.appName,
      shouldRecommendExternalBrowser: true
    };
  }

  const looksLikeIosWebView =
    /iphone|ipad|ipod/i.test(userAgent) &&
    /applewebkit/i.test(userAgent) &&
    !/safari/i.test(userAgent) &&
    !/crios|edgios|fxios/i.test(userAgent);
  if (looksLikeIosWebView) {
    return {
      appName: "アプリ内ブラウザ",
      shouldRecommendExternalBrowser: true
    };
  }

  return {
    appName: "",
    shouldRecommendExternalBrowser: !isKnownMajorBrowser(userAgent)
  };
}
