const pt = {
    common: {
        appName: 'nospeak',
        save: 'Guardar',
        cancel: 'Cancelar'
    },
    auth: {
        loginWithAmber: 'Entrar com Amber',
        loginWithExtension: 'Entrar com a extensão Nostr Signer',
        orSeparator: 'OU',
        loginWithNsecLabel: 'Entrar com nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Entrar',
        connecting: 'A conectar...',
        generateKeypairLink: 'Gerar novo par de chaves',
        downloadAndroidApp: 'Transferir app Android',
        amber: {
            title: 'Entrar com Amber',
            helper: 'Digitaliza este código QR com o Amber ou usa os botões abaixo.',
            openInAmber: 'Abrir no Amber',
            copyConnectionString: 'Copiar string de ligação',
            copied: 'Copiado!'
        },
        keypair: {
            title: 'Gerar novo par de chaves',
            description: 'Um novo par de chaves Nostr é gerado localmente no seu navegador.',
            npubLabel: 'npub (chave pública)',
            nsecLabel: 'nsec (chave secreta)',
            generateAnother: 'Gerar outro',
            useAndLogin: 'Usar este par de chaves e entrar'
        }
    },
    chats: {
        title: 'Conversas',
        emptyHint: 'Ainda não há conversas. Toque em + para adicionar um contacto.',
        selectPrompt: 'Selecione uma conversa para começar a enviar mensagens',
        addContact: 'Adicionar contacto',
        filterAll: 'Todos',
        filterUnread: 'Não lidos',
        filterGroups: 'Grupos',
        emptyUnread: 'Nenhum chat não lido',
        emptyGroups: 'Nenhum grupo'
    },
    contacts: {
        title: 'Contactos',
        manage: 'Gerir',
        scanQr: 'Ler QR',
        scanQrAria: 'Ler QR de contacto',
        emptyHint: 'Se não aparecerem contactos, clique em Gerir para adicionar alguns.',
        selectPrompt: 'Selecione um contacto para começar a conversar',
        youPrefix: 'Tu',
        mediaPreview: {
            image: 'Imagem',
            video: 'Vídeo',
            voiceMessage: 'Mensagem de voz',
            audio: 'Áudio',
            file: 'Arquivo',
            location: 'Localização'
        }
    },
    connection: {
        relaysLabel: 'Relays:',
        authLabel: 'Auth:',
        authFailedLabel: 'Falhou:'
    },
    sync: {
        title: 'A sincronizar mensagens...',
        fetched: '{count} obtidas',
        errorTitle: 'Sincronização falhou',
        timeoutError: 'Tempo limite excedido após 5 minutos',
        relayErrorsTitle: 'Erros de relay',
        retryButton: 'Tentar novamente',
        skipButton: 'Saltar e continuar',
        continueInBackground: 'Continuar em segundo plano',
        backgroundComplete: 'Sincronização concluída',
        steps: {
            connectDiscoveryRelays: 'Ligar a relays de descoberta',
            fetchMessagingRelays: 'Obter e colocar em cache os relays de mensagens do utilizador',
            connectReadRelays: 'Ligar aos relays de mensagens do utilizador',
            fetchHistory: 'Obter e colocar em cache itens de histórico a partir dos relays',
            fetchContacts: 'Obter e sincronizar contactos a partir dos relays',
            fetchContactProfiles: 'Obter e colocar em cache perfis de contactos e informação de relays',
            fetchUserProfile: 'Obter e colocar em cache o perfil do utilizador'
        }
    },

    modals: {
        manageContacts: {
            title: 'Contactos',
            scanQr: 'Ler QR',
            scanQrAria: 'Ler código QR para adicionar contacto',
            searchPlaceholder: 'npub, NIP-05 ou termo de pesquisa',
            addContactAria: 'Adicionar contacto',
            searchContactsAria: 'Pesquisar contactos',
            searching: 'A pesquisar...',
            searchFailed: 'A pesquisa falhou',
            noResults: 'Sem resultados',
            noContacts: 'Nenhum contacto adicionado',
            removeContactAria: 'Remover contacto',
            resolvingNip05: 'A procurar NIP-05...',
            nip05LookupFailed: 'Falha ao procurar NIP-05',
            nip05NotFound: 'NIP-05 não encontrado',
            nip05InvalidFormat: 'Formato NIP-05 inválido (use nome@dominio.com)',
            alreadyAdded: 'Já adicionado',
            syncing: 'A sincronizar contactos…',
            pullToRefresh: 'Puxe para atualizar',
            releaseToRefresh: 'Solte para atualizar',
            contextMenu: {
                openMenu: 'Abrir menu',
                delete: 'Eliminar'
            },
            confirmDelete: {
                title: 'Eliminar contacto',
                message: 'Tens a certeza que queres eliminar {name}?',
                confirm: 'Eliminar'
            },
            newContact: 'Adicionar contacto',
            createGroup: 'Criar grupo'
        },
        createGroup: {
            title: 'Criar chat de grupo',
            searchPlaceholder: 'Pesquisar contactos',
            selectedCount: '{count} selecionados',
            minContactsHint: 'Selecione pelo menos 2 contactos',
            createButton: 'Criar grupo',
            creating: 'A criar...',
            noContacts: 'Sem contactos para adicionar ao grupo'
        },
        profile: {
            unknownName: 'Desconhecido',
            about: 'Sobre',
            publicKey: 'Chave pública',
            messagingRelays: 'Relays de mensagens',
            noRelays: 'Nenhum',
            refreshing: 'A atualizar perfil…',
            notFound: 'Perfil não encontrado'
        },

        emptyProfile: {
            title: 'Termine a configuração do seu perfil',
            introLine1: 'Esta chave ainda não tem relays de mensagens nem um nome de utilizador configurado.',
            introLine2: 'Vamos configurar alguns relays de mensagens por defeito para que o nospeak possa enviar e receber mensagens. Pode alterá-los mais tarde em Definições → Relays de mensagens.',
            usernameLabel: 'Nome de utilizador',
            usernamePlaceholder: 'O seu nome',
            usernameRequired: 'Introduza um nome de utilizador para continuar.',
            saveError: 'Não foi possível guardar a configuração inicial. Tente novamente.',
            doLater: 'Farei isto mais tarde',
            saving: 'A guardar...',
            continue: 'Continuar',
            autoRelaysConfigured: 'Relays de mensagens configurados. Pode alterá-los em Definições.'
        },
        relayStatus: {
            title: 'Ligações a relays',
            noRelays: 'Nenhum relay configurado',
            connected: 'Ligado',
            disconnected: 'Desligado',
            typeLabel: 'Tipo:',
            lastConnectedLabel: 'Última ligação:',
            successLabel: 'Sucesso:',
            failureLabel: 'Falhas:',
            authLabel: 'Auth:',
            authErrorLabel: 'Erro de auth:',
            authNotRequired: 'Não requerido',
            authRequired: 'Requerido',
            authAuthenticating: 'A autenticar',
            authAuthenticated: 'Autenticado',
            authFailed: 'Falhou',
            typePersistent: 'Persistente',
            typeTemporary: 'Temporário',
            never: 'Nunca'
        },
        qr: {
            title: 'Código QR',
            tabs: {
                myQr: 'Meu código',
                scanQr: 'Ler código'
            }
        },
        userQr: {
            preparing: 'A preparar código QR…',
            hint: 'Este é o seu npub como código QR. Partilhe-o com alguém para que possa lê-lo e adicioná-lo como contacto.'
        },
        scanContactQr: {
            title: 'Ler QR de contacto',
            instructions: 'Aponte a sua câmara para um código QR nostr para adicionar um contacto.',
            scanning: 'A ler…',
            noCamera: 'A câmara não está disponível neste dispositivo.',
            invalidQr: 'Este código QR não contém um npub de contacto válido.',
            addFailed: 'Não foi possível adicionar o contacto a partir deste QR. Tente novamente.',
            added: 'Contacto adicionado a partir do QR.'
        },
        scanContactQrResult: {
            title: 'Contato do QR',
            alreadyContact: 'Este contato já está nos seus contatos.',
            reviewHint: 'Revise o contato do QR escaneado antes de adicionar.',
            updatingProfile: 'Atualizando perfil…',
            loadFailed: 'Falha ao carregar detalhes do contato do QR.',
            addFailed: 'Falha ao adicionar contato do QR.',
            closeButton: 'Fechar',
            addButton: 'Adicionar contato',
            startChatButton: 'Iniciar conversa'
        },
        attachmentPreview: {
            title: 'Pré-visualização do anexo',
            imageAlt: 'Pré-visualização do anexo',
            noPreview: 'Nenhuma pré-visualização disponível',
            captionLabel: 'Legenda (opcional)',
            cancelButton: 'Cancelar',
            sendButtonIdle: 'Enviar',
            sendButtonSending: 'A enviar…',
            uploadButtonIdle: 'Enviar',
            uploadButtonUploading: 'A enviar…'
        },
        locationPreview: {
            title: 'Localização',
            closeButton: 'Fechar',
            openInOpenStreetMap: 'Abrir no OpenStreetMap',
            ctrlScrollToZoom: 'Use Ctrl + scroll para dar zoom'
        },
        mediaServersAutoConfigured: {
            title: 'Servidores de media configurados',
            message: 'Não estavam configurados servidores Blossom. Adicionámos {server1} e {server2}.\n\nPode alterar isto em Definições → Servidores de media.'
        }
    },
    chat: {
        sendFailedTitle: 'Falha ao enviar',
        sendFailedMessagePrefix: 'Falha ao enviar a mensagem: ',
        location: {
            errorTitle: 'Erro de localização',
            errorMessage: 'Não foi possível obter a sua localização. Verifique as permissões.'
        },
        relative: {
            justNow: 'agora mesmo',
            minutes: 'há {count} min',
            minutesPlural: 'há {count} min',
            hours: 'há {count} hora',
            hoursPlural: 'há {count} horas',
            days: 'há {count} dia',
            daysPlural: 'há {count} dias',
            weeks: 'há {count} semana',
            weeksPlural: 'há {count} semanas',
            months: 'há {count} mês',
            monthsPlural: 'há {count} meses',
            years: 'há {count} ano',
            yearsPlural: 'há {count} anos'
        },
        dateLabel: {
            today: 'Hoje',
            yesterday: 'Ontem'
        },
        history: {
            fetchOlder: 'Obter mensagens antigas a partir dos relays',
            summary: 'Obtidos {events} eventos, guardadas {saved} novas mensagens ({chat} nesta conversa)',
            none: 'Não há mais mensagens disponíveis a partir dos relays',
            error: 'Falha ao obter mensagens antigas. Tente novamente mais tarde.'
        },
        empty: {
            noMessagesTitle: 'Ainda não há mensagens',
            forContact: 'Inicie a conversa com {name}.',
            forGroup: 'Inicie a conversa em {name}.',
            generic: 'Selecione um contacto para começar a conversar.'
        },
        group: {
            defaultTitle: 'Chat de grupo',
            participants: '{count} participantes',
            participantsShort: '{count}',
            members: 'Membros: {count}',
            membersTitle: 'Membros',
            viewMembers: 'Ver membros',
            editName: 'Editar nome do grupo',
            editNameTitle: 'Nome do grupo',
            editNamePlaceholder: 'Digite o nome do grupo...',
            editNameHint: 'Deixe vazio para usar nomes dos participantes',
            editNameSave: 'Salvar',
            editNameCancel: 'Cancelar',
            nameSavedToast: 'Salvo. Será definido na próxima mensagem.',
            nameValidationTooLong: 'Nome muito longo (máx. 100 caracteres)',
            nameValidationInvalidChars: 'O nome contém caracteres inválidos'
        },
        inputPlaceholder: 'Escreva uma mensagem...',
        contextMenu: {
            cite: 'Citar',
            copy: 'Copiar',
            sentAt: 'Enviado',
            favorite: 'Favorito',
            unfavorite: 'Remover favorito'
        },
        reactions: {
            cannotReactTitle: 'Não é possível reagir',
            cannotReactMessage: 'Esta mensagem é demasiado antiga para suportar reações.',
            failedTitle: 'Falha na reação',
            failedMessagePrefix: 'Falha ao enviar a reação: '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Enviar media',
            takePhoto: 'Tirar foto',
            location: 'Localização',
            image: 'Imagem',
            video: 'Vídeo',
            audio: 'Música',
            file: 'Arquivo'
        },
        mediaErrors: {
            cameraErrorTitle: 'Erro da câmara',
            cameraErrorMessage: 'Falha ao capturar a foto'
        },
        fileUpload: {
            fileTooLarge: 'O arquivo é muito grande. O tamanho máximo é 10 MB.',
            download: 'Baixar',
            decrypting: 'Descriptografando...'
        },
        mediaUnavailable: 'Este media já não está disponível.',
        voiceMessage: {
            title: 'Mensagem de voz',
            recordAria: 'Gravar mensagem de voz',
            playPreviewAria: 'Reproduzir pré-visualização',
            pausePreviewAria: 'Pausar pré-visualização',
            cancelButton: 'Cancelar',
            pauseButton: 'Pausar',
            doneButton: 'Concluir',
            resumeButton: 'Retomar',
            sendButton: 'Enviar',
            microphoneTitle: 'Microfone',
            permissionDeniedTitle: 'Permissão do microfone',
            permissionDeniedMessage: 'Permita o acesso ao microfone para gravar.',
            nativeNotAvailable: 'A gravação nativa não está disponível.',
            unsupported: 'A gravação de voz não é suportada neste dispositivo.',
            failedToStart: 'Não foi possível iniciar a gravação.',
            failedToStop: 'Não foi possível parar a gravação.',
            recordingFailed: 'A gravação falhou.'
        },
        relayStatus: {
            sending: 'a enviar...',
            sentToRelays: 'enviado para {successful}/{desired} relays'
        },
        searchPlaceholder: 'Pesquisar',
        searchNoMatches: 'Sem correspondências',
        searchAriaLabel: 'Pesquisar na conversa'
    },
    settings: {
        title: 'Definições',
        categories: {
            general: 'Geral',
            profile: 'Perfil',
            messagingRelays: 'Relays de mensagens',
            mediaServers: 'Servidores de media',
            security: 'Segurança',
            about: 'Sobre'
        },

        general: {
            appearanceLabel: 'Aparência',
            appearanceDescription: 'Escolha se deve seguir o modo do sistema, claro ou escuro.',
            languageLabel: 'Idioma',
            languageDescription: 'Escolha o idioma preferido da aplicação.'
        },
        notifications: {
            label: 'Notificações',
            supportedDescription: 'Receba notificações quando chegar uma nova mensagem neste dispositivo',
            unsupportedDescription: 'As notificações não são suportadas neste dispositivo'
        },
        backgroundMessaging: {
            label: 'Mensagens em segundo plano',
            description: 'Mantenha o nospeak ligado aos seus relays de mensagens e receba notificações de mensagens/reações enquanto a aplicação está em segundo plano. O Android mostrará uma notificação persistente quando isto estiver ativado. Funciona tanto com chave local (nsec) como com logins do Amber. As pré-visualizações de notificações podem ser limitadas pelas definições de privacidade do ecrã de bloqueio do Android.',
            openBatterySettings: 'Abrir definições da bateria'
        },
        urlPreviews: {
            label: 'Pré-visualizações de URL',
            description: 'Mostrar cartões de pré-visualização para links não media nas mensagens.'
        },
        profile: {
            nameLabel: 'Nome',
            namePlaceholder: 'O seu nome',
            displayNameLabel: 'Nome a mostrar',
            displayNamePlaceholder: 'Nome a mostrar',
            aboutLabel: 'Sobre',
            aboutPlaceholder: 'Fale-nos sobre si',
            pictureUrlLabel: 'URL da imagem',
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL do banner',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: 'NIP-05 (Nome de utilizador)',
            nip05Placeholder: 'nome@dominio.com',
            websiteLabel: 'Website',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Endereço Lightning (LUD-16)',
            lightningPlaceholder: 'utilizador@fornecedor.com',
            saveButton: 'Guardar alterações',
            savingButton: 'A guardar...'
        },
        messagingRelays: {
            description: 'Configure os seus relays de mensagens NIP-17. Estes relays são usados para receber as suas mensagens encriptadas. Para melhor desempenho, normalmente 2–3 relays de mensagens funcionam melhor.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Adicionar',
            emptyState: 'Nenhum relay configurado',
            tooManyWarning: 'Ter mais de 3 relays de mensagens pode reduzir o desempenho e a fiabilidade.',
            saveStatusSuccess: 'Lista de relays guardada em {count} relays.',
            saveStatusPartial: 'Lista de relays guardada em {succeeded} de {attempted} relays.',
            saveStatusNone: 'Não foi possível guardar a lista de relays em nenhum relay.',
            saveStatusError: 'Erro ao guardar a lista de relays. As suas definições podem não ser totalmente propagadas.',
            savingStatus: 'A guardar definições de relays…'
        },

        mediaServers: {
            description: 'Configure os seus servidores de media Blossom. Estes servidores são usados para armazenar ficheiros que envia (media do perfil e anexos da conversa).',

            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Adicionar',
            emptyState: 'Nenhum servidor configurado',
            saveStatusSuccess: 'Lista de servidores guardada em {count} relays.',
            saveStatusPartial: 'Lista de servidores guardada em {succeeded} de {attempted} relays.',
            saveStatusNone: 'Não foi possível guardar a lista de servidores em nenhum relay.',
            saveStatusError: 'Erro ao guardar a lista de servidores. As suas definições podem não ser totalmente propagadas.',
            savingStatus: 'A guardar definições de servidores de media…',
            primary: 'Principal',
            setAsPrimary: 'Definir como principal',
            mediaCacheLabel: 'Cache de media',
            mediaCacheDescription: 'Guarde os media visualizados na sua galeria para acesso offline. Os ficheiros podem ser geridos na sua app Fotos.'
        },

        security: {
            loginMethodTitle: 'Método de início de sessão',
            loginMethodUnknown: 'Desconhecido',
            npubLabel: 'O seu npub',
            nsecLabel: 'O seu nsec',
            hideNsecAria: 'Ocultar nsec',
            showNsecAria: 'Mostrar nsec',
            dangerZoneTitle: 'Zona de perigo',
            dangerZoneDescription: 'Terminar sessão irá remover todos os dados em cache deste dispositivo.',
            logoutButton: 'Terminar sessão'
        }
    },
    signerMismatch: {
        title: 'Conta não corresponde',
        description: 'A extensão do assinante do navegador tem uma conta diferente ativa daquela com que iniciou sessão.',
        expectedAccount: 'Conectado como',
        actualAccount: 'Conta ativa do assinante',
        instructions: 'Por favor, mude para a conta correta na sua extensão de assinante e recarregue esta página.'
    }
};

export default pt;
