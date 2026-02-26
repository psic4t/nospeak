const bn = {
    common: {
        appName: 'nospeak',
        save: 'সংরক্ষণ করুন',
        cancel: 'বাতিল'
    },
    auth: {
        loginWithAmber: 'Amber দিয়ে লগইন করুন',
        loginWithExtension: 'Nostr সাইনার এক্সটেনশন দিয়ে লগইন করুন',
        orSeparator: 'অথবা',
        loginWithNsecLabel: 'nsec দিয়ে লগইন করুন',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'লগইন',
        connecting: 'সংযোগ হচ্ছে...',
        generateKeypairLink: 'নতুন কীপেয়ার তৈরি করুন',
        downloadAndroidApp: 'Android অ্যাপ ডাউনলোড করুন',
        amber: {
            title: 'Amber দিয়ে লগইন করুন',
            helper: 'Amber দিয়ে এই QR কোডটি স্ক্যান করুন অথবা নিচের বোতামগুলি ব্যবহার করুন।',
            openInAmber: 'Amber-এ খুলুন',
            copyConnectionString: 'সংযোগ স্ট্রিং কপি করুন',
            copied: 'কপি হয়েছে!'
        },
        keypair: {
            title: 'নতুন কীপেয়ার তৈরি করুন',
            description: 'আপনার ব্রাউজারে স্থানীয়ভাবে একটি নতুন Nostr কীপেয়ার তৈরি হয়েছে।',
            npubLabel: 'npub (পাবলিক কী)',
            nsecLabel: 'nsec (সিক্রেট কী)',
            generateAnother: 'আরেকটি তৈরি করুন',
            useAndLogin: 'এই কীপেয়ার ব্যবহার করে লগইন করুন'
        }
    },
    chats: {
        title: 'চ্যাটসমূহ',
        emptyHint: 'এখনো কোনো চ্যাট নেই। একটি পরিচিতি যোগ করতে + ট্যাপ করুন।',
        selectPrompt: 'মেসেজিং শুরু করতে একটি চ্যাট নির্বাচন করুন',
        addContact: 'পরিচিতি যোগ করুন',
        filterAll: 'সব',
        filterUnread: 'অপঠিত',
        filterGroups: 'গ্রুপ',
        emptyUnread: 'কোনো অপঠিত চ্যাট নেই',
        emptyGroups: 'কোনো গ্রুপ নেই',
        favorites: 'প্রিয়',
        favoriteMessage: 'বার্তা',
        favoriteMessages: 'বার্তা',
        emptyFavorites: 'এখনো কোনো প্রিয় বার্তা নেই',
        archive: 'আর্কাইভ',
        unarchive: 'আর্কাইভ মুক্ত করুন',
        archived: 'আর্কাইভ করা',
        emptyArchive: 'কোনো আর্কাইভ করা চ্যাট নেই',
        chatArchived: 'চ্যাট আর্কাইভ হয়েছে'
    },
    contacts: {
        title: 'পরিচিতি',
        manage: 'পরিচালনা',
        scanQr: 'QR স্ক্যান করুন',
        scanQrAria: 'পরিচিতির QR কোড স্ক্যান করুন',
        emptyHint: 'যদি কোনো পরিচিতি দেখা না যায়, কিছু যোগ করতে পরিচালনা-তে ক্লিক করুন।',
        selectPrompt: 'চ্যাটিং শুরু করতে একটি পরিচিতি নির্বাচন করুন',
        youPrefix: 'আপনি',
        mediaPreview: {
            image: 'ছবি',
            video: 'ভিডিও',
            voiceMessage: 'ভয়েস বার্তা',
            audio: 'অডিও',
            file: 'ফাইল',
            location: 'অবস্থান'
        }
    },
    connection: {
        relaysLabel: 'রিলে:',
        authLabel: 'অথ:',
        authFailedLabel: 'ব্যর্থ:'
    },
    sync: {
        title: 'বার্তা সিঙ্ক হচ্ছে...',
        fetched: '{count}টি আনা হয়েছে',
        errorTitle: 'সিঙ্ক ব্যর্থ হয়েছে',
        timeoutError: '৫ মিনিট পর সিঙ্ক টাইমআউট হয়েছে',
        relayErrorsTitle: 'রিলে ত্রুটি',
        retryButton: 'পুনরায় চেষ্টা',
        skipButton: 'এড়িয়ে যান এবং চালিয়ে যান',
        continueInBackground: 'ব্যাকগ্রাউন্ডে চালিয়ে যান',
        backgroundComplete: 'সিঙ্ক সম্পন্ন হয়েছে',
        manualRelay: {
            label: 'অথবা ম্যানুয়ালি একটি রিলে লিখুন',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'সংযোগ করুন',
            connecting: 'সংযোগ হচ্ছে...',
            invalidUrl: 'অবৈধ রিলে URL'
        },
        steps: {
            connectDiscoveryRelays: 'ডিসকভারি রিলেতে সংযোগ করুন',
            fetchMessagingRelays: 'ব্যবহারকারীর মেসেজিং রিলে আনুন ও ক্যাশ করুন',
            connectReadRelays: 'ব্যবহারকারীর মেসেজিং রিলেতে সংযোগ করুন',
            fetchHistory: 'রিলে থেকে ইতিহাসের আইটেম আনুন ও ক্যাশ করুন',
            fetchContacts: 'রিলে থেকে পরিচিতি আনুন ও মার্জ করুন',
            fetchContactProfiles: 'পরিচিতির প্রোফাইল ও রিলে তথ্য আনুন ও ক্যাশ করুন',
            fetchUserProfile: 'ব্যবহারকারীর প্রোফাইল আনুন ও ক্যাশ করুন'
        }
    },
    modals: {
        manageContacts: {
            title: 'পরিচিতি',
            scanQr: 'QR স্ক্যান করুন',
            scanQrAria: 'পরিচিতি যোগ করতে QR কোড স্ক্যান করুন',
            searchPlaceholder: 'npub, NIP-05, অথবা সার্চ টার্ম',
            addContactAria: 'পরিচিতি যোগ করুন',
            searchContactsAria: 'পরিচিতি অনুসন্ধান করুন',
            searching: 'অনুসন্ধান করা হচ্ছে...',
            searchFailed: 'অনুসন্ধান ব্যর্থ হয়েছে',
            noResults: 'কোনো ফলাফল নেই',
            noContacts: 'কোনো পরিচিতি যোগ করা হয়নি',
            removeContactAria: 'পরিচিতি সরান',
            resolvingNip05: 'NIP-05 খোঁজা হচ্ছে...',
            nip05LookupFailed: 'NIP-05 খুঁজে পাওয়া যায়নি',
            nip05NotFound: 'NIP-05 পাওয়া যায়নি',
            nip05InvalidFormat: 'অবৈধ NIP-05 ফরম্যাট (name@domain.com ব্যবহার করুন)',
            alreadyAdded: 'ইতিমধ্যে যোগ করা হয়েছে',
            syncing: 'পরিচিতি সিঙ্ক হচ্ছে…',
            pullToRefresh: 'রিফ্রেশ করতে টানুন',
            releaseToRefresh: 'রিফ্রেশ করতে ছেড়ে দিন',
            newContact: 'পরিচিতি যোগ করুন',
            createGroup: 'গ্রুপ তৈরি করুন',
            contextMenu: {
                openMenu: 'মেনু খুলুন',
                viewProfile: 'প্রোফাইল দেখুন',
                delete: 'মুছুন'
            },
            confirmDelete: {
                title: 'পরিচিতি মুছুন',
                message: 'আপনি কি নিশ্চিত যে আপনি {name}-কে মুছতে চান?',
                confirm: 'মুছুন'
            }
        },
        createGroup: {
            title: 'গ্রুপ চ্যাট তৈরি করুন',
            searchPlaceholder: 'পরিচিতি অনুসন্ধান করুন',
            selectedCount: '{count}টি নির্বাচিত',
            minContactsHint: 'কমপক্ষে ২টি পরিচিতি নির্বাচন করুন',
            createButton: 'গ্রুপ তৈরি করুন',
            creating: 'তৈরি হচ্ছে...',
            noContacts: 'গ্রুপে যোগ করার জন্য কোনো পরিচিতি নেই'
        },
        profile: {
            unknownName: 'অজানা',
            about: 'সম্পর্কে',
            publicKey: 'পাবলিক কী',
            messagingRelays: 'মেসেজিং রিলে',
            noRelays: 'নেই',
            refreshing: 'প্রোফাইল রিফ্রেশ হচ্ছে…',
            notFound: 'প্রোফাইল পাওয়া যায়নি',
            addToContacts: 'পরিচিতিতে যোগ করুন',
            addingContact: 'যোগ হচ্ছে…',
            contactAdded: 'পরিচিতি যোগ হয়েছে'
        },
        emptyProfile: {
            title: 'আপনার প্রোফাইল সেটআপ সম্পন্ন করুন',
            introLine1: 'এই কী-তে এখনো কোনো মেসেজিং রিলে বা ব্যবহারকারীর নাম কনফিগার করা হয়নি।',
            introLine2: 'আমরা কিছু ডিফল্ট মেসেজিং রিলে কনফিগার করব যাতে nospeak বার্তা পাঠাতে ও গ্রহণ করতে পারে। আপনি পরে সেটিংসে মেসেজিং রিলে-তে এগুলো পরিবর্তন করতে পারবেন।',
            usernameLabel: 'ব্যবহারকারীর নাম',
            usernamePlaceholder: 'আপনার নাম',
            usernameRequired: 'চালিয়ে যেতে অনুগ্রহ করে একটি ব্যবহারকারীর নাম লিখুন।',
            saveError: 'আপনার প্রাথমিক সেটআপ সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
            doLater: 'আমি পরে করব',
            saving: 'সংরক্ষণ হচ্ছে...',
            continue: 'চালিয়ে যান',
            autoRelaysConfigured: 'মেসেজিং রিলে কনফিগার করা হয়েছে। আপনি সেটিংসে এগুলো পরিবর্তন করতে পারবেন।'
        },
        relayStatus: {
            title: 'রিলে সংযোগ',
            noRelays: 'কোনো রিলে কনফিগার করা হয়নি',
            connected: 'সংযুক্ত',
            disconnected: 'সংযোগ বিচ্ছিন্ন',
            typeLabel: 'ধরন:',
            lastConnectedLabel: 'শেষ সংযোগ:',
            successLabel: 'সফল:',
            failureLabel: 'ব্যর্থতা:',
            authLabel: 'অথ:',
            authErrorLabel: 'অথ ত্রুটি:',
            authNotRequired: 'প্রয়োজন নেই',
            authRequired: 'প্রয়োজন',
            authAuthenticating: 'প্রমাণীকরণ হচ্ছে',
            authAuthenticated: 'প্রমাণীকৃত',
            authFailed: 'ব্যর্থ',
            typePersistent: 'স্থায়ী',
            typeTemporary: 'অস্থায়ী',
            never: 'কখনো না'
        },
        qr: {
            title: 'QR কোড',
            tabs: {
                myQr: 'আমার কোড',
                scanQr: 'কোড স্ক্যান করুন'
            }
        },
        userQr: {
            preparing: 'QR কোড প্রস্তুত হচ্ছে…',
            hint: 'এটি আপনার npub-এর QR কোড। কাউকে শেয়ার করুন যাতে তারা এটি স্ক্যান করে আপনাকে পরিচিতি হিসেবে যোগ করতে পারে।'
        },
        scanContactQr: {
            title: 'পরিচিতির QR স্ক্যান করুন',
            instructions: 'একটি পরিচিতি যোগ করতে আপনার ক্যামেরা একটি nostr QR কোডের দিকে রাখুন।',
            scanning: 'স্ক্যান হচ্ছে…',
            noCamera: 'এই ডিভাইসে ক্যামেরা উপলব্ধ নেই।',
            invalidQr: 'এই QR কোডে একটি বৈধ পরিচিতি npub নেই।',
            addFailed: 'এই QR থেকে পরিচিতি যোগ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
            added: 'QR থেকে পরিচিতি যোগ হয়েছে।'
        },
        scanContactQrResult: {
            title: 'QR থেকে পরিচিতি',
            alreadyContact: 'এই পরিচিতি ইতিমধ্যে আপনার পরিচিতিতে আছে।',
            reviewHint: 'যোগ করার আগে স্ক্যান করা QR থেকে পরিচিতি পর্যালোচনা করুন।',
            updatingProfile: 'প্রোফাইল আপডেট হচ্ছে…',
            loadFailed: 'QR থেকে পরিচিতির বিবরণ লোড করা যায়নি।',
            addFailed: 'QR থেকে পরিচিতি যোগ করা যায়নি।',
            closeButton: 'বন্ধ করুন',
            addButton: 'পরিচিতি যোগ করুন',
            startChatButton: 'চ্যাট শুরু করুন'
        },
        attachmentPreview: {
            title: 'সংযুক্তির পূর্বরূপ',
            imageAlt: 'সংযুক্তির পূর্বরূপ',
            noPreview: 'কোনো পূর্বরূপ উপলব্ধ নেই',
            captionLabel: 'ক্যাপশন (ঐচ্ছিক)',
            cancelButton: 'বাতিল',
            sendButtonIdle: 'পাঠান',
            sendButtonSending: 'পাঠানো হচ্ছে…',
            uploadButtonIdle: 'আপলোড',
            uploadButtonUploading: 'আপলোড হচ্ছে…'
        },
        locationPreview: {
            title: 'অবস্থান',
            closeButton: 'বন্ধ করুন',
            openInOpenStreetMap: 'OpenStreetMap-এ খুলুন',
            ctrlScrollToZoom: 'জুম করতে Ctrl + স্ক্রল ব্যবহার করুন'
        },
        mediaServersAutoConfigured: {
            title: 'মিডিয়া সার্ভার কনফিগার করা হয়েছে',
            message: 'কোনো Blossom সার্ভার কনফিগার করা ছিল না। আমরা {server1} এবং {server2} যোগ করেছি।\n\nআপনি সেটিংস → মিডিয়া সার্ভারে এগুলো পরিবর্তন করতে পারবেন।'
        }
    },
    chat: {
        sendFailedTitle: 'পাঠানো ব্যর্থ',
        sendFailedMessagePrefix: 'বার্তা পাঠাতে ব্যর্থ: ',
        location: {
            errorTitle: 'অবস্থান ত্রুটি',
            errorMessage: 'আপনার অবস্থান পেতে ব্যর্থ হয়েছে। অনুগ্রহ করে অনুমতি পরীক্ষা করুন।'
        },
        relative: {
            justNow: 'এইমাত্র',
            minutes: '{count} মিনিট আগে',
            minutesPlural: '{count} মিনিট আগে',
            hours: '{count} ঘন্টা আগে',
            hoursPlural: '{count} ঘন্টা আগে',
            days: '{count} দিন আগে',
            daysPlural: '{count} দিন আগে',
            weeks: '{count} সপ্তাহ আগে',
            weeksPlural: '{count} সপ্তাহ আগে',
            months: '{count} মাস আগে',
            monthsPlural: '{count} মাস আগে',
            years: '{count} বছর আগে',
            yearsPlural: '{count} বছর আগে'
        },
        dateLabel: {
            today: 'আজ',
            yesterday: 'গতকাল'
        },
        history: {
            fetchOlder: 'রিলে থেকে পুরানো বার্তা আনুন',
            summary: '{events}টি ইভেন্ট আনা হয়েছে, {saved}টি নতুন বার্তা সংরক্ষিত ({chat}টি এই চ্যাটে)',
            none: 'রিলে থেকে আর কোনো বার্তা পাওয়া যাচ্ছে না',
            error: 'পুরানো বার্তা আনতে ব্যর্থ। পরে আবার চেষ্টা করুন।'
        },
        empty: {
            noMessagesTitle: 'এখনো কোনো বার্তা নেই',
            forContact: '{name}-এর সাথে কথোপকথন শুরু করুন।',
            forGroup: '{name}-এ কথোপকথন শুরু করুন।',
            generic: 'চ্যাটিং শুরু করতে একটি পরিচিতি নির্বাচন করুন।'
        },
        group: {
            defaultTitle: 'গ্রুপ চ্যাট',
            participants: '{count} জন অংশগ্রহণকারী',
            participantsShort: '{count}',
            members: 'সদস্য: {count}',
            membersTitle: 'সদস্য',
            viewMembers: 'সদস্য দেখুন',
            editName: 'গ্রুপের নাম সম্পাদনা করুন',
            editNameTitle: 'গ্রুপের নাম',
            editNamePlaceholder: 'গ্রুপের নাম লিখুন...',
            editNameHint: 'অংশগ্রহণকারীদের নাম ব্যবহার করতে খালি রাখুন',
            editNameSave: 'সংরক্ষণ করুন',
            editNameCancel: 'বাতিল',
            nameSavedToast: 'সংরক্ষিত। পরবর্তী বার্তার সাথে সেট হবে।',
            nameValidationTooLong: 'নাম খুব দীর্ঘ (সর্বোচ্চ ১০০ অক্ষর)',
            nameValidationInvalidChars: 'নামে অবৈধ অক্ষর আছে'
        },
        inputPlaceholder: 'একটি বার্তা লিখুন...',
        contextMenu: {
            cite: 'উদ্ধৃতি',
            copy: 'কপি',
            sentAt: 'পাঠানো হয়েছে',
            favorite: 'প্রিয়',
            unfavorite: 'প্রিয় থেকে সরান'
        },
        reactions: {
            cannotReactTitle: 'প্রতিক্রিয়া দেওয়া যাচ্ছে না',
            cannotReactMessage: 'এই বার্তাটি প্রতিক্রিয়া সমর্থন করার জন্য অনেক পুরানো।',
            failedTitle: 'প্রতিক্রিয়া ব্যর্থ',
            failedMessagePrefix: 'প্রতিক্রিয়া পাঠাতে ব্যর্থ: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'মিডিয়া আপলোড করুন',
            takePhoto: 'ছবি তুলুন',
            location: 'অবস্থান',
            image: 'ছবি',
            video: 'ভিডিও',
            audio: 'সঙ্গীত',
            file: 'ফাইল'
        },
        mediaErrors: {
            cameraErrorTitle: 'ক্যামেরা ত্রুটি',
            cameraErrorMessage: 'ছবি তুলতে ব্যর্থ'
        },
        fileUpload: {
            fileTooLarge: 'ফাইলটি খুব বড়। সর্বোচ্চ সাইজ ১০ MB।',
            download: 'ডাউনলোড',
            decrypting: 'ডিক্রিপ্ট হচ্ছে...'
        },
        mediaUnavailable: 'এই মিডিয়া আর উপলব্ধ নেই।',
        voiceMessage: {
            title: 'ভয়েস বার্তা',
            recordAria: 'ভয়েস বার্তা রেকর্ড করুন',
            playPreviewAria: 'পূর্বরূপ চালান',
            pausePreviewAria: 'পূর্বরূপ থামান',
            cancelButton: 'বাতিল',
            pauseButton: 'বিরতি',
            doneButton: 'সম্পন্ন',
            resumeButton: 'পুনরায় শুরু',
            sendButton: 'পাঠান',
            microphoneTitle: 'মাইক্রোফোন',
            permissionDeniedTitle: 'মাইক্রোফোন অনুমতি',
            permissionDeniedMessage: 'রেকর্ড করতে অনুগ্রহ করে মাইক্রোফোন অ্যাক্সেস অনুমতি দিন।',
            nativeNotAvailable: 'নেটিভ রেকর্ডিং উপলব্ধ নেই।',
            unsupported: 'এই ডিভাইসে ভয়েস রেকর্ডিং সমর্থিত নয়।',
            failedToStart: 'রেকর্ডিং শুরু করতে ব্যর্থ।',
            failedToStop: 'রেকর্ডিং বন্ধ করতে ব্যর্থ।',
            recordingFailed: 'রেকর্ডিং ব্যর্থ হয়েছে।'
        },
        relayStatus: {
            sending: 'পাঠানো হচ্ছে...',
            sentToRelays: '{successful}/{desired} রিলেতে পাঠানো হয়েছে'
        },
        searchPlaceholder: 'অনুসন্ধান',
        searchNoMatches: 'কোনো মিল নেই',
        searchAriaLabel: 'চ্যাট অনুসন্ধান করুন'
    },
    settings: {
        title: 'সেটিংস',
        categories: {
            general: 'সাধারণ',
            profile: 'প্রোফাইল',
            messagingRelays: 'মেসেজিং রিলে',
            mediaServers: 'মিডিয়া সার্ভার',
            security: 'নিরাপত্তা',
            about: 'সম্পর্কে'
        },
        general: {
            appearanceLabel: 'চেহারা',
            appearanceDescription: 'সিস্টেম, লাইট, অথবা ডার্ক মোড অনুসরণ করবেন কিনা তা চয়ন করুন।',
            languageLabel: 'ভাষা',
            languageDescription: 'আপনার পছন্দের অ্যাপ ভাষা চয়ন করুন।'
        },
        notifications: {
            label: 'বিজ্ঞপ্তি',
            supportedDescription: 'এই ডিভাইসে নতুন বার্তা পেলে বিজ্ঞপ্তি পান',
            unsupportedDescription: 'এই ডিভাইসে বিজ্ঞপ্তি সমর্থিত নয়'
        },
        backgroundMessaging: {
            label: 'ব্যাকগ্রাউন্ড মেসেজিং',
            description: 'অ্যাপ ব্যাকগ্রাউন্ডে থাকাকালীন nospeak-কে আপনার মেসেজিং রিলেতে সংযুক্ত রাখুন এবং বার্তা/প্রতিক্রিয়া বিজ্ঞপ্তি পান। এটি সক্ষম থাকলে Android একটি স্থায়ী বিজ্ঞপ্তি দেখাবে। লোকাল-কী (nsec) এবং Amber উভয় লগইনের সাথে কাজ করে। আপনার Android লকস্ক্রিন গোপনীয়তা সেটিংস দ্বারা বিজ্ঞপ্তির পূর্বরূপ সীমিত হতে পারে।',
            openBatterySettings: 'ব্যাটারি সেটিংস খুলুন'
        },
        urlPreviews: {
            label: 'URL পূর্বরূপ',
            description: 'বার্তায় নন-মিডিয়া লিঙ্কের জন্য পূর্বরূপ কার্ড দেখান।'
        },
        profile: {
            nameLabel: 'নাম',
            namePlaceholder: 'আপনার নাম',
            displayNameLabel: 'প্রদর্শন নাম',
            displayNamePlaceholder: 'প্রদর্শন নাম',
            aboutLabel: 'সম্পর্কে',
            aboutPlaceholder: 'নিজের সম্পর্কে বলুন',
            pictureUrlLabel: 'ছবির URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'ব্যানারের URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (ব্যবহারকারীর নাম)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'ওয়েবসাইট',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning ঠিকানা (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'পরিবর্তন সংরক্ষণ করুন',
            savingButton: 'সংরক্ষণ হচ্ছে...'
        },
        messagingRelays: {
            description: 'আপনার NIP-17 মেসেজিং রিলে কনফিগার করুন। এই রিলেগুলো আপনার এনক্রিপ্টেড বার্তা গ্রহণ করতে ব্যবহৃত হয়। সেরা কর্মক্ষমতার জন্য, সাধারণত ২টি মেসেজিং রিলে সবচেয়ে ভালো কাজ করে।',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'যোগ করুন',
            emptyState: 'কোনো রিলে কনফিগার করা হয়নি',
            tooManyWarning: '৩টির বেশি মেসেজিং রিলে থাকলে কর্মক্ষমতা ও নির্ভরযোগ্যতা কমতে পারে।',
            saveStatusSuccess: '{count}টি রিলেতে রিলে তালিকা সংরক্ষিত হয়েছে।',
            saveStatusPartial: '{attempted}টির মধ্যে {succeeded}টি রিলেতে রিলে তালিকা সংরক্ষিত হয়েছে।',
            saveStatusNone: 'কোনো রিলেতে রিলে তালিকা সংরক্ষণ করা যায়নি।',
            saveStatusError: 'রিলে তালিকা সংরক্ষণে ত্রুটি। আপনার সেটিংস সম্পূর্ণরূপে প্রচারিত নাও হতে পারে।',
            savingStatus: 'রিলে সেটিংস সংরক্ষণ হচ্ছে…'
        },
        mediaServers: {
            description: 'আপনার Blossom মিডিয়া সার্ভার কনফিগার করুন। এই সার্ভারগুলো আপনার আপলোড করা ফাইল সংরক্ষণ করতে ব্যবহৃত হয় (প্রোফাইল মিডিয়া এবং চ্যাট সংযুক্তি)।',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'যোগ করুন',
            emptyState: 'কোনো সার্ভার কনফিগার করা হয়নি',
            saveStatusSuccess: '{count}টি রিলেতে সার্ভার তালিকা সংরক্ষিত হয়েছে।',
            saveStatusPartial: '{attempted}টির মধ্যে {succeeded}টি রিলেতে সার্ভার তালিকা সংরক্ষিত হয়েছে।',
            saveStatusNone: 'কোনো রিলেতে সার্ভার তালিকা সংরক্ষণ করা যায়নি।',
            saveStatusError: 'সার্ভার তালিকা সংরক্ষণে ত্রুটি। আপনার সেটিংস সম্পূর্ণরূপে প্রচারিত নাও হতে পারে।',
            savingStatus: 'মিডিয়া সার্ভার সেটিংস সংরক্ষণ হচ্ছে…',
            primary: 'প্রাথমিক',
            setAsPrimary: 'প্রাথমিক হিসেবে সেট করুন',
            mediaCacheLabel: 'মিডিয়া ক্যাশ',
            mediaCacheDescription: 'অফলাইন অ্যাক্সেসের জন্য দেখা মিডিয়া আপনার গ্যালারিতে সংরক্ষণ করুন। ফাইলগুলো আপনার ফটোজ অ্যাপে পরিচালনা করা যাবে।'
        },
        security: {
            loginMethodTitle: 'লগইন পদ্ধতি',
            loginMethodUnknown: 'অজানা',
            npubLabel: 'আপনার npub',
            nsecLabel: 'আপনার nsec',
            hideNsecAria: 'nsec লুকান',
            showNsecAria: 'nsec দেখান',
            dangerZoneTitle: 'বিপদ অঞ্চল',
            dangerZoneDescription: 'লগআউট করলে এই ডিভাইস থেকে সমস্ত ক্যাশ করা ডেটা মুছে যাবে।',
            logoutButton: 'লগআউট'
        },
        pin: {
            appLockLabel: 'অ্যাপ লক',
            appLockDescription: 'অ্যাপে প্রবেশ করতে PIN প্রয়োজন',
            changePinButton: 'PIN পরিবর্তন করুন',
            enterNewPin: 'একটি PIN সেট করুন',
            enterNewPinDescription: '4 সংখ্যার PIN দিন',
            confirmPin: 'PIN নিশ্চিত করুন',
            confirmPinDescription: 'একই PIN আবার দিন',
            enterCurrentPin: 'PIN দিন',
            enterCurrentPinDescription: 'আপনার বর্তমান PIN দিন',
            wrongPin: 'ভুল PIN',
            pinMismatch: 'PIN মিলছে না, আবার চেষ্টা করুন',
            enterPinToUnlock: 'আনলক করতে PIN দিন'
        }
    },
    signerMismatch: {
        title: 'অ্যাকাউন্ট অমিল',
        description: 'আপনার ব্রাউজার সাইনার এক্সটেনশনে যে অ্যাকাউন্ট সক্রিয় আছে তা আপনি যে অ্যাকাউন্ট দিয়ে লগইন করেছিলেন তার থেকে আলাদা।',
        expectedAccount: 'যে অ্যাকাউন্টে লগইন করা হয়েছে',
        actualAccount: 'সাইনারে সক্রিয় অ্যাকাউন্ট',
        instructions: 'অনুগ্রহ করে আপনার সাইনার এক্সটেনশনে সঠিক অ্যাকাউন্টে স্যুইচ করুন এবং এই পৃষ্ঠাটি পুনরায় লোড করুন।'
    }
};

export default bn;
