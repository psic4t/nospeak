const fa = {
    common: {
        appName: 'nospeak',
        save: 'ذخیره',
        cancel: 'لغو'
    },
    auth: {
        loginWithAmber: 'ورود با Amber',
        loginWithExtension: 'ورود با افزونه امضاکننده Nostr',
        orSeparator: 'یا',
        loginWithNsecLabel: 'ورود با nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'ورود',
        connecting: 'در حال اتصال...',
        generateKeypairLink: 'ایجاد جفت‌کلید جدید',
        downloadAndroidApp: 'دانلود اپلیکیشن اندروید',
        amber: {
            title: 'ورود با Amber',
            helper: 'این کد QR را با Amber اسکن کنید یا از دکمه‌های زیر استفاده کنید.',
            openInAmber: 'باز کردن در Amber',
            copyConnectionString: 'کپی رشته اتصال',
            copied: 'کپی شد!'
        },
        keypair: {
            title: 'ایجاد جفت‌کلید جدید',
            description: 'یک جفت‌کلید جدید Nostr به صورت محلی در مرورگر شما ایجاد می‌شود.',
            npubLabel: 'npub (کلید عمومی)',
            nsecLabel: 'nsec (کلید خصوصی)',
            generateAnother: 'ایجاد جفت‌کلید دیگر',
            useAndLogin: 'استفاده از این جفت‌کلید و ورود'
        }
    },
    chats: {
        title: 'گفتگوها',
        emptyHint: 'هنوز گفتگویی نیست. روی + بزنید تا مخاطب اضافه کنید.',
        selectPrompt: 'یک گفتگو انتخاب کنید تا پیام‌رسانی شروع شود',
        addContact: 'افزودن مخاطب',
        filterAll: 'همه',
        filterUnread: 'خوانده‌نشده',
        filterGroups: 'گروه‌ها',
        emptyUnread: 'گفتگوی خوانده‌نشده‌ای نیست',
        emptyGroups: 'گروهی نیست',
        favorites: 'موردعلاقه‌ها',
        favoriteMessage: 'پیام',
        favoriteMessages: 'پیام',
        emptyFavorites: 'هنوز پیام موردعلاقه‌ای نیست',
        archive: 'بایگانی',
        unarchive: 'خارج کردن از بایگانی',
        archived: 'بایگانی‌شده',
        emptyArchive: 'گفتگوی بایگانی‌شده‌ای نیست',
        chatArchived: 'گفتگو بایگانی شد'
    },
    contacts: {
        title: 'مخاطبین',
        manage: 'مدیریت',
        scanQr: 'اسکن QR',
        scanQrAria: 'اسکن کد QR مخاطب',
        emptyHint: 'اگر مخاطبی نمایش داده نمی‌شود، روی مدیریت کلیک کنید تا اضافه کنید.',
        selectPrompt: 'یک مخاطب انتخاب کنید تا گفتگو شروع شود',
        youPrefix: 'شما',
        mediaPreview: {
            image: 'تصویر',
            video: 'ویدیو',
            voiceMessage: 'پیام صوتی',
            audio: 'صوت',
            file: 'فایل',
            location: 'موقعیت مکانی'
        }
    },
    connection: {
        relaysLabel: 'رله‌ها:',
        authLabel: 'احراز هویت:',
        authFailedLabel: 'ناموفق:'
    },
    sync: {
        title: 'در حال همگام‌سازی پیام‌ها...',
        fetched: '{count} دریافت شد',
        errorTitle: 'همگام‌سازی ناموفق بود',
        timeoutError: 'همگام‌سازی پس از ۵ دقیقه به پایان رسید',
        relayErrorsTitle: 'خطاهای رله',
        retryButton: 'تلاش مجدد',
        skipButton: 'رد شدن و ادامه',
        continueInBackground: 'ادامه در پس‌زمینه',
        backgroundComplete: 'همگام‌سازی کامل شد',
        manualRelay: {
            label: 'یا یک رله به صورت دستی وارد کنید',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'اتصال',
            connecting: 'در حال اتصال...',
            invalidUrl: 'آدرس رله نامعتبر است'
        },
        steps: {
            connectDiscoveryRelays: 'اتصال به رله‌های کشف',
            fetchMessagingRelays: 'دریافت و ذخیره رله‌های پیام‌رسانی کاربر',
            connectReadRelays: 'اتصال به رله‌های پیام‌رسانی کاربر',
            fetchHistory: 'دریافت و ذخیره تاریخچه از رله‌ها',
            fetchContacts: 'دریافت و ادغام مخاطبین از رله‌ها',
            fetchContactProfiles: 'دریافت و ذخیره پروفایل و اطلاعات رله مخاطبین',
            fetchUserProfile: 'دریافت و ذخیره پروفایل کاربر'
        }
    },

         modals: {
          manageContacts: {
              title: 'مخاطبین',
              scanQr: 'اسکن QR',
              scanQrAria: 'اسکن کد QR برای افزودن مخاطب',
              searchPlaceholder: 'npub، NIP-05 یا عبارت جستجو',
              addContactAria: 'افزودن مخاطب',
              searchContactsAria: 'جستجوی مخاطبین',
              searching: 'در حال جستجو...',
              searchFailed: 'جستجو ناموفق بود',
              noResults: 'نتیجه‌ای یافت نشد',
              noContacts: 'مخاطبی اضافه نشده',
              removeContactAria: 'حذف مخاطب',
              resolvingNip05: 'در حال جستجوی NIP-05...',
              nip05LookupFailed: 'جستجوی NIP-05 ناموفق بود',
              nip05NotFound: 'NIP-05 یافت نشد',
              nip05InvalidFormat: 'فرمت NIP-05 نامعتبر است (از name@domain.com استفاده کنید)',
              alreadyAdded: 'قبلاً اضافه شده',
              syncing: 'در حال همگام‌سازی مخاطبین…',
              pullToRefresh: 'برای بازخوانی بکشید',
              releaseToRefresh: 'رها کنید تا بازخوانی شود',
              newContact: 'افزودن مخاطب',
              createGroup: 'ایجاد گروه',
              contextMenu: {
                  openMenu: 'باز کردن منو',
                  viewProfile: 'مشاهده پروفایل',
                  delete: 'حذف'
              },
              confirmDelete: {
                  title: 'حذف مخاطب',
                  message: 'آیا مطمئنید که می‌خواهید {name} را حذف کنید؟',
                  confirm: 'حذف'
              }
          },
          createGroup: {
              title: 'ایجاد گفتگوی گروهی',
              searchPlaceholder: 'جستجوی مخاطبین',
              selectedCount: '{count} انتخاب شده',
              minContactsHint: 'حداقل ۲ مخاطب انتخاب کنید',
              createButton: 'ایجاد گروه',
              creating: 'در حال ایجاد...',
              noContacts: 'مخاطبی برای افزودن به گروه نیست'
          },
         profile: {
              unknownName: 'ناشناس',
              about: 'درباره',
              publicKey: 'کلید عمومی',
              messagingRelays: 'رله‌های پیام‌رسانی',
              noRelays: 'هیچ‌کدام',
              refreshing: 'در حال بازخوانی پروفایل…',
              notFound: 'پروفایل یافت نشد',
              addToContacts: 'افزودن به مخاطبین',
              addingContact: 'در حال افزودن…',
              contactAdded: 'مخاطب اضافه شد'
          },

        emptyProfile: {
            title: 'تکمیل تنظیمات پروفایل',
            introLine1: 'این کلید هنوز رله‌های پیام‌رسانی یا نام کاربری پیکربندی نشده است.',
            introLine2: 'ما چند رله پیام‌رسانی پیش‌فرض تنظیم می‌کنیم تا nospeak بتواند پیام ارسال و دریافت کند. می‌توانید بعداً در تنظیمات رله‌های پیام‌رسانی آن‌ها را تغییر دهید.',
            usernameLabel: 'نام کاربری',
            usernamePlaceholder: 'نام شما',
            usernameRequired: 'لطفاً نام کاربری وارد کنید تا ادامه دهید.',
            saveError: 'ذخیره تنظیمات اولیه ممکن نشد. لطفاً دوباره تلاش کنید.',
            doLater: 'بعداً انجام می‌دهم',
            saving: 'در حال ذخیره...',
            continue: 'ادامه',
            autoRelaysConfigured: 'رله‌های پیام‌رسانی پیکربندی شدند. می‌توانید در تنظیمات آن‌ها را تغییر دهید.'
        },
        relayStatus: {
            title: 'اتصالات رله',
            noRelays: 'هیچ رله‌ای پیکربندی نشده',
            connected: 'متصل',
            disconnected: 'قطع شده',
            typeLabel: 'نوع:',
            lastConnectedLabel: 'آخرین اتصال:',
            successLabel: 'موفق:',
            failureLabel: 'ناموفق:',
            authLabel: 'احراز هویت:',
            authErrorLabel: 'خطای احراز هویت:',
            authNotRequired: 'نیاز نیست',
            authRequired: 'نیاز است',
            authAuthenticating: 'در حال احراز هویت',
            authAuthenticated: 'احراز هویت شده',
            authFailed: 'ناموفق',
            typePersistent: 'دائمی',
            typeTemporary: 'موقت',
            never: 'هرگز'
        },
        qr: {
            title: 'کد QR',
            tabs: {
                myQr: 'کد من',
                scanQr: 'اسکن کد'
            }
        },
        userQr: {
            preparing: 'در حال آماده‌سازی کد QR…',
            hint: 'این npub شما به صورت کد QR است. آن را با کسی به اشتراک بگذارید تا بتواند شما را به عنوان مخاطب اضافه کند.'
        },
        scanContactQr: {
            title: 'اسکن QR مخاطب',
            instructions: 'دوربین خود را به سمت کد QR ناستر بگیرید تا مخاطب اضافه شود.',
            scanning: 'در حال اسکن…',
            noCamera: 'دوربین در این دستگاه در دسترس نیست.',
            invalidQr: 'این کد QR حاوی npub معتبر مخاطب نیست.',
            addFailed: 'افزودن مخاطب از این QR ممکن نشد. لطفاً دوباره تلاش کنید.',
            added: 'مخاطب از QR اضافه شد.'
        },
        scanContactQrResult: {
            title: 'مخاطب از QR',
            alreadyContact: 'این مخاطب قبلاً در لیست مخاطبین شما است.',
            reviewHint: 'مخاطب اسکن‌شده از QR را قبل از افزودن بررسی کنید.',
            updatingProfile: 'در حال بروزرسانی پروفایل…',
            loadFailed: 'بارگذاری جزئیات مخاطب از QR ناموفق بود.',
            addFailed: 'افزودن مخاطب از QR ناموفق بود.',
            closeButton: 'بستن',
            addButton: 'افزودن مخاطب',
            startChatButton: 'شروع گفتگو'
        },
        attachmentPreview: {
            title: 'پیش‌نمایش پیوست',
            imageAlt: 'پیش‌نمایش پیوست',
            noPreview: 'پیش‌نمایش در دسترس نیست',
            captionLabel: 'توضیح (اختیاری)',
            cancelButton: 'لغو',
            sendButtonIdle: 'ارسال',
            sendButtonSending: 'در حال ارسال…',
            uploadButtonIdle: 'آپلود',
            uploadButtonUploading: 'در حال آپلود…'
        },
        locationPreview: {
            title: 'موقعیت مکانی',
            closeButton: 'بستن',
            openInOpenStreetMap: 'باز کردن در OpenStreetMap',
            ctrlScrollToZoom: 'از Ctrl + اسکرول برای بزرگنمایی استفاده کنید'
        },
        mediaServersAutoConfigured: {
            title: 'سرورهای رسانه پیکربندی شدند',
            message: 'هیچ سرور Blossom پیکربندی نشده بود. {server1} و {server2} اضافه شدند.\n\nمی‌توانید در تنظیمات ← سرورهای رسانه آن‌ها را تغییر دهید.'
        }
    },
    chat: {
        sendFailedTitle: 'ارسال ناموفق بود',
        sendFailedMessagePrefix: 'ارسال پیام ناموفق بود: ',
        location: {
            errorTitle: 'خطای موقعیت مکانی',
            errorMessage: 'دریافت موقعیت مکانی شما ناموفق بود. لطفاً دسترسی‌ها را بررسی کنید.'
        },
        relative: {
            justNow: 'همین الان',
            minutes: '{count} دقیقه پیش',
            minutesPlural: '{count} دقیقه پیش',
            hours: '{count} ساعت پیش',
            hoursPlural: '{count} ساعت پیش',
            days: '{count} روز پیش',
            daysPlural: '{count} روز پیش',
            weeks: '{count} هفته پیش',
            weeksPlural: '{count} هفته پیش',
            months: '{count} ماه پیش',
            monthsPlural: '{count} ماه پیش',
            years: '{count} سال پیش',
            yearsPlural: '{count} سال پیش'
        },
        dateLabel: {
            today: 'امروز',
            yesterday: 'دیروز'
        },
        history: {
            fetchOlder: 'دریافت پیام‌های قدیمی‌تر از رله‌ها',
            summary: '{events} رویداد دریافت شد، {saved} پیام جدید ذخیره شد ({chat} در این گفتگو)',
            none: 'پیام دیگری از رله‌ها در دسترس نیست',
            error: 'دریافت پیام‌های قدیمی‌تر ناموفق بود. بعداً دوباره تلاش کنید.'
        },
        empty: {
            noMessagesTitle: 'هنوز پیامی نیست',
            forContact: 'گفتگو با {name} را شروع کنید.',
            forGroup: 'گفتگو در {name} را شروع کنید.',
            generic: 'یک مخاطب انتخاب کنید تا گفتگو شروع شود.'
        },
        group: {
            defaultTitle: 'گفتگوی گروهی',
            participants: '{count} شرکت‌کننده',
            participantsShort: '{count}',
            members: 'اعضا: {count}',
            membersTitle: 'اعضا',
            viewMembers: 'مشاهده اعضا',
            editName: 'ویرایش نام گروه',
            editNameTitle: 'نام گروه',
            editNamePlaceholder: 'نام گروه را وارد کنید...',
            editNameHint: 'خالی بگذارید تا از نام شرکت‌کنندگان استفاده شود',
            editNameSave: 'ذخیره',
            editNameCancel: 'لغو',
            nameSavedToast: 'ذخیره شد. با پیام بعدی اعمال می‌شود.',
            nameValidationTooLong: 'نام خیلی طولانی است (حداکثر ۱۰۰ کاراکتر)',
            nameValidationInvalidChars: 'نام حاوی کاراکترهای نامعتبر است'
        },
        inputPlaceholder: 'یک پیام بنویسید...',
        contextMenu: {
            cite: 'نقل‌قول',
            copy: 'کپی',
            sentAt: 'ارسال شده',
            favorite: 'موردعلاقه',
            unfavorite: 'حذف از موردعلاقه'
        },
        reactions: {
            cannotReactTitle: 'واکنش ممکن نیست',
            cannotReactMessage: 'این پیام برای پشتیبانی از واکنش خیلی قدیمی است.',
            failedTitle: 'واکنش ناموفق بود',
            failedMessagePrefix: 'ارسال واکنش ناموفق بود: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'آپلود رسانه',
            takePhoto: 'گرفتن عکس',
            location: 'موقعیت مکانی',
            image: 'تصویر',
            video: 'ویدیو',
            audio: 'موسیقی',
            file: 'فایل'
        },
        mediaErrors: {
            cameraErrorTitle: 'خطای دوربین',
            cameraErrorMessage: 'گرفتن عکس ناموفق بود'
        },
        fileUpload: {
            fileTooLarge: 'فایل خیلی بزرگ است. حداکثر اندازه ۱۰ مگابایت است.',
            download: 'دانلود',
            decrypting: 'در حال رمزگشایی...'
        },
        mediaUnavailable: 'این رسانه دیگر در دسترس نیست.',
        voiceMessage: {
            title: 'پیام صوتی',
            recordAria: 'ضبط پیام صوتی',
            playPreviewAria: 'پخش پیش‌نمایش',
            pausePreviewAria: 'توقف پیش‌نمایش',
            cancelButton: 'لغو',
            pauseButton: 'توقف',
            doneButton: 'تمام',
            resumeButton: 'ادامه',
            sendButton: 'ارسال',
            microphoneTitle: 'میکروفون',
            permissionDeniedTitle: 'دسترسی میکروفون',
            permissionDeniedMessage: 'لطفاً دسترسی میکروفون را برای ضبط مجاز کنید.',
            nativeNotAvailable: 'ضبط بومی در دسترس نیست.',
            unsupported: 'ضبط صدا در این دستگاه پشتیبانی نمی‌شود.',
            failedToStart: 'شروع ضبط ناموفق بود.',
            failedToStop: 'توقف ضبط ناموفق بود.',
            recordingFailed: 'ضبط ناموفق بود.'
        },
        relayStatus: {
            sending: 'در حال ارسال...',
            sentToRelays: 'ارسال شده به {successful}/{desired} رله'
        },
        searchPlaceholder: 'جستجو',
        searchNoMatches: 'نتیجه‌ای یافت نشد',
        searchAriaLabel: 'جستجوی گفتگو'
    },
    settings: {
          title: 'تنظیمات',
          categories: {
              general: 'عمومی',
              profile: 'پروفایل',
               messagingRelays: 'رله‌های پیام‌رسانی',
               mediaServers: 'سرورهای رسانه',
               security: 'امنیت',
               about: 'درباره'
          },

        general: {
            appearanceLabel: 'ظاهر',
            appearanceDescription:
                'انتخاب کنید که حالت سیستم، روشن یا تاریک دنبال شود.',
            languageLabel: 'زبان',
            languageDescription: 'زبان مورد نظر اپلیکیشن را انتخاب کنید.'
        },
        notifications: {
            label: 'اعلان‌ها',
            supportedDescription:
                'هنگام دریافت پیام‌های جدید در این دستگاه اعلان دریافت کنید',
            unsupportedDescription:
                'اعلان‌ها در این دستگاه پشتیبانی نمی‌شوند'
        },
        backgroundMessaging: {
            label: 'پیام‌رسانی پس‌زمینه',
            description:
                'nospeak را به رله‌های پیام‌رسانی متصل نگه دارید و هنگامی که اپلیکیشن در پس‌زمینه است اعلان پیام/واکنش دریافت کنید. اندروید هنگام فعال بودن یک اعلان دائمی نمایش می‌دهد. با ورود کلید محلی (nsec) و Amber کار می‌کند. پیش‌نمایش اعلان‌ها ممکن است توسط تنظیمات حریم خصوصی صفحه قفل اندروید محدود شود.',
            openBatterySettings: 'باز کردن تنظیمات باتری'
        },
        urlPreviews: {
            label: 'پیش‌نمایش URL',
            description:
                'نمایش کارت‌های پیش‌نمایش برای لینک‌های غیررسانه‌ای در پیام‌ها.'
        },
        profile: {
            nameLabel: 'نام',
            namePlaceholder: 'نام شما',
            displayNameLabel: 'نام نمایشی',
            displayNamePlaceholder: 'نام نمایشی',
            aboutLabel: 'درباره',
            aboutPlaceholder: 'درباره خودتان بگویید',
            pictureUrlLabel: 'آدرس تصویر',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'آدرس بنر',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (نام کاربری)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'وب‌سایت',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'آدرس Lightning (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'ذخیره تغییرات',
            savingButton: 'در حال ذخیره...'
        },
          messagingRelays: {
              description: 'رله‌های پیام‌رسانی NIP-17 خود را پیکربندی کنید. این رله‌ها برای دریافت پیام‌های رمزنگاری‌شده شما استفاده می‌شوند. برای بهترین عملکرد، معمولاً ۲ رله پیام‌رسانی بهتر کار می‌کنند.',
              inputPlaceholder: 'wss://relay.example.com',
              addButton: 'افزودن',
              emptyState: 'هیچ رله‌ای پیکربندی نشده',
              tooManyWarning: 'داشتن بیش از ۳ رله پیام‌رسانی ممکن است عملکرد و قابلیت اطمینان را کاهش دهد.',
              saveStatusSuccess: 'لیست رله‌ها در {count} رله ذخیره شد.',
              saveStatusPartial: 'لیست رله‌ها در {succeeded} از {attempted} رله ذخیره شد.',
              saveStatusNone: 'لیست رله‌ها در هیچ رله‌ای ذخیره نشد.',
              saveStatusError: 'خطا در ذخیره لیست رله‌ها. تنظیمات شما ممکن است به طور کامل منتشر نشده باشد.',
              savingStatus: 'در حال ذخیره تنظیمات رله…'
          },

           mediaServers: {
               description: 'سرورهای رسانه Blossom خود را پیکربندی کنید. این سرورها برای ذخیره فایل‌هایی که آپلود می‌کنید استفاده می‌شوند (رسانه پروفایل و پیوست‌های گفتگو).',

               inputPlaceholder: 'https://cdn.example.com',
               addButton: 'افزودن',
               emptyState: 'هیچ سروری پیکربندی نشده',
               saveStatusSuccess: 'لیست سرورها در {count} رله ذخیره شد.',
               saveStatusPartial: 'لیست سرورها در {succeeded} از {attempted} رله ذخیره شد.',
               saveStatusNone: 'لیست سرورها در هیچ رله‌ای ذخیره نشد.',
               saveStatusError: 'خطا در ذخیره لیست سرورها. تنظیمات شما ممکن است به طور کامل منتشر نشده باشد.',
               savingStatus: 'در حال ذخیره تنظیمات سرور رسانه…',
               primary: 'اصلی',
               setAsPrimary: 'تنظیم به عنوان اصلی',
               mediaCacheLabel: 'حافظه پنهان رسانه',
               mediaCacheDescription: 'رسانه‌های مشاهده‌شده را برای دسترسی آفلاین در گالری ذخیره کنید. فایل‌ها در اپلیکیشن عکس‌ها قابل مدیریت هستند.'
           },


           security: {
            loginMethodTitle: 'روش ورود',
            loginMethodUnknown: 'ناشناخته',
            npubLabel: 'npub شما',
            nsecLabel: 'nsec شما',
            hideNsecAria: 'پنهان کردن nsec',
            showNsecAria: 'نمایش nsec',
            dangerZoneTitle: 'منطقه خطر',
            dangerZoneDescription: 'خروج از حساب تمام داده‌های ذخیره‌شده را از این دستگاه حذف می‌کند.',
            logoutButton: 'خروج'
        },
        pin: {
            appLockLabel: 'قفل اپلیکیشن',
            appLockDescription: 'برای دسترسی به اپلیکیشن کد PIN لازم باشد',
            changePinButton: 'تغییر کد PIN',
            enterNewPin: 'تنظیم کد PIN',
            enterNewPinDescription: 'یک کد PIN ۴ رقمی وارد کنید',
            confirmPin: 'تأیید کد PIN',
            confirmPinDescription: 'همان کد PIN را دوباره وارد کنید',
            enterCurrentPin: 'کد PIN را وارد کنید',
            enterCurrentPinDescription: 'کد PIN فعلی خود را وارد کنید',
            wrongPin: 'کد PIN اشتباه است',
            pinMismatch: 'کدهای PIN مطابقت ندارند، دوباره تلاش کنید',
            enterPinToUnlock: 'برای باز کردن قفل کد PIN را وارد کنید'
        }
    },
    signerMismatch: {
        title: 'عدم تطابق حساب',
        description: 'افزونه امضاکننده مرورگر شما حساب متفاوتی نسبت به حسابی که با آن وارد شده‌اید فعال دارد.',
        expectedAccount: 'وارد شده به عنوان',
        actualAccount: 'حساب فعال امضاکننده',
        instructions: 'لطفاً در افزونه امضاکننده خود به حساب صحیح تغییر دهید و این صفحه را بازخوانی کنید.'
    }
};

export default fa;
