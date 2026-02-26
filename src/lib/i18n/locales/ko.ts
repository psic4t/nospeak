const ko = {
    common: {
        appName: 'nospeak',
        save: '저장',
        cancel: '취소'
    },
    auth: {
        loginWithAmber: 'Amber로 로그인',
        loginWithExtension: 'Nostr 서명 확장 프로그램으로 로그인',
        orSeparator: '또는',
        loginWithNsecLabel: 'nsec로 로그인',
        nsecPlaceholder: 'nsec1...',
        loginButton: '로그인',
        connecting: '연결 중...',
        generateKeypairLink: '새 키 쌍 생성',
        downloadAndroidApp: 'Android 앱 다운로드',
        amber: {
            title: 'Amber로 로그인',
            helper: 'Amber로 이 QR 코드를 스캔하거나 아래 버튼을 사용하세요.',
            openInAmber: 'Amber에서 열기',
            copyConnectionString: '연결 문자열 복사',
            copied: '복사됨!'
        },
        keypair: {
            title: '새 키 쌍 생성',
            description: '새 Nostr 키 쌍이 브라우저에서 로컬로 생성됩니다.',
            npubLabel: 'npub (공개 키)',
            nsecLabel: 'nsec (비밀 키)',
            generateAnother: '다른 키 쌍 생성',
            useAndLogin: '이 키 쌍을 사용하여 로그인'
        }
    },
    chats: {
        title: '채팅',
        emptyHint: '아직 채팅이 없습니다. +를 눌러 연락처를 추가하세요.',
        selectPrompt: '메시지를 시작하려면 채팅을 선택하세요',
        addContact: '연락처 추가',
        filterAll: '전체',
        filterUnread: '읽지 않음',
        filterGroups: '그룹',
        emptyUnread: '읽지 않은 채팅이 없습니다',
        emptyGroups: '그룹이 없습니다',
        favorites: '즐겨찾기',
        favoriteMessage: '메시지',
        favoriteMessages: '메시지',
        emptyFavorites: '즐겨찾기한 메시지가 아직 없습니다',
        export: '내보내기',
        archive: '보관',
        unarchive: '보관 해제',
        archived: '보관됨',
        emptyArchive: '보관된 채팅이 없습니다',
        chatArchived: '채팅이 보관되었습니다'
    },
    contacts: {
        title: '연락처',
        manage: '관리',
        scanQr: 'QR 스캔',
        scanQrAria: '연락처 QR 코드 스캔',
        emptyHint: '연락처가 표시되지 않으면 관리를 클릭하여 추가하세요.',
        selectPrompt: '채팅을 시작하려면 연락처를 선택하세요',
        youPrefix: '나',
        mediaPreview: {
            image: '이미지',
            video: '동영상',
            voiceMessage: '음성 메시지',
            audio: '오디오',
            file: '파일',
            location: '위치'
        }
    },
    connection: {
        relaysLabel: '릴레이:',
        authLabel: '인증:',
        authFailedLabel: '실패:'
    },
    sync: {
        title: '메시지 동기화 중...',
        fetched: '{count}개 가져옴',
        errorTitle: '동기화 실패',
        timeoutError: '5분 후 동기화 시간이 초과되었습니다',
        relayErrorsTitle: '릴레이 오류',
        retryButton: '재시도',
        skipButton: '건너뛰고 계속',
        continueInBackground: '백그라운드에서 계속',
        backgroundComplete: '동기화 완료',
        manualRelay: {
            label: '또는 릴레이를 수동으로 입력',
            placeholder: 'ws://192.168.1.50:7777',
            connectButton: '연결',
            connecting: '연결 중...',
            invalidUrl: '잘못된 릴레이 URL'
        },
        steps: {
            connectDiscoveryRelays: '검색 릴레이에 연결',
            fetchMessagingRelays: '사용자의 메시징 릴레이 가져오기 및 캐시',
            connectReadRelays: '사용자의 메시징 릴레이에 연결',
            fetchHistory: '릴레이에서 기록 항목 가져오기 및 캐시',
            fetchContacts: '릴레이에서 연락처 가져오기 및 병합',
            fetchContactProfiles: '연락처 프로필 및 릴레이 정보 가져오기 및 캐시',
            fetchUserProfile: '사용자 프로필 가져오기 및 캐시'
        }
    },

         modals: {
          manageContacts: {
              title: '연락처',
              scanQr: 'QR 스캔',
              scanQrAria: 'QR 코드를 스캔하여 연락처 추가',
              searchPlaceholder: 'npub, NIP-05 또는 검색어',
              addContactAria: '연락처 추가',
              searchContactsAria: '연락처 검색',
              searching: '검색 중...',
              searchFailed: '검색 실패',
              noResults: '결과 없음',
              noContacts: '추가된 연락처가 없습니다',
              removeContactAria: '연락처 제거',
              resolvingNip05: 'NIP-05 조회 중...',
              nip05LookupFailed: 'NIP-05 조회 실패',
              nip05NotFound: 'NIP-05를 찾을 수 없습니다',
              nip05InvalidFormat: '잘못된 NIP-05 형식입니다 (name@domain.com 형식을 사용하세요)',
              alreadyAdded: '이미 추가됨',
              syncing: '연락처 동기화 중…',
              pullToRefresh: '당겨서 새로고침',
              releaseToRefresh: '놓아서 새로고침',
              newContact: '연락처 추가',
              createGroup: '그룹 만들기',
              contextMenu: {
                  openMenu: '메뉴 열기',
                  viewProfile: '프로필 보기',
                  delete: '삭제'
              },
              confirmDelete: {
                  title: '연락처 삭제',
                  message: '{name}을(를) 삭제하시겠습니까?',
                  confirm: '삭제'
              }
          },
          createGroup: {
              title: '그룹 채팅 만들기',
              searchPlaceholder: '연락처 검색',
              selectedCount: '{count}명 선택됨',
              minContactsHint: '최소 2명의 연락처를 선택하세요',
              createButton: '그룹 만들기',
              creating: '만드는 중...',
              noContacts: '그룹에 추가할 연락처가 없습니다'
          },
         profile: {
              unknownName: '알 수 없음',
              about: '소개',
              publicKey: '공개 키',
              messagingRelays: '메시징 릴레이',
              noRelays: '없음',
              refreshing: '프로필 새로고침 중…',
              notFound: '프로필을 찾을 수 없습니다',
              addToContacts: '연락처에 추가',
              addingContact: '추가 중…',
              contactAdded: '연락처가 추가되었습니다'
          },

        emptyProfile: {
            title: '프로필 설정 완료하기',
            introLine1: '이 키에는 아직 메시징 릴레이나 사용자 이름이 설정되어 있지 않습니다.',
            introLine2: 'nospeak가 메시지를 보내고 받을 수 있도록 기본 메시징 릴레이를 설정합니다. 나중에 설정의 메시징 릴레이에서 변경할 수 있습니다.',
            usernameLabel: '사용자 이름',
            usernamePlaceholder: '이름',
            usernameRequired: '계속하려면 사용자 이름을 입력하세요.',
            saveError: '초기 설정을 저장할 수 없습니다. 다시 시도해 주세요.',
            doLater: '나중에 할게요',
            saving: '저장 중...',
            continue: '계속',
            autoRelaysConfigured: '메시징 릴레이가 설정되었습니다. 설정에서 변경할 수 있습니다.'
        },
        relayStatus: {
            title: '릴레이 연결',
            noRelays: '설정된 릴레이가 없습니다',
            connected: '연결됨',
            disconnected: '연결 끊김',
            typeLabel: '유형:',
            lastConnectedLabel: '마지막 연결:',
            successLabel: '성공:',
            failureLabel: '실패:',
            authLabel: '인증:',
            authErrorLabel: '인증 오류:',
            authNotRequired: '불필요',
            authRequired: '필요',
            authAuthenticating: '인증 중',
            authAuthenticated: '인증됨',
            authFailed: '실패',
            typePersistent: '영구',
            typeTemporary: '임시',
            never: '없음'
        },
        qr: {
            title: 'QR 코드',
            tabs: {
                myQr: '내 코드',
                scanQr: '코드 스캔'
            }
        },
        userQr: {
            preparing: 'QR 코드 준비 중…',
            hint: '이것은 QR 코드로 된 당신의 npub입니다. 다른 사람과 공유하면 스캔하여 연락처로 추가할 수 있습니다.'
        },
        scanContactQr: {
            title: '연락처 QR 스캔',
            instructions: '카메라를 Nostr QR 코드에 맞추어 연락처를 추가하세요.',
            scanning: '스캔 중…',
            noCamera: '이 기기에서는 카메라를 사용할 수 없습니다.',
            invalidQr: '이 QR 코드에는 유효한 연락처 npub가 포함되어 있지 않습니다.',
            addFailed: '이 QR에서 연락처를 추가할 수 없습니다. 다시 시도해 주세요.',
            added: 'QR에서 연락처가 추가되었습니다.'
        },
        scanContactQrResult: {
            title: 'QR의 연락처',
            alreadyContact: '이 연락처는 이미 연락처 목록에 있습니다.',
            reviewHint: '추가하기 전에 스캔한 QR의 연락처를 확인하세요.',
            updatingProfile: '프로필 업데이트 중…',
            loadFailed: 'QR에서 연락처 세부 정보를 불러오지 못했습니다.',
            addFailed: 'QR에서 연락처를 추가하지 못했습니다.',
            closeButton: '닫기',
            addButton: '연락처 추가',
            startChatButton: '채팅 시작'
        },
        attachmentPreview: {
            title: '첨부파일 미리보기',
            imageAlt: '첨부파일 미리보기',
            noPreview: '미리보기를 사용할 수 없습니다',
            captionLabel: '캡션 (선택 사항)',
            cancelButton: '취소',
            sendButtonIdle: '보내기',
            sendButtonSending: '보내는 중…',
            uploadButtonIdle: '업로드',
            uploadButtonUploading: '업로드 중…'
        },
        locationPreview: {
            title: '위치',
            closeButton: '닫기',
            openInOpenStreetMap: 'OpenStreetMap에서 열기',
            ctrlScrollToZoom: 'Ctrl + 스크롤로 확대/축소'
        },
        mediaServersAutoConfigured: {
            title: '미디어 서버가 설정되었습니다',
            message: 'Blossom 서버가 설정되어 있지 않았습니다. {server1}과(와) {server2}을(를) 추가했습니다.\n\n설정 → 미디어 서버에서 변경할 수 있습니다.'
        }
    },
    chat: {
        sendFailedTitle: '전송 실패',
        sendFailedMessagePrefix: '메시지 전송 실패: ',
        location: {
            errorTitle: '위치 오류',
            errorMessage: '위치를 가져오지 못했습니다. 권한을 확인해 주세요.'
        },
        relative: {
            justNow: '방금',
            minutes: '{count}분 전',
            minutesPlural: '{count}분 전',
            hours: '{count}시간 전',
            hoursPlural: '{count}시간 전',
            days: '{count}일 전',
            daysPlural: '{count}일 전',
            weeks: '{count}주 전',
            weeksPlural: '{count}주 전',
            months: '{count}개월 전',
            monthsPlural: '{count}개월 전',
            years: '{count}년 전',
            yearsPlural: '{count}년 전'
        },
        dateLabel: {
            today: '오늘',
            yesterday: '어제'
        },
        history: {
            fetchOlder: '릴레이에서 이전 메시지 가져오기',
            summary: '{events}개 이벤트를 가져와 {saved}개의 새 메시지를 저장했습니다 (이 채팅에서 {chat}개)',
            none: '릴레이에서 더 이상 사용 가능한 메시지가 없습니다',
            error: '이전 메시지를 가져오지 못했습니다. 나중에 다시 시도해 주세요.'
        },
        empty: {
            noMessagesTitle: '아직 메시지가 없습니다',
            forContact: '{name}님과 대화를 시작하세요.',
            forGroup: '{name}에서 대화를 시작하세요.',
            generic: '채팅을 시작하려면 연락처를 선택하세요.'
        },
        group: {
            defaultTitle: '그룹 채팅',
            participants: '참여자 {count}명',
            participantsShort: '{count}',
            members: '멤버: {count}',
            membersTitle: '멤버',
            viewMembers: '멤버 보기',
            editName: '그룹 이름 편집',
            editNameTitle: '그룹 이름',
            editNamePlaceholder: '그룹 이름 입력...',
            editNameHint: '비워두면 참여자 이름을 사용합니다',
            editNameSave: '저장',
            editNameCancel: '취소',
            nameSavedToast: '저장됨. 다음 메시지와 함께 설정됩니다.',
            nameValidationTooLong: '이름이 너무 깁니다 (최대 100자)',
            nameValidationInvalidChars: '이름에 잘못된 문자가 포함되어 있습니다'
        },
        inputPlaceholder: '메시지를 입력하세요...',
        contextMenu: {
            cite: '인용',
            copy: '복사',
            sentAt: '전송됨',
            favorite: '즐겨찾기',
            unfavorite: '즐겨찾기 해제'
        },
        reactions: {
            cannotReactTitle: '반응할 수 없음',
            cannotReactMessage: '이 메시지는 너무 오래되어 반응을 지원하지 않습니다.',
            failedTitle: '반응 실패',
            failedMessagePrefix: '반응 전송 실패: '
        },
        mediaMenu: {
            uploadMediaTooltip: '미디어 업로드',
            takePhoto: '사진 촬영',
            location: '위치',
            image: '이미지',
            video: '동영상',
            audio: '음악',
            file: '파일'
        },
        mediaErrors: {
            cameraErrorTitle: '카메라 오류',
            cameraErrorMessage: '사진을 촬영하지 못했습니다'
        },
        fileUpload: {
            fileTooLarge: '파일이 너무 큽니다. 최대 크기는 10 MB입니다.',
            download: '다운로드',
            decrypting: '복호화 중...'
        },
        mediaUnavailable: '이 미디어는 더 이상 사용할 수 없습니다.',
        voiceMessage: {
            title: '음성 메시지',
            recordAria: '음성 메시지 녹음',
            playPreviewAria: '미리듣기 재생',
            pausePreviewAria: '미리듣기 일시정지',
            cancelButton: '취소',
            pauseButton: '일시정지',
            doneButton: '완료',
            resumeButton: '재개',
            sendButton: '보내기',
            microphoneTitle: '마이크',
            permissionDeniedTitle: '마이크 권한',
            permissionDeniedMessage: '녹음하려면 마이크 접근을 허용해 주세요.',
            nativeNotAvailable: '네이티브 녹음을 사용할 수 없습니다.',
            unsupported: '이 기기에서는 음성 녹음이 지원되지 않습니다.',
            failedToStart: '녹음을 시작하지 못했습니다.',
            failedToStop: '녹음을 중지하지 못했습니다.',
            recordingFailed: '녹음에 실패했습니다.'
        },
        relayStatus: {
            sending: '전송 중...',
            sentToRelays: '{successful}/{desired} 릴레이에 전송됨'
        },
        searchPlaceholder: '검색',
        searchNoMatches: '일치 항목 없음',
        searchAriaLabel: '채팅 검색'
    },
    settings: {
          title: '설정',
          categories: {
              general: '일반',
              profile: '프로필',
               messagingRelays: '메시징 릴레이',
               mediaServers: '미디어 서버',
               security: '보안',
               about: '정보'
          },

        general: {
            appearanceLabel: '외관',
            appearanceDescription:
                '시스템, 라이트 또는 다크 모드를 선택하세요.',
            languageLabel: '언어',
            languageDescription: '원하는 앱 언어를 선택하세요.'
        },
        notifications: {
            label: '알림',
            supportedDescription:
                '이 기기에서 새 메시지를 받을 때 알림을 받습니다',
            unsupportedDescription:
                '이 기기에서는 알림이 지원되지 않습니다'
        },
        backgroundMessaging: {
            label: '백그라운드 메시징',
            description:
                'nospeak를 메시징 릴레이에 연결된 상태로 유지하고 앱이 백그라운드에 있는 동안 메시지/반응 알림을 받습니다. 이 기능이 활성화되면 Android에서 지속적인 알림이 표시됩니다. 로컬 키(nsec) 및 Amber 로그인 모두에서 작동합니다. 알림 미리보기는 Android 잠금 화면 개인정보 설정에 따라 제한될 수 있습니다.',
            openBatterySettings: '배터리 설정 열기'
        },
        urlPreviews: {
            label: 'URL 미리보기',
            description:
                '메시지의 비미디어 링크에 대해 미리보기 카드를 표시합니다.'
        },
        profile: {
            nameLabel: '이름',
            namePlaceholder: '이름',
            displayNameLabel: '표시 이름',
            displayNamePlaceholder: '표시 이름',
            aboutLabel: '소개',
            aboutPlaceholder: '자기소개를 해주세요',
            pictureUrlLabel: '프로필 사진 URL',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: '배너 URL',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (사용자 이름)',
            nip05Placeholder: 'name@domain.com',
            websiteLabel: '웹사이트',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Lightning 주소 (LUD-16)',
            lightningPlaceholder: 'user@provider.com',
            saveButton: '변경 사항 저장',
            savingButton: '저장 중...'
        },
          messagingRelays: {
              description: 'NIP-17 메시징 릴레이를 설정합니다. 이 릴레이는 암호화된 메시지를 수신하는 데 사용됩니다. 최적의 성능을 위해 일반적으로 2개의 메시징 릴레이가 가장 적합합니다.',
              inputPlaceholder: 'wss://relay.example.com',
              addButton: '추가',
              emptyState: '설정된 릴레이가 없습니다',
              tooManyWarning: '3개 이상의 메시징 릴레이를 사용하면 성능과 안정성이 저하될 수 있습니다.',
              saveStatusSuccess: '{count}개의 릴레이에 릴레이 목록을 저장했습니다.',
              saveStatusPartial: '{attempted}개 중 {succeeded}개의 릴레이에 릴레이 목록을 저장했습니다.',
              saveStatusNone: '어떤 릴레이에도 릴레이 목록을 저장할 수 없습니다.',
              saveStatusError: '릴레이 목록 저장 중 오류가 발생했습니다. 설정이 완전히 전파되지 않았을 수 있습니다.',
              savingStatus: '릴레이 설정 저장 중…'
          },

           mediaServers: {
               description: 'Blossom 미디어 서버를 설정합니다. 이 서버는 업로드한 파일(프로필 미디어 및 채팅 첨부파일)을 저장하는 데 사용됩니다.',

               inputPlaceholder: 'https://cdn.example.com',
               addButton: '추가',
               emptyState: '설정된 서버가 없습니다',
               saveStatusSuccess: '{count}개의 릴레이에 서버 목록을 저장했습니다.',
               saveStatusPartial: '{attempted}개 중 {succeeded}개의 릴레이에 서버 목록을 저장했습니다.',
               saveStatusNone: '어떤 릴레이에도 서버 목록을 저장할 수 없습니다.',
               saveStatusError: '서버 목록 저장 중 오류가 발생했습니다. 설정이 완전히 전파되지 않았을 수 있습니다.',
               savingStatus: '미디어 서버 설정 저장 중…',
               primary: '기본',
               setAsPrimary: '기본으로 설정',
               mediaCacheLabel: '미디어 캐시',
               mediaCacheDescription: '오프라인 접근을 위해 본 미디어를 갤러리에 저장합니다. 파일은 사진 앱에서 관리할 수 있습니다.'
           },


           security: {
            loginMethodTitle: '로그인 방법',
            loginMethodUnknown: '알 수 없음',
            npubLabel: '내 npub',
            nsecLabel: '내 nsec',
            hideNsecAria: 'nsec 숨기기',
            showNsecAria: 'nsec 표시',
            dangerZoneTitle: '위험 구역',
            dangerZoneDescription: '로그아웃하면 이 기기의 모든 캐시 데이터가 삭제됩니다.',
            logoutButton: '로그아웃'
        },
        pin: {
            appLockLabel: '앱 잠금',
            appLockDescription: '앱에 접근할 때 PIN을 요구합니다',
            changePinButton: 'PIN 변경',
            enterNewPin: 'PIN 설정',
            enterNewPinDescription: '4자리 PIN을 입력하세요',
            confirmPin: 'PIN 확인',
            confirmPinDescription: '같은 PIN을 다시 입력하세요',
            enterCurrentPin: 'PIN 입력',
            enterCurrentPinDescription: '현재 PIN을 입력하세요',
            wrongPin: '잘못된 PIN',
            pinMismatch: 'PIN이 일치하지 않습니다. 다시 시도하세요',
            enterPinToUnlock: 'PIN을 입력하여 잠금 해제'
        }
    },
    signerMismatch: {
        title: '계정 불일치',
        description: '브라우저 서명 확장 프로그램에 로그인한 계정과 다른 계정이 활성화되어 있습니다.',
        expectedAccount: '로그인된 계정',
        actualAccount: '서명자 활성 계정',
        instructions: '서명 확장 프로그램에서 올바른 계정으로 전환하고 이 페이지를 새로고침해 주세요.'
    }
};

export default ko;
