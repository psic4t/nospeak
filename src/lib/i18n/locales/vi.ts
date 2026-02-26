const vi = {
    common: {
        appName: 'nospeak',
        save: 'Lưu',
        cancel: 'Hủy'
    },
    auth: {
        loginWithAmber: 'Đăng nhập bằng Amber',
        loginWithExtension: 'Đăng nhập bằng Tiện ích ký Nostr',
        orSeparator: 'HOẶC',
        loginWithNsecLabel: 'Đăng nhập bằng nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Đăng nhập',
        connecting: 'Đang kết nối...',
        generateKeypairLink: 'Tạo cặp khóa mới',
        downloadAndroidApp: 'Tải ứng dụng Android',
        amber: {
            title: 'Đăng nhập bằng Amber',
            helper: 'Quét mã QR này bằng Amber hoặc sử dụng các nút bên dưới.',
            openInAmber: 'Mở trong Amber',
            copyConnectionString: 'Sao chép chuỗi kết nối',
            copied: 'Đã sao chép!'
        },
        keypair: {
            title: 'Tạo cặp khóa mới',
            description: 'Một cặp khóa Nostr mới được tạo cục bộ trong trình duyệt của bạn.',
            npubLabel: 'npub (khóa công khai)',
            nsecLabel: 'nsec (khóa bí mật)',
            generateAnother: 'Tạo cặp khóa khác',
            useAndLogin: 'Sử dụng cặp khóa này và đăng nhập'
        }
    },
    chats: {
        title: 'Trò chuyện',
        emptyHint: 'Chưa có cuộc trò chuyện nào. Nhấn + để thêm liên hệ.',
        selectPrompt: 'Chọn một cuộc trò chuyện để bắt đầu nhắn tin',
        addContact: 'Thêm liên hệ',
        filterAll: 'Tất cả',
        filterUnread: 'Chưa đọc',
        filterGroups: 'Nhóm',
        emptyUnread: 'Không có cuộc trò chuyện chưa đọc',
        emptyGroups: 'Không có nhóm',
        favorites: 'Yêu thích',
        favoriteMessage: 'tin nhắn',
        favoriteMessages: 'tin nhắn',
        emptyFavorites: 'Chưa có tin nhắn yêu thích',
        export: 'Xuất',
        archive: 'Lưu trữ',
        unarchive: 'Bỏ lưu trữ',
        archived: 'Đã lưu trữ',
        emptyArchive: 'Không có cuộc trò chuyện đã lưu trữ',
        chatArchived: 'Cuộc trò chuyện đã được lưu trữ'
    },
    contacts: {
        title: 'Danh bạ',
        manage: 'Quản lý',
        scanQr: 'Quét QR',
        scanQrAria: 'Quét mã QR liên hệ',
        emptyHint: 'Nếu không có liên hệ nào xuất hiện, hãy nhấn Quản lý để thêm.',
        selectPrompt: 'Chọn một liên hệ để bắt đầu trò chuyện',
        youPrefix: 'Bạn',
        mediaPreview: {
            image: 'Hình ảnh',
            video: 'Video',
            voiceMessage: 'Tin nhắn thoại',
            audio: 'Âm thanh',
            file: 'Tệp',
            location: 'Vị trí'
        }
    },
    connection: {
        relaysLabel: 'Relay:',
        authLabel: 'Xác thực:',
        authFailedLabel: 'Thất bại:'
    },
    sync: {
        title: 'Đang đồng bộ tin nhắn...',
        fetched: 'Đã tải {count}',
        errorTitle: 'Đồng bộ thất bại',
        timeoutError: 'Đồng bộ đã hết thời gian sau 5 phút',
        relayErrorsTitle: 'Lỗi relay',
        retryButton: 'Thử lại',
        skipButton: 'Bỏ qua và tiếp tục',
        continueInBackground: 'Tiếp tục ở chế độ nền',
        backgroundComplete: 'Đồng bộ hoàn tất',
        manualRelay: {
            label: 'Hoặc nhập relay thủ công',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: 'Kết nối',
            connecting: 'Đang kết nối...',
            invalidUrl: 'URL relay không hợp lệ'
        },
        steps: {
            connectDiscoveryRelays: 'Kết nối đến các relay khám phá',
            fetchMessagingRelays: 'Tải và lưu cache các relay nhắn tin của người dùng',
            connectReadRelays: 'Kết nối đến các relay nhắn tin của người dùng',
            fetchHistory: 'Tải và lưu cache lịch sử từ các relay',
            fetchContacts: 'Tải và hợp nhất danh bạ từ các relay',
            fetchContactProfiles: 'Tải và lưu cache hồ sơ liên hệ và thông tin relay',
            fetchUserProfile: 'Tải và lưu cache hồ sơ người dùng'
        }
    },
    modals: {
        manageContacts: {
            title: 'Danh bạ',
            scanQr: 'Quét QR',
            scanQrAria: 'Quét mã QR để thêm liên hệ',
            searchPlaceholder: 'npub, NIP-05, hoặc từ khóa tìm kiếm',
            addContactAria: 'Thêm liên hệ',
            searchContactsAria: 'Tìm kiếm liên hệ',
            searching: 'Đang tìm kiếm...',
            searchFailed: 'Tìm kiếm thất bại',
            noResults: 'Không có kết quả',
            noContacts: 'Chưa có liên hệ nào',
            removeContactAria: 'Xóa liên hệ',
            resolvingNip05: 'Đang tra cứu NIP-05...',
            nip05LookupFailed: 'Tra cứu NIP-05 thất bại',
            nip05NotFound: 'Không tìm thấy NIP-05',
            nip05InvalidFormat: 'Định dạng NIP-05 không hợp lệ (sử dụng tên@domain.com)',
            alreadyAdded: 'Đã được thêm',
            syncing: 'Đang đồng bộ danh bạ…',
            pullToRefresh: 'Kéo xuống để làm mới',
            releaseToRefresh: 'Thả để làm mới',
            newContact: 'Thêm liên hệ',
            createGroup: 'Tạo nhóm',
            contextMenu: {
                openMenu: 'Mở menu',
                viewProfile: 'Xem hồ sơ',
                delete: 'Xóa'
            },
            confirmDelete: {
                title: 'Xóa liên hệ',
                message: 'Bạn có chắc chắn muốn xóa {name} không?',
                confirm: 'Xóa'
            }
        },
        createGroup: {
            title: 'Tạo nhóm trò chuyện',
            searchPlaceholder: 'Tìm kiếm liên hệ',
            selectedCount: 'Đã chọn {count}',
            minContactsHint: 'Chọn ít nhất 2 liên hệ',
            createButton: 'Tạo nhóm',
            creating: 'Đang tạo...',
            noContacts: 'Không có liên hệ để thêm vào nhóm'
        },
        profile: {
            unknownName: 'Không rõ',
            about: 'Giới thiệu',
            publicKey: 'Khóa công khai',
            messagingRelays: 'Relay nhắn tin',
            noRelays: 'Không có',
            refreshing: 'Đang làm mới hồ sơ…',
            notFound: 'Không tìm thấy hồ sơ',
            addToContacts: 'Thêm vào danh bạ',
            addingContact: 'Đang thêm…',
            contactAdded: 'Đã thêm liên hệ'
        },
        emptyProfile: {
            title: 'Hoàn tất thiết lập hồ sơ của bạn',
            introLine1: 'Khóa này chưa có relay nhắn tin hoặc tên người dùng được cấu hình.',
            introLine2: 'Chúng tôi sẽ cấu hình một số relay nhắn tin mặc định để nospeak có thể gửi và nhận tin nhắn. Bạn có thể thay đổi trong Cài đặt mục Relay nhắn tin sau.',
            usernameLabel: 'Tên người dùng',
            usernamePlaceholder: 'Tên của bạn',
            usernameRequired: 'Vui lòng nhập tên người dùng để tiếp tục.',
            saveError: 'Không thể lưu thiết lập ban đầu. Vui lòng thử lại.',
            doLater: 'Tôi sẽ làm sau',
            saving: 'Đang lưu...',
            continue: 'Tiếp tục',
            autoRelaysConfigured: 'Đã cấu hình relay nhắn tin. Bạn có thể thay đổi trong Cài đặt.'
        },
        relayStatus: {
            title: 'Kết nối relay',
            noRelays: 'Chưa cấu hình relay',
            connected: 'Đã kết nối',
            disconnected: 'Đã ngắt kết nối',
            typeLabel: 'Loại:',
            lastConnectedLabel: 'Kết nối lần cuối:',
            successLabel: 'Thành công:',
            failureLabel: 'Thất bại:',
            authLabel: 'Xác thực:',
            authErrorLabel: 'Lỗi xác thực:',
            authNotRequired: 'Không bắt buộc',
            authRequired: 'Bắt buộc',
            authAuthenticating: 'Đang xác thực',
            authAuthenticated: 'Đã xác thực',
            authFailed: 'Thất bại',
            typePersistent: 'Cố định',
            typeTemporary: 'Tạm thời',
            never: 'Chưa bao giờ'
        },
        qr: {
            title: 'Mã QR',
            tabs: {
                myQr: 'Mã của tôi',
                scanQr: 'Quét mã'
            }
        },
        userQr: {
            preparing: 'Đang chuẩn bị mã QR…',
            hint: 'Đây là npub của bạn dưới dạng mã QR. Chia sẻ với người khác để họ có thể quét và thêm bạn vào danh bạ.'
        },
        scanContactQr: {
            title: 'Quét QR liên hệ',
            instructions: 'Hướng camera vào mã QR nostr để thêm liên hệ.',
            scanning: 'Đang quét…',
            noCamera: 'Camera không khả dụng trên thiết bị này.',
            invalidQr: 'Mã QR này không chứa npub liên hệ hợp lệ.',
            addFailed: 'Không thể thêm liên hệ từ mã QR này. Vui lòng thử lại.',
            added: 'Đã thêm liên hệ từ QR.'
        },
        scanContactQrResult: {
            title: 'Liên hệ từ QR',
            alreadyContact: 'Liên hệ này đã có trong danh bạ của bạn.',
            reviewHint: 'Xem lại liên hệ từ mã QR đã quét trước khi thêm.',
            updatingProfile: 'Đang cập nhật hồ sơ…',
            loadFailed: 'Không thể tải chi tiết liên hệ từ QR.',
            addFailed: 'Không thể thêm liên hệ từ QR.',
            closeButton: 'Đóng',
            addButton: 'Thêm liên hệ',
            startChatButton: 'Bắt đầu trò chuyện'
        },
        attachmentPreview: {
            title: 'Xem trước tệp đính kèm',
            imageAlt: 'Xem trước tệp đính kèm',
            noPreview: 'Không có bản xem trước',
            captionLabel: 'Chú thích (tùy chọn)',
            cancelButton: 'Hủy',
            sendButtonIdle: 'Gửi',
            sendButtonSending: 'Đang gửi…',
            uploadButtonIdle: 'Tải lên',
            uploadButtonUploading: 'Đang tải lên…'
        },
        locationPreview: {
            title: 'Vị trí',
            closeButton: 'Đóng',
            openInOpenStreetMap: 'Mở trong OpenStreetMap',
            ctrlScrollToZoom: 'Sử dụng Ctrl + cuộn để phóng to'
        },
        mediaServersAutoConfigured: {
            title: 'Đã cấu hình máy chủ media',
            message: 'Chưa có máy chủ Blossom nào được cấu hình. Chúng tôi đã thêm {server1} và {server2}.\n\nBạn có thể thay đổi trong Cài đặt → Máy chủ media.'
        }
    },
    chat: {
        sendFailedTitle: 'Gửi thất bại',
        sendFailedMessagePrefix: 'Không thể gửi tin nhắn: ',
        location: {
            errorTitle: 'Lỗi vị trí',
            errorMessage: 'Không thể lấy vị trí của bạn. Vui lòng kiểm tra quyền truy cập.'
        },
        relative: {
            justNow: 'vừa xong',
            minutes: '{count} phút trước',
            minutesPlural: '{count} phút trước',
            hours: '{count} giờ trước',
            hoursPlural: '{count} giờ trước',
            days: '{count} ngày trước',
            daysPlural: '{count} ngày trước',
            weeks: '{count} tuần trước',
            weeksPlural: '{count} tuần trước',
            months: '{count} tháng trước',
            monthsPlural: '{count} tháng trước',
            years: '{count} năm trước',
            yearsPlural: '{count} năm trước'
        },
        dateLabel: {
            today: 'Hôm nay',
            yesterday: 'Hôm qua'
        },
        history: {
            fetchOlder: 'Tải tin nhắn cũ hơn từ các relay',
            summary: 'Đã tải {events} sự kiện, lưu {saved} tin nhắn mới ({chat} trong cuộc trò chuyện này)',
            none: 'Không còn tin nhắn từ các relay',
            error: 'Không thể tải tin nhắn cũ hơn. Vui lòng thử lại sau.'
        },
        empty: {
            noMessagesTitle: 'Chưa có tin nhắn',
            forContact: 'Bắt đầu cuộc trò chuyện với {name}.',
            forGroup: 'Bắt đầu cuộc trò chuyện trong {name}.',
            generic: 'Chọn một liên hệ để bắt đầu trò chuyện.'
        },
        group: {
            defaultTitle: 'Nhóm trò chuyện',
            participants: '{count} thành viên',
            participantsShort: '{count}',
            members: 'Thành viên: {count}',
            membersTitle: 'Thành viên',
            viewMembers: 'Xem thành viên',
            editName: 'Sửa tên nhóm',
            editNameTitle: 'Tên nhóm',
            editNamePlaceholder: 'Nhập tên nhóm...',
            editNameHint: 'Để trống để sử dụng tên các thành viên',
            editNameSave: 'Lưu',
            editNameCancel: 'Hủy',
            nameSavedToast: 'Đã lưu. Sẽ được áp dụng với tin nhắn tiếp theo.',
            nameValidationTooLong: 'Tên quá dài (tối đa 100 ký tự)',
            nameValidationInvalidChars: 'Tên chứa ký tự không hợp lệ'
        },
        inputPlaceholder: 'Nhập tin nhắn...',
        contextMenu: {
            cite: 'Trích dẫn',
            copy: 'Sao chép',
            sentAt: 'Đã gửi',
            favorite: 'Yêu thích',
            unfavorite: 'Bỏ yêu thích'
        },
        reactions: {
            cannotReactTitle: 'Không thể bày tỏ cảm xúc',
            cannotReactMessage: 'Tin nhắn này quá cũ để hỗ trợ bày tỏ cảm xúc.',
            failedTitle: 'Bày tỏ cảm xúc thất bại',
            failedMessagePrefix: 'Không thể gửi cảm xúc: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Tải lên media',
            takePhoto: 'Chụp ảnh',
            location: 'Vị trí',
            image: 'Hình ảnh',
            video: 'Video',
            audio: 'Nhạc',
            file: 'Tệp'
        },
        mediaErrors: {
            cameraErrorTitle: 'Lỗi camera',
            cameraErrorMessage: 'Không thể chụp ảnh'
        },
        fileUpload: {
            fileTooLarge: 'Tệp quá lớn. Kích thước tối đa là 10 MB.',
            download: 'Tải xuống',
            decrypting: 'Đang giải mã...'
        },
        mediaUnavailable: 'Media này không còn khả dụng.',
        voiceMessage: {
            title: 'Tin nhắn thoại',
            recordAria: 'Ghi âm tin nhắn thoại',
            playPreviewAria: 'Phát xem trước',
            pausePreviewAria: 'Tạm dừng xem trước',
            cancelButton: 'Hủy',
            pauseButton: 'Tạm dừng',
            doneButton: 'Xong',
            resumeButton: 'Tiếp tục',
            sendButton: 'Gửi',
            microphoneTitle: 'Micrô',
            permissionDeniedTitle: 'Quyền truy cập micrô',
            permissionDeniedMessage: 'Vui lòng cho phép truy cập micrô để ghi âm.',
            nativeNotAvailable: 'Ghi âm gốc không khả dụng.',
            unsupported: 'Ghi âm giọng nói không được hỗ trợ trên thiết bị này.',
            failedToStart: 'Không thể bắt đầu ghi âm.',
            failedToStop: 'Không thể dừng ghi âm.',
            recordingFailed: 'Ghi âm thất bại.'
        },
        relayStatus: {
            sending: 'đang gửi...',
            sentToRelays: 'đã gửi đến {successful}/{desired} relay'
        },
        searchPlaceholder: 'Tìm kiếm',
        searchNoMatches: 'Không có kết quả',
        searchAriaLabel: 'Tìm kiếm trò chuyện'
    },
    settings: {
        title: 'Cài đặt',
        categories: {
            general: 'Chung',
            profile: 'Hồ sơ',
            messagingRelays: 'Relay nhắn tin',
            mediaServers: 'Máy chủ media',
            security: 'Bảo mật',
            about: 'Giới thiệu'
        },
        general: {
            appearanceLabel: 'Giao diện',
            appearanceDescription: 'Chọn chế độ theo Hệ thống, Sáng hoặc Tối.',
            languageLabel: 'Ngôn ngữ',
            languageDescription: 'Chọn ngôn ngữ ưa thích cho ứng dụng.'
        },
        notifications: {
            label: 'Thông báo',
            supportedDescription: 'Nhận thông báo khi có tin nhắn mới trên thiết bị này',
            unsupportedDescription: 'Thiết bị này không hỗ trợ thông báo'
        },
        backgroundMessaging: {
            label: 'Nhắn tin nền',
            description: 'Giữ nospeak kết nối với các relay nhắn tin và nhận thông báo tin nhắn/cảm xúc khi ứng dụng chạy nền. Android sẽ hiển thị thông báo cố định khi tính năng này được bật. Hoạt động với cả đăng nhập bằng khóa cục bộ (nsec) và Amber. Bản xem trước thông báo có thể bị giới hạn bởi cài đặt quyền riêng tư màn hình khóa Android của bạn.',
            openBatterySettings: 'Mở cài đặt pin'
        },
        urlPreviews: {
            label: 'Xem trước URL',
            description: 'Hiển thị thẻ xem trước cho các liên kết không phải media trong tin nhắn.'
        },
        profile: {
            nameLabel: 'Tên',
            namePlaceholder: 'Tên của bạn',
            displayNameLabel: 'Tên hiển thị',
            displayNamePlaceholder: 'Tên hiển thị',
            aboutLabel: 'Giới thiệu',
            aboutPlaceholder: 'Giới thiệu về bản thân',
            pictureUrlLabel: 'URL ảnh đại diện',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL ảnh bìa',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Tên người dùng)',
            nip05Placeholder: 'tên@domain.com',
            websiteLabel: 'Trang web',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Địa chỉ Lightning (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: 'Lưu thay đổi',
            savingButton: 'Đang lưu...'
        },
        messagingRelays: {
            description: 'Cấu hình các relay nhắn tin NIP-17 của bạn. Các relay này được sử dụng để nhận tin nhắn mã hóa. Để có hiệu suất tốt nhất, 2 relay nhắn tin thường là lý tưởng.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Thêm',
            emptyState: 'Chưa cấu hình relay',
            tooManyWarning: 'Có nhiều hơn 3 relay nhắn tin có thể giảm hiệu suất và độ tin cậy.',
            saveStatusSuccess: 'Đã lưu danh sách relay đến {count} relay.',
            saveStatusPartial: 'Đã lưu danh sách relay đến {succeeded} trong số {attempted} relay.',
            saveStatusNone: 'Không thể lưu danh sách relay đến bất kỳ relay nào.',
            saveStatusError: 'Lỗi khi lưu danh sách relay. Cài đặt của bạn có thể chưa được phổ biến đầy đủ.',
            savingStatus: 'Đang lưu cài đặt relay…'
        },
        mediaServers: {
            description: 'Cấu hình các máy chủ media Blossom của bạn. Các máy chủ này được sử dụng để lưu trữ tệp bạn tải lên (media hồ sơ và tệp đính kèm trò chuyện).',
            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Thêm',
            emptyState: 'Chưa cấu hình máy chủ',
            saveStatusSuccess: 'Đã lưu danh sách máy chủ đến {count} relay.',
            saveStatusPartial: 'Đã lưu danh sách máy chủ đến {succeeded} trong số {attempted} relay.',
            saveStatusNone: 'Không thể lưu danh sách máy chủ đến bất kỳ relay nào.',
            saveStatusError: 'Lỗi khi lưu danh sách máy chủ. Cài đặt của bạn có thể chưa được phổ biến đầy đủ.',
            savingStatus: 'Đang lưu cài đặt máy chủ media…',
            primary: 'Chính',
            setAsPrimary: 'Đặt làm chính',
            mediaCacheLabel: 'Bộ nhớ đệm media',
            mediaCacheDescription: 'Lưu media đã xem vào thư viện để truy cập ngoại tuyến. Tệp có thể được quản lý trong ứng dụng Ảnh.'
        },
        security: {
            loginMethodTitle: 'Phương thức đăng nhập',
            loginMethodUnknown: 'Không rõ',
            npubLabel: 'npub của bạn',
            nsecLabel: 'nsec của bạn',
            hideNsecAria: 'Ẩn nsec',
            showNsecAria: 'Hiện nsec',
            dangerZoneTitle: 'Vùng nguy hiểm',
            dangerZoneDescription: 'Đăng xuất sẽ xóa tất cả dữ liệu đã lưu cache khỏi thiết bị này.',
            logoutButton: 'Đăng xuất'
        },
        pin: {
            appLockLabel: 'Khóa ứng dụng',
            appLockDescription: 'Yêu cầu mã PIN để truy cập ứng dụng',
            changePinButton: 'Đổi mã PIN',
            enterNewPin: 'Đặt mã PIN',
            enterNewPinDescription: 'Nhập mã PIN 4 chữ số',
            confirmPin: 'Xác nhận mã PIN',
            confirmPinDescription: 'Nhập lại mã PIN',
            enterCurrentPin: 'Nhập mã PIN',
            enterCurrentPinDescription: 'Nhập mã PIN hiện tại của bạn',
            wrongPin: 'Sai mã PIN',
            pinMismatch: 'Mã PIN không khớp, vui lòng thử lại',
            enterPinToUnlock: 'Nhập mã PIN để mở khóa'
        }
    },
    signerMismatch: {
        title: 'Tài khoản không khớp',
        description: 'Tiện ích ký trên trình duyệt của bạn đang hoạt động với tài khoản khác so với tài khoản bạn đã đăng nhập.',
        expectedAccount: 'Đã đăng nhập với',
        actualAccount: 'Tài khoản đang hoạt động trên tiện ích ký',
        instructions: 'Vui lòng chuyển sang tài khoản đúng trong tiện ích ký và tải lại trang.'
    }
};

export default vi;
