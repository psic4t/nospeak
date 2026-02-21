const ar = {
    common: {
        appName: 'nospeak',
        save: 'حفظ',
        cancel: 'إلغاء'
    },
    auth: {
        loginWithAmber: 'تسجيل الدخول باستخدام Amber',
        loginWithExtension: 'تسجيل الدخول باستخدام إضافة Nostr للتوقيع',
        orSeparator: 'أو',
        loginWithNsecLabel: 'تسجيل الدخول باستخدام nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'تسجيل الدخول',
        connecting: 'جارٍ الاتصال...',
        generateKeypairLink: 'إنشاء زوج مفاتيح جديد',
        downloadAndroidApp: 'تحميل تطبيق أندرويد',
        amber: {
            title: 'تسجيل الدخول باستخدام Amber',
            helper: 'امسح رمز QR هذا باستخدام Amber أو استخدم الأزرار أدناه.',
            openInAmber: 'فتح في Amber',
            copyConnectionString: 'نسخ سلسلة الاتصال',
            copied: 'تم النسخ!'
        },
        keypair: {
            title: 'إنشاء زوج مفاتيح جديد',
            description: 'يتم إنشاء زوج مفاتيح Nostr جديد محليًا في متصفحك.',
            npubLabel: 'npub (المفتاح العام)',
            nsecLabel: 'nsec (المفتاح السري)',
            generateAnother: 'إنشاء زوج آخر',
            useAndLogin: 'استخدام زوج المفاتيح هذا وتسجيل الدخول'
        }
    },
    chats: {
        title: 'المحادثات',
        emptyHint: 'لا توجد محادثات بعد. اضغط + لإضافة جهة اتصال.',
        selectPrompt: 'اختر محادثة لبدء المراسلة',
        addContact: 'إضافة جهة اتصال',
        filterAll: 'الكل',
        filterUnread: 'غير مقروءة',
        filterGroups: 'المجموعات',
        emptyUnread: 'لا توجد محادثات غير مقروءة',
        emptyGroups: 'لا توجد مجموعات',
        favorites: 'المفضلة',
        favoriteMessage: 'رسالة',
        favoriteMessages: 'رسائل',
        emptyFavorites: 'لا توجد رسائل مفضلة بعد',
        archive: 'أرشفة',
        unarchive: 'إلغاء الأرشفة',
        archived: 'المؤرشفة',
        emptyArchive: 'لا توجد محادثات مؤرشفة',
        chatArchived: 'تمت أرشفة المحادثة'
    },
    contacts: {
        title: 'جهات الاتصال',
        manage: 'إدارة',
        scanQr: 'مسح QR',
        scanQrAria: 'مسح رمز QR لجهة الاتصال',
        emptyHint: 'إذا لم تظهر جهات اتصال، انقر على إدارة لإضافة بعضها.',
        selectPrompt: 'اختر جهة اتصال لبدء الدردشة',
        youPrefix: 'أنت',
        mediaPreview: {
            image: 'صورة',
            video: 'فيديو',
            voiceMessage: 'رسالة صوتية',
            audio: 'صوت',
            file: 'ملف',
            location: 'موقع'
        }
    },
    connection: {
        relaysLabel: 'المُرحّلات:',
        authLabel: 'المصادقة:',
        authFailedLabel: 'فشلت:'
    },
    sync: {
        title: 'جارٍ مزامنة الرسائل...',
        fetched: 'تم جلب {count}',
        errorTitle: 'فشلت المزامنة',
        timeoutError: 'انتهت مهلة المزامنة بعد 5 دقائق',
        relayErrorsTitle: 'أخطاء المُرحّلات',
        retryButton: 'إعادة المحاولة',
        skipButton: 'تخطي والمتابعة',
        continueInBackground: 'المتابعة في الخلفية',
        backgroundComplete: 'اكتملت المزامنة',
        manualRelay: {
            label: 'أو أدخل مُرحّلًا يدويًا',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'اتصال',
            connecting: 'جارٍ الاتصال...',
            invalidUrl: 'عنوان URL للمُرحّل غير صالح'
        },
        steps: {
            connectDiscoveryRelays: 'الاتصال بمُرحّلات الاكتشاف',
            fetchMessagingRelays: 'جلب وتخزين مُرحّلات المراسلة للمستخدم',
            connectReadRelays: 'الاتصال بمُرحّلات المراسلة للمستخدم',
            fetchHistory: 'جلب وتخزين سجل العناصر من المُرحّلات',
            fetchContacts: 'جلب ودمج جهات الاتصال من المُرحّلات',
            fetchContactProfiles: 'جلب وتخزين ملفات جهات الاتصال ومعلومات المُرحّلات',
            fetchUserProfile: 'جلب وتخزين ملف المستخدم الشخصي'
        }
    },
    modals: {
        manageContacts: {
            title: 'جهات الاتصال',
            scanQr: 'مسح QR',
            scanQrAria: 'مسح رمز QR لإضافة جهة اتصال',
            searchPlaceholder: 'npub أو NIP-05 أو مصطلح بحث',
            addContactAria: 'إضافة جهة اتصال',
            searchContactsAria: 'البحث في جهات الاتصال',
            searching: 'جارٍ البحث...',
            searchFailed: 'فشل البحث',
            noResults: 'لا توجد نتائج',
            noContacts: 'لم تتم إضافة جهات اتصال',
            removeContactAria: 'إزالة جهة الاتصال',
            resolvingNip05: 'جارٍ البحث عن NIP-05...',
            nip05LookupFailed: 'فشل البحث عن NIP-05',
            nip05NotFound: 'لم يتم العثور على NIP-05',
            nip05InvalidFormat: 'تنسيق NIP-05 غير صالح (استخدم name@domain.com)',
            alreadyAdded: 'مُضاف بالفعل',
            syncing: 'جارٍ مزامنة جهات الاتصال…',
            pullToRefresh: 'اسحب للتحديث',
            releaseToRefresh: 'أفلت للتحديث',
            newContact: 'إضافة جهة اتصال',
            createGroup: 'إنشاء مجموعة',
            contextMenu: {
                openMenu: 'فتح القائمة',
                delete: 'حذف'
            },
            confirmDelete: {
                title: 'حذف جهة الاتصال',
                message: 'هل أنت متأكد أنك تريد حذف {name}؟',
                confirm: 'حذف'
            }
        },
        createGroup: {
            title: 'إنشاء محادثة جماعية',
            searchPlaceholder: 'البحث في جهات الاتصال',
            selectedCount: 'تم اختيار {count}',
            minContactsHint: 'اختر جهتي اتصال على الأقل',
            createButton: 'إنشاء المجموعة',
            creating: 'جارٍ الإنشاء...',
            noContacts: 'لا توجد جهات اتصال لإضافتها إلى المجموعة'
        },
        profile: {
            unknownName: 'غير معروف',
            about: 'نبذة',
            publicKey: 'المفتاح العام',
            messagingRelays: 'مُرحّلات المراسلة',
            noRelays: 'لا يوجد',
            refreshing: 'جارٍ تحديث الملف الشخصي…',
            notFound: 'لم يتم العثور على الملف الشخصي',
            addToContacts: 'إضافة إلى جهات الاتصال',
            addingContact: 'جارٍ الإضافة…',
            contactAdded: 'تمت إضافة جهة الاتصال'
        },
        emptyProfile: {
            title: 'أكمل إعداد ملفك الشخصي',
            introLine1: 'لا يحتوي هذا المفتاح على مُرحّلات مراسلة أو اسم مستخدم مُعدّ بعد.',
            introLine2: 'سنقوم بإعداد بعض مُرحّلات المراسلة الافتراضية حتى يتمكن nospeak من إرسال واستقبال الرسائل. يمكنك تغييرها لاحقًا في الإعدادات ضمن مُرحّلات المراسلة.',
            usernameLabel: 'اسم المستخدم',
            usernamePlaceholder: 'اسمك',
            usernameRequired: 'يرجى إدخال اسم مستخدم للمتابعة.',
            saveError: 'تعذر حفظ الإعداد الأولي. يرجى المحاولة مرة أخرى.',
            doLater: 'سأفعل هذا لاحقًا',
            saving: 'جارٍ الحفظ...',
            continue: 'متابعة',
            autoRelaysConfigured: 'تم إعداد مُرحّلات المراسلة. يمكنك تغييرها في الإعدادات.'
        },
        relayStatus: {
            title: 'اتصالات المُرحّلات',
            noRelays: 'لم يتم إعداد مُرحّلات',
            connected: 'متصل',
            disconnected: 'غير متصل',
            typeLabel: 'النوع:',
            lastConnectedLabel: 'آخر اتصال:',
            successLabel: 'نجاح:',
            failureLabel: 'إخفاقات:',
            authLabel: 'المصادقة:',
            authErrorLabel: 'خطأ المصادقة:',
            authNotRequired: 'غير مطلوبة',
            authRequired: 'مطلوبة',
            authAuthenticating: 'جارٍ المصادقة',
            authAuthenticated: 'تمت المصادقة',
            authFailed: 'فشلت',
            typePersistent: 'دائم',
            typeTemporary: 'مؤقت',
            never: 'أبدًا'
        },
        qr: {
            title: 'رمز QR',
            tabs: {
                myQr: 'رمزي',
                scanQr: 'مسح رمز'
            }
        },
        userQr: {
            preparing: 'جارٍ تحضير رمز QR…',
            hint: 'هذا هو npub الخاص بك كرمز QR. شاركه مع شخص ما ليتمكن من مسحه وإضافتك كجهة اتصال.'
        },
        scanContactQr: {
            title: 'مسح QR جهة الاتصال',
            instructions: 'وجّه الكاميرا نحو رمز QR خاص بـ Nostr لإضافة جهة اتصال.',
            scanning: 'جارٍ المسح…',
            noCamera: 'الكاميرا غير متاحة على هذا الجهاز.',
            invalidQr: 'لا يحتوي رمز QR هذا على npub صالح لجهة اتصال.',
            addFailed: 'تعذرت إضافة جهة اتصال من رمز QR هذا. يرجى المحاولة مرة أخرى.',
            added: 'تمت إضافة جهة الاتصال من QR.'
        },
        scanContactQrResult: {
            title: 'جهة اتصال من QR',
            alreadyContact: 'جهة الاتصال هذه موجودة بالفعل في جهات اتصالك.',
            reviewHint: 'راجع جهة الاتصال من رمز QR الممسوح قبل الإضافة.',
            updatingProfile: 'جارٍ تحديث الملف الشخصي…',
            loadFailed: 'فشل تحميل تفاصيل جهة الاتصال من QR.',
            addFailed: 'فشلت إضافة جهة الاتصال من QR.',
            closeButton: 'إغلاق',
            addButton: 'إضافة جهة اتصال',
            startChatButton: 'بدء محادثة'
        },
        attachmentPreview: {
            title: 'معاينة المرفق',
            imageAlt: 'معاينة المرفق',
            noPreview: 'المعاينة غير متاحة',
            captionLabel: 'تعليق (اختياري)',
            cancelButton: 'إلغاء',
            sendButtonIdle: 'إرسال',
            sendButtonSending: 'جارٍ الإرسال…',
            uploadButtonIdle: 'رفع',
            uploadButtonUploading: 'جارٍ الرفع…'
        },
        locationPreview: {
            title: 'الموقع',
            closeButton: 'إغلاق',
            openInOpenStreetMap: 'فتح في OpenStreetMap',
            ctrlScrollToZoom: 'استخدم Ctrl + التمرير للتكبير'
        },
        mediaServersAutoConfigured: {
            title: 'تم إعداد خوادم الوسائط',
            message: 'لم تكن هناك خوادم Blossom مُعدّة. أضفنا {server1} و {server2}.\n\nيمكنك تغييرها في الإعدادات → خوادم الوسائط.'
        }
    },
    chat: {
        sendFailedTitle: 'فشل الإرسال',
        sendFailedMessagePrefix: 'فشل إرسال الرسالة: ',
        location: {
            errorTitle: 'خطأ في الموقع',
            errorMessage: 'فشل الحصول على موقعك. يرجى التحقق من الأذونات.'
        },
        relative: {
            justNow: 'الآن',
            minutes: 'منذ {count} دقيقة',
            minutesPlural: 'منذ {count} دقائق',
            hours: 'منذ {count} ساعة',
            hoursPlural: 'منذ {count} ساعات',
            days: 'منذ {count} يوم',
            daysPlural: 'منذ {count} أيام',
            weeks: 'منذ {count} أسبوع',
            weeksPlural: 'منذ {count} أسابيع',
            months: 'منذ {count} شهر',
            monthsPlural: 'منذ {count} أشهر',
            years: 'منذ {count} سنة',
            yearsPlural: 'منذ {count} سنوات'
        },
        dateLabel: {
            today: 'اليوم',
            yesterday: 'أمس'
        },
        history: {
            fetchOlder: 'جلب رسائل أقدم من المُرحّلات',
            summary: 'تم جلب {events} حدث، وحُفظت {saved} رسالة جديدة ({chat} في هذه المحادثة)',
            none: 'لا تتوفر رسائل إضافية من المُرحّلات',
            error: 'فشل جلب الرسائل الأقدم. حاول مرة أخرى لاحقًا.'
        },
        empty: {
            noMessagesTitle: 'لا توجد رسائل بعد',
            forContact: 'ابدأ المحادثة مع {name}.',
            forGroup: 'ابدأ المحادثة في {name}.',
            generic: 'اختر جهة اتصال لبدء الدردشة.'
        },
        group: {
            defaultTitle: 'محادثة جماعية',
            participants: '{count} مشاركين',
            participantsShort: '{count}',
            members: 'الأعضاء: {count}',
            membersTitle: 'الأعضاء',
            viewMembers: 'عرض الأعضاء',
            editName: 'تعديل اسم المجموعة',
            editNameTitle: 'اسم المجموعة',
            editNamePlaceholder: 'أدخل اسم المجموعة...',
            editNameHint: 'اتركه فارغًا لاستخدام أسماء المشاركين',
            editNameSave: 'حفظ',
            editNameCancel: 'إلغاء',
            nameSavedToast: 'تم الحفظ. سيتم تعيينه مع الرسالة التالية.',
            nameValidationTooLong: 'الاسم طويل جدًا (الحد الأقصى 100 حرف)',
            nameValidationInvalidChars: 'يحتوي الاسم على أحرف غير صالحة'
        },
        inputPlaceholder: 'اكتب رسالة...',
        contextMenu: {
            cite: 'اقتباس',
            copy: 'نسخ',
            sentAt: 'أُرسلت',
            favorite: 'تفضيل',
            unfavorite: 'إزالة التفضيل'
        },
        reactions: {
            cannotReactTitle: 'لا يمكن التفاعل',
            cannotReactMessage: 'هذه الرسالة قديمة جدًا لدعم التفاعلات.',
            failedTitle: 'فشل التفاعل',
            failedMessagePrefix: 'فشل إرسال التفاعل: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'رفع وسائط',
            takePhoto: 'التقاط صورة',
            location: 'الموقع',
            image: 'صورة',
            video: 'فيديو',
            audio: 'موسيقى',
            file: 'ملف'
        },
        mediaErrors: {
            cameraErrorTitle: 'خطأ في الكاميرا',
            cameraErrorMessage: 'فشل التقاط الصورة'
        },
        fileUpload: {
            fileTooLarge: 'الملف كبير جدًا. الحد الأقصى للحجم هو 10 ميغابايت.',
            download: 'تحميل',
            decrypting: 'جارٍ فك التشفير...'
        },
        mediaUnavailable: 'لم تعد هذه الوسائط متاحة.',
        voiceMessage: {
            title: 'رسالة صوتية',
            recordAria: 'تسجيل رسالة صوتية',
            playPreviewAria: 'تشغيل المعاينة',
            pausePreviewAria: 'إيقاف المعاينة مؤقتًا',
            cancelButton: 'إلغاء',
            pauseButton: 'إيقاف مؤقت',
            doneButton: 'تم',
            resumeButton: 'استئناف',
            sendButton: 'إرسال',
            microphoneTitle: 'الميكروفون',
            permissionDeniedTitle: 'إذن الميكروفون',
            permissionDeniedMessage: 'يرجى السماح بالوصول إلى الميكروفون للتسجيل.',
            nativeNotAvailable: 'التسجيل الأصلي غير متاح.',
            unsupported: 'تسجيل الصوت غير مدعوم على هذا الجهاز.',
            failedToStart: 'فشل بدء التسجيل.',
            failedToStop: 'فشل إيقاف التسجيل.',
            recordingFailed: 'فشل التسجيل.'
        },
        relayStatus: {
            sending: 'جارٍ الإرسال...',
            sentToRelays: 'أُرسلت إلى {successful}/{desired} مُرحّلات'
        },
        searchPlaceholder: 'بحث',
        searchNoMatches: 'لا توجد نتائج',
        searchAriaLabel: 'البحث في المحادثة'
    },
    settings: {
        title: 'الإعدادات',
        categories: {
            general: 'عام',
            profile: 'الملف الشخصي',
            messagingRelays: 'مُرحّلات المراسلة',
            mediaServers: 'خوادم الوسائط',
            security: 'الأمان',
            about: 'حول'
        },
        general: {
            appearanceLabel: 'المظهر',
            appearanceDescription: 'اختر بين اتباع النظام أو الوضع الفاتح أو الداكن.',
            languageLabel: 'اللغة',
            languageDescription: 'اختر لغة التطبيق المفضلة لديك.'
        },
        notifications: {
            label: 'الإشعارات',
            supportedDescription: 'احصل على إشعارات عند استلام رسائل جديدة على هذا الجهاز',
            unsupportedDescription: 'الإشعارات غير مدعومة على هذا الجهاز'
        },
        backgroundMessaging: {
            label: 'المراسلة في الخلفية',
            description: 'أبقِ nospeak متصلًا بمُرحّلات المراسلة الخاصة بك واستقبل إشعارات الرسائل والتفاعلات أثناء عمل التطبيق في الخلفية. سيعرض أندرويد إشعارًا دائمًا عند تفعيل هذا الخيار. يعمل مع تسجيل الدخول بالمفتاح المحلي (nsec) وتسجيل الدخول عبر Amber. قد تكون معاينات الإشعارات محدودة بإعدادات خصوصية شاشة القفل في أندرويد.',
            openBatterySettings: 'فتح إعدادات البطارية'
        },
        urlPreviews: {
            label: 'معاينات URL',
            description: 'عرض بطاقات معاينة للروابط غير الوسائطية في الرسائل.'
        },
        profile: {
            nameLabel: 'الاسم',
            namePlaceholder: 'اسمك',
            displayNameLabel: 'الاسم المعروض',
            displayNamePlaceholder: 'الاسم المعروض',
            aboutLabel: 'نبذة',
            aboutPlaceholder: 'أخبرنا عن نفسك',
            pictureUrlLabel: 'رابط الصورة',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'رابط الغلاف',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (اسم المستخدم)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'الموقع الإلكتروني',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'عنوان Lightning (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'حفظ التغييرات',
            savingButton: 'جارٍ الحفظ...'
        },
        messagingRelays: {
            description: 'قم بإعداد مُرحّلات المراسلة NIP-17 الخاصة بك. تُستخدم هذه المُرحّلات لاستقبال رسائلك المشفرة. للحصول على أفضل أداء، يُفضل استخدام مُرحّلَي مراسلة.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'إضافة',
            emptyState: 'لم يتم إعداد مُرحّلات',
            tooManyWarning: 'قد يؤدي وجود أكثر من 3 مُرحّلات مراسلة إلى تقليل الأداء والموثوقية.',
            saveStatusSuccess: 'تم حفظ قائمة المُرحّلات إلى {count} مُرحّلات.',
            saveStatusPartial: 'تم حفظ قائمة المُرحّلات إلى {succeeded} من {attempted} مُرحّلات.',
            saveStatusNone: 'تعذر حفظ قائمة المُرحّلات إلى أي مُرحّل.',
            saveStatusError: 'خطأ في حفظ قائمة المُرحّلات. قد لا يتم نشر إعداداتك بالكامل.',
            savingStatus: 'جارٍ حفظ إعدادات المُرحّلات…'
        },
        mediaServers: {
            description: 'قم بإعداد خوادم الوسائط Blossom الخاصة بك. تُستخدم هذه الخوادم لتخزين الملفات التي ترفعها (وسائط الملف الشخصي ومرفقات المحادثات).',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'إضافة',
            emptyState: 'لم يتم إعداد خوادم',
            saveStatusSuccess: 'تم حفظ قائمة الخوادم إلى {count} مُرحّلات.',
            saveStatusPartial: 'تم حفظ قائمة الخوادم إلى {succeeded} من {attempted} مُرحّلات.',
            saveStatusNone: 'تعذر حفظ قائمة الخوادم إلى أي مُرحّل.',
            saveStatusError: 'خطأ في حفظ قائمة الخوادم. قد لا يتم نشر إعداداتك بالكامل.',
            savingStatus: 'جارٍ حفظ إعدادات خوادم الوسائط…',
            primary: 'أساسي',
            setAsPrimary: 'تعيين كأساسي',
            mediaCacheLabel: 'ذاكرة الوسائط المؤقتة',
            mediaCacheDescription: 'حفظ الوسائط المعروضة في معرض الصور للوصول دون اتصال. يمكن إدارة الملفات في تطبيق الصور.'
        },
        security: {
            loginMethodTitle: 'طريقة تسجيل الدخول',
            loginMethodUnknown: 'غير معروفة',
            npubLabel: 'npub الخاص بك',
            nsecLabel: 'nsec الخاص بك',
            hideNsecAria: 'إخفاء nsec',
            showNsecAria: 'إظهار nsec',
            dangerZoneTitle: 'منطقة الخطر',
            dangerZoneDescription: 'سيؤدي تسجيل الخروج إلى إزالة جميع البيانات المخزنة مؤقتًا من هذا الجهاز.',
            logoutButton: 'تسجيل الخروج'
        },
        pin: {
            appLockLabel: 'قفل التطبيق',
            appLockDescription: 'طلب رمز PIN للوصول إلى التطبيق',
            changePinButton: 'تغيير رمز PIN',
            enterNewPin: 'تعيين رمز PIN',
            enterNewPinDescription: 'أدخل رمز PIN مكون من 4 أرقام',
            confirmPin: 'تأكيد رمز PIN',
            confirmPinDescription: 'أدخل نفس رمز PIN مرة أخرى',
            enterCurrentPin: 'أدخل رمز PIN',
            enterCurrentPinDescription: 'أدخل رمز PIN الحالي',
            wrongPin: 'رمز PIN خاطئ',
            pinMismatch: 'رموز PIN غير متطابقة، حاول مرة أخرى',
            enterPinToUnlock: 'أدخل رمز PIN لفتح القفل'
        }
    },
    signerMismatch: {
        title: 'عدم تطابق الحساب',
        description: 'إضافة التوقيع في متصفحك لديها حساب نشط مختلف عن الحساب الذي سجلت الدخول به.',
        expectedAccount: 'مسجل الدخول باسم',
        actualAccount: 'الحساب النشط في إضافة التوقيع',
        instructions: 'يرجى التبديل إلى الحساب الصحيح في إضافة التوقيع وإعادة تحميل هذه الصفحة.'
    }
};

export default ar;
