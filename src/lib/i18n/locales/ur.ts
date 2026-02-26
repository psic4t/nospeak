const ur = {
    common: {
        appName: 'nospeak',
        save: 'محفوظ کریں',
        cancel: 'منسوخ کریں'
    },
    auth: {
        loginWithAmber: 'Amber سے لاگ ان کریں',
        loginWithExtension: 'Nostr سائنر ایکسٹینشن سے لاگ ان کریں',
        orSeparator: 'یا',
        loginWithNsecLabel: 'nsec سے لاگ ان کریں',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'لاگ ان',
        connecting: 'جوڑ رہا ہے...',
        generateKeypairLink: 'نئی کلیدی جوڑی بنائیں',
        downloadAndroidApp: 'اینڈرائیڈ ایپ ڈاؤن لوڈ کریں',
        amber: {
            title: 'Amber سے لاگ ان کریں',
            helper: 'اس QR کوڈ کو Amber سے اسکین کریں یا نیچے دیے گئے بٹن استعمال کریں۔',
            openInAmber: 'Amber میں کھولیں',
            copyConnectionString: 'کنکشن سٹرنگ کاپی کریں',
            copied: 'کاپی ہو گیا!'
        },
        keypair: {
            title: 'نئی کلیدی جوڑی بنائیں',
            description: 'ایک نئی Nostr کلیدی جوڑی آپ کے براؤزر میں مقامی طور پر بنائی جاتی ہے۔',
            npubLabel: 'npub (عوامی کلید)',
            nsecLabel: 'nsec (خفیہ کلید)',
            generateAnother: 'ایک اور بنائیں',
            useAndLogin: 'یہ کلیدی جوڑی استعمال کریں اور لاگ ان کریں'
        }
    },
    chats: {
        title: 'چیٹس',
        emptyHint: 'ابھی کوئی چیٹ نہیں ہے۔ رابطہ شامل کرنے کے لیے + دبائیں۔',
        selectPrompt: 'پیغام رسانی شروع کرنے کے لیے چیٹ منتخب کریں',
        addContact: 'رابطہ شامل کریں',
        filterAll: 'سب',
        filterUnread: 'غیر پڑھے',
        filterGroups: 'گروپس',
        emptyUnread: 'کوئی غیر پڑھی چیٹ نہیں',
        emptyGroups: 'کوئی گروپ نہیں',
        favorites: 'پسندیدہ',
        favoriteMessage: 'پیغام',
        favoriteMessages: 'پیغامات',
        emptyFavorites: 'ابھی کوئی پسندیدہ پیغام نہیں',
        export: 'برآمد',
        archive: 'آرکائیو',
        unarchive: 'آرکائیو سے نکالیں',
        archived: 'آرکائیو شدہ',
        emptyArchive: 'کوئی آرکائیو شدہ چیٹ نہیں',
        chatArchived: 'چیٹ آرکائیو ہو گئی'
    },
    contacts: {
        title: 'رابطے',
        manage: 'انتظام',
        scanQr: 'QR اسکین کریں',
        scanQrAria: 'رابطے کا QR کوڈ اسکین کریں',
        emptyHint: 'اگر کوئی رابطہ نظر نہ آئے تو شامل کرنے کے لیے انتظام پر کلک کریں۔',
        selectPrompt: 'چیٹ شروع کرنے کے لیے رابطہ منتخب کریں',
        youPrefix: 'آپ',
        mediaPreview: {
            image: 'تصویر',
            video: 'ویڈیو',
            voiceMessage: 'صوتی پیغام',
            audio: 'آڈیو',
            file: 'فائل',
            location: 'مقام'
        }
    },
    connection: {
        relaysLabel: 'ریلے:',
        authLabel: 'تصدیق:',
        authFailedLabel: 'ناکام:'
    },
    sync: {
        title: 'پیغامات ہم آہنگ ہو رہے ہیں...',
        fetched: '{count} حاصل کیے',
        errorTitle: 'ہم آہنگی ناکام',
        timeoutError: '5 منٹ کے بعد ہم آہنگی کا وقت ختم ہو گیا',
        relayErrorsTitle: 'ریلے کی خرابیاں',
        retryButton: 'دوبارہ کوشش کریں',
        skipButton: 'چھوڑ کر آگے بڑھیں',
        continueInBackground: 'پس منظر میں جاری رکھیں',
        backgroundComplete: 'ہم آہنگی مکمل ہو گئی',
        manualRelay: {
            label: 'یا دستی طور پر ریلے درج کریں',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'جوڑیں',
            connecting: 'جوڑ رہا ہے...',
            invalidUrl: 'ریلے کا URL غلط ہے'
        },
        steps: {
            connectDiscoveryRelays: 'دریافتی ریلے سے جوڑیں',
            fetchMessagingRelays: 'صارف کے پیغام رسانی ریلے حاصل اور کیش کریں',
            connectReadRelays: 'صارف کے پیغام رسانی ریلے سے جوڑیں',
            fetchHistory: 'ریلے سے تاریخ کی اشیاء حاصل اور کیش کریں',
            fetchContacts: 'ریلے سے رابطے حاصل اور ضم کریں',
            fetchContactProfiles: 'رابطوں کی پروفائلز اور ریلے معلومات حاصل اور کیش کریں',
            fetchUserProfile: 'صارف کی پروفائل حاصل اور کیش کریں'
        }
    },
    modals: {
        manageContacts: {
            title: 'رابطے',
            scanQr: 'QR اسکین کریں',
            scanQrAria: 'رابطہ شامل کرنے کے لیے QR کوڈ اسکین کریں',
            searchPlaceholder: 'npub، NIP-05، یا تلاش کی اصطلاح',
            addContactAria: 'رابطہ شامل کریں',
            searchContactsAria: 'رابطے تلاش کریں',
            searching: 'تلاش ہو رہی ہے...',
            searchFailed: 'تلاش ناکام ہو گئی',
            noResults: 'کوئی نتیجہ نہیں',
            noContacts: 'کوئی رابطہ شامل نہیں',
            removeContactAria: 'رابطہ ہٹائیں',
            resolvingNip05: 'NIP-05 تلاش ہو رہا ہے...',
            nip05LookupFailed: 'NIP-05 تلاش ناکام ہو گئی',
            nip05NotFound: 'NIP-05 نہیں ملا',
            nip05InvalidFormat: 'NIP-05 کی شکل غلط ہے (name@domain.com استعمال کریں)',
            alreadyAdded: 'پہلے سے شامل ہے',
            syncing: 'رابطے ہم آہنگ ہو رہے ہیں…',
            pullToRefresh: 'تازہ کرنے کے لیے نیچے کھینچیں',
            releaseToRefresh: 'تازہ کرنے کے لیے چھوڑیں',
            newContact: 'رابطہ شامل کریں',
            createGroup: 'گروپ بنائیں',
            contextMenu: {
                openMenu: 'مینو کھولیں',
                viewProfile: 'پروفائل دیکھیں',
                delete: 'حذف کریں'
            },
            confirmDelete: {
                title: 'رابطہ حذف کریں',
                message: 'کیا آپ واقعی {name} کو حذف کرنا چاہتے ہیں؟',
                confirm: 'حذف کریں'
            }
        },
        createGroup: {
            title: 'گروپ چیٹ بنائیں',
            searchPlaceholder: 'رابطے تلاش کریں',
            selectedCount: '{count} منتخب',
            minContactsHint: 'کم از کم 2 رابطے منتخب کریں',
            createButton: 'گروپ بنائیں',
            creating: 'بنایا جا رہا ہے...',
            noContacts: 'گروپ میں شامل کرنے کے لیے کوئی رابطہ نہیں'
        },
        profile: {
            unknownName: 'نامعلوم',
            about: 'تعارف',
            publicKey: 'عوامی کلید',
            messagingRelays: 'پیغام رسانی ریلے',
            noRelays: 'کوئی نہیں',
            refreshing: 'پروفائل تازہ ہو رہی ہے…',
            notFound: 'پروفائل نہیں ملی',
            addToContacts: 'رابطوں میں شامل کریں',
            addingContact: 'شامل ہو رہا ہے…',
            contactAdded: 'رابطہ شامل ہو گیا'
        },
        emptyProfile: {
            title: 'اپنی پروفائل مکمل کریں',
            introLine1: 'اس کلید میں ابھی تک کوئی پیغام رسانی ریلے یا صارف نام ترتیب نہیں دیا گیا۔',
            introLine2: 'ہم کچھ پہلے سے طے شدہ پیغام رسانی ریلے ترتیب دیں گے تاکہ nospeak پیغامات بھیج اور وصول کر سکے۔ آپ بعد میں ترتیبات میں پیغام رسانی ریلے کے تحت انہیں تبدیل کر سکتے ہیں۔',
            usernameLabel: 'صارف نام',
            usernamePlaceholder: 'آپ کا نام',
            usernameRequired: 'جاری رکھنے کے لیے صارف نام درج کریں۔',
            saveError: 'ابتدائی ترتیب محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔',
            doLater: 'میں یہ بعد میں کروں گا',
            saving: 'محفوظ ہو رہا ہے...',
            continue: 'جاری رکھیں',
            autoRelaysConfigured: 'پیغام رسانی ریلے ترتیب دیے گئے۔ آپ انہیں ترتیبات میں تبدیل کر سکتے ہیں۔'
        },
        relayStatus: {
            title: 'ریلے کنکشنز',
            noRelays: 'کوئی ریلے ترتیب نہیں دیا گیا',
            connected: 'جڑا ہوا',
            disconnected: 'منقطع',
            typeLabel: 'قسم:',
            lastConnectedLabel: 'آخری کنکشن:',
            successLabel: 'کامیاب:',
            failureLabel: 'ناکامیاں:',
            authLabel: 'تصدیق:',
            authErrorLabel: 'تصدیق کی خرابی:',
            authNotRequired: 'ضرورت نہیں',
            authRequired: 'ضروری ہے',
            authAuthenticating: 'تصدیق ہو رہی ہے',
            authAuthenticated: 'تصدیق شدہ',
            authFailed: 'ناکام',
            typePersistent: 'مستقل',
            typeTemporary: 'عارضی',
            never: 'کبھی نہیں'
        },
        qr: {
            title: 'QR کوڈ',
            tabs: {
                myQr: 'میرا کوڈ',
                scanQr: 'کوڈ اسکین کریں'
            }
        },
        userQr: {
            preparing: 'QR کوڈ تیار ہو رہا ہے…',
            hint: 'یہ آپ کا npub بطور QR کوڈ ہے۔ اسے کسی کے ساتھ شیئر کریں تاکہ وہ آپ کو رابطے کے طور پر شامل کر سکیں۔'
        },
        scanContactQr: {
            title: 'رابطے کا QR اسکین کریں',
            instructions: 'رابطہ شامل کرنے کے لیے اپنا کیمرہ Nostr QR کوڈ کی طرف رکھیں۔',
            scanning: 'اسکین ہو رہا ہے…',
            noCamera: 'اس آلے پر کیمرہ دستیاب نہیں ہے۔',
            invalidQr: 'اس QR کوڈ میں درست رابطے کا npub نہیں ہے۔',
            addFailed: 'اس QR سے رابطہ شامل نہیں ہو سکا۔ دوبارہ کوشش کریں۔',
            added: 'QR سے رابطہ شامل ہو گیا۔'
        },
        scanContactQrResult: {
            title: 'QR سے رابطہ',
            alreadyContact: 'یہ رابطہ پہلے سے آپ کے رابطوں میں ہے۔',
            reviewHint: 'شامل کرنے سے پہلے اسکین شدہ QR سے رابطے کا جائزہ لیں۔',
            updatingProfile: 'پروفائل اپ ڈیٹ ہو رہی ہے…',
            loadFailed: 'QR سے رابطے کی تفصیلات لوڈ نہیں ہو سکیں۔',
            addFailed: 'QR سے رابطہ شامل نہیں ہو سکا۔',
            closeButton: 'بند کریں',
            addButton: 'رابطہ شامل کریں',
            startChatButton: 'چیٹ شروع کریں'
        },
        attachmentPreview: {
            title: 'منسلکہ کا پیش نظارہ',
            imageAlt: 'منسلکہ کا پیش نظارہ',
            noPreview: 'پیش نظارہ دستیاب نہیں',
            captionLabel: 'عنوان (اختیاری)',
            cancelButton: 'منسوخ کریں',
            sendButtonIdle: 'بھیجیں',
            sendButtonSending: 'بھیجا جا رہا ہے…',
            uploadButtonIdle: 'اپ لوڈ کریں',
            uploadButtonUploading: 'اپ لوڈ ہو رہا ہے…'
        },
        locationPreview: {
            title: 'مقام',
            closeButton: 'بند کریں',
            openInOpenStreetMap: 'OpenStreetMap میں کھولیں',
            ctrlScrollToZoom: 'زوم کرنے کے لیے Ctrl + اسکرول استعمال کریں'
        },
        mediaServersAutoConfigured: {
            title: 'میڈیا سرورز ترتیب دیے گئے',
            message: 'کوئی Blossom سرور ترتیب نہیں تھا۔ ہم نے {server1} اور {server2} شامل کیے ہیں۔\n\nآپ انہیں ترتیبات ← میڈیا سرورز میں تبدیل کر سکتے ہیں۔'
        }
    },
    chat: {
        sendFailedTitle: 'بھیجنا ناکام',
        sendFailedMessagePrefix: 'پیغام بھیجنے میں ناکامی: ',
        location: {
            errorTitle: 'مقام کی خرابی',
            errorMessage: 'آپ کا مقام حاصل نہیں ہو سکا۔ اجازتیں چیک کریں۔'
        },
        relative: {
            justNow: 'ابھی ابھی',
            minutes: '{count} منٹ پہلے',
            minutesPlural: '{count} منٹ پہلے',
            hours: '{count} گھنٹہ پہلے',
            hoursPlural: '{count} گھنٹے پہلے',
            days: '{count} دن پہلے',
            daysPlural: '{count} دن پہلے',
            weeks: '{count} ہفتہ پہلے',
            weeksPlural: '{count} ہفتے پہلے',
            months: '{count} مہینہ پہلے',
            monthsPlural: '{count} مہینے پہلے',
            years: '{count} سال پہلے',
            yearsPlural: '{count} سال پہلے'
        },
        dateLabel: {
            today: 'آج',
            yesterday: 'کل'
        },
        history: {
            fetchOlder: 'ریلے سے پرانے پیغامات حاصل کریں',
            summary: '{events} ایونٹس حاصل ہوئے، {saved} نئے پیغامات محفوظ ہوئے ({chat} اس چیٹ میں)',
            none: 'ریلے سے مزید پیغامات دستیاب نہیں',
            error: 'پرانے پیغامات حاصل نہیں ہو سکے۔ بعد میں دوبارہ کوشش کریں۔'
        },
        empty: {
            noMessagesTitle: 'ابھی کوئی پیغام نہیں',
            forContact: '{name} کے ساتھ گفتگو شروع کریں۔',
            forGroup: '{name} میں گفتگو شروع کریں۔',
            generic: 'چیٹ شروع کرنے کے لیے رابطہ منتخب کریں۔'
        },
        group: {
            defaultTitle: 'گروپ چیٹ',
            participants: '{count} شرکاء',
            participantsShort: '{count}',
            members: 'اراکین: {count}',
            membersTitle: 'اراکین',
            viewMembers: 'اراکین دیکھیں',
            editName: 'گروپ کا نام تبدیل کریں',
            editNameTitle: 'گروپ کا نام',
            editNamePlaceholder: 'گروپ کا نام درج کریں...',
            editNameHint: 'شرکاء کے نام استعمال کرنے کے لیے خالی چھوڑیں',
            editNameSave: 'محفوظ کریں',
            editNameCancel: 'منسوخ کریں',
            nameSavedToast: 'محفوظ ہو گیا۔ اگلے پیغام کے ساتھ لاگو ہو گا۔',
            nameValidationTooLong: 'نام بہت لمبا ہے (زیادہ سے زیادہ 100 حروف)',
            nameValidationInvalidChars: 'نام میں غلط حروف ہیں'
        },
        inputPlaceholder: 'پیغام لکھیں...',
        contextMenu: {
            cite: 'حوالہ دیں',
            copy: 'کاپی کریں',
            sentAt: 'بھیجا گیا',
            favorite: 'پسندیدہ',
            unfavorite: 'پسندیدہ ہٹائیں'
        },
        reactions: {
            cannotReactTitle: 'ردعمل نہیں دے سکتے',
            cannotReactMessage: 'یہ پیغام بہت پرانا ہے اور ردعمل کی حمایت نہیں کرتا۔',
            failedTitle: 'ردعمل ناکام',
            failedMessagePrefix: 'ردعمل بھیجنے میں ناکامی: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'میڈیا اپ لوڈ کریں',
            takePhoto: 'تصویر لیں',
            location: 'مقام',
            image: 'تصویر',
            video: 'ویڈیو',
            audio: 'موسیقی',
            file: 'فائل'
        },
        mediaErrors: {
            cameraErrorTitle: 'کیمرے کی خرابی',
            cameraErrorMessage: 'تصویر لینے میں ناکامی'
        },
        fileUpload: {
            fileTooLarge: 'فائل بہت بڑی ہے۔ زیادہ سے زیادہ سائز 10 MB ہے۔',
            download: 'ڈاؤن لوڈ',
            decrypting: 'ڈکرپٹ ہو رہا ہے...'
        },
        mediaUnavailable: 'یہ میڈیا اب دستیاب نہیں ہے۔',
        voiceMessage: {
            title: 'صوتی پیغام',
            recordAria: 'صوتی پیغام ریکارڈ کریں',
            playPreviewAria: 'پیش نظارہ چلائیں',
            pausePreviewAria: 'پیش نظارہ روکیں',
            cancelButton: 'منسوخ کریں',
            pauseButton: 'روکیں',
            doneButton: 'مکمل',
            resumeButton: 'دوبارہ شروع کریں',
            sendButton: 'بھیجیں',
            microphoneTitle: 'مائیکروفون',
            permissionDeniedTitle: 'مائیکروفون کی اجازت',
            permissionDeniedMessage: 'ریکارڈنگ کے لیے مائیکروفون تک رسائی کی اجازت دیں۔',
            nativeNotAvailable: 'مقامی ریکارڈنگ دستیاب نہیں ہے۔',
            unsupported: 'اس آلے پر صوتی ریکارڈنگ کی حمایت نہیں ہے۔',
            failedToStart: 'ریکارڈنگ شروع نہیں ہو سکی۔',
            failedToStop: 'ریکارڈنگ بند نہیں ہو سکی۔',
            recordingFailed: 'ریکارڈنگ ناکام ہو گئی۔'
        },
        relayStatus: {
            sending: 'بھیجا جا رہا ہے...',
            sentToRelays: '{successful}/{desired} ریلے کو بھیجا گیا'
        },
        searchPlaceholder: 'تلاش کریں',
        searchNoMatches: 'کوئی نتیجہ نہیں',
        searchAriaLabel: 'چیٹ میں تلاش کریں'
    },
    settings: {
        title: 'ترتیبات',
        categories: {
            general: 'عمومی',
            profile: 'پروفائل',
            messagingRelays: 'پیغام رسانی ریلے',
            mediaServers: 'میڈیا سرورز',
            security: 'سیکیورٹی',
            about: 'کے بارے میں'
        },
        general: {
            appearanceLabel: 'ظاہری شکل',
            appearanceDescription: 'سسٹم، ہلکا، یا تاریک موڈ منتخب کریں۔',
            languageLabel: 'زبان',
            languageDescription: 'اپنی پسندیدہ ایپ کی زبان منتخب کریں۔'
        },
        notifications: {
            label: 'اطلاعات',
            supportedDescription: 'اس آلے پر نئے پیغامات موصول ہونے پر مطلع ہوں',
            unsupportedDescription: 'اس آلے پر اطلاعات کی حمایت نہیں ہے'
        },
        backgroundMessaging: {
            label: 'پس منظر پیغام رسانی',
            description: 'nospeak کو آپ کے پیغام رسانی ریلے سے جوڑے رکھیں اور ایپ پس منظر میں ہونے پر پیغام/ردعمل کی اطلاعات وصول کریں۔ اینڈرائیڈ اس کے فعال ہونے پر ایک مستقل اطلاع دکھائے گا۔ مقامی کلید (nsec) اور Amber دونوں لاگ ان کے ساتھ کام کرتا ہے۔ اطلاعات کے پیش نظارے آپ کی اینڈرائیڈ لاک اسکرین پرائیویسی ترتیبات سے محدود ہو سکتے ہیں۔',
            openBatterySettings: 'بیٹری کی ترتیبات کھولیں'
        },
        urlPreviews: {
            label: 'URL پیش نظارے',
            description: 'پیغامات میں غیر میڈیا لنکس کے لیے پیش نظارہ کارڈ دکھائیں۔'
        },
        profile: {
            nameLabel: 'نام',
            namePlaceholder: 'آپ کا نام',
            displayNameLabel: 'ظاہری نام',
            displayNamePlaceholder: 'ظاہری نام',
            aboutLabel: 'تعارف',
            aboutPlaceholder: 'اپنے بارے میں بتائیں',
            pictureUrlLabel: 'تصویر کا URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'بینر کا URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (صارف نام)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'ویب سائٹ',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning ایڈریس (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'تبدیلیاں محفوظ کریں',
            savingButton: 'محفوظ ہو رہا ہے...'
        },
        messagingRelays: {
            description: 'اپنے NIP-17 پیغام رسانی ریلے ترتیب دیں۔ یہ ریلے آپ کے خفیہ پیغامات وصول کرنے کے لیے استعمال ہوتے ہیں۔ بہترین کارکردگی کے لیے عام طور پر 2 پیغام رسانی ریلے کافی ہیں۔',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'شامل کریں',
            emptyState: 'کوئی ریلے ترتیب نہیں دیا گیا',
            tooManyWarning: '3 سے زیادہ پیغام رسانی ریلے ہونے سے کارکردگی اور قابل اعتمادی کم ہو سکتی ہے۔',
            saveStatusSuccess: 'ریلے فہرست {count} ریلے کو محفوظ کی گئی۔',
            saveStatusPartial: 'ریلے فہرست {attempted} میں سے {succeeded} ریلے کو محفوظ کی گئی۔',
            saveStatusNone: 'ریلے فہرست کسی بھی ریلے کو محفوظ نہیں ہو سکی۔',
            saveStatusError: 'ریلے فہرست محفوظ کرنے میں خرابی۔ آپ کی ترتیبات مکمل طور پر پھیلائی نہیں جا سکیں۔',
            savingStatus: 'ریلے کی ترتیبات محفوظ ہو رہی ہیں…'
        },
        mediaServers: {
            description: 'اپنے Blossom میڈیا سرورز ترتیب دیں۔ یہ سرورز آپ کی اپ لوڈ کردہ فائلیں (پروفائل میڈیا اور چیٹ منسلکات) ذخیرہ کرنے کے لیے استعمال ہوتے ہیں۔',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'شامل کریں',
            emptyState: 'کوئی سرور ترتیب نہیں دیا گیا',
            saveStatusSuccess: 'سرور فہرست {count} ریلے کو محفوظ کی گئی۔',
            saveStatusPartial: 'سرور فہرست {attempted} میں سے {succeeded} ریلے کو محفوظ کی گئی۔',
            saveStatusNone: 'سرور فہرست کسی بھی ریلے کو محفوظ نہیں ہو سکی۔',
            saveStatusError: 'سرور فہرست محفوظ کرنے میں خرابی۔ آپ کی ترتیبات مکمل طور پر پھیلائی نہیں جا سکیں۔',
            savingStatus: 'میڈیا سرور کی ترتیبات محفوظ ہو رہی ہیں…',
            primary: 'بنیادی',
            setAsPrimary: 'بنیادی بنائیں',
            mediaCacheLabel: 'میڈیا کیش',
            mediaCacheDescription: 'آف لائن رسائی کے لیے دیکھے گئے میڈیا کو اپنی گیلری میں محفوظ کریں۔ فائلیں آپ کی فوٹوز ایپ میں منظم کی جا سکتی ہیں۔'
        },
        security: {
            loginMethodTitle: 'لاگ ان کا طریقہ',
            loginMethodUnknown: 'نامعلوم',
            npubLabel: 'آپ کا npub',
            nsecLabel: 'آپ کا nsec',
            hideNsecAria: 'nsec چھپائیں',
            showNsecAria: 'nsec دکھائیں',
            dangerZoneTitle: 'خطرناک علاقہ',
            dangerZoneDescription: 'لاگ آؤٹ کرنے سے اس آلے سے تمام کیش شدہ ڈیٹا ہٹ جائے گا۔',
            logoutButton: 'لاگ آؤٹ'
        },
        pin: {
            appLockLabel: 'ایپ لاک',
            appLockDescription: 'ایپ تک رسائی کے لیے PIN درکار ہو',
            changePinButton: 'PIN تبدیل کریں',
            enterNewPin: 'PIN مقرر کریں',
            enterNewPinDescription: '4 ہندسوں کا PIN درج کریں',
            confirmPin: 'PIN کی تصدیق کریں',
            confirmPinDescription: 'وہی PIN دوبارہ درج کریں',
            enterCurrentPin: 'PIN درج کریں',
            enterCurrentPinDescription: 'اپنا موجودہ PIN درج کریں',
            wrongPin: 'غلط PIN',
            pinMismatch: 'PIN مماثل نہیں ہیں، دوبارہ کوشش کریں',
            enterPinToUnlock: 'انلاک کرنے کے لیے PIN درج کریں'
        }
    },
    signerMismatch: {
        title: 'اکاؤنٹ کا عدم مطابقت',
        description: 'آپ کے براؤزر کی سائنر ایکسٹینشن میں جس اکاؤنٹ سے آپ نے لاگ ان کیا تھا اس سے مختلف اکاؤنٹ فعال ہے۔',
        expectedAccount: 'لاگ ان بطور',
        actualAccount: 'سائنر کا فعال اکاؤنٹ',
        instructions: 'براہ کرم اپنی سائنر ایکسٹینشن میں درست اکاؤنٹ پر سوئچ کریں اور یہ صفحہ دوبارہ لوڈ کریں۔'
    }
};

export default ur;
