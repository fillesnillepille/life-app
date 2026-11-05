# Keep this version in sync with scripts/setup-pocketbase.ps1, and read the release notes before changing it: PocketBase is pre-1.0.
FROM alpine:3.22 AS download
ARG PB_VERSION=0.40.6
WORKDIR /dl
RUN apk add --no-cache unzip \
 && ZIP="pocketbase_${PB_VERSION}_linux_amd64.zip" \
 && BASE="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}" \
 && wget -q "$BASE/$ZIP" "$BASE/checksums.txt" \
 && grep " \*\?$ZIP\$" checksums.txt | sha256sum -c - \
 && unzip "$ZIP" pocketbase

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=download /dl/pocketbase /usr/local/bin/pocketbase
COPY pocketbase/pb_migrations /pb/pb_migrations
EXPOSE 8090
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
