const hi = {
    common: {
        appName: 'nospeak',
        save: 'सहेजें',
        cancel: 'रद्द करें'
    },
    auth: {
        loginWithAmber: 'Amber से लॉगिन करें',
        loginWithExtension: 'Nostr साइनर एक्सटेंशन से लॉगिन करें',
        orSeparator: 'या',
        loginWithNsecLabel: 'nsec से लॉगिन करें',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'लॉगिन',
        connecting: 'कनेक्ट हो रहा है...',
        generateKeypairLink: 'नई कीपेयर बनाएँ',
        downloadAndroidApp: 'Android ऐप डाउनलोड करें',
        amber: {
            title: 'Amber से लॉगिन करें',
            helper: 'इस QR कोड को Amber से स्कैन करें या नीचे दिए बटन का उपयोग करें।',
            openInAmber: 'Amber में खोलें',
            copyConnectionString: 'कनेक्शन स्ट्रिंग कॉपी करें',
            copied: 'कॉपी हो गया!'
        },
        keypair: {
            title: 'नई कीपेयर बनाएँ',
            description: 'एक नई Nostr कीपेयर आपके ब्राउज़र में स्थानीय रूप से बनाई जाती है।',
            npubLabel: 'npub (सार्वजनिक कुंजी)',
            nsecLabel: 'nsec (गोपनीय कुंजी)',
            generateAnother: 'एक और बनाएँ',
            useAndLogin: 'इस कीपेयर का उपयोग करें और लॉगिन करें'
        }
    },
    chats: {
        title: 'चैट',
        emptyHint: 'अभी कोई चैट नहीं है। संपर्क जोड़ने के लिए + दबाएँ।',
        selectPrompt: 'मैसेजिंग शुरू करने के लिए एक चैट चुनें',
        addContact: 'संपर्क जोड़ें',
        filterAll: 'सभी',
        filterUnread: 'अपठित',
        filterGroups: 'समूह',
        emptyUnread: 'कोई अपठित चैट नहीं',
        emptyGroups: 'कोई समूह नहीं',
        favorites: 'पसंदीदा',
        favoriteMessage: 'संदेश',
        favoriteMessages: 'संदेश',
        emptyFavorites: 'अभी कोई पसंदीदा संदेश नहीं',
        archive: 'संग्रहित करें',
        unarchive: 'असंग्रहित करें',
        archived: 'संग्रहित',
        emptyArchive: 'कोई संग्रहित चैट नहीं',
        chatArchived: 'चैट संग्रहित हो गई'
    },
    contacts: {
        title: 'संपर्क',
        manage: 'प्रबंधित करें',
        scanQr: 'QR स्कैन करें',
        scanQrAria: 'संपर्क QR कोड स्कैन करें',
        emptyHint: 'यदि कोई संपर्क दिखाई नहीं दे रहा, तो जोड़ने के लिए प्रबंधित करें पर क्लिक करें।',
        selectPrompt: 'चैट शुरू करने के लिए एक संपर्क चुनें',
        youPrefix: 'आप',
        mediaPreview: {
            image: 'चित्र',
            video: 'वीडियो',
            voiceMessage: 'ध्वनि संदेश',
            audio: 'ऑडियो',
            file: 'फ़ाइल',
            location: 'स्थान'
        }
    },
    connection: {
        relaysLabel: 'रिले:',
        authLabel: 'प्रमाणीकरण:',
        authFailedLabel: 'विफल:'
    },
    sync: {
        title: 'संदेश सिंक हो रहे हैं...',
        fetched: '{count} प्राप्त हुए',
        errorTitle: 'सिंक विफल',
        timeoutError: '5 मिनट के बाद सिंक का समय समाप्त हो गया',
        relayErrorsTitle: 'रिले त्रुटियाँ',
        retryButton: 'पुनः प्रयास करें',
        skipButton: 'छोड़ें और जारी रखें',
        continueInBackground: 'पृष्ठभूमि में जारी रखें',
        backgroundComplete: 'सिंक पूर्ण हुआ',
        manualRelay: {
            label: 'या मैन्युअल रूप से रिले दर्ज करें',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'कनेक्ट करें',
            connecting: 'कनेक्ट हो रहा है...',
            invalidUrl: 'अमान्य रिले URL'
        },
        steps: {
            connectDiscoveryRelays: 'डिस्कवरी रिले से कनेक्ट करें',
            fetchMessagingRelays: 'उपयोगकर्ता की मैसेजिंग रिले प्राप्त करें और कैश करें',
            connectReadRelays: 'उपयोगकर्ता की मैसेजिंग रिले से कनेक्ट करें',
            fetchHistory: 'रिले से इतिहास आइटम प्राप्त करें और कैश करें',
            fetchContacts: 'रिले से संपर्क प्राप्त करें और मर्ज करें',
            fetchContactProfiles: 'संपर्क प्रोफ़ाइल और रिले जानकारी प्राप्त करें और कैश करें',
            fetchUserProfile: 'उपयोगकर्ता प्रोफ़ाइल प्राप्त करें और कैश करें'
        }
    },
    modals: {
        manageContacts: {
            title: 'संपर्क',
            scanQr: 'QR स्कैन करें',
            scanQrAria: 'संपर्क जोड़ने के लिए QR कोड स्कैन करें',
            searchPlaceholder: 'npub, NIP-05, या खोज शब्द',
            addContactAria: 'संपर्क जोड़ें',
            searchContactsAria: 'संपर्क खोजें',
            searching: 'खोज रहा है...',
            searchFailed: 'खोज विफल',
            noResults: 'कोई परिणाम नहीं',
            noContacts: 'कोई संपर्क नहीं जोड़ा गया',
            removeContactAria: 'संपर्क हटाएँ',
            resolvingNip05: 'NIP-05 खोज रहा है...',
            nip05LookupFailed: 'NIP-05 खोज विफल',
            nip05NotFound: 'NIP-05 नहीं मिला',
            nip05InvalidFormat: 'अमान्य NIP-05 प्रारूप (name@domain.com उपयोग करें)',
            alreadyAdded: 'पहले से जोड़ा हुआ',
            syncing: 'संपर्क सिंक हो रहे हैं…',
            pullToRefresh: 'रिफ़्रेश के लिए खींचें',
            releaseToRefresh: 'रिफ़्रेश के लिए छोड़ें',
            newContact: 'संपर्क जोड़ें',
            createGroup: 'समूह बनाएँ',
            contextMenu: {
                openMenu: 'मेनू खोलें',
                delete: 'हटाएँ'
            },
            confirmDelete: {
                title: 'संपर्क हटाएँ',
                message: 'क्या आप वाकई {name} को हटाना चाहते हैं?',
                confirm: 'हटाएँ'
            }
        },
        createGroup: {
            title: 'समूह चैट बनाएँ',
            searchPlaceholder: 'संपर्क खोजें',
            selectedCount: '{count} चयनित',
            minContactsHint: 'कम से कम 2 संपर्क चुनें',
            createButton: 'समूह बनाएँ',
            creating: 'बना रहा है...',
            noContacts: 'समूह में जोड़ने के लिए कोई संपर्क नहीं'
        },
        profile: {
            unknownName: 'अज्ञात',
            about: 'परिचय',
            publicKey: 'सार्वजनिक कुंजी',
            messagingRelays: 'मैसेजिंग रिले',
            noRelays: 'कोई नहीं',
            refreshing: 'प्रोफ़ाइल रिफ़्रेश हो रही है…',
            notFound: 'प्रोफ़ाइल नहीं मिली',
            addToContacts: 'संपर्कों में जोड़ें',
            addingContact: 'जोड़ रहा है…',
            contactAdded: 'संपर्क जोड़ा गया'
        },
        emptyProfile: {
            title: 'अपनी प्रोफ़ाइल सेटअप पूरा करें',
            introLine1: 'इस कुंजी में कोई मैसेजिंग रिले या उपयोगकर्ता नाम कॉन्फ़िगर नहीं है।',
            introLine2: 'हम कुछ डिफ़ॉल्ट मैसेजिंग रिले कॉन्फ़िगर करेंगे ताकि nospeak संदेश भेज और प्राप्त कर सके। आप इन्हें बाद में सेटिंग्स में मैसेजिंग रिले के अंतर्गत बदल सकते हैं।',
            usernameLabel: 'उपयोगकर्ता नाम',
            usernamePlaceholder: 'आपका नाम',
            usernameRequired: 'जारी रखने के लिए कृपया एक उपयोगकर्ता नाम दर्ज करें।',
            saveError: 'प्रारंभिक सेटअप सहेजा नहीं जा सका। कृपया पुनः प्रयास करें।',
            doLater: 'मैं यह बाद में करूँगा',
            saving: 'सहेज रहा है...',
            continue: 'जारी रखें',
            autoRelaysConfigured: 'मैसेजिंग रिले कॉन्फ़िगर हो गईं। आप इन्हें सेटिंग्स में बदल सकते हैं।'
        },
        relayStatus: {
            title: 'रिले कनेक्शन',
            noRelays: 'कोई रिले कॉन्फ़िगर नहीं',
            connected: 'कनेक्टेड',
            disconnected: 'डिस्कनेक्टेड',
            typeLabel: 'प्रकार:',
            lastConnectedLabel: 'अंतिम कनेक्शन:',
            successLabel: 'सफल:',
            failureLabel: 'विफलताएँ:',
            authLabel: 'प्रमाणीकरण:',
            authErrorLabel: 'प्रमाणीकरण त्रुटि:',
            authNotRequired: 'आवश्यक नहीं',
            authRequired: 'आवश्यक',
            authAuthenticating: 'प्रमाणित हो रहा है',
            authAuthenticated: 'प्रमाणित',
            authFailed: 'विफल',
            typePersistent: 'स्थायी',
            typeTemporary: 'अस्थायी',
            never: 'कभी नहीं'
        },
        qr: {
            title: 'QR कोड',
            tabs: {
                myQr: 'मेरा कोड',
                scanQr: 'कोड स्कैन करें'
            }
        },
        userQr: {
            preparing: 'QR कोड तैयार हो रहा है…',
            hint: 'यह आपका npub QR कोड के रूप में है। इसे किसी के साथ साझा करें ताकि वे इसे स्कैन करके आपको संपर्क के रूप में जोड़ सकें।'
        },
        scanContactQr: {
            title: 'संपर्क QR स्कैन करें',
            instructions: 'संपर्क जोड़ने के लिए अपना कैमरा किसी Nostr QR कोड की ओर करें।',
            scanning: 'स्कैन हो रहा है…',
            noCamera: 'इस डिवाइस पर कैमरा उपलब्ध नहीं है।',
            invalidQr: 'इस QR कोड में कोई मान्य संपर्क npub नहीं है।',
            addFailed: 'इस QR से संपर्क नहीं जोड़ा जा सका। कृपया पुनः प्रयास करें।',
            added: 'QR से संपर्क जोड़ा गया।'
        },
        scanContactQrResult: {
            title: 'QR से संपर्क',
            alreadyContact: 'यह संपर्क पहले से आपके संपर्कों में है।',
            reviewHint: 'जोड़ने से पहले स्कैन किए गए QR से संपर्क की समीक्षा करें।',
            updatingProfile: 'प्रोफ़ाइल अपडेट हो रही है…',
            loadFailed: 'QR से संपर्क विवरण लोड करने में विफल।',
            addFailed: 'QR से संपर्क जोड़ने में विफल।',
            closeButton: 'बंद करें',
            addButton: 'संपर्क जोड़ें',
            startChatButton: 'चैट शुरू करें'
        },
        attachmentPreview: {
            title: 'अटैचमेंट पूर्वावलोकन',
            imageAlt: 'अटैचमेंट पूर्वावलोकन',
            noPreview: 'पूर्वावलोकन उपलब्ध नहीं',
            captionLabel: 'कैप्शन (वैकल्पिक)',
            cancelButton: 'रद्द करें',
            sendButtonIdle: 'भेजें',
            sendButtonSending: 'भेज रहा है…',
            uploadButtonIdle: 'अपलोड करें',
            uploadButtonUploading: 'अपलोड हो रहा है…'
        },
        locationPreview: {
            title: 'स्थान',
            closeButton: 'बंद करें',
            openInOpenStreetMap: 'OpenStreetMap में खोलें',
            ctrlScrollToZoom: 'ज़ूम करने के लिए Ctrl + स्क्रॉल का उपयोग करें'
        },
        mediaServersAutoConfigured: {
            title: 'मीडिया सर्वर कॉन्फ़िगर हो गए',
            message: 'कोई Blossom सर्वर कॉन्फ़िगर नहीं थे। हमने {server1} और {server2} जोड़ दिए हैं।\n\nआप इन्हें सेटिंग्स → मीडिया सर्वर में बदल सकते हैं।'
        }
    },
    chat: {
        sendFailedTitle: 'भेजना विफल',
        sendFailedMessagePrefix: 'संदेश भेजने में विफल: ',
        location: {
            errorTitle: 'स्थान त्रुटि',
            errorMessage: 'आपका स्थान प्राप्त करने में विफल। कृपया अनुमतियाँ जाँचें।'
        },
        relative: {
            justNow: 'अभी',
            minutes: '{count} मिनट पहले',
            minutesPlural: '{count} मिनट पहले',
            hours: '{count} घंटा पहले',
            hoursPlural: '{count} घंटे पहले',
            days: '{count} दिन पहले',
            daysPlural: '{count} दिन पहले',
            weeks: '{count} सप्ताह पहले',
            weeksPlural: '{count} सप्ताह पहले',
            months: '{count} महीना पहले',
            monthsPlural: '{count} महीने पहले',
            years: '{count} साल पहले',
            yearsPlural: '{count} साल पहले'
        },
        dateLabel: {
            today: 'आज',
            yesterday: 'कल'
        },
        history: {
            fetchOlder: 'रिले से पुराने संदेश प्राप्त करें',
            summary: '{events} इवेंट प्राप्त हुए, {saved} नए संदेश सहेजे गए (इस चैट में {chat})',
            none: 'रिले से और कोई संदेश उपलब्ध नहीं',
            error: 'पुराने संदेश प्राप्त करने में विफल। बाद में पुनः प्रयास करें।'
        },
        empty: {
            noMessagesTitle: 'अभी कोई संदेश नहीं',
            forContact: '{name} के साथ बातचीत शुरू करें।',
            forGroup: '{name} में बातचीत शुरू करें।',
            generic: 'चैट शुरू करने के लिए एक संपर्क चुनें।'
        },
        group: {
            defaultTitle: 'समूह चैट',
            participants: '{count} प्रतिभागी',
            participantsShort: '{count}',
            members: 'सदस्य: {count}',
            membersTitle: 'सदस्य',
            viewMembers: 'सदस्य देखें',
            editName: 'समूह का नाम बदलें',
            editNameTitle: 'समूह का नाम',
            editNamePlaceholder: 'समूह का नाम दर्ज करें...',
            editNameHint: 'प्रतिभागी नामों का उपयोग करने के लिए खाली छोड़ें',
            editNameSave: 'सहेजें',
            editNameCancel: 'रद्द करें',
            nameSavedToast: 'सहेजा गया। अगले संदेश के साथ सेट होगा।',
            nameValidationTooLong: 'नाम बहुत लंबा है (अधिकतम 100 अक्षर)',
            nameValidationInvalidChars: 'नाम में अमान्य अक्षर हैं'
        },
        inputPlaceholder: 'संदेश लिखें...',
        contextMenu: {
            cite: 'उद्धृत करें',
            copy: 'कॉपी करें',
            sentAt: 'भेजा गया',
            favorite: 'पसंदीदा',
            unfavorite: 'पसंदीदा हटाएँ'
        },
        reactions: {
            cannotReactTitle: 'प्रतिक्रिया नहीं दे सकते',
            cannotReactMessage: 'यह संदेश प्रतिक्रियाओं के लिए बहुत पुराना है।',
            failedTitle: 'प्रतिक्रिया विफल',
            failedMessagePrefix: 'प्रतिक्रिया भेजने में विफल: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'मीडिया अपलोड करें',
            takePhoto: 'फ़ोटो लें',
            location: 'स्थान',
            image: 'चित्र',
            video: 'वीडियो',
            audio: 'संगीत',
            file: 'फ़ाइल'
        },
        mediaErrors: {
            cameraErrorTitle: 'कैमरा त्रुटि',
            cameraErrorMessage: 'फ़ोटो कैप्चर करने में विफल'
        },
        fileUpload: {
            fileTooLarge: 'फ़ाइल बहुत बड़ी है। अधिकतम आकार 10 MB है।',
            download: 'डाउनलोड करें',
            decrypting: 'डिक्रिप्ट हो रहा है...'
        },
        mediaUnavailable: 'यह मीडिया अब उपलब्ध नहीं है।',
        voiceMessage: {
            title: 'ध्वनि संदेश',
            recordAria: 'ध्वनि संदेश रिकॉर्ड करें',
            playPreviewAria: 'पूर्वावलोकन चलाएँ',
            pausePreviewAria: 'पूर्वावलोकन रोकें',
            cancelButton: 'रद्द करें',
            pauseButton: 'रोकें',
            doneButton: 'हो गया',
            resumeButton: 'फिर से शुरू करें',
            sendButton: 'भेजें',
            microphoneTitle: 'माइक्रोफ़ोन',
            permissionDeniedTitle: 'माइक्रोफ़ोन अनुमति',
            permissionDeniedMessage: 'रिकॉर्ड करने के लिए कृपया माइक्रोफ़ोन एक्सेस की अनुमति दें।',
            nativeNotAvailable: 'नेटिव रिकॉर्डिंग उपलब्ध नहीं है।',
            unsupported: 'इस डिवाइस पर ध्वनि रिकॉर्डिंग समर्थित नहीं है।',
            failedToStart: 'रिकॉर्डिंग शुरू करने में विफल।',
            failedToStop: 'रिकॉर्डिंग रोकने में विफल।',
            recordingFailed: 'रिकॉर्डिंग विफल।'
        },
        relayStatus: {
            sending: 'भेज रहा है...',
            sentToRelays: '{successful}/{desired} रिले को भेजा गया'
        },
        searchPlaceholder: 'खोजें',
        searchNoMatches: 'कोई मिलान नहीं',
        searchAriaLabel: 'चैट में खोजें'
    },
    settings: {
        title: 'सेटिंग्स',
        categories: {
            general: 'सामान्य',
            profile: 'प्रोफ़ाइल',
            messagingRelays: 'मैसेजिंग रिले',
            mediaServers: 'मीडिया सर्वर',
            security: 'सुरक्षा',
            about: 'जानकारी'
        },
        general: {
            appearanceLabel: 'दिखावट',
            appearanceDescription: 'सिस्टम, लाइट या डार्क मोड में से चुनें।',
            languageLabel: 'भाषा',
            languageDescription: 'अपनी पसंदीदा ऐप भाषा चुनें।'
        },
        notifications: {
            label: 'सूचनाएँ',
            supportedDescription: 'इस डिवाइस पर नए संदेश प्राप्त होने पर सूचना पाएँ',
            unsupportedDescription: 'इस डिवाइस पर सूचनाएँ समर्थित नहीं हैं'
        },
        backgroundMessaging: {
            label: 'बैकग्राउंड मैसेजिंग',
            description: 'ऐप बैकग्राउंड में होने पर nospeak को अपनी मैसेजिंग रिले से कनेक्टेड रखें और संदेश/प्रतिक्रिया सूचनाएँ प्राप्त करें। यह सक्षम होने पर Android एक स्थायी सूचना दिखाएगा। यह स्थानीय कुंजी (nsec) और Amber दोनों लॉगिन के साथ काम करता है। आपकी Android लॉकस्क्रीन गोपनीयता सेटिंग्स द्वारा सूचना पूर्वावलोकन सीमित हो सकते हैं।',
            openBatterySettings: 'बैटरी सेटिंग्स खोलें'
        },
        urlPreviews: {
            label: 'URL पूर्वावलोकन',
            description: 'संदेशों में गैर-मीडिया लिंक के लिए पूर्वावलोकन कार्ड दिखाएँ।'
        },
        profile: {
            nameLabel: 'नाम',
            namePlaceholder: 'आपका नाम',
            displayNameLabel: 'प्रदर्शन नाम',
            displayNamePlaceholder: 'प्रदर्शन नाम',
            aboutLabel: 'परिचय',
            aboutPlaceholder: 'अपने बारे में बताएँ',
            pictureUrlLabel: 'चित्र URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'बैनर URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (उपयोगकर्ता नाम)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: 'वेबसाइट',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning पता (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'बदलाव सहेजें',
            savingButton: 'सहेज रहा है...'
        },
        messagingRelays: {
            description: 'अपनी NIP-17 मैसेजिंग रिले कॉन्फ़िगर करें। इन रिले का उपयोग आपके एन्क्रिप्टेड संदेश प्राप्त करने के लिए किया जाता है। सर्वोत्तम प्रदर्शन के लिए, 2 मैसेजिंग रिले सबसे अच्छा काम करती हैं।',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'जोड़ें',
            emptyState: 'कोई रिले कॉन्फ़िगर नहीं',
            tooManyWarning: '3 से अधिक मैसेजिंग रिले होने से प्रदर्शन और विश्वसनीयता कम हो सकती है।',
            saveStatusSuccess: '{count} रिले पर रिले सूची सहेजी गई।',
            saveStatusPartial: '{attempted} में से {succeeded} रिले पर रिले सूची सहेजी गई।',
            saveStatusNone: 'किसी भी रिले पर रिले सूची नहीं सहेजी जा सकी।',
            saveStatusError: 'रिले सूची सहेजने में त्रुटि। आपकी सेटिंग्स पूरी तरह प्रसारित नहीं हो सकती हैं।',
            savingStatus: 'रिले सेटिंग्स सहेज रहा है…'
        },
        mediaServers: {
            description: 'अपने Blossom मीडिया सर्वर कॉन्फ़िगर करें। इन सर्वरों का उपयोग आपकी अपलोड की गई फ़ाइलों (प्रोफ़ाइल मीडिया और चैट अटैचमेंट) को स्टोर करने के लिए किया जाता है।',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'जोड़ें',
            emptyState: 'कोई सर्वर कॉन्फ़िगर नहीं',
            saveStatusSuccess: '{count} रिले पर सर्वर सूची सहेजी गई।',
            saveStatusPartial: '{attempted} में से {succeeded} रिले पर सर्वर सूची सहेजी गई।',
            saveStatusNone: 'किसी भी रिले पर सर्वर सूची नहीं सहेजी जा सकी।',
            saveStatusError: 'सर्वर सूची सहेजने में त्रुटि। आपकी सेटिंग्स पूरी तरह प्रसारित नहीं हो सकती हैं।',
            savingStatus: 'मीडिया सर्वर सेटिंग्स सहेज रहा है…',
            primary: 'प्राथमिक',
            setAsPrimary: 'प्राथमिक सेट करें',
            mediaCacheLabel: 'मीडिया कैश',
            mediaCacheDescription: 'ऑफ़लाइन एक्सेस के लिए देखे गए मीडिया को अपनी गैलरी में सहेजें। फ़ाइलें आपके फ़ोटो ऐप में प्रबंधित की जा सकती हैं।'
        },
        security: {
            loginMethodTitle: 'लॉगिन विधि',
            loginMethodUnknown: 'अज्ञात',
            npubLabel: 'आपका npub',
            nsecLabel: 'आपका nsec',
            hideNsecAria: 'nsec छुपाएँ',
            showNsecAria: 'nsec दिखाएँ',
            dangerZoneTitle: 'खतरा क्षेत्र',
            dangerZoneDescription: 'लॉगआउट करने से इस डिवाइस से सभी कैश्ड डेटा हट जाएगा।',
            logoutButton: 'लॉगआउट'
        },
        pin: {
            appLockLabel: 'ऐप लॉक',
            appLockDescription: 'ऐप तक पहुँचने के लिए PIN आवश्यक हो',
            changePinButton: 'PIN बदलें',
            enterNewPin: 'PIN सेट करें',
            enterNewPinDescription: '4 अंकों का PIN दर्ज करें',
            confirmPin: 'PIN की पुष्टि करें',
            confirmPinDescription: 'वही PIN दोबारा दर्ज करें',
            enterCurrentPin: 'PIN दर्ज करें',
            enterCurrentPinDescription: 'अपना वर्तमान PIN दर्ज करें',
            wrongPin: 'गलत PIN',
            pinMismatch: 'PIN मेल नहीं खाते, पुनः प्रयास करें',
            enterPinToUnlock: 'अनलॉक करने के लिए PIN दर्ज करें'
        }
    },
    signerMismatch: {
        title: 'खाता बेमेल',
        description: 'आपके ब्राउज़र साइनर एक्सटेंशन में उस खाते से अलग खाता सक्रिय है जिससे आपने लॉगिन किया था।',
        expectedAccount: 'लॉगिन किया हुआ',
        actualAccount: 'साइनर सक्रिय खाता',
        instructions: 'कृपया अपने साइनर एक्सटेंशन में सही खाते पर स्विच करें और इस पेज को रीलोड करें।'
    }
};

export default hi;
