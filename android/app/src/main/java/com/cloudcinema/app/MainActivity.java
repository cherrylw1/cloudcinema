package com.cloudcinema.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Intercept intent:// and vlc:// links to launch external media players like VLC
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings settings = bridge.getWebView().getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setOffscreenPreRaster(false);

            bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (handleUri(view, request.getUrl())) {
                        return true;
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (handleUri(view, Uri.parse(url))) {
                        return true;
                    }
                    return super.shouldOverrideUrlLoading(view, url);
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    super.onReceivedError(view, request, error);
                    if (request != null && request.isForMainFrame()) {
                        String retryUrl = "https://cherrycinema.netlify.app?platform=app";
                        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                            "<style>body{margin:0;background:#08080f;color:#f5f5f7;font-family:sans-serif;display:flex;" +
                            "min-height:100vh;align-items:center;justify-content:center;text-align:center}main{padding:32px}" +
                            "a{display:inline-block;margin-top:16px;padding:12px 20px;background:#e50914;color:white;" +
                            "text-decoration:none;border-radius:8px;font-weight:700}</style></head><body><main>" +
                            "<h2>CloudCinema is offline</h2><p>Check your connection and try again.</p>" +
                            "<a href='" + retryUrl + "'>Retry</a></main></body></html>";
                        view.loadDataWithBaseURL(retryUrl, html, "text/html", "UTF-8", null);
                    }
                }

                private boolean handleUri(WebView view, Uri uri) {
                    if (uri == null) return false;
                    String url = uri.toString();
                    String host = uri.getHost();
                    String path = uri.getPath();

                    boolean isGoogleAuth = host != null && host.endsWith("google.com");
                    boolean isSupabaseAuth = host != null && host.endsWith("supabase.co")
                        && path != null && path.startsWith("/auth/v1/authorize");
                    if (isGoogleAuth || isSupabaseAuth) {
                        Uri browserUri = isSupabaseAuth ? withNativeCallback(uri) : uri;
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, browserUri);
                        browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                        startActivity(browserIntent);
                        view.stopLoading();
                        return true;
                    }

                    if (url.startsWith("intent://") || url.startsWith("vlc://")) {
                        try {
                            Intent intent;
                            if (url.startsWith("intent://")) {
                                intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                            } else {
                                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            }

                            if (intent != null) {
                                view.stopLoading();
                                try {
                                    startActivity(intent);
                                } catch (android.content.ActivityNotFoundException e) {
                                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                                    if (fallbackUrl != null) {
                                        view.loadUrl(fallbackUrl);
                                    } else {
                                        // Fallback to play store dynamically based on target package
                                        String targetPackage = intent.getPackage();
                                        if (targetPackage == null) {
                                            targetPackage = "org.videolan.vlc"; // Default fallback
                                        }
                                        try {
                                            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + targetPackage));
                                            startActivity(marketIntent);
                                        } catch (android.content.ActivityNotFoundException marketError) {
                                            Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + targetPackage));
                                            startActivity(webIntent);
                                        }
                                    }
                                }
                                return true;
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                    return false;
                }

                private Uri withNativeCallback(Uri uri) {
                    String redirectTo = uri.getQueryParameter("redirect_to");
                    if (redirectTo == null || redirectTo.isEmpty()) return uri;

                    Uri callbackUri = Uri.parse(redirectTo);
                    callbackUri = callbackUri.buildUpon()
                        .path("/api/auth/google/callback")
                        .clearQuery()
                        .appendQueryParameter("source", "app")
                        .fragment(null)
                        .build();

                    Uri.Builder builder = uri.buildUpon().clearQuery();
                    for (String name : uri.getQueryParameterNames()) {
                        if ("redirect_to".equals(name)) {
                            builder.appendQueryParameter(name, callbackUri.toString());
                        } else {
                            for (String value : uri.getQueryParameters(name)) {
                                builder.appendQueryParameter(name, value);
                            }
                        }
                    }
                    return builder.build();
                }
            });
        }
    }
}
