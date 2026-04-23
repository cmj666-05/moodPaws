package com.moodpaws.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "LanDiscovery")
public class LanDiscoveryPlugin extends Plugin {

    private static final String DEFAULT_SERVICE_TYPE = "_http._tcp.";
    private static final int DEFAULT_TIMEOUT_MS = 3500;
    private static final int DEFAULT_MAX_RESULTS = 6;
    private static final int MIN_TIMEOUT_MS = 1000;
    private static final int MAX_TIMEOUT_MS = 15000;
    private static final int MAX_RESULT_LIMIT = 20;

    @PluginMethod
    public void discoverService(PluginCall call) {
        startDiscovery(call);
    }

    private void startDiscovery(PluginCall call) {
        Context context = getContext();
        NsdManager nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);

        if (nsdManager == null) {
            call.unavailable("NSD service is not available on this device");
            return;
        }

        String serviceType = normalizeServiceType(call.getString("serviceType", DEFAULT_SERVICE_TYPE));
        String serviceNamePrefix = normalizeServiceNamePrefix(call.getString("serviceNamePrefix", ""));
        int timeoutMs = clamp(call.getInt("timeoutMs", DEFAULT_TIMEOUT_MS), MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
        int maxResults = clamp(call.getInt("maxResults", DEFAULT_MAX_RESULTS), 1, MAX_RESULT_LIMIT);

        new DiscoverySession(
            nsdManager,
            call,
            serviceType,
            serviceNamePrefix,
            timeoutMs,
            maxResults
        ).start();
    }

    private static int clamp(Integer value, int min, int max) {
        int resolved = value == null ? min : value;
        return Math.max(min, Math.min(max, resolved));
    }

    private static String normalizeServiceType(String serviceType) {
        String normalized = safeTrim(serviceType);
        if (normalized.isEmpty()) {
            return DEFAULT_SERVICE_TYPE;
        }
        return normalized.endsWith(".") ? normalized : normalized + ".";
    }

    private static String normalizeServiceNamePrefix(String prefix) {
        return safeTrim(prefix).toLowerCase(Locale.ROOT);
    }

    private static String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class DiscoverySession {

        private final NsdManager nsdManager;
        private final PluginCall call;
        private final String serviceType;
        private final String serviceNamePrefix;
        private final int timeoutMs;
        private final int maxResults;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final AtomicBoolean finished = new AtomicBoolean(false);
        private final LinkedHashMap<String, JSObject> resolvedServices = new LinkedHashMap<>();

        private boolean discoveryActive = false;

        private final Runnable timeoutTask = new Runnable() {
            @Override
            public void run() {
                finishSuccess("timeout");
            }
        };

        private final NsdManager.DiscoveryListener discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String regType) {
                discoveryActive = true;
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                if (!matchesTarget(serviceInfo)) {
                    return;
                }
                resolveService(serviceInfo);
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {}

            @Override
            public void onDiscoveryStopped(String serviceType) {
                discoveryActive = false;
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                finishError("Failed to start LAN discovery (" + errorCode + ")");
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                finishError("Failed to stop LAN discovery (" + errorCode + ")");
            }
        };

        DiscoverySession(
            NsdManager nsdManager,
            PluginCall call,
            String serviceType,
            String serviceNamePrefix,
            int timeoutMs,
            int maxResults
        ) {
            this.nsdManager = nsdManager;
            this.call = call;
            this.serviceType = serviceType;
            this.serviceNamePrefix = serviceNamePrefix;
            this.timeoutMs = timeoutMs;
            this.maxResults = maxResults;
        }

        void start() {
            try {
                nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
                handler.postDelayed(timeoutTask, timeoutMs);
            } catch (Exception error) {
                finishError(error instanceof Exception ? error.getMessage() : "Failed to start discovery");
            }
        }

