CREATE TABLE users (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_bidx                     BYTEA NOT NULL,
    email_enc                      BYTEA NOT NULL,

    srp_salt                       BYTEA NOT NULL,
    srp_verifier                   BYTEA NOT NULL,

    public_key                     BYTEA NOT NULL,
    encrypted_private_key          BYTEA NOT NULL,
    recovery_encrypted_private_key BYTEA NOT NULL,
    kdf_salt                       BYTEA NOT NULL,
    mk_sealed                      BYTEA NOT NULL,

    key_epoch                      INT  NOT NULL DEFAULT 0,
    rotation_required              BOOLEAN NOT NULL DEFAULT false,

    purge_after                    TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_bidx  ON users (email_bidx);
CREATE INDEX users_purge_after ON users (purge_after) WHERE purge_after IS NOT NULL;

CREATE TABLE folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  UUID,
    name_enc   BYTEA NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    CONSTRAINT folders_parent_same_owner
        FOREIGN KEY (parent_id, user_id) REFERENCES folders(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_folders_user    ON folders (user_id);
CREATE INDEX idx_folders_parent  ON folders (parent_id);
CREATE INDEX idx_folders_expires ON folders (expires_at) WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION folders_prevent_cycle() RETURNS trigger AS $$
DECLARE cur UUID := NEW.parent_id;
BEGIN
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'folder % cannot be its own ancestor', NEW.id;
    END IF;
    SELECT parent_id INTO cur FROM folders WHERE id = cur;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_folders_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON folders
  FOR EACH ROW EXECUTE FUNCTION folders_prevent_cycle();

CREATE TABLE files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id    UUID,

    meta_enc     BYTEA  NOT NULL,
    stored_name  TEXT   NOT NULL,

    size_bytes   BIGINT NOT NULL,

    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    CONSTRAINT files_folder_same_owner
        FOREIGN KEY (folder_id, user_id) REFERENCES folders(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_files_user    ON files (user_id);
CREATE INDEX idx_files_folder  ON files (folder_id);
CREATE INDEX idx_files_expires ON files (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE user_blobs (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    blob       BYTEA NOT NULL,
    revision   INT  NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind)
);

CREATE TABLE shares (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id     UUID,
    folder_id   UUID,
    shared_with UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    meta_sealed BYTEA,
    recipient_label BYTEA,
    sharer_label BYTEA,
    expires_at  TIMESTAMPTZ,
    permission  TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view','save')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shares_one_resource CHECK (
        (file_id IS NOT NULL)::int + (folder_id IS NOT NULL)::int = 1
    ),
    CONSTRAINT shares_no_self_share CHECK (owner_id <> shared_with),
    CONSTRAINT shares_file_same_owner
        FOREIGN KEY (file_id, owner_id)   REFERENCES files(id, user_id)   ON DELETE CASCADE,
    CONSTRAINT shares_folder_same_owner
        FOREIGN KEY (folder_id, owner_id) REFERENCES folders(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_shares_owner       ON shares (owner_id);
CREATE INDEX idx_shares_shared_with ON shares (shared_with);
CREATE UNIQUE INDEX uq_shares_file_user   ON shares (file_id, shared_with)   WHERE file_id   IS NOT NULL;
CREATE UNIQUE INDEX uq_shares_folder_user ON shares (folder_id, shared_with) WHERE folder_id IS NOT NULL;

CREATE TABLE file_keys (
    file_id     UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wrapped_dek BYTEA NOT NULL,
    meta_sealed BYTEA,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (file_id, user_id)
);
CREATE INDEX idx_file_keys_user ON file_keys (user_id);

CREATE TABLE ai_processing_requests (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id                UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    wrapped_dek_for_server BYTEA,
    purpose                TEXT NOT NULL CHECK (purpose IN ('summary','embed','classify','keywords')),
    consumed               BOOLEAN NOT NULL DEFAULT false,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at             TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_apr_expires   ON ai_processing_requests (expires_at);
CREATE INDEX idx_apr_user_file ON ai_processing_requests (user_id, file_id);

CREATE TABLE ai_preferences (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    auto_file_mode  TEXT    NOT NULL DEFAULT 'off' CHECK (auto_file_mode IN ('off','type','smart')),
    analysis        BOOLEAN NOT NULL DEFAULT false,
    semantic_search BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE file_embeddings (
    file_id       UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    embedding_enc BYTEA NOT NULL,
    source        TEXT  NOT NULL CHECK (source IN ('text','image')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE file_keywords (
    file_id      UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    keywords_enc BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE token_sessions (
    jti        TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_epoch  INT  NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_token_sessions_expires ON token_sessions (expires_at);

CREATE TABLE login_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','consumed','expired')),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    transfer_pk BYTEA,
    sealed_sk   BYTEA,
    token       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_login_requests_expires ON login_requests (expires_at);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    type       TEXT NOT NULL,
    file_id    UUID REFERENCES files(id)            ON DELETE CASCADE,
    folder_id  UUID REFERENCES folders(id)          ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
