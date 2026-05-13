package com.nospeak.app;

import android.content.Context;
import android.graphics.SurfaceTexture;
import android.util.AttributeSet;
import android.util.Log;
import android.view.TextureView;

import org.webrtc.EglBase;
import org.webrtc.EglRenderer;
import org.webrtc.GlRectDrawer;
import org.webrtc.RendererCommon;
import org.webrtc.VideoFrame;
import org.webrtc.VideoSink;

/**
 * A {@link TextureView}-backed WebRTC video renderer.
 *
 * <p>Stream-webrtc-android (and upstream org.webrtc) ship
 * {@code SurfaceViewRenderer}, whose pixels are composited on a
 * separate hardware overlay plane that bypasses the View hierarchy's
 * outline clipping. That makes rounded corners impossible — the
 * outline mask exists but sits behind the SurfaceView's overlay
 * plane (see the deleted attempt in {@code c826e77}).
 *
 * <p>This class is the {@code TextureView} alternative: pixels are
 * drawn into a regular {@code SurfaceTexture} owned by the View, so
 * the View's outline / clipToOutline / matrix transforms work
 * normally. The cost is one extra GPU compositing pass per frame,
 * which is negligible at the 120dp × 160dp self-view size.
 *
 * <p>Only the public surface used by {@link ActiveCallActivity} is
 * exposed: {@link #init}, {@link #release}, {@link #setMirror},
 * {@link #setScalingType}, {@link #setEnableHardwareScaler},
 * {@link #setZOrderMediaOverlay}. {@code setEnableHardwareScaler}
 * and {@code setZOrderMediaOverlay} are no-op stubs — TextureView
 * is already in the View hierarchy, z-order is determined by the
 * layout, and TextureView has no equivalent of SurfaceView's
 * hardware-scaler hint (the GPU shader scales the texture during
 * draw regardless).
 *
 * <p>Mirroring is applied in GL space via
 * {@link EglRenderer#setMirror(boolean)} rather than via
 * {@link android.view.View#setScaleX(float)} so that the View's
 * width / outline / clip rect stay in canonical orientation.
 *
 * <p>Scaling mode {@link RendererCommon.ScalingType#SCALE_ASPECT_FILL}
 * is implemented by setting the EglRenderer's layout aspect ratio to
 * the View's aspect ratio on each frame-resolution change, then
 * letting the View clip overflow via its bounds. This matches the
 * fill behavior of {@code SurfaceViewRenderer} closely enough that
 * the existing 120 × 160 layout slot displays the same crop.
 */
