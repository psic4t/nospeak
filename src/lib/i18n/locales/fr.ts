const fr = {
    common: {
        appName: 'nospeak',
        save: 'Enregistrer',
        cancel: 'Annuler'
    },
    auth: {
        loginWithAmber: 'Se connecter avec Amber',
        loginWithExtension: "Se connecter avec l’extension Nostr Signer",
        orSeparator: 'OU',
        loginWithNsecLabel: 'Se connecter avec nsec',
        nsecPlaceholder: 'nsec1...',
        loginButton: 'Se connecter',
        connecting: 'Connexion...',
        generateKeypairLink: 'Générer une nouvelle paire de clés',
        downloadAndroidApp: "Télécharger l’application Android",
        amber: {
            title: 'Se connecter avec Amber',
            helper: 'Scannez ce code QR avec Amber ou utilisez les boutons ci-dessous.',
            openInAmber: 'Ouvrir dans Amber',
            copyConnectionString: 'Copier la chaîne de connexion',
            copied: 'Copié !'
        },
        keypair: {
            title: 'Générer une nouvelle paire de clés',
            description: 'Une nouvelle paire de clés Nostr est générée localement dans votre navigateur.',
            npubLabel: 'npub (clé publique)',
            nsecLabel: 'nsec (clé secrète)',
            generateAnother: 'En générer une autre',
            useAndLogin: 'Utiliser cette paire de clés et se connecter'
        }
    },
    chats: {
        title: 'Discussions',
        emptyHint: 'Aucune discussion pour le moment. Appuyez sur + pour ajouter un contact.',
        selectPrompt: 'Sélectionnez une discussion pour commencer à envoyer des messages',
        addContact: 'Ajouter un contact',
        filterAll: 'Tous',
        filterUnread: 'Non lus',
        filterGroups: 'Groupes',
        emptyUnread: 'Aucun chat non lu',
        emptyGroups: 'Aucun groupe',
        archive: 'Archiver',
        unarchive: 'Désarchiver',
        archived: 'Archivés',
        emptyArchive: 'Aucune discussion archivée'
    },
    contacts: {
        title: 'Contacts',
        manage: 'Gérer',
        scanQr: 'Scanner QR',
        scanQrAria: 'Scanner le QR du contact',
        emptyHint: "Si aucun contact n'apparaît, cliquez sur Gérer pour en ajouter.",
        selectPrompt: 'Sélectionnez un contact pour commencer à discuter',
        youPrefix: 'Vous',
        mediaPreview: {
            image: 'Image',
            video: 'Vidéo',
            voiceMessage: 'Message vocal',
            audio: 'Audio',
            file: 'Fichier',
            location: 'Position'
        }
    },
    connection: {
        relaysLabel: 'Relays :',
        authLabel: 'Auth :',
        authFailedLabel: 'Échec :'
    },
    sync: {
        title: 'Synchronisation des messages...',
        fetched: '{count} récupérés',
        errorTitle: 'Synchronisation échouée',
        timeoutError: 'Délai dépassé après 5 minutes',
        relayErrorsTitle: 'Erreurs de relays',
        retryButton: 'Réessayer',
        skipButton: 'Ignorer et continuer',
        continueInBackground: 'Continuer en arrière-plan',
        backgroundComplete: 'Synchronisation terminée',
        steps: {
            connectDiscoveryRelays: 'Se connecter aux relays de découverte',
            fetchMessagingRelays: "Récupérer et mettre en cache les relays de messagerie de l'utilisateur",
            connectReadRelays: "Se connecter aux relays de messagerie de l'utilisateur",
            fetchHistory: "Récupérer et mettre en cache l'historique depuis les relays",
            fetchContacts: 'Récupérer et fusionner les contacts depuis les relays',
            fetchContactProfiles: 'Récupérer et mettre en cache les profils de contacts et infos de relays',
            fetchUserProfile: "Récupérer et mettre en cache le profil de l'utilisateur"
        }
    },

    modals: {
        manageContacts: {
            title: 'Contacts',
            scanQr: 'Scanner QR',
            scanQrAria: 'Scanner le code QR pour ajouter un contact',
            searchPlaceholder: 'npub, NIP-05, ou terme de recherche',
            addContactAria: 'Ajouter un contact',
            searchContactsAria: 'Rechercher des contacts',
            searching: 'Recherche...',
            searchFailed: 'Échec de la recherche',
            noResults: 'Aucun résultat',
            noContacts: 'Aucun contact ajouté',
            removeContactAria: 'Supprimer le contact',
            resolvingNip05: 'Recherche de NIP-05...',
            nip05LookupFailed: 'Impossible de rechercher le NIP-05',
            nip05NotFound: 'NIP-05 introuvable',
            nip05InvalidFormat: 'Format NIP-05 invalide (utilisez nom@domaine.com)',
            alreadyAdded: 'Déjà ajouté',
            syncing: 'Synchronisation des contacts…',
            pullToRefresh: 'Tirez pour actualiser',
            releaseToRefresh: 'Relâchez pour actualiser',
            contextMenu: {
                openMenu: 'Ouvrir le menu',
                delete: 'Supprimer'
            },
            confirmDelete: {
                title: 'Supprimer le contact',
                message: 'Voulez-vous vraiment supprimer {name} ?',
                confirm: 'Supprimer'
            },
            newContact: 'Ajouter un contact',
            createGroup: 'Créer un groupe'
        },
        createGroup: {
            title: 'Créer une discussion de groupe',
            searchPlaceholder: 'Rechercher des contacts',
            selectedCount: '{count} sélectionnés',
            minContactsHint: 'Sélectionnez au moins 2 contacts',
            createButton: 'Créer le groupe',
            creating: 'Création…',
            noContacts: 'Aucun contact à ajouter au groupe'
        },
        profile: {
            unknownName: 'Inconnu',
            about: 'À propos',
            publicKey: 'Clé publique',
            messagingRelays: 'Relays de messagerie',
            noRelays: 'Aucun',
            refreshing: 'Actualisation du profil…',
            notFound: 'Profil introuvable',
            addToContacts: 'Ajouter aux contacts',
            addingContact: 'Ajout en cours…',
            contactAdded: 'Contact ajouté'
        },

        emptyProfile: {
            title: 'Terminez la configuration de votre profil',
            introLine1: 'Cette clé n’a pas encore de relays de messagerie ni de nom d’utilisateur configurés.',
            introLine2: 'Nous allons configurer des relays de messagerie par défaut pour que nospeak puisse envoyer et recevoir des messages. Vous pourrez les modifier plus tard dans Paramètres → Relays de messagerie.',
            usernameLabel: "Nom d’utilisateur",
            usernamePlaceholder: 'Votre nom',
            usernameRequired: "Veuillez saisir un nom d’utilisateur pour continuer.",
            saveError: "Impossible d’enregistrer votre configuration initiale. Veuillez réessayer.",
            doLater: 'Je le ferai plus tard',
            saving: 'Enregistrement...',
            continue: 'Continuer',
            autoRelaysConfigured: 'Relays de messagerie configurés. Vous pouvez les modifier dans Paramètres.'
        },
        relayStatus: {
            title: 'Connexions aux relays',
            noRelays: 'Aucun relay configuré',
            connected: 'Connecté',
            disconnected: 'Déconnecté',
            typeLabel: 'Type :',
            lastConnectedLabel: 'Dernière connexion :',
            successLabel: 'Succès :',
            failureLabel: 'Échecs :',
            authLabel: 'Auth :',
            authErrorLabel: "Erreur d’auth :",
            authNotRequired: 'Non requis',
            authRequired: 'Requis',
            authAuthenticating: 'Authentification',
            authAuthenticated: 'Authentifié',
            authFailed: 'Échec',
            typePersistent: 'Persistant',
            typeTemporary: 'Temporaire',
            never: 'Jamais'
        },
        qr: {
            title: 'Code QR',
            tabs: {
                myQr: 'Mon code',
                scanQr: 'Scanner code'
            }
        },
        userQr: {
            preparing: 'Préparation du code QR…',
            hint: 'Ceci est votre npub sous forme de code QR. Partagez-le avec quelqu\'un pour qu\'il puisse le scanner et vous ajouter comme contact.'
        },
        scanContactQr: {
            title: 'Scanner le QR du contact',
            instructions: 'Pointez votre caméra vers un QR nostr pour ajouter un contact.',
            scanning: 'Scan…',
            noCamera: "La caméra n'est pas disponible sur cet appareil.",
            invalidQr: 'Ce code QR ne contient pas un npub de contact valide.',
            addFailed: "Impossible d'ajouter le contact depuis ce QR. Veuillez réessayer.",
            added: 'Contact ajouté depuis le QR.'
        },
        scanContactQrResult: {
            title: 'Contact depuis QR',
            alreadyContact: 'Ce contact est déjà dans vos contacts.',
            reviewHint: "Vérifiez le contact du QR scanné avant de l'ajouter.",
            updatingProfile: 'Mise à jour du profil…',
            loadFailed: 'Échec du chargement des détails du contact depuis le QR.',
            addFailed: "Échec de l'ajout du contact depuis le QR.",
            closeButton: 'Fermer',
            addButton: 'Ajouter le contact',
            startChatButton: 'Démarrer le chat'
        },
        attachmentPreview: {
            title: 'Aperçu de la pièce jointe',
            imageAlt: 'Aperçu de la pièce jointe',
            noPreview: 'Aucun aperçu disponible',
            captionLabel: 'Légende (facultatif)',
            cancelButton: 'Annuler',
            sendButtonIdle: 'Envoyer',
            sendButtonSending: 'Envoi…',
            uploadButtonIdle: 'Téléverser',
            uploadButtonUploading: 'Téléversement…'
        },
        locationPreview: {
            title: 'Localisation',
            closeButton: 'Fermer',
            openInOpenStreetMap: 'Ouvrir dans OpenStreetMap',
            ctrlScrollToZoom: 'Utilisez Ctrl + molette pour zoomer'
        },
        mediaServersAutoConfigured: {
            title: 'Serveurs médias configurés',
            message: 'Aucun serveur Blossom n’était configuré. Nous avons ajouté {server1} et {server2}.\n\nVous pouvez modifier cela dans Paramètres → Serveurs médias.'
        }
    },
    chat: {
        sendFailedTitle: "Échec de l’envoi",
        sendFailedMessagePrefix: "Impossible d’envoyer le message : ",
        location: {
            errorTitle: 'Erreur de localisation',
            errorMessage: "Impossible d’obtenir votre localisation. Veuillez vérifier les autorisations."
        },
        relative: {
            justNow: "à l’instant",
            minutes: 'il y a {count} min',
            minutesPlural: 'il y a {count} min',
            hours: 'il y a {count} heure',
            hoursPlural: 'il y a {count} heures',
            days: 'il y a {count} jour',
            daysPlural: 'il y a {count} jours',
            weeks: 'il y a {count} semaine',
            weeksPlural: 'il y a {count} semaines',
            months: 'il y a {count} mois',
            monthsPlural: 'il y a {count} mois',
            years: 'il y a {count} an',
            yearsPlural: 'il y a {count} ans'
        },
        dateLabel: {
            today: "Aujourd’hui",
            yesterday: 'Hier'
        },
        history: {
            fetchOlder: 'Récupérer des messages plus anciens depuis les relays',
            summary: '{events} événements récupérés, {saved} nouveaux messages enregistrés ({chat} dans cette conversation)',
            none: 'Plus aucun message disponible depuis les relays',
            error: 'Échec de la récupération des anciens messages. Réessayez plus tard.'
        },
        empty: {
            noMessagesTitle: 'Aucun message pour le moment',
            forContact: 'Commencez la conversation avec {name}.',
            forGroup: 'Commencez la conversation dans {name}.',
            generic: 'Sélectionnez un contact pour commencer à discuter.'
        },
        group: {
            defaultTitle: 'Discussion de groupe',
            participants: '{count} participants',
            participantsShort: '{count}',
            members: 'Membres : {count}',
            membersTitle: 'Membres',
            viewMembers: 'Voir les membres',
            editName: 'Modifier le nom du groupe',
            editNameTitle: 'Nom du groupe',
            editNamePlaceholder: 'Entrez le nom du groupe...',
            editNameHint: 'Laisser vide pour utiliser les noms des participants',
            editNameSave: 'Enregistrer',
            editNameCancel: 'Annuler',
            nameSavedToast: 'Enregistré. Sera défini avec le prochain message.',
            nameValidationTooLong: 'Nom trop long (max. 100 caractères)',
            nameValidationInvalidChars: 'Le nom contient des caractères invalides'
        },
        inputPlaceholder: 'Écrire un message...',
        contextMenu: {
            cite: 'Citer',
            copy: 'Copier',
            sentAt: 'Envoyé',
            favorite: 'Favori',
            unfavorite: 'Retirer le favori'
        },
        reactions: {
            cannotReactTitle: 'Impossible de réagir',
            cannotReactMessage: 'Ce message est trop ancien pour supporter les réactions.',
            failedTitle: 'Échec de la réaction',
            failedMessagePrefix: 'Impossible d’envoyer la réaction : '
        },
        mediaMenu: {
            uploadMediaTooltip: 'Téléverser un média',
            takePhoto: 'Prendre une photo',
            location: 'Localisation',
            image: 'Image',
            video: 'Vidéo',
            audio: 'Musique',
            file: 'Fichier'
        },
        mediaErrors: {
            cameraErrorTitle: 'Erreur de caméra',
            cameraErrorMessage: 'Impossible de prendre la photo'
        },
        fileUpload: {
            fileTooLarge: 'Le fichier est trop volumineux. La taille maximale est de 10 Mo.',
            download: 'Télécharger',
            decrypting: 'Déchiffrement...'
        },
        mediaUnavailable: "Ce média n'est plus disponible.",
        voiceMessage: {
            title: 'Message vocal',
            recordAria: 'Enregistrer un message vocal',
            playPreviewAria: 'Lire l’aperçu',
            pausePreviewAria: 'Mettre en pause l’aperçu',
            cancelButton: 'Annuler',
            pauseButton: 'Pause',
            doneButton: 'Terminé',
            resumeButton: 'Reprendre',
            sendButton: 'Envoyer',
            microphoneTitle: 'Microphone',
            permissionDeniedTitle: 'Autorisation micro',
            permissionDeniedMessage: 'Veuillez autoriser l’accès au microphone pour enregistrer.',
            nativeNotAvailable: 'L’enregistrement natif n’est pas disponible.',
            unsupported: 'L’enregistrement vocal n’est pas pris en charge sur cet appareil.',
            failedToStart: 'Impossible de démarrer l’enregistrement.',
            failedToStop: 'Impossible d’arrêter l’enregistrement.',
            recordingFailed: 'Échec de l’enregistrement.'
        },
        relayStatus: {
            sending: 'envoi...',
            sentToRelays: 'envoyé à {successful}/{desired} relays'
        },
        searchPlaceholder: 'Rechercher',
        searchNoMatches: 'Aucune correspondance',
        searchAriaLabel: 'Rechercher dans la conversation'
    },
    settings: {
        title: 'Paramètres',
        categories: {
            general: 'Général',
            profile: 'Profil',
            messagingRelays: 'Relays de messagerie',
            mediaServers: 'Serveurs médias',
            security: 'Sécurité',
            about: 'À propos'
        },

        general: {
            appearanceLabel: 'Apparence',
            appearanceDescription: 'Choisissez de suivre le mode Système, Clair ou Sombre.',
            languageLabel: 'Langue',
            languageDescription: "Choisissez la langue de l’application."
        },
        notifications: {
            label: 'Notifications',
            supportedDescription: 'Recevez une notification quand vous recevez de nouveaux messages sur cet appareil',
            unsupportedDescription: "Les notifications ne sont pas prises en charge sur cet appareil"
        },
        backgroundMessaging: {
            label: 'Messagerie en arrière-plan',
            description: "Gardez nospeak connecté à vos relays de messagerie et recevez des notifications de message/réaction lorsque l’application est en arrière-plan. Android affichera une notification persistante lorsque cette option est activée. Fonctionne avec les connexions par clé locale (nsec) et Amber. Les aperçus de notifications peuvent être limités par les paramètres de confidentialité de l’écran de verrouillage Android.",
            openBatterySettings: 'Ouvrir les paramètres de batterie'
        },
        urlPreviews: {
            label: "Aperçus d’URL",
            description: 'Afficher des cartes d’aperçu pour les liens non-médias dans les messages.'
        },
        profile: {
            nameLabel: 'Nom',
            namePlaceholder: 'Votre nom',
            displayNameLabel: "Nom d’affichage",
            displayNamePlaceholder: "Nom d’affichage",
            aboutLabel: 'À propos',
            aboutPlaceholder: 'Parlez-nous de vous',
            pictureUrlLabel: "URL de l’image",
            pictureUrlPlaceholder: 'https://example.com/avatar.jpg',
            bannerUrlLabel: 'URL de la bannière',
            bannerUrlPlaceholder: 'https://example.com/banner.jpg',
            nip05Label: "NIP-05 (Nom d’utilisateur)",
            nip05Placeholder: 'nom@domaine.com',
            websiteLabel: 'Site web',
            websitePlaceholder: 'https://example.com',
            lightningLabel: 'Adresse Lightning (LUD-16)',
            lightningPlaceholder: 'utilisateur@fournisseur.com',
            saveButton: 'Enregistrer les modifications',
            savingButton: 'Enregistrement...'
        },
        messagingRelays: {
            description: 'Configurez vos relays de messagerie NIP-17. Ces relays sont utilisés pour recevoir vos messages chiffrés. Pour de meilleures performances, 2–3 relays de messagerie fonctionnent généralement le mieux.',
            inputPlaceholder: 'wss://relay.example.com',
            addButton: 'Ajouter',
            emptyState: 'Aucun relay configuré',
            tooManyWarning: 'Avoir plus de 3 relays de messagerie peut réduire les performances et la fiabilité.',
            saveStatusSuccess: 'Liste de relays enregistrée sur {count} relays.',
            saveStatusPartial: 'Liste de relays enregistrée sur {succeeded} relays sur {attempted}.',
            saveStatusNone: "Impossible d’enregistrer la liste de relays sur un relay.",
            saveStatusError: 'Erreur lors de l’enregistrement de la liste de relays. Vos paramètres peuvent ne pas être entièrement propagés.',
            savingStatus: 'Enregistrement des paramètres des relays…'
        },

        mediaServers: {
            description: 'Configurez vos serveurs médias Blossom. Ces serveurs sont utilisés pour stocker les fichiers que vous téléversez (médias de profil et pièces jointes).',

            inputPlaceholder: 'https://cdn.example.com',
            addButton: 'Ajouter',
            emptyState: 'Aucun serveur configuré',
            saveStatusSuccess: 'Liste des serveurs enregistrée sur {count} relays.',
            saveStatusPartial: 'Liste des serveurs enregistrée sur {succeeded} relays sur {attempted}.',
            saveStatusNone: "Impossible d'enregistrer la liste des serveurs sur un relay.",
            saveStatusError: "Erreur lors de l'enregistrement de la liste des serveurs. Vos paramètres peuvent ne pas être entièrement propagés.",
            savingStatus: 'Enregistrement des paramètres des serveurs médias…',
            primary: 'Principal',
            setAsPrimary: 'Définir comme principal',
            mediaCacheLabel: 'Cache média',
            mediaCacheDescription: 'Enregistrez les médias consultés dans votre galerie pour un accès hors ligne. Les fichiers peuvent être gérés dans votre application Photos.'
        },

        security: {
            loginMethodTitle: 'Méthode de connexion',
            loginMethodUnknown: 'Inconnu',
            npubLabel: 'Votre npub',
            nsecLabel: 'Votre nsec',
            hideNsecAria: 'Masquer nsec',
            showNsecAria: 'Afficher nsec',
            dangerZoneTitle: 'Zone de danger',
            dangerZoneDescription: "Se déconnecter supprimera toutes les données en cache de cet appareil.",
            logoutButton: 'Se déconnecter'
        }
    },
    signerMismatch: {
        title: 'Compte non correspondant',
        description: "Votre extension de signature a un compte différent actif de celui avec lequel vous vous êtes connecté.",
        expectedAccount: 'Connecté en tant que',
        actualAccount: 'Compte actif du signataire',
        instructions: 'Veuillez passer au bon compte dans votre extension de signature et recharger cette page.'
    }
};

export default fr;