        private boolean matchesTarget(NsdServiceInfo serviceInfo) {
            String discoveredType = safeTrim(serviceInfo.getServiceType());
            String discoveredName = safeTrim(serviceInfo.getServiceName()).toLowerCase(Locale.ROOT);

            if (!serviceType.equalsIgnoreCase(discoveredType)) {
                return false;
            }

            if (serviceNamePrefix.isEmpty()) {
                return true;
            }

            return discoveredName.startsWith(serviceNamePrefix);
        }

        @SuppressWarnings("deprecation")
        private void resolveService(NsdServiceInfo serviceInfo) {
            try {
                nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                    @Override
                    public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {}

                    @Override
                    public void onServiceResolved(NsdServiceInfo resolvedInfo) {
                        addResolvedService(resolvedInfo);
                    }
                });
            } catch (Exception ignored) {}
        }

        private synchronized void addResolvedService(NsdServiceInfo serviceInfo) {
            if (finished.get()) {
                return;
            }

            JSObject entry = toServiceEntry(serviceInfo);
            if (entry == null) {
                return;
            }

            String key = entry.getString("key");
            if (key == null || key.isEmpty()) {
                return;
            }

            resolvedServices.put(key, entry);

            if (resolvedServices.size() >= maxResults) {
                finishSuccess("max_results");
            }
        }

        private JSObject toServiceEntry(NsdServiceInfo serviceInfo) {
            if (serviceInfo.getHost() == null) {
                return null;
            }

            String hostAddress = safeTrim(serviceInfo.getHost().getHostAddress());
            if (hostAddress.isEmpty()) {
                return null;
            }

            String hostLabel = safeTrim(serviceInfo.getHost().getHostName());
            int port = serviceInfo.getPort();
            String formattedHost = formatHostForUrl(hostAddress);
            String servicePath = "";
            JSObject attributes = new JSObject();

            for (Map.Entry<String, byte[]> entry : serviceInfo.getAttributes().entrySet()) {
                String key = safeTrim(entry.getKey());
                String value = entry.getValue() == null
                    ? ""
                    : new String(entry.getValue(), StandardCharsets.UTF_8).trim();
                attributes.put(key, value);

                if ("path".equalsIgnoreCase(key) && !value.isEmpty()) {
                    servicePath = normalizePath(value);
                }
            }

            return new JSObject()
                .put("key", hostAddress + ":" + port)
                .put("serviceName", safeTrim(serviceInfo.getServiceName()))
                .put("serviceType", safeTrim(serviceInfo.getServiceType()))
                .put("host", hostAddress)
                .put("hostName", hostLabel)
                .put("port", port)
                .put("originUrl", "http://" + formattedHost + ":" + port)
                .put("path", servicePath)
                .put("attributes", attributes);
        }

        private static String normalizePath(String path) {
            String normalized = safeTrim(path);
            if (normalized.isEmpty()) {
                return "";
            }
            return normalized.startsWith("/") ? normalized : "/" + normalized;
        }

        private static String formatHostForUrl(@NonNull String host) {
            return host.contains(":") ? "[" + host + "]" : host;
        }

        private void finishSuccess(String reason) {
            if (!finished.compareAndSet(false, true)) {
                return;
            }

            handler.removeCallbacks(timeoutTask);
            stopDiscoveryQuietly();

            JSArray services = new JSArray();
            for (JSObject item : resolvedServices.values()) {
                item.remove("key");
                services.put(item);
            }

            JSObject payload = new JSObject()
                .put("reason", reason)
                .put("serviceType", serviceType)
                .put("serviceNamePrefix", serviceNamePrefix)
                .put("discoveredAt", System.currentTimeMillis())
                .put("services", services);

            call.resolve(payload);
        }

        private void finishError(String message) {
            if (!finished.compareAndSet(false, true)) {
                return;
            }

            handler.removeCallbacks(timeoutTask);
            stopDiscoveryQuietly();
            call.reject(message == null || message.isEmpty() ? "LAN discovery failed" : message);
        }

        private void stopDiscoveryQuietly() {
            if (!discoveryActive) {
                return;
            }

            try {
                nsdManager.stopServiceDiscovery(discoveryListener);
            } catch (Exception ignored) {}

            discoveryActive = false;
        }
    }
}