public class TextureViewRenderer extends TextureView
        implements VideoSink, TextureView.SurfaceTextureListener {

    private static final String TAG = "TextureViewRenderer";

    /** Backing GL renderer. One per TextureViewRenderer instance. */
    private final EglRenderer eglRenderer;

    /** Caller's renderer-events callback (first-frame, resolution). */
    private RendererCommon.RendererEvents rendererEvents;

    /** True between init() and release(). Idempotency guard. */
    private boolean isInitialized;

    /**
     * Cached most-recent reported frame dimensions, in render
     * orientation. Used to fire
     * {@link RendererCommon.RendererEvents#onFrameResolutionChanged}
     * only on real changes (matches SurfaceEglRenderer behavior).
     */
    private int rotatedFrameWidth;
    private int rotatedFrameHeight;
    private int frameRotation;

    /** True until the first frame has been forwarded. */
    private boolean isFirstFrameRendered;

    /** Active scaling mode (default SCALE_ASPECT_FILL). */
    private RendererCommon.ScalingType scalingType =
            RendererCommon.ScalingType.SCALE_ASPECT_FILL;

    public TextureViewRenderer(Context context) {
        super(context);
        this.eglRenderer = new EglRenderer(resourceName(context));
        setSurfaceTextureListener(this);
    }

    public TextureViewRenderer(Context context, AttributeSet attrs) {
        super(context, attrs);
        this.eglRenderer = new EglRenderer(resourceName(context));
        setSurfaceTextureListener(this);
    }

    private String resourceName(Context context) {
        try {
            return context.getResources().getResourceEntryName(getId()) + ": ";
        } catch (Throwable t) {
            return "TextureViewRenderer: ";
        }
    }

    /**
     * Initialize the renderer against the shared {@link EglBase}
     * context owned by {@code NativeVoiceCallManager}. Must be
     * called from the UI thread before frames are delivered.
     */
    public void init(EglBase.Context sharedContext,
                     RendererCommon.RendererEvents events) {
        if (isInitialized) {
            Log.w(TAG, "init: already initialized, skipping");
            return;
        }
        this.rendererEvents = events;
        this.rotatedFrameWidth = 0;
        this.rotatedFrameHeight = 0;
        this.frameRotation = 0;
        this.isFirstFrameRendered = false;
        eglRenderer.init(sharedContext, EglBase.CONFIG_PLAIN, new GlRectDrawer());
        // If the SurfaceTexture is already available (View was
        // already attached + measured before init), create the EGL
        // surface immediately so the first frame lands on screen.
        SurfaceTexture st = getSurfaceTexture();
        if (st != null) {
            eglRenderer.createEglSurface(st);
        }
        isInitialized = true;
    }

    /** Release GL resources. Idempotent. Safe from the UI thread. */
    public void release() {
        if (!isInitialized) return;
        isInitialized = false;
        eglRenderer.release();
        rendererEvents = null;
    }

    /**
     * Horizontal mirror in GL space — used to flip the front-camera
     * preview so users see themselves "as in a mirror".
     */
    public void setMirror(boolean mirror) {
        eglRenderer.setMirror(mirror);
    }

    /**
     * API parity with {@code SurfaceViewRenderer}. We only support
     * {@link RendererCommon.ScalingType#SCALE_ASPECT_FILL} —
     * matching the existing self-view layout. Other modes are
     * accepted but treated as fill (the View's bounds clip
     * overflow either way).
     */
    public void setScalingType(RendererCommon.ScalingType type) {
        this.scalingType = type;
        applyLayoutAspectRatio();
    }

    /**
     * API parity stub. TextureView has no analogue of SurfaceView's
     * hardware scaler hint — scaling happens in the fragment shader
     * during draw.
     */
    @SuppressWarnings("unused")
    public void setEnableHardwareScaler(boolean enabled) {
        // no-op
    }

    /**
     * API parity stub. TextureView participates in the normal View
     * hierarchy, so z-order comes from layout order (and the PiP
     * declaration follows the remote renderer in
     * {@code activity_active_call.xml}, putting it on top
     * automatically).
     */
    @SuppressWarnings("unused")
    public void setZOrderMediaOverlay(boolean overlay) {
        // no-op
    }

    // ------------------------------------------------------------------
    // VideoSink
    // ------------------------------------------------------------------

    @Override
    public void onFrame(VideoFrame frame) {
        // Forward statistics + first-frame / resolution-changed
        // callbacks to mirror SurfaceEglRenderer semantics, then
        // hand the frame to the GL renderer for drawing.
        updateFrameDimensionsAndReportEvents(frame);
        eglRenderer.onFrame(frame);
    }

    private void updateFrameDimensionsAndReportEvents(VideoFrame frame) {
        if (!isFirstFrameRendered) {
            isFirstFrameRendered = true;
            if (rendererEvents != null) {
                rendererEvents.onFirstFrameRendered();
            }
        }
        int rotatedWidth = frame.getRotation() % 180 == 0
                ? frame.getBuffer().getWidth()
                : frame.getBuffer().getHeight();
        int rotatedHeight = frame.getRotation() % 180 == 0
                ? frame.getBuffer().getHeight()
                : frame.getBuffer().getWidth();
        if (rotatedWidth != rotatedFrameWidth
                || rotatedHeight != rotatedFrameHeight
                || frame.getRotation() != frameRotation) {
            rotatedFrameWidth = rotatedWidth;
            rotatedFrameHeight = rotatedHeight;
            frameRotation = frame.getRotation();
            if (rendererEvents != null) {
                rendererEvents.onFrameResolutionChanged(
                        frame.getBuffer().getWidth(),
                        frame.getBuffer().getHeight(),
                        frame.getRotation());
            }
            post(this::applyLayoutAspectRatio);
        }
    }

    /**
     * Sync the EglRenderer's layout aspect ratio to the View's
     * current aspect ratio, so SCALE_ASPECT_FILL fills the View
     * without letterboxing. Called on layout changes and on first
     * frame-resolution change.
     */
    private void applyLayoutAspectRatio() {
        if (!isInitialized) return;
        int w = getWidth();
        int h = getHeight();
        if (w == 0 || h == 0) {
            eglRenderer.setLayoutAspectRatio(0f);
            return;
        }
        eglRenderer.setLayoutAspectRatio((float) w / (float) h);
    }

    @Override
    protected void onLayout(boolean changed, int left, int top,
                            int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);
        if (changed) applyLayoutAspectRatio();
    }

    // ------------------------------------------------------------------
    // TextureView.SurfaceTextureListener
    // ------------------------------------------------------------------

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture surface,
                                          int width, int height) {
        if (isInitialized) {
            eglRenderer.createEglSurface(surface);
        }
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture surface,
                                            int width, int height) {
        applyLayoutAspectRatio();
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
        // Synchronously release the EGL surface before letting the
        // SurfaceTexture be torn down. We block on a CountDownLatch
        // via EglRenderer.releaseEglSurface(Runnable) → the same
        // pattern SurfaceEglRenderer uses internally.
        final java.util.concurrent.CountDownLatch latch =
                new java.util.concurrent.CountDownLatch(1);
        if (isInitialized) {
            eglRenderer.releaseEglSurface(latch::countDown);
            try {
                latch.await(500, java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        return true;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture surface) {
        // no-op
    }
}
