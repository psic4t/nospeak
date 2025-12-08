#!/bin/bash

npm run build:android
pushd android
./gradlew clean :app:assembleDebug
#./gradlew clean :app:assembleRelease
popd
#cp ./android/app/build/outputs/apk/release/app-release.apk ~/Nextcloud/Verschiedenes/
adb install -r ./android/app/build/outputs/apk/debug/app-debug.apk
