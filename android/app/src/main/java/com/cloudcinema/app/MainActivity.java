package com.cloudcinema.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
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
