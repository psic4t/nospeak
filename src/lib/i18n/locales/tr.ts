const tr = {
    common: {
        appName: 'nospeak',
        save: 'Kaydet',
        cancel: 'İptal'
    },
    auth: {
        loginWithAmber: 'Amber ile giriş yap',
        loginWithExtension: 'Nostr İmzalayıcı Eklentisi ile giriş yap',
        orSeparator: 'VEYA',
        loginWithNsecLabel: 'nsec ile giriş yap',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Giriş Yap',
        connecting: 'Bağlanıyor...',
        generateKeypairLink: 'Yeni anahtar çifti oluştur',
        downloadAndroidApp: 'Android Uygulamasını İndir',
        amber: {
            title: 'Amber ile giriş yap',
            helper: 'Bu QR kodunu Amber ile tarayın veya aşağıdaki düğmeleri kullanın.',
            openInAmber: 'Amber\'da Aç',
            copyConnectionString: 'Bağlantı Dizesini Kopyala',
            copied: 'Kopyalandı!'
        },
        keypair: {
            title: 'Yeni anahtar çifti oluştur',
            description: 'Tarayıcınızda yerel olarak yeni bir Nostr anahtar çifti oluşturulur.',
            npubLabel: 'npub (açık anahtar)',
            nsecLabel: 'nsec (gizli anahtar)',
            generateAnother: 'Başka bir tane oluştur',
            useAndLogin: 'Bu anahtar çiftini kullan ve giriş yap'
        }
    },
    chats: {
        title: 'Sohbetler',
        emptyHint: 'Henüz sohbet yok. Kişi eklemek için + simgesine dokunun.',
        selectPrompt: 'Mesajlaşmaya başlamak için bir sohbet seçin',
        addContact: 'Kişi ekle',
        filterAll: 'Tümü',
        filterUnread: 'Okunmamış',
        filterGroups: 'Gruplar',
        emptyUnread: 'Okunmamış sohbet yok',
        emptyGroups: 'Grup yok',
        favorites: 'Favoriler',
        favoriteMessage: 'mesaj',
        favoriteMessages: 'mesaj',
        emptyFavorites: 'Henüz favori mesaj yok',
        archive: 'Arşivle',
        unarchive: 'Arşivden Çıkar',
        archived: 'Arşivlendi',
        emptyArchive: 'Arşivlenmiş sohbet yok',
        chatArchived: 'Sohbet arşivlendi'
    },
    contacts: {
        title: 'Kişiler',
        manage: 'Yönet',
        scanQr: 'QR Tara',
        scanQrAria: 'Kişi QR kodunu tara',
        emptyHint: 'Kişi görünmüyorsa eklemek için Yönet\'e tıklayın.',
        selectPrompt: 'Sohbet başlatmak için bir kişi seçin',
        youPrefix: 'Sen',
        mediaPreview: {
            image: 'Görsel',
            video: 'Video',
            voiceMessage: 'Sesli Mesaj',
            audio: 'Ses',
            file: 'Dosya',
            location: 'Konum'
        }
    },
    connection: {
        relaysLabel: 'Röle:',
        authLabel: 'Kimlik Doğrulama:',
        authFailedLabel: 'Başarısız:'
    },
    sync: {
        title: 'Mesajlar eşitleniyor...',
        fetched: '{count} alındı',
        errorTitle: 'Eşitleme başarısız',
        timeoutError: 'Eşitleme 5 dakika sonra zaman aşımına uğradı',
        relayErrorsTitle: 'Röle hataları',
        retryButton: 'Tekrar Dene',
        skipButton: 'Atla ve devam et',
        continueInBackground: 'Arka planda devam et',
        backgroundComplete: 'Eşitleme tamamlandı',
        manualRelay: {
            label: 'Veya elle bir röle girin',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'Bağlan',
            connecting: 'Bağlanıyor...',
            invalidUrl: 'Geçersiz röle URL'
        },
        steps: {
            connectDiscoveryRelays: 'Keşif rölelerine bağlan',
            fetchMessagingRelays: 'Kullanıcının mesajlaşma rölelerini al ve önbelleğe al',
            connectReadRelays: 'Kullanıcının mesajlaşma rölelerine bağlan',
            fetchHistory: 'Rölelerden geçmiş öğelerini al ve önbelleğe al',
            fetchContacts: 'Rölelerden kişileri al ve birleştir',
            fetchContactProfiles: 'Kişi profillerini ve röle bilgilerini al ve önbelleğe al',
            fetchUserProfile: 'Kullanıcı profilini al ve önbelleğe al'
        }
    },
    modals: {
        manageContacts: {
            title: 'Kişiler',
            scanQr: 'QR Tara',
            scanQrAria: 'Kişi eklemek için QR kodu tara',
            searchPlaceholder: 'npub, NIP-05 veya arama terimi',
            addContactAria: 'Kişi ekle',
            searchContactsAria: 'Kişileri ara',
            searching: 'Aranıyor...',
            searchFailed: 'Arama başarısız',
            noResults: 'Sonuç bulunamadı',
            noContacts: 'Kişi eklenmemiş',
            removeContactAria: 'Kişiyi kaldır',
            resolvingNip05: 'NIP-05 aranıyor...',
            nip05LookupFailed: 'NIP-05 araması başarısız',
            nip05NotFound: 'NIP-05 bulunamadı',
            nip05InvalidFormat: 'Geçersiz NIP-05 biçimi (ad@alan.com kullanın)',
            alreadyAdded: 'Zaten ekli',
            syncing: 'Kişiler eşitleniyor…',
            pullToRefresh: 'Yenilemek için aşağı çekin',
            releaseToRefresh: 'Yenilemek için bırakın',
            newContact: 'Kişi ekle',
            createGroup: 'Grup oluştur',
            contextMenu: {
                openMenu: 'Menüyü aç',
                viewProfile: 'Profili görüntüle',
                delete: 'Sil'
            },
            confirmDelete: {
                title: 'Kişiyi Sil',
                message: '{name} kişisini silmek istediğinizden emin misiniz?',
                confirm: 'Sil'
            }
        },
        createGroup: {
            title: 'Grup Sohbeti Oluştur',
            searchPlaceholder: 'Kişileri ara',
            selectedCount: '{count} seçili',
            minContactsHint: 'En az 2 kişi seçin',
            createButton: 'Grup Oluştur',
            creating: 'Oluşturuluyor...',
            noContacts: 'Gruba eklenecek kişi yok'
        },
        profile: {
            unknownName: 'Bilinmiyor',
            about: 'Hakkında',
            publicKey: 'Açık Anahtar',
            messagingRelays: 'Mesajlaşma Röleleri',
            noRelays: 'Yok',
            refreshing: 'Profil yenileniyor…',
            notFound: 'Profil bulunamadı',
            addToContacts: 'Kişilere ekle',
            addingContact: 'Ekleniyor…',
            contactAdded: 'Kişi eklendi'
        },
        emptyProfile: {
            title: 'Profilinizi tamamlayın',
            introLine1: 'Bu anahtarın henüz yapılandırılmış mesajlaşma röleleri veya kullanıcı adı yok.',
            introLine2: 'nospeak\'in mesaj gönderip alabilmesi için bazı varsayılan mesajlaşma rölelerini yapılandıracağız. Bunları daha sonra Ayarlar altındaki Mesajlaşma Röleleri bölümünden değiştirebilirsiniz.',
            usernameLabel: 'Kullanıcı Adı',
            usernamePlaceholder: 'Adınız',
            usernameRequired: 'Devam etmek için bir kullanıcı adı girin.',
            saveError: 'İlk kurulum kaydedilemedi. Lütfen tekrar deneyin.',
            doLater: 'Bunu daha sonra yapacağım',
            saving: 'Kaydediliyor...',
            continue: 'Devam Et',
            autoRelaysConfigured: 'Mesajlaşma röleleri yapılandırıldı. Bunları Ayarlar\'dan değiştirebilirsiniz.'
        },
        relayStatus: {
            title: 'Röle Bağlantıları',
            noRelays: 'Yapılandırılmış röle yok',
            connected: 'Bağlı',
            disconnected: 'Bağlantı Kesildi',
            typeLabel: 'Tür:',
            lastConnectedLabel: 'Son Bağlantı:',
            successLabel: 'Başarılı:',
            failureLabel: 'Başarısız:',
            authLabel: 'Kimlik Doğrulama:',
            authErrorLabel: 'Kimlik doğrulama hatası:',
            authNotRequired: 'Gerekli değil',
            authRequired: 'Gerekli',
            authAuthenticating: 'Doğrulanıyor',
            authAuthenticated: 'Doğrulandı',
            authFailed: 'Başarısız',
            typePersistent: 'Kalıcı',
            typeTemporary: 'Geçici',
            never: 'Hiçbir zaman'
        },
        qr: {
            title: 'QR Kodu',
            tabs: {
                myQr: 'Benim kodum',
                scanQr: 'Kod tara'
            }
        },
        userQr: {
            preparing: 'QR kodu hazırlanıyor…',
            hint: 'Bu sizin npub\'ınızın QR kodu olarak gösterimidir. Sizi kişi olarak ekleyebilmeleri için biriyle paylaşın.'
        },
        scanContactQr: {
            title: 'Kişi QR\'sini tara',
            instructions: 'Kişi eklemek için kameranızı bir Nostr QR koduna doğrultun.',
            scanning: 'Taranıyor…',
            noCamera: 'Bu cihazda kamera kullanılamıyor.',
            invalidQr: 'Bu QR kodu geçerli bir kişi npub\'ı içermiyor.',
            addFailed: 'Bu QR\'den kişi eklenemedi. Lütfen tekrar deneyin.',
            added: 'QR\'den kişi eklendi.'
        },
        scanContactQrResult: {
            title: 'QR\'den Kişi',
            alreadyContact: 'Bu kişi zaten kişilerinizde mevcut.',
            reviewHint: 'Eklemeden önce taranan QR\'deki kişiyi gözden geçirin.',
            updatingProfile: 'Profil güncelleniyor…',
            loadFailed: 'QR\'den kişi ayrıntıları yüklenemedi.',
            addFailed: 'QR\'den kişi eklenemedi.',
            closeButton: 'Kapat',
            addButton: 'Kişi ekle',
            startChatButton: 'Sohbet başlat'
        },
        attachmentPreview: {
            title: 'Ek önizlemesi',
            imageAlt: 'Ek önizlemesi',
            noPreview: 'Önizleme mevcut değil',
            captionLabel: 'Açıklama (isteğe bağlı)',
            cancelButton: 'İptal',
            sendButtonIdle: 'Gönder',
            sendButtonSending: 'Gönderiliyor…',
            uploadButtonIdle: 'Yükle',
            uploadButtonUploading: 'Yükleniyor…'
        },
        locationPreview: {
            title: 'Konum',
            closeButton: 'Kapat',
            openInOpenStreetMap: 'OpenStreetMap\'de Aç',
            ctrlScrollToZoom: 'Yakınlaştırmak için Ctrl + kaydırma kullanın'
        },
        mediaServersAutoConfigured: {
            title: 'Medya sunucuları yapılandırıldı',
            message: 'Yapılandırılmış Blossom sunucusu bulunamadı. {server1} ve {server2} eklendi.\n\nBunları Ayarlar → Medya Sunucuları bölümünden değiştirebilirsiniz.'
        }
    },
    chat: {
        sendFailedTitle: 'Gönderme başarısız',
        sendFailedMessagePrefix: 'Mesaj gönderilemedi: ',
        location: {
            errorTitle: 'Konum Hatası',
            errorMessage: 'Konumunuz alınamadı. Lütfen izinleri kontrol edin.'
        },
        relative: {
            justNow: 'az önce',
            minutes: '{count} dk önce',
            minutesPlural: '{count} dk önce',
            hours: '{count} saat önce',
            hoursPlural: '{count} saat önce',
            days: '{count} gün önce',
            daysPlural: '{count} gün önce',
            weeks: '{count} hafta önce',
            weeksPlural: '{count} hafta önce',
            months: '{count} ay önce',
            monthsPlural: '{count} ay önce',
            years: '{count} yıl önce',
            yearsPlural: '{count} yıl önce'
        },
        dateLabel: {
            today: 'Bugün',
            yesterday: 'Dün'
        },
        history: {
            fetchOlder: 'Rölelerden eski mesajları al',
            summary: '{events} olay alındı, {saved} yeni mesaj kaydedildi ({chat} bu sohbette)',
            none: 'Rölelerden başka mesaj yok',
            error: 'Eski mesajlar alınamadı. Daha sonra tekrar deneyin.'
        },
        empty: {
            noMessagesTitle: 'Henüz mesaj yok',
            forContact: '{name} ile sohbete başlayın.',
            forGroup: '{name} grubunda sohbete başlayın.',
            generic: 'Sohbet başlatmak için bir kişi seçin.'
        },
        group: {
            defaultTitle: 'Grup Sohbeti',
            participants: '{count} katılımcı',
            participantsShort: '{count}',
            members: 'Üyeler: {count}',
            membersTitle: 'Üyeler',
            viewMembers: 'Üyeleri görüntüle',
            editName: 'Grup adını düzenle',
            editNameTitle: 'Grup Adı',
            editNamePlaceholder: 'Grup adını girin...',
            editNameHint: 'Katılımcı adlarını kullanmak için boş bırakın',
            editNameSave: 'Kaydet',
            editNameCancel: 'İptal',
            nameSavedToast: 'Kaydedildi. Sonraki mesajla birlikte uygulanacak.',
            nameValidationTooLong: 'Ad çok uzun (en fazla 100 karakter)',
            nameValidationInvalidChars: 'Ad geçersiz karakterler içeriyor'
        },
        inputPlaceholder: 'Mesaj yazın...',
        contextMenu: {
            cite: 'Alıntıla',
            copy: 'Kopyala',
            sentAt: 'Gönderildi',
            favorite: 'Favorilere ekle',
            unfavorite: 'Favorilerden çıkar'
        },
        reactions: {
            cannotReactTitle: 'Tepki Verilemiyor',
            cannotReactMessage: 'Bu mesaj tepkileri desteklemek için çok eski.',
            failedTitle: 'Tepki başarısız',
            failedMessagePrefix: 'Tepki gönderilemedi: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Medya yükle',
            takePhoto: 'Fotoğraf çek',
            location: 'Konum',
            image: 'Görsel',
            video: 'Video',
            audio: 'Müzik',
            file: 'Dosya'
        },
        mediaErrors: {
            cameraErrorTitle: 'Kamera hatası',
            cameraErrorMessage: 'Fotoğraf çekilemedi'
        },
        fileUpload: {
            fileTooLarge: 'Dosya çok büyük. Maksimum boyut 10 MB.',
            download: 'İndir',
            decrypting: 'Şifre çözülüyor...'
        },
        mediaUnavailable: 'Bu medya artık mevcut değil.',
        voiceMessage: {
            title: 'Sesli mesaj',
            recordAria: 'Sesli mesaj kaydet',
            playPreviewAria: 'Önizlemeyi oynat',
            pausePreviewAria: 'Önizlemeyi duraklat',
            cancelButton: 'İptal',
            pauseButton: 'Duraklat',
            doneButton: 'Bitti',
            resumeButton: 'Devam Et',
            sendButton: 'Gönder',
            microphoneTitle: 'Mikrofon',
            permissionDeniedTitle: 'Mikrofon izni',
            permissionDeniedMessage: 'Kayıt yapmak için mikrofon erişimine izin verin.',
            nativeNotAvailable: 'Yerel kayıt mevcut değil.',
            unsupported: 'Bu cihazda ses kaydı desteklenmiyor.',
            failedToStart: 'Kayıt başlatılamadı.',
            failedToStop: 'Kayıt durdurulamadı.',
            recordingFailed: 'Kayıt başarısız oldu.'
        },
        relayStatus: {
            sending: 'gönderiliyor...',
            sentToRelays: '{successful}/{desired} röleye gönderildi'
        },
        searchPlaceholder: 'Ara',
        searchNoMatches: 'Eşleşme yok',
        searchAriaLabel: 'Sohbette ara'
    },
    settings: {
        title: 'Ayarlar',
        categories: {
            general: 'Genel',
            profile: 'Profil',
            messagingRelays: 'Mesajlaşma Röleleri',
            mediaServers: 'Medya Sunucuları',
            security: 'Güvenlik',
            about: 'Hakkında'
        },
        general: {
            appearanceLabel: 'Görünüm',
            appearanceDescription: 'Sistem, Açık veya Koyu modu seçin.',
            languageLabel: 'Dil',
            languageDescription: 'Tercih ettiğiniz uygulama dilini seçin.'
        },
        notifications: {
            label: 'Bildirimler',
            supportedDescription: 'Bu cihazda yeni mesaj aldığınızda bildirim alın',
            unsupportedDescription: 'Bu cihazda bildirimler desteklenmiyor'
        },
        backgroundMessaging: {
            label: 'Arka Plan Mesajlaşma',
            description: 'nospeak\'i mesajlaşma rölelerinize bağlı tutun ve uygulama arka plandayken mesaj/tepki bildirimleri alın. Bu etkinleştirildiğinde Android kalıcı bir bildirim gösterecektir. Hem yerel anahtar (nsec) hem de Amber girişleriyle çalışır. Bildirim önizlemeleri Android kilit ekranı gizlilik ayarlarınız tarafından sınırlandırılabilir.',
            openBatterySettings: 'Pil ayarlarını aç'
        },
        urlPreviews: {
            label: 'URL Önizlemeleri',
            description: 'Mesajlardaki medya dışı bağlantılar için önizleme kartları gösterin.'
        },
        profile: {
            nameLabel: 'Ad',
            namePlaceholder: 'Adınız',
            displayNameLabel: 'Görünen Ad',
            displayNamePlaceholder: 'Görünen ad',
            aboutLabel: 'Hakkında',
            aboutPlaceholder: 'Kendinizden bahsedin',
            pictureUrlLabel: 'Profil Resmi URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'Kapak Resmi URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Kullanıcı Adı)',
            nip05Placeholder: 'ad@alan.com',
            websiteLabel: 'Web Sitesi',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning Adresi (LUD-16)',
            lightningPlaceholder: 'kullanici@saglayici.com',
            saveButton: 'Değişiklikleri Kaydet',
            savingButton: 'Kaydediliyor...'
        },
        messagingRelays: {
            description: 'NIP-17 mesajlaşma rölelerinizi yapılandırın. Bu röleler şifreli mesajlarınızı almak için kullanılır. En iyi performans için genellikle 2 mesajlaşma rölesi yeterlidir.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Ekle',
            emptyState: 'Yapılandırılmış röle yok',
            tooManyWarning: '3\'ten fazla mesajlaşma rölesine sahip olmak performansı ve güvenilirliği azaltabilir.',
            saveStatusSuccess: 'Röle listesi {count} röleye kaydedildi.',
            saveStatusPartial: 'Röle listesi {attempted} röleden {succeeded} tanesine kaydedildi.',
            saveStatusNone: 'Röle listesi hiçbir röleye kaydedilemedi.',
            saveStatusError: 'Röle listesi kaydedilirken hata oluştu. Ayarlarınız tam olarak yayılmamış olabilir.',
            savingStatus: 'Röle ayarları kaydediliyor…'
        },
        mediaServers: {
            description: 'Blossom medya sunucularınızı yapılandırın. Bu sunucular yüklediğiniz dosyaları (profil medyası ve sohbet ekleri) depolamak için kullanılır.',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Ekle',
            emptyState: 'Yapılandırılmış sunucu yok',
            saveStatusSuccess: 'Sunucu listesi {count} röleye kaydedildi.',
            saveStatusPartial: 'Sunucu listesi {attempted} röleden {succeeded} tanesine kaydedildi.',
            saveStatusNone: 'Sunucu listesi hiçbir röleye kaydedilemedi.',
            saveStatusError: 'Sunucu listesi kaydedilirken hata oluştu. Ayarlarınız tam olarak yayılmamış olabilir.',
            savingStatus: 'Medya sunucu ayarları kaydediliyor…',
            primary: 'Birincil',
            setAsPrimary: 'Birincil olarak ayarla',
            mediaCacheLabel: 'Medya Önbelleği',
            mediaCacheDescription: 'Çevrimdışı erişim için görüntülenen medyayı galerinize kaydedin. Dosyalar Fotoğraflar uygulamanızda yönetilebilir.'
        },
        security: {
            loginMethodTitle: 'Giriş yöntemi',
            loginMethodUnknown: 'Bilinmiyor',
            npubLabel: 'npub\'ınız',
            nsecLabel: 'nsec\'iniz',
            hideNsecAria: 'nsec\'i gizle',
            showNsecAria: 'nsec\'i göster',
            dangerZoneTitle: 'Tehlikeli Bölge',
            dangerZoneDescription: 'Çıkış yapmak bu cihazdaki tüm önbelleğe alınmış verileri silecektir.',
            logoutButton: 'Çıkış Yap'
        },
        pin: {
            appLockLabel: 'Uygulama Kilidi',
            appLockDescription: 'Uygulamaya erişmek için PIN gerekli olsun',
            changePinButton: 'PIN Değiştir',
            enterNewPin: 'PIN Belirle',
            enterNewPinDescription: '4 haneli bir PIN girin',
            confirmPin: 'PIN\'i Onayla',
            confirmPinDescription: 'Aynı PIN\'i tekrar girin',
            enterCurrentPin: 'PIN Girin',
            enterCurrentPinDescription: 'Mevcut PIN\'inizi girin',
            wrongPin: 'Yanlış PIN',
            pinMismatch: 'PIN\'ler eşleşmiyor, tekrar deneyin',
            enterPinToUnlock: 'Kilidini açmak için PIN girin'
        }
    },
    signerMismatch: {
        title: 'Hesap Uyuşmazlığı',
        description: 'Tarayıcı imzalayıcı eklentinizde giriş yaptığınız hesaptan farklı bir hesap etkin.',
        expectedAccount: 'Giriş yapılan hesap',
        actualAccount: 'İmzalayıcı etkin hesap',
        instructions: 'Lütfen imzalayıcı eklentinizde doğru hesaba geçin ve bu sayfayı yeniden yükleyin.'
    }
};

export default tr;
