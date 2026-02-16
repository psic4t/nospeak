package com.nospeak.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidNotificationRouter")
public class AndroidNotificationRouterPlugin extends Plugin {

    private static final String EXTRA_ROUTE_KIND = "nospeak_route_kind";
    private static final String EXTRA_ROUTE_CONVERSATION_ID = "nospeak_conversation_id";

    @PluginMethod
    public void getInitialRoute(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject payload = extractRoutePayload(intent);
        if (payload == null) {
            call.resolve();
            return;
        }

        // Clear the intent so we do not process the same tap twice.
        getActivity().setIntent(new Intent(getContext(), getActivity().getClass()));
        call.resolve(payload);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject payload = extractRoutePayload(intent);
        if (payload != null) {
            notifyListeners("routeReceived", payload, true);
        }
    }

    private JSObject extractRoutePayload(Intent intent) {
        if (intent == null) {
            return null;
        }

        // Primary path: read from intent extras (notification taps via PendingIntent)
        String kind = intent.getStringExtra(EXTRA_ROUTE_KIND);
        String conversationId = intent.getStringExtra(EXTRA_ROUTE_CONVERSATION_ID);

        // Fallback: parse from data URI (launcher shortcuts may strip extras).
        // Only when MIME type is absent — a non-null type means a real share-sheet
        // intent which should be handled by AndroidShareTargetPlugin instead.
        if ((kind == null || kind.isEmpty())
                && intent.getType() == null
                && intent.getData() != null) {
            Uri data = intent.getData();
            if ("nospeak".equals(data.getScheme())
                    && data.getPathSegments() != null
                    && !data.getPathSegments().isEmpty()) {
                String host = data.getHost();
                if ("chat".equals(host)) {
                    kind = "chat";
                    conversationId = data.getLastPathSegment();
                }
            }
        }

        if (kind == null || kind.isEmpty() || conversationId == null || conversationId.isEmpty()) {
            return null;
        }

        JSObject payload = new JSObject();
        payload.put("kind", kind);
        payload.put("conversationId", conversationId);
        return payload;
    }
}
