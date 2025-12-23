package com.nospeak.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;

public class AndroidUnifiedPushDistributorLinkActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();

        if (intent != null && intent.getData() != null) {
            String data = intent.getData().toString();
            String[] parts = data.split("/");
            
            if (parts.length >= 4) {
                String token = parts[3];
                
                AndroidUnifiedPushPrefs.Registration reg = AndroidUnifiedPushPrefs.getRegistration(this, token);
                
                if (reg != null) {
                    try {
                        Class<?> pendingIntentClass = Class.forName("android.app.PendingIntent");
                        java.lang.reflect.Method getActivityMethod = pendingIntentClass.getMethod(
                            "getActivity",
                            android.content.Context.class,
                            int.class,
                            android.content.Intent.class,
                            int.class
                        );
                        
                        Class<?> mutableFlagClass = Class.forName("android.app.PendingIntent$MutableFlags");
                        java.lang.reflect.Field immutableField = mutableFlagClass.getField("IMMUTABLE");
                        int immutableFlag = immutableField.getInt(null);
                        
                        PendingIntent pendingIntent = (PendingIntent) getActivityMethod.invoke(
                            null,
                            this,
                            0,
                            new Intent().setPackage(reg.packageName),
                            immutableFlag
                        );
                        
                        Intent resultIntent = new Intent("org.unifiedpush.android.distributor.feature.BINDING");
                        resultIntent.putExtra("token", token);
                        resultIntent.putExtra("pendingIntent", pendingIntent);
                        resultIntent.setPackage(reg.packageName);
                        
                        sendBroadcast(resultIntent);
                        setResult(RESULT_OK);
                    } catch (Exception e) {
                        setResult(RESULT_CANCELED);
                    }
                } else {
                    setResult(RESULT_CANCELED);
                }
            } else {
                setResult(RESULT_CANCELED);
            }
        } else {
            setResult(RESULT_CANCELED);
        }

        finish();
    }
}
