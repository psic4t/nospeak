const he = {
    common: {
        appName: 'nospeak',
        save: 'שמור',
        cancel: 'ביטול'
    },
    auth: {
        loginWithAmber: 'התחברות עם Amber',
        loginWithExtension: 'התחברות עם תוסף חתימה של Nostr',
        orSeparator: 'או',
        loginWithNsecLabel: 'התחברות עם nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'התחברות',
        connecting: 'מתחבר...',
        generateKeypairLink: 'יצירת זוג מפתחות חדש',
        downloadAndroidApp: 'הורדת אפליקציית אנדרואיד',
        amber: {
            title: 'התחברות עם Amber',
            helper: 'סרוק קוד QR זה עם Amber או השתמש בכפתורים למטה.',
            openInAmber: 'פתח ב-Amber',
            copyConnectionString: 'העתק מחרוזת חיבור',
            copied: 'הועתק!'
        },
        keypair: {
            title: 'יצירת זוג מפתחות חדש',
            description: 'זוג מפתחות Nostr חדש נוצר מקומית בדפדפן שלך.',
            npubLabel: 'npub (מפתח ציבורי)',
            nsecLabel: 'nsec (מפתח סודי)',
            generateAnother: 'יצירת זוג נוסף',
            useAndLogin: 'השתמש בזוג מפתחות זה והתחבר'
        }
    },
    chats: {
        title: 'צ\'אטים',
        emptyHint: 'אין צ\'אטים עדיין. הקש + כדי להוסיף איש קשר.',
        selectPrompt: 'בחר צ\'אט כדי להתחיל לשלוח הודעות',
        addContact: 'הוסף איש קשר',
        filterAll: 'הכל',
        filterUnread: 'לא נקראו',
        filterGroups: 'קבוצות',
        emptyUnread: 'אין צ\'אטים שלא נקראו',
        emptyGroups: 'אין קבוצות',
        favorites: 'מועדפים',
        favoriteMessage: 'הודעה',
        favoriteMessages: 'הודעות',
        emptyFavorites: 'אין הודעות מועדפות עדיין',
        export: 'ייצוא',
        archive: 'ארכיון',
        unarchive: 'הוצאה מארכיון',
        archived: 'בארכיון',
        emptyArchive: 'אין צ\'אטים בארכיון',
        chatArchived: 'הצ\'אט הועבר לארכיון'
    },
    contacts: {
        title: 'אנשי קשר',
        manage: 'ניהול',
        scanQr: 'סריקת QR',
        scanQrAria: 'סריקת קוד QR של איש קשר',
        emptyHint: 'אם לא מופיעים אנשי קשר, לחץ על ניהול כדי להוסיף.',
        selectPrompt: 'בחר איש קשר כדי להתחיל לשוחח',
        youPrefix: 'את/ה',
        mediaPreview: {
            image: 'תמונה',
            video: 'וידאו',
            voiceMessage: 'הודעה קולית',
            audio: 'שמע',
            file: 'קובץ',
            location: 'מיקום'
        }
    },
    connection: {
        relaysLabel: 'ממסרים:',
        authLabel: 'אימות:',
        authFailedLabel: 'נכשל:'
    },
    sync: {
        title: 'מסנכרן הודעות...',
        fetched: '{count} נשלפו',
        errorTitle: 'הסנכרון נכשל',
        timeoutError: 'הסנכרון חרג מזמן המתנה לאחר 5 דקות',
        relayErrorsTitle: 'שגיאות ממסרים',
        retryButton: 'נסה שוב',
        skipButton: 'דלג והמשך',
        continueInBackground: 'המשך ברקע',
        backgroundComplete: 'הסנכרון הושלם',
        manualRelay: {
            label: 'או הזן ממסר ידנית',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'התחבר',
            connecting: 'מתחבר...',
            invalidUrl: 'כתובת URL של ממסר לא חוקית'
        },
        steps: {
            connectDiscoveryRelays: 'התחברות לממסרי גילוי',
            fetchMessagingRelays: 'שליפה ושמירת ממסרי ההודעות של המשתמש',
            connectReadRelays: 'התחברות לממסרי ההודעות של המשתמש',
            fetchHistory: 'שליפה ושמירת פריטי היסטוריה מממסרים',
            fetchContacts: 'שליפה ומיזוג אנשי קשר מממסרים',
            fetchContactProfiles: 'שליפה ושמירת פרופילי אנשי קשר ומידע ממסרים',
            fetchUserProfile: 'שליפה ושמירת פרופיל המשתמש'
        }
    },
    modals: {
        manageContacts: {
            title: 'אנשי קשר',
            scanQr: 'סריקת QR',
            scanQrAria: 'סריקת קוד QR להוספת איש קשר',
            searchPlaceholder: 'npub, NIP-05 או מונח חיפוש',
            addContactAria: 'הוסף איש קשר',
            searchContactsAria: 'חיפוש אנשי קשר',
            searching: 'מחפש...',
            searchFailed: 'החיפוש נכשל',
            noResults: 'אין תוצאות',
            noContacts: 'לא נוספו אנשי קשר',
            removeContactAria: 'הסר איש קשר',
            resolvingNip05: 'מחפש NIP-05...',
            nip05LookupFailed: 'חיפוש NIP-05 נכשל',
            nip05NotFound: 'NIP-05 לא נמצא',
            nip05InvalidFormat: 'פורמט NIP-05 לא חוקי (השתמש ב-name@domain.com)',
            alreadyAdded: 'כבר נוסף',
            syncing: 'מסנכרן אנשי קשר…',
            pullToRefresh: 'משוך לרענון',
            releaseToRefresh: 'שחרר לרענון',
            newContact: 'הוסף איש קשר',
            createGroup: 'צור קבוצה',
            contextMenu: {
                openMenu: 'פתח תפריט',
                viewProfile: 'צפה בפרופיל',
                delete: 'מחק'
            },
            confirmDelete: {
                title: 'מחיקת איש קשר',
                message: 'האם אתה בטוח שברצונך למחוק את {name}?',
                confirm: 'מחק'
            }
        },
        createGroup: {
            title: 'יצירת צ\'אט קבוצתי',
            searchPlaceholder: 'חיפוש אנשי קשר',
            selectedCount: '{count} נבחרו',
            minContactsHint: 'בחר לפחות 2 אנשי קשר',
            createButton: 'צור קבוצה',
            creating: 'יוצר...',
            noContacts: 'אין אנשי קשר להוספה לקבוצה'
        },
        profile: {
            unknownName: 'לא ידוע',
            about: 'אודות',
            publicKey: 'מפתח ציבורי',
            messagingRelays: 'ממסרי הודעות',
            noRelays: 'אין',
            refreshing: 'מרענן פרופיל…',
            notFound: 'הפרופיל לא נמצא',
            addToContacts: 'הוסף לאנשי קשר',
            addingContact: 'מוסיף…',
            contactAdded: 'איש הקשר נוסף'
        },
        emptyProfile: {
            title: 'סיים את הגדרת הפרופיל שלך',
            introLine1: 'למפתח זה אין ממסרי הודעות או שם משתמש מוגדרים עדיין.',
            introLine2: 'נגדיר כמה ממסרי הודעות ברירת מחדל כדי ש-nospeak יוכל לשלוח ולקבל הודעות. תוכל לשנות אותם מאוחר יותר בהגדרות תחת ממסרי הודעות.',
            usernameLabel: 'שם משתמש',
            usernamePlaceholder: 'השם שלך',
            usernameRequired: 'אנא הזן שם משתמש כדי להמשיך.',
            saveError: 'לא ניתן לשמור את ההגדרה הראשונית. אנא נסה שוב.',
            doLater: 'אעשה זאת מאוחר יותר',
            saving: 'שומר...',
            continue: 'המשך',
            autoRelaysConfigured: 'ממסרי ההודעות הוגדרו. תוכל לשנות אותם בהגדרות.'
        },
        relayStatus: {
            title: 'חיבורי ממסרים',
            noRelays: 'לא הוגדרו ממסרים',
            connected: 'מחובר',
            disconnected: 'מנותק',
            typeLabel: 'סוג:',
            lastConnectedLabel: 'חיבור אחרון:',
            successLabel: 'הצלחה:',
            failureLabel: 'כשלונות:',
            authLabel: 'אימות:',
            authErrorLabel: 'שגיאת אימות:',
            authNotRequired: 'לא נדרש',
            authRequired: 'נדרש',
            authAuthenticating: 'מאמת',
            authAuthenticated: 'מאומת',
            authFailed: 'נכשל',
            typePersistent: 'קבוע',
            typeTemporary: 'זמני',
            never: 'אף פעם'
        },
        qr: {
            title: 'קוד QR',
            tabs: {
                myQr: 'הקוד שלי',
                scanQr: 'סריקת קוד'
            }
        },
        userQr: {
            preparing: 'מכין קוד QR…',
            hint: 'זהו ה-npub שלך כקוד QR. שתף אותו עם מישהו כדי שיוכל לסרוק אותו ולהוסיף אותך כאיש קשר.'
        },
        scanContactQr: {
            title: 'סריקת QR של איש קשר',
            instructions: 'כוון את המצלמה אל קוד QR של Nostr כדי להוסיף איש קשר.',
            scanning: 'סורק…',
            noCamera: 'המצלמה אינה זמינה במכשיר זה.',
            invalidQr: 'קוד QR זה אינו מכיל npub חוקי של איש קשר.',
            addFailed: 'לא ניתן להוסיף איש קשר מקוד QR זה. אנא נסה שוב.',
            added: 'איש קשר נוסף מ-QR.'
        },
        scanContactQrResult: {
            title: 'איש קשר מ-QR',
            alreadyContact: 'איש קשר זה כבר נמצא ברשימת אנשי הקשר שלך.',
            reviewHint: 'בדוק את איש הקשר מקוד ה-QR הסרוק לפני ההוספה.',
            updatingProfile: 'מעדכן פרופיל…',
            loadFailed: 'נכשל בטעינת פרטי איש הקשר מ-QR.',
            addFailed: 'נכשל בהוספת איש קשר מ-QR.',
            closeButton: 'סגור',
            addButton: 'הוסף איש קשר',
            startChatButton: 'התחל צ\'אט'
        },
        attachmentPreview: {
            title: 'תצוגה מקדימה של קובץ מצורף',
            imageAlt: 'תצוגה מקדימה של קובץ מצורף',
            noPreview: 'תצוגה מקדימה לא זמינה',
            captionLabel: 'כיתוב (אופציונלי)',
            cancelButton: 'ביטול',
            sendButtonIdle: 'שלח',
            sendButtonSending: 'שולח…',
            uploadButtonIdle: 'העלה',
            uploadButtonUploading: 'מעלה…'
        },
        locationPreview: {
            title: 'מיקום',
            closeButton: 'סגור',
            openInOpenStreetMap: 'פתח ב-OpenStreetMap',
            ctrlScrollToZoom: 'השתמש ב-Ctrl + גלילה כדי לשנות תקריב'
        },
        mediaServersAutoConfigured: {
            title: 'שרתי מדיה הוגדרו',
            message: 'לא היו שרתי Blossom מוגדרים. הוספנו את {server1} ו-{server2}.\n\nתוכל לשנות אותם בהגדרות → שרתי מדיה.'
        }
    },
    chat: {
        sendFailedTitle: 'השליחה נכשלה',
        sendFailedMessagePrefix: 'נכשל בשליחת הודעה: ',
        location: {
            errorTitle: 'שגיאת מיקום',
            errorMessage: 'נכשל בקבלת המיקום שלך. אנא בדוק את ההרשאות.'
        },
        relative: {
            justNow: 'עכשיו',
            minutes: 'לפני {count} דקה',
            minutesPlural: 'לפני {count} דקות',
            hours: 'לפני {count} שעה',
            hoursPlural: 'לפני {count} שעות',
            days: 'לפני {count} יום',
            daysPlural: 'לפני {count} ימים',
            weeks: 'לפני {count} שבוע',
            weeksPlural: 'לפני {count} שבועות',
            months: 'לפני {count} חודש',
            monthsPlural: 'לפני {count} חודשים',
            years: 'לפני {count} שנה',
            yearsPlural: 'לפני {count} שנים'
        },
        dateLabel: {
            today: 'היום',
            yesterday: 'אתמול'
        },
        history: {
            fetchOlder: 'שליפת הודעות ישנות יותר מממסרים',
            summary: 'נשלפו {events} אירועים, נשמרו {saved} הודעות חדשות ({chat} בצ\'אט זה)',
            none: 'אין עוד הודעות זמינות מממסרים',
            error: 'נכשל בשליפת הודעות ישנות. נסה שוב מאוחר יותר.'
        },
        empty: {
            noMessagesTitle: 'אין הודעות עדיין',
            forContact: 'התחל את השיחה עם {name}.',
            forGroup: 'התחל את השיחה ב-{name}.',
            generic: 'בחר איש קשר כדי להתחיל לשוחח.'
        },
        group: {
            defaultTitle: 'צ\'אט קבוצתי',
            participants: '{count} משתתפים',
            participantsShort: '{count}',
            members: 'חברים: {count}',
            membersTitle: 'חברים',
            viewMembers: 'הצג חברים',
            editName: 'ערוך שם קבוצה',
            editNameTitle: 'שם הקבוצה',
            editNamePlaceholder: 'הזן שם קבוצה...',
            editNameHint: 'השאר ריק כדי להשתמש בשמות המשתתפים',
            editNameSave: 'שמור',
            editNameCancel: 'ביטול',
            nameSavedToast: 'נשמר. יוגדר עם ההודעה הבאה.',
            nameValidationTooLong: 'השם ארוך מדי (מקסימום 100 תווים)',
            nameValidationInvalidChars: 'השם מכיל תווים לא חוקיים'
        },
        inputPlaceholder: 'הקלד הודעה...',
        contextMenu: {
            cite: 'ציטוט',
            copy: 'העתק',
            sentAt: 'נשלח',
            favorite: 'מועדף',
            unfavorite: 'הסר ממועדפים'
        },
        reactions: {
            cannotReactTitle: 'לא ניתן להגיב',
            cannotReactMessage: 'הודעה זו ישנה מדי כדי לתמוך בתגובות.',
            failedTitle: 'התגובה נכשלה',
            failedMessagePrefix: 'נכשל בשליחת תגובה: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'העלאת מדיה',
            takePhoto: 'צלם תמונה',
            location: 'מיקום',
            image: 'תמונה',
            video: 'וידאו',
            audio: 'מוזיקה',
            file: 'קובץ'
        },
        mediaErrors: {
            cameraErrorTitle: 'שגיאת מצלמה',
            cameraErrorMessage: 'נכשל בצילום תמונה'
        },
        fileUpload: {
            fileTooLarge: 'הקובץ גדול מדי. הגודל המרבי הוא 10 מגה-בייט.',
            download: 'הורד',
            decrypting: 'מפענח...'
        },
        mediaUnavailable: 'מדיה זו אינה זמינה עוד.',
        voiceMessage: {
            title: 'הודעה קולית',
            recordAria: 'הקלט הודעה קולית',
            playPreviewAria: 'נגן תצוגה מקדימה',
            pausePreviewAria: 'השהה תצוגה מקדימה',
            cancelButton: 'ביטול',
            pauseButton: 'השהה',
            doneButton: 'סיום',
            resumeButton: 'המשך',
            sendButton: 'שלח',
            microphoneTitle: 'מיקרופון',
            permissionDeniedTitle: 'הרשאת מיקרופון',
            permissionDeniedMessage: 'אנא אפשר גישה למיקרופון כדי להקליט.',
            nativeNotAvailable: 'הקלטה מקומית אינה זמינה.',
            unsupported: 'הקלטה קולית אינה נתמכת במכשיר זה.',
            failedToStart: 'נכשל בהתחלת ההקלטה.',
            failedToStop: 'נכשל בעצירת ההקלטה.',
            recordingFailed: 'ההקלטה נכשלה.'
        },
        relayStatus: {
            sending: 'שולח...',
            sentToRelays: 'נשלח ל-{successful}/{desired} ממסרים'
        },
        searchPlaceholder: 'חיפוש',
        searchNoMatches: 'אין התאמות',
        searchAriaLabel: 'חיפוש בצ\'אט'
    },
    settings: {
        title: 'הגדרות',
        categories: {
            general: 'כללי',
            profile: 'פרופיל',
            messagingRelays: 'ממסרי הודעות',
            mediaServers: 'שרתי מדיה',
            security: 'אבטחה',
            about: 'אודות'
        },
        general: {
            appearanceLabel: 'מראה',
            appearanceDescription: 'בחר אם לעקוב אחר המערכת, מצב בהיר או מצב כהה.',
            languageLabel: 'שפה',
            languageDescription: 'בחר את שפת האפליקציה המועדפת עליך.'
        },
        notifications: {
            label: 'התראות',
            supportedDescription: 'קבל התראות כאשר מתקבלות הודעות חדשות במכשיר זה',
            unsupportedDescription: 'התראות אינן נתמכות במכשיר זה'
        },
        backgroundMessaging: {
            label: 'הודעות ברקע',
            description: 'שמור על nospeak מחובר לממסרי ההודעות שלך וקבל התראות על הודעות ותגובות בזמן שהאפליקציה ברקע. אנדרואיד יציג התראה קבועה כאשר אפשרות זו מופעלת. עובד עם התחברות במפתח מקומי (nsec) והתחברות עם Amber. תצוגות מקדימות של התראות עשויות להיות מוגבלות על ידי הגדרות הפרטיות של מסך הנעילה באנדרואיד.',
            openBatterySettings: 'פתח הגדרות סוללה'
        },
        urlPreviews: {
            label: 'תצוגות מקדימות של URL',
            description: 'הצג כרטיסי תצוגה מקדימה עבור קישורים שאינם מדיה בהודעות.'
        },
        profile: {
            nameLabel: 'שם',
            namePlaceholder: 'השם שלך',
            displayNameLabel: 'שם תצוגה',
            displayNamePlaceholder: 'שם תצוגה',
            aboutLabel: 'אודות',
            aboutPlaceholder: 'ספר לנו על עצמך',
            pictureUrlLabel: 'כתובת URL של תמונה',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'כתובת URL של באנר',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (שם משתמש)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'אתר אינטרנט',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'כתובת Lightning (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'שמור שינויים',
            savingButton: 'שומר...'
        },
        messagingRelays: {
            description: 'הגדר את ממסרי ההודעות NIP-17 שלך. ממסרים אלה משמשים לקבלת ההודעות המוצפנות שלך. לביצועים מיטביים, 2 ממסרי הודעות בדרך כלל עובדים הכי טוב.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'הוסף',
            emptyState: 'לא הוגדרו ממסרים',
            tooManyWarning: 'יותר מ-3 ממסרי הודעות עלול לפגוע בביצועים ובאמינות.',
            saveStatusSuccess: 'רשימת הממסרים נשמרה ל-{count} ממסרים.',
            saveStatusPartial: 'רשימת הממסרים נשמרה ל-{succeeded} מתוך {attempted} ממסרים.',
            saveStatusNone: 'לא ניתן לשמור את רשימת הממסרים לאף ממסר.',
            saveStatusError: 'שגיאה בשמירת רשימת הממסרים. ייתכן שההגדרות שלך לא הופצו במלואן.',
            savingStatus: 'שומר הגדרות ממסרים…'
        },
        mediaServers: {
            description: 'הגדר את שרתי המדיה Blossom שלך. שרתים אלה משמשים לאחסון קבצים שאתה מעלה (מדיה של פרופיל וקבצים מצורפים בצ\'אט).',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'הוסף',
            emptyState: 'לא הוגדרו שרתים',
            saveStatusSuccess: 'רשימת השרתים נשמרה ל-{count} ממסרים.',
            saveStatusPartial: 'רשימת השרתים נשמרה ל-{succeeded} מתוך {attempted} ממסרים.',
            saveStatusNone: 'לא ניתן לשמור את רשימת השרתים לאף ממסר.',
            saveStatusError: 'שגיאה בשמירת רשימת השרתים. ייתכן שההגדרות שלך לא הופצו במלואן.',
            savingStatus: 'שומר הגדרות שרתי מדיה…',
            primary: 'ראשי',
            setAsPrimary: 'הגדר כראשי',
            mediaCacheLabel: 'מטמון מדיה',
            mediaCacheDescription: 'שמור מדיה שנצפתה בגלריה שלך לגישה לא מקוונת. ניתן לנהל קבצים באפליקציית התמונות.'
        },
        security: {
            loginMethodTitle: 'שיטת התחברות',
            loginMethodUnknown: 'לא ידוע',
            npubLabel: 'ה-npub שלך',
            nsecLabel: 'ה-nsec שלך',
            hideNsecAria: 'הסתר nsec',
            showNsecAria: 'הצג nsec',
            dangerZoneTitle: 'אזור סכנה',
            dangerZoneDescription: 'התנתקות תסיר את כל הנתונים השמורים מהמכשיר הזה.',
            logoutButton: 'התנתקות'
        },
        pin: {
            appLockLabel: 'נעילת אפליקציה',
            appLockDescription: 'דרוש קוד PIN לגישה לאפליקציה',
            changePinButton: 'שנה קוד PIN',
            enterNewPin: 'הגדר קוד PIN',
            enterNewPinDescription: 'הזן קוד PIN בן 4 ספרות',
            confirmPin: 'אשר קוד PIN',
            confirmPinDescription: 'הזן את אותו קוד PIN שוב',
            enterCurrentPin: 'הזן קוד PIN',
            enterCurrentPinDescription: 'הזן את קוד ה-PIN הנוכחי שלך',
            wrongPin: 'קוד PIN שגוי',
            pinMismatch: 'קודי ה-PIN אינם תואמים, נסה שוב',
            enterPinToUnlock: 'הזן קוד PIN לביטול נעילה'
        }
    },
    signerMismatch: {
        title: 'אי-התאמת חשבון',
        description: 'לתוסף החתימה בדפדפן שלך יש חשבון פעיל שונה מהחשבון שאיתו התחברת.',
        expectedAccount: 'מחובר בתור',
        actualAccount: 'חשבון פעיל בתוסף החתימה',
        instructions: 'אנא עבור לחשבון הנכון בתוסף החתימה שלך וטען מחדש את הדף.'
    }
};

export default he;
