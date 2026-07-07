package com.cloudcinema.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());

        // Request high display refresh rate (120Hz) on supported devices
        try {
            android.view.WindowManager.LayoutParams layoutParams = getWindow().getAttributes();
            layoutParams.preferredRefreshRate = 120.0f;
            getWindow().setAttributes(layoutParams);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Intercept intent:// and vlc:// links to launch external media players like VLC
        if (bridge != null && bridge.getWebView() != null) {
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

                private boolean handleUri(WebView view, Uri uri) {
                    if (uri == null) return false;
                    String url = uri.toString();
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
                                        Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + targetPackage));
                                        startActivity(marketIntent);
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
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null && "cloudcinema".equals(data.getScheme())) {
            // Extract the hash fragment or query params
            String fragment = data.getFragment();
            String query = data.getQuery();
            
            String targetUrl = "https://cloudcinema.vercel.app/login";
            if (fragment != null) {
                targetUrl += "#" + fragment;
            } else if (query != null) {
                targetUrl += "?" + query;
            }
            
            // Tell the WebView to load this URL on the UI thread
            final String finalUrl = targetUrl;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().loadUrl(finalUrl);
                    }
                }
            });
        }
    }
}
