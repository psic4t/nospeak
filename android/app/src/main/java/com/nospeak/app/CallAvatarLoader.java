package com.nospeak.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.graphics.drawable.RoundedBitmapDrawable;
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory;

/**
 * Shared avatar loader used by the native voice-call activities
 * ({@link IncomingCallActivity} lockscreen ringer and
 * {@link ActiveCallActivity} in-call surface).
 *
 * <p>Resolution order for a given peer:
 * <ol>
 *   <li>Decode the cached profile-picture PNG at {@code avatarFilePath}
 *       (when supplied and decodable), circularize, return.</li>
 *   <li>Fall back to a deterministic identicon derived from the peer's
 *       npub (last 10 chars), matching the seed derivation used by
 *       {@link NativeBackgroundMessagingService#generateIdenticonForPubkey}
 *       and the JS-side {@code identicon.ts}. Circularized, return.</li>
 *   <li>Return {@code null} on total failure (caller leaves the layout's
 *       placeholder drawable in place).</li>
 * </ol>
 *
 * <p>Identicons are NOT written to disk by this class — they're generated
 * in-memory each time, same as the heads-up CallStyle notification path.
 * Calls last seconds-to-minutes; avatars bind once on activity start.
 *
 * <p>The circularization helper here is intentionally a static duplicate
 * of {@code NativeBackgroundMessagingService.makeCircularBitmap}; making
 * the FGS-private method static-accessible from the activity layer was
 * the only alternative and was rejected as too much surface area for a
 * 10-line utility.
 */
public final class CallAvatarLoader {

    private static final String TAG = "CallAvatarLoader";

    private CallAvatarLoader() {}

    /**
     * Resolve the best-available avatar for a peer. See class javadoc for
     * the resolution order.
     *
     * @param ctx             non-null context (for {@code getResources()})
     * @param avatarFilePath  optional cached PNG path (from
     *                        {@link NativeBackgroundMessagingService#resolveCachedAvatarFilePath})
     * @param peerHex         optional peer pubkey hex used for the
     *                        identicon fallback seed
     * @param targetPx        size in pixels to generate the identicon at
     *                        (ignored for the cached-file path; the
     *                        {@code RoundedBitmapDrawable} fits to the
     *                        {@code ImageView})
     * @return a circular drawable, or {@code null} if both paths failed
     */
    @Nullable
    public static Drawable loadCircular(
        Context ctx,
        @Nullable String avatarFilePath,
        @Nullable String peerHex,
        int targetPx
    ) {
        if (ctx == null) return null;

        // 1) Try cached real picture.
        if (avatarFilePath != null && !avatarFilePath.isEmpty()) {
            try {
                Bitmap bmp = BitmapFactory.decodeFile(avatarFilePath);
                if (bmp != null) {
                    RoundedBitmapDrawable d =
                        RoundedBitmapDrawableFactory.create(ctx.getResources(), bmp);
                    d.setCircular(true);
                    return d;
                }
                Log.d(TAG, "decodeFile returned null path=" + avatarFilePath);
            } catch (Throwable t) {
                Log.d(TAG, "decodeFile threw for path=" + avatarFilePath, t);
            }
        }

        // 2) Identicon fallback.
        if (peerHex != null && !peerHex.isEmpty()) {
            try {
                String npub = Bech32.pubkeyHexToNpub(peerHex);
                if (npub != null && npub.length() >= 10) {
                    String seed = npub.substring(npub.length() - 10);
                    int size = targetPx > 0 ? targetPx : 192;
                    Bitmap raw = IdenticonGenerator.generate(seed, size);
                    if (raw != null) {
                        Bitmap circ = makeCircularBitmap(raw);
                        if (circ != null) {
                            RoundedBitmapDrawable d =
                                RoundedBitmapDrawableFactory.create(ctx.getResources(), circ);
                            // Bitmap is already pre-masked; keep the
                            // drawable circular too so any future swap
                            // to a non-pre-masked source still renders
                            // correctly.
                            d.setCircular(true);
                            return d;
                        }
                    }
                }
            } catch (Throwable t) {
                Log.d(TAG, "identicon fallback failed for peerHex", t);
            }
        }

        return null;
    }

    /**
     * Mask a square bitmap into a circle using a PorterDuff DST_IN
     * compositing pass. Static duplicate of the instance method on
     * {@link NativeBackgroundMessagingService} — see class javadoc.
     */
    @Nullable
    private static Bitmap makeCircularBitmap(@Nullable Bitmap source) {
        if (source == null) return null;
        int w = source.getWidth();
        int h = source.getHeight();
        if (w <= 0 || h <= 0) return null;
        int size = Math.min(w, h);

        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.WHITE);

        RectF rect = new RectF(0f, 0f, size, size);
        canvas.drawOval(rect, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));

        // Center-crop the source if it's not square.
        int srcLeft = (w - size) / 2;
        int srcTop = (h - size) / 2;
        Rect srcRect = new Rect(srcLeft, srcTop, srcLeft + size, srcTop + size);
        Rect dstRect = new Rect(0, 0, size, size);
        canvas.drawBitmap(source, srcRect, dstRect, paint);

        return output;
    }
}
